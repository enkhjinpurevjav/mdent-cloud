import express from "express";
import prisma from "../db.js";
import {
  computePaidTotal,
  applyPaymentToInvoice,
} from "../services/settlementService.js";
import { sseBroadcast } from "./appointments.js";

const router = express.Router();

const DEFAULT_PAGE_SIZE = 20;
const MIN_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const PAYMENT_STATUS_VALUES = new Set(["all", "paid", "partial", "unpaid", "overpaid"]);
const EBARIMT_STATUS_VALUES = new Set(["all", "issued", "not_issued"]);

function parseDateOnlyStart(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const dt = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseDateOnlyEndExclusive(value) {
  const start = parseDateOnlyStart(value);
  if (!start) return null;
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function normalizeMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function derivePaymentStatus(totalAmount, paidAmount) {
  const total = normalizeMoney(totalAmount);
  const paid = normalizeMoney(paidAmount);
  const epsilon = 0.01;

  if (paid <= 0) return "unpaid";
  if (paid + epsilon < total) return "partial";
  if (Math.abs(paid - total) <= epsilon) return "paid";
  return "overpaid";
}

function formatMethodLabel(method) {
  if (!method) return "-";
  const normalized = String(method).trim().toUpperCase();
  if (normalized === "QPAY") return "QPay";
  if (normalized === "POS") return "POS";
  if (normalized === "CASH") return "Cash";
  if (normalized === "WALLET") return "Wallet";
  if (normalized === "TRANSFER") return "Transfer";
  if (normalized === "INSURANCE") return "Insurance";
  if (normalized === "APPLICATION") return "Application";
  return normalized;
}

export function buildPaymentMethodSummary(payments = []) {
  const byMethod = new Map();
  for (const p of payments) {
    const key = String(p.method || "").trim().toUpperCase();
    if (!key) continue;
    const prev = byMethod.get(key) || { method: key, amount: 0, count: 0 };
    prev.amount = normalizeMoney(prev.amount + Number(p.amount || 0));
    prev.count += 1;
    byMethod.set(key, prev);
  }

  const methods = Array.from(byMethod.values()).sort((a, b) => b.amount - a.amount);
  const methodLabels = methods.map((m) => formatMethodLabel(m.method));
  const label = methodLabels.length <= 1 ? (methodLabels[0] || "-") : `Mixed (${methodLabels.join("/")})`;

  return {
    methods,
    label,
    hasWallet: methods.some((m) => m.method === "WALLET"),
  };
}

function resolvePatient(invoice) {
  return (
    invoice.patient ||
    invoice.encounter?.patientBook?.patient || {
      id: null,
      name: null,
      ovog: null,
      phone: null,
      regNo: null,
    }
  );
}

function buildInvoiceFinanceRow(invoice) {
  const total = normalizeMoney(
    invoice.finalAmount != null ? Number(invoice.finalAmount) : Number(invoice.totalAmount || 0)
  );
  const paid = normalizeMoney(computePaidTotal(invoice.payments || []));
  const remaining = normalizeMoney(total - paid);
  const status = derivePaymentStatus(total, paid);
  const paymentSummary = buildPaymentMethodSummary(invoice.payments || []);
  const patient = resolvePatient(invoice);
  const lastPaymentAt = (invoice.payments || []).reduce((latest, p) => {
    const current = p?.timestamp ? new Date(p.timestamp) : null;
    if (!current || Number.isNaN(current.getTime())) return latest;
    if (!latest) return current;
    return current > latest ? current : latest;
  }, null);

  return {
    id: invoice.id,
    encounterId: invoice.encounterId,
    createdAt: invoice.createdAt,
    patient: {
      id: patient.id ?? null,
      name: patient.name ?? null,
      ovog: patient.ovog ?? null,
      phone: patient.phone ?? null,
      regNo: patient.regNo ?? null,
    },
    doctor: invoice.encounter?.doctor
      ? {
          id: invoice.encounter.doctor.id,
          name: invoice.encounter.doctor.name ?? null,
          ovog: invoice.encounter.doctor.ovog ?? null,
        }
      : null,
    branch: invoice.branch
      ? {
          id: invoice.branch.id,
          name: invoice.branch.name,
        }
      : null,
    total,
    paid,
    remaining,
    status,
    paymentMethods: paymentSummary.methods,
    paymentMethodsLabel: paymentSummary.label,
    hasWalletUsage: paymentSummary.hasWallet,
    lastPaymentAt: lastPaymentAt ? lastPaymentAt.toISOString() : null,
    ebarimt: {
      issued: !!invoice.eBarimtReceipt,
      status: invoice.eBarimtReceipt?.status || null,
      receiptNumber:
        invoice.eBarimtReceipt?.ddtd ||
        invoice.eBarimtReceipt?.printedAtText ||
        null,
    },
  };
}

async function getPatientBalanceSummary(trx, patientId) {
  const invoices = await trx.invoice.findMany({
    where: { patientId },
    select: {
      id: true,
      finalAmount: true,
      totalAmount: true,
    },
  });

  if (invoices.length === 0) {
    return { totalBilled: 0, totalPaid: 0, totalAdjusted: 0, balance: 0 };
  }

  const invoiceIds = invoices.map((inv) => inv.id);
  const paymentAgg = await trx.payment.aggregate({
    where: { invoiceId: { in: invoiceIds } },
    _sum: { amount: true },
  });
  const adjustmentAgg = await trx.balanceAdjustmentLog.aggregate({
    where: { patientId },
    _sum: { amount: true },
  });

  let totalBilled = 0;
  for (const inv of invoices) {
    totalBilled += inv.finalAmount != null
      ? Number(inv.finalAmount)
      : Number(inv.totalAmount || 0);
  }
  const totalPaid = Number(paymentAgg._sum.amount || 0);
  const totalAdjusted = Number(adjustmentAgg._sum.amount || 0);
  const balance = Number((totalBilled - totalPaid - totalAdjusted).toFixed(2));

  return { totalBilled, totalPaid, totalAdjusted, balance };
}

function buildWalletDeductionReason(invoice, meta) {
  const metaNote = meta && typeof meta.note === "string" ? meta.note.trim() : "";
  const parts = [
    `Wallet settlement`,
    `invoiceId=${invoice.id}`,
    `encounterId=${invoice.encounterId ?? "null"}`,
  ];
  if (metaNote) {
    parts.push(`note=${metaNote}`);
  }
  return parts.join("; ");
}

function availableWalletFromPatientBalance(patientBalance) {
  return patientBalance < 0 ? Math.abs(patientBalance) : 0;
}

export async function applyWalletSettlement(
  trx,
  {
    invoice,
    payAmount,
    methodStr,
    meta = null,
    createdByUserId = null,
    applyPaymentFn = applyPaymentToInvoice,
  }
) {
  if (!invoice?.patientId) {
    throw new Error("Patient мэдээлэл олдсонгүй.");
  }
  if (!createdByUserId) {
    throw new Error("Төлбөр бүртгэж буй хэрэглэгчийн мэдээлэл олдсонгүй.");
  }

  const balanceSummary = await getPatientBalanceSummary(trx, invoice.patientId);
  // balanceSummary.balance < 0 means prepaid/overpaid credit that can be consumed as wallet.
  const availableWallet = availableWalletFromPatientBalance(balanceSummary.balance);

  if (availableWallet < payAmount) {
    throw new Error(
      `Хэтэвчийн үлдэгдэл хүрэлцэхгүй байна. Боломжит: ${availableWallet}₮, Шаардлагатай: ${payAmount}₮`
    );
  }

  await trx.balanceAdjustmentLog.create({
    data: {
      patientId: invoice.patientId,
      // Wallet deduction is stored as negative adjustment to consume prepaid wallet credit.
      amount: -payAmount,
      reason: buildWalletDeductionReason(invoice, meta),
      createdById: createdByUserId,
    },
  });

  return applyPaymentFn(trx, {
    invoice,
    payAmount,
    methodStr,
    meta,
    createdByUserId,
  });
}

router.get("/", async (req, res) => {
  try {
    const fromDate = parseDateOnlyStart(req.query.from);
    const toDateExclusive = parseDateOnlyEndExclusive(req.query.to);
    if (!fromDate || !toDateExclusive) {
      return res.status(400).json({
        error: "from, to query parameters are required in YYYY-MM-DD format.",
      });
    }

    const page = Math.max(Number(req.query.page || 1), 1);
    const rawPageSize = Number(req.query.pageSize || DEFAULT_PAGE_SIZE);
    const pageSize = Math.min(Math.max(rawPageSize, MIN_PAGE_SIZE), MAX_PAGE_SIZE);
    const branchId = req.query.branchId ? Number(req.query.branchId) : null;
    const doctorId = req.query.doctorId ? Number(req.query.doctorId) : null;
    const invoiceId = req.query.invoiceId ? Number(req.query.invoiceId) : null;
    const patientSearch =
      typeof req.query.patientSearch === "string"
        ? req.query.patientSearch.trim()
        : "";
    const paymentStatusRaw =
      typeof req.query.paymentStatus === "string"
        ? req.query.paymentStatus.trim().toLowerCase()
        : "all";
    const ebarimtStatusRaw =
      typeof req.query.ebarimtStatus === "string"
        ? req.query.ebarimtStatus.trim().toLowerCase()
        : "all";

    const paymentStatus = PAYMENT_STATUS_VALUES.has(paymentStatusRaw)
      ? paymentStatusRaw
      : "all";
    const ebarimtStatus = EBARIMT_STATUS_VALUES.has(ebarimtStatusRaw)
      ? ebarimtStatusRaw
      : "all";

    const where = {
      createdAt: { gte: fromDate, lt: toDateExclusive },
    };

    if (branchId && !Number.isNaN(branchId)) {
      where.branchId = branchId;
    }
    if (invoiceId && !Number.isNaN(invoiceId)) {
      where.id = invoiceId;
    }
    if (doctorId && !Number.isNaN(doctorId)) {
      where.encounter = { is: { doctorId } };
    }
    if (patientSearch) {
      where.OR = [
        { patient: { is: { name: { contains: patientSearch, mode: "insensitive" } } } },
        { patient: { is: { ovog: { contains: patientSearch, mode: "insensitive" } } } },
        { patient: { is: { phone: { contains: patientSearch, mode: "insensitive" } } } },
        { patient: { is: { regNo: { contains: patientSearch, mode: "insensitive" } } } },
      ];
    }
    if (ebarimtStatus === "issued") {
      where.eBarimtReceipt = { isNot: null };
    } else if (ebarimtStatus === "not_issued") {
      where.eBarimtReceipt = { is: null };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        branch: { select: { id: true, name: true } },
        patient: {
          select: { id: true, name: true, ovog: true, phone: true, regNo: true },
        },
        encounter: {
          include: {
            doctor: { select: { id: true, name: true, ovog: true } },
            patientBook: {
              include: {
                patient: {
                  select: { id: true, name: true, ovog: true, phone: true, regNo: true },
                },
              },
            },
          },
        },
        eBarimtReceipt: { select: { status: true, ddtd: true, printedAtText: true } },
        payments: {
          select: { id: true, amount: true, method: true, timestamp: true },
          orderBy: { timestamp: "desc" },
        },
      },
    });

    let rows = invoices.map(buildInvoiceFinanceRow);
    if (paymentStatus !== "all") {
      rows = rows.filter((row) => row.status === paymentStatus);
    }

    const summary = rows.reduce(
      (acc, row) => {
        acc.totalBilled = normalizeMoney(acc.totalBilled + row.total);
        acc.totalCollected = normalizeMoney(acc.totalCollected + row.paid);
        if (row.remaining > 0) {
          acc.totalUnpaid = normalizeMoney(acc.totalUnpaid + row.remaining);
        } else if (row.remaining < 0) {
          acc.overpayments = normalizeMoney(acc.overpayments + Math.abs(row.remaining));
        }
        return acc;
      },
      { totalBilled: 0, totalCollected: 0, totalUnpaid: 0, overpayments: 0 }
    );

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const items = rows.slice(start, start + pageSize);

    return res.json({
      page,
      pageSize,
      total,
      summary,
      items,
    });
  } catch (err) {
    console.error("GET /api/invoices error:", err);
    return res.status(500).json({ error: "Failed to fetch invoices." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    if (!invoiceId || Number.isNaN(invoiceId)) {
      return res.status(400).json({ error: "Invalid invoice id." });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        branch: { select: { id: true, name: true } },
        patient: {
          select: { id: true, name: true, ovog: true, phone: true, regNo: true },
        },
        encounter: {
          include: {
            doctor: { select: { id: true, name: true, ovog: true } },
            patientBook: {
              include: {
                patient: {
                  select: { id: true, name: true, ovog: true, phone: true, regNo: true },
                },
              },
            },
          },
        },
        items: { orderBy: { id: "asc" } },
        payments: {
          include: {
            createdBy: { select: { id: true, name: true, ovog: true } },
          },
          orderBy: { timestamp: "desc" },
        },
        eBarimtReceipt: {
          select: {
            id: true,
            status: true,
            ddtd: true,
            printedAtText: true,
            printedAt: true,
            totalAmount: true,
            qrData: true,
            lottery: true,
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    const row = buildInvoiceFinanceRow(invoice);
    return res.json({
      ...row,
      ebarimtReceipt: invoice.eBarimtReceipt
        ? {
            id: invoice.eBarimtReceipt.id,
            status: invoice.eBarimtReceipt.status,
            ddtd: invoice.eBarimtReceipt.ddtd ?? null,
            printedAtText: invoice.eBarimtReceipt.printedAtText ?? null,
            printedAt: invoice.eBarimtReceipt.printedAt
              ? invoice.eBarimtReceipt.printedAt.toISOString()
              : null,
            totalAmount: invoice.eBarimtReceipt.totalAmount ?? null,
            qrData: invoice.eBarimtReceipt.qrData ?? null,
            lottery: invoice.eBarimtReceipt.lottery ?? null,
          }
        : null,
      items: invoice.items.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        serviceId: item.serviceId,
        productId: item.productId,
        name: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
      payments: invoice.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        timestamp: payment.timestamp,
        qpayTxnId: payment.qpayTxnId,
        reference:
          (payment.meta && typeof payment.meta === "object" && payment.meta.reference) ||
          payment.qpayTxnId ||
          null,
        note:
          payment.meta && typeof payment.meta === "object" && payment.meta.note
            ? String(payment.meta.note)
            : null,
        createdByUser: payment.createdBy
          ? {
              id: payment.createdBy.id,
              name: payment.createdBy.name ?? null,
              ovog: payment.createdBy.ovog ?? null,
            }
          : null,
      })),
    });
  } catch (err) {
    console.error("GET /api/invoices/:id error:", err);
    return res.status(500).json({ error: "Failed to fetch invoice details." });
  }
});

/**
 * POST /api/invoices/:id/settlement
 *
 * Body:
 * {
 *   amount: number;        // required, >0
 *   method: "CASH" | "QPAY" | "POS" | "TRANSFER" | "INSURANCE" | "VOUCHER" | ...,
 *   issueEBarimt?: boolean; // ignored; e-Barimt is always auto-issued on full payment
 *   meta?: { ... }          // optional extra info (employeeCode, voucherCode, etc.)
 * }
 */
router.post("/:id/settlement", async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    if (!invoiceId || Number.isNaN(invoiceId)) {
      return res.status(400).json({ error: "Invalid invoice id" });
    }

    const { amount, method, meta } = req.body || {};

    const payAmount = Number(amount || 0);
    if (!payAmount || payAmount <= 0) {
      return res
        .status(400)
        .json({ error: "amount must be a number greater than zero." });
    }

    if (!method || typeof method !== "string" || !method.trim()) {
      return res
        .status(400)
        .json({ error: "method is required for payment." });
    }
    const methodStr = method.trim().toUpperCase();

    // Load invoice with items, payments, and patient info
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true,
        payments: true,
        eBarimtReceipt: true,
        encounter: {
          include: {
            patientBook: {
              include: { patient: true },
            },
            appointment: true,
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Settlement gating: validate appointment status
    if (invoice.encounter?.appointment) {
      const appointmentStatus = invoice.encounter.appointment.status;
      const allowedStatuses = ["ready_to_pay", "partial_paid"];
      
      if (!allowedStatuses.includes(appointmentStatus)) {
        return res.status(400).json({
          error: `Settlement not allowed for appointment status "${appointmentStatus}". Only "ready_to_pay" and "partial_paid" statuses can accept payment.`,
        });
      }
    }

    // NEW: Billing gate - check for unresolved sterilization mismatches
    if (invoice.encounterId) {
      const unresolvedMismatches = await prisma.sterilizationMismatch.findFirst({
        where: {
          encounterId: invoice.encounterId,
          status: "UNRESOLVED",
        },
        select: { id: true },
      });

      if (unresolvedMismatches) {
        return res.status(400).json({
          error: "Төлбөр батлах боломжгүй: Ариутгалын тохиргоо дутуу байна. Эхлээд ариутгалын зөрүүг шийдвэрлэнэ үү.",
          errorCode: "UNRESOLVED_STERILIZATION_MISMATCH",
        });
      }
    }

    // Financial base amount to settle against
    const baseAmount =
      invoice.finalAmount != null
        ? Number(invoice.finalAmount)
        : Number(invoice.totalAmount || 0);

    // B2B validation: block settlement if buyerType=B2B and no buyerTin
    if (invoice.buyerType === "B2B" && !invoice.buyerTin) {
      return res.status(400).json({
        error:
          "B2B баримт гаргахын тулд худалдан авагчийн ТТД шаардлагатай. Нэхэмжлэлд buyerTin оруулна уу.",
        errorCode: "B2B_BUYER_TIN_REQUIRED",
      });
    }

    if (!baseAmount || baseAmount <= 0) {
      return res.status(409).json({
        error:
          "Invoice has no positive final/total amount. Please verify invoice structure first.",
      });
    }

    const alreadyPaid = computePaidTotal(invoice.payments);

    // If already fully paid, don't accept more settlement
    if (alreadyPaid >= baseAmount) {
      return res.status(409).json({
        error:
          "Invoice is already fully paid. Additional settlement is not allowed.",
      });
    }

    // Option A enforcement: if invoice has any PaymentAllocation rows, reject
    // standard (non-split) settlement — caller must use batch-settlement with splitAllocations.
    const hasAllocations = await prisma.paymentAllocation.findFirst({
      where: { invoiceItem: { invoiceId } },
      select: { id: true },
    });
    if (hasAllocations) {
      return res.status(400).json({
        error:
          'Энэ нэхэмжлэл дээр "Хувааж төлөх" ашигласан тул дараагийн төлбөрийг мөн үйлчилгээний мөрөөр хуваарилж бүртгэнэ үү.',
        errorCode: "ALLOCATION_REQUIRED",
      });
    }

    // ─────────────────────────────────────────────────────────────
    // SPECIAL CASE: EMPLOYEE_BENEFIT
    // ─────────────────────────────────────────────────────────────
    if (methodStr === "EMPLOYEE_BENEFIT") {
      const employeeCode =
        meta && typeof meta.employeeCode === "string"
          ? meta.employeeCode.trim()
          : null;

      if (!employeeCode) {
        return res.status(400).json({
          error: "employeeCode is required for EMPLOYEE_BENEFIT.",
        });
      }

      try {
        const result = await prisma.$transaction(async (trx) => {
          const benefit = await trx.employeeBenefit.findFirst({
            where: {
              code: employeeCode,
              isActive: true,
            },
          });

          if (!benefit) {
            throw new Error("Ажилтны код хүчингүй байна.");
          }

          if (benefit.remainingAmount < payAmount) {
            throw new Error(
              "Ажилтны хөнгөлөлтийн үлдэгдэл хүрэлцэхгүй байна."
            );
          }

          // 1) Deduct benefit balance
          await trx.employeeBenefit.update({
            where: { id: benefit.id },
            data: {
              remainingAmount: {
                decrement: payAmount,
              },
            },
          });

          // 2) Record usage
          const bookNumber = invoice.encounter?.patientBook?.bookNumber || null;
          await trx.employeeBenefitUsage.create({
            data: {
              employeeBenefitId: benefit.id,
              invoiceId: invoice.id,
              encounterId: invoice.encounterId,
              amountUsed: payAmount,
              patientId: invoice.patientId,
              patientBookNumber: bookNumber,
            },
          });

          // 3) Apply payment using shared settlement logic
          const { updatedInvoice, paidTotal } = await applyPaymentToInvoice(trx, {
            invoice,
            payAmount,
            methodStr,
            meta,
            createdByUserId: req.user?.id || null,
          });

          return { updatedInvoice, paidTotal };
        });

        const { updatedInvoice, paidTotal } = result;

        // Broadcast SSE so Appointments page reflects status change immediately
        const appointmentIdForSse = invoice.encounter?.appointmentId ?? null;
        if (appointmentIdForSse) {
          try {
            const apptForBroadcast = await prisma.appointment.findUnique({
              where: { id: appointmentIdForSse },
              include: {
                patient: { select: { id: true, name: true, ovog: true, phone: true, patientBook: true } },
                doctor: { select: { id: true, name: true, ovog: true } },
                branch: { select: { id: true, name: true } },
              },
            });
            if (apptForBroadcast?.scheduledAt) {
              const apptDate = apptForBroadcast.scheduledAt.toISOString().slice(0, 10);
              // Include encounterId so the receptionist billing button works without a refresh.
              sseBroadcast(
                "appointment_updated",
                { ...apptForBroadcast, encounterId: invoice.encounterId },
                apptDate,
                apptForBroadcast.branchId
              );
            }
          } catch (sseErr) {
            console.error("SSE broadcast error after employee-benefit settlement (non-fatal):", sseErr);
          }
        }

        return res.json({
          id: updatedInvoice.id,
          branchId: updatedInvoice.branchId,
          encounterId: updatedInvoice.encounterId,
          patientId: updatedInvoice.patientId,
          status: updatedInvoice.statusLegacy,
          totalBeforeDiscount: updatedInvoice.totalBeforeDiscount,
          discountPercent: updatedInvoice.discountPercent,
          collectionDiscountAmount: updatedInvoice.collectionDiscountAmount || 0,
          finalAmount: updatedInvoice.finalAmount,
          totalAmountLegacy: updatedInvoice.totalAmount,
          paidTotal,
          unpaidAmount: Math.max(baseAmount - paidTotal, 0),
          hasEBarimt: !!updatedInvoice.eBarimtReceipt,
          items: updatedInvoice.items.map((it) => ({
            id: it.id,
            itemType: it.itemType,
            serviceId: it.serviceId,
            productId: it.productId,
            name: it.name,
            unitPrice: it.unitPrice,
            quantity: it.quantity,
            lineTotal: it.lineTotal,
          })),
          payments: updatedInvoice.payments.map((p) => ({
            id: p.id,
            amount: p.amount,
            method: p.method,
            timestamp: p.timestamp,
            createdByUser: p.createdBy ? { id: p.createdBy.id, name: p.createdBy.name || null, ovog: p.createdBy.ovog || null } : null,
          })),
        });
      } catch (err) {
        console.error("EMPLOYEE_BENEFIT settlement transaction error:", err);
        return res
          .status(400)
          .json({ error: err.message || "Төлбөр бүртгэхэд алдаа гарлаа." });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // SPECIAL CASE: BARTER
    // ─────────────────────────────────────────────────────────────
    if (methodStr === "BARTER") {
      const barterCode =
        meta && typeof meta.code === "string" ? meta.code.trim() : null;

      if (!barterCode) {
        return res.status(400).json({
          error: "barterCode is required for BARTER.",
        });
      }

      try {
        const result = await prisma.$transaction(async (trx) => {
          const barter = await trx.barter.findFirst({
            where: { code: { equals: barterCode, mode: "insensitive" }, isActive: true },
          });

          if (!barter) {
            throw new Error("Бартерийн код хүчингүй байна.");
          }

          if (barter.remainingAmount < payAmount) {
            throw new Error("Бартерийн үлдэгдэл хүрэлцэхгүй байна.");
          }

          // 1) Deduct barter balance
          await trx.barter.update({
            where: { id: barter.id },
            data: {
              spentAmount: { increment: payAmount },
              remainingAmount: { decrement: payAmount },
            },
          });

          // 2) Record usage
          await trx.barterUsage.create({
            data: {
              barterId: barter.id,
              invoiceId: invoice.id,
              encounterId: invoice.encounterId,
              amountUsed: payAmount,
              patientId: invoice.patientId,
              usedByUserId: req.user?.id ?? null,
            },
          });

          // 3) Apply payment using shared settlement logic
          const { updatedInvoice, paidTotal } = await applyPaymentToInvoice(trx, {
            invoice,
            payAmount,
            methodStr,
            meta,
            createdByUserId: req.user?.id || null,
          });

          return { updatedInvoice, paidTotal };
        });

        const { updatedInvoice, paidTotal } = result;

        // Broadcast SSE
        const appointmentIdForSse = invoice.encounter?.appointmentId ?? null;
        if (appointmentIdForSse) {
          try {
            const apptForBroadcast = await prisma.appointment.findUnique({
              where: { id: appointmentIdForSse },
              include: {
                patient: { select: { id: true, name: true, ovog: true, phone: true, patientBook: true } },
                doctor: { select: { id: true, name: true, ovog: true } },
                branch: { select: { id: true, name: true } },
              },
            });
            if (apptForBroadcast?.scheduledAt) {
              const apptDate = apptForBroadcast.scheduledAt.toISOString().slice(0, 10);
              sseBroadcast(
                "appointment_updated",
                { ...apptForBroadcast, encounterId: invoice.encounterId },
                apptDate,
                apptForBroadcast.branchId
              );
            }
          } catch (sseErr) {
            console.error("SSE broadcast error after barter settlement (non-fatal):", sseErr);
          }
        }

        return res.json({
          id: updatedInvoice.id,
          branchId: updatedInvoice.branchId,
          encounterId: updatedInvoice.encounterId,
          patientId: updatedInvoice.patientId,
          status: updatedInvoice.statusLegacy,
          totalBeforeDiscount: updatedInvoice.totalBeforeDiscount,
          discountPercent: updatedInvoice.discountPercent,
          collectionDiscountAmount: updatedInvoice.collectionDiscountAmount || 0,
          finalAmount: updatedInvoice.finalAmount,
          totalAmountLegacy: updatedInvoice.totalAmount,
          paidTotal,
          unpaidAmount: Math.max(baseAmount - paidTotal, 0),
          hasEBarimt: !!updatedInvoice.eBarimtReceipt,
          items: updatedInvoice.items.map((it) => ({
            id: it.id,
            itemType: it.itemType,
            serviceId: it.serviceId,
            productId: it.productId,
            name: it.name,
            unitPrice: it.unitPrice,
            quantity: it.quantity,
            lineTotal: it.lineTotal,
          })),
          payments: updatedInvoice.payments.map((p) => ({
            id: p.id,
            amount: p.amount,
            method: p.method,
            timestamp: p.timestamp,
            createdByUser: p.createdBy ? { id: p.createdBy.id, name: p.createdBy.name || null, ovog: p.createdBy.ovog || null } : null,
          })),
        });
      } catch (err) {
        console.error("BARTER settlement transaction error:", err);
        return res
          .status(400)
          .json({ error: err.message || "Төлбөр бүртгэхэд алдаа гарлаа." });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // SPECIAL CASE: GIFT_CARD (Бэлгийн карт)
    // ─────────────────────────────────────────────────────────────
    if (methodStr === "GIFT_CARD") {
      const giftCardCode =
        meta && typeof meta.code === "string" ? meta.code.trim() : null;

      if (!giftCardCode) {
        return res.status(400).json({
          error: "giftCardCode is required for GIFT_CARD.",
        });
      }

      try {
        const result = await prisma.$transaction(async (trx) => {
          const card = await trx.giftCard.findUnique({
            where: { code: giftCardCode },
          });

          if (!card) {
            throw new Error("Бэлгийн картын код хүчингүй байна.");
          }

          if (!card.isActive) {
            throw new Error("Энэ бэлгийн карт идэвхгүй байна.");
          }

          if (card.remainingBalance < payAmount) {
            throw new Error("Бэлгийн картын үлдэгдэл хүрэлцэхгүй байна.");
          }

          const newBalance = card.remainingBalance - payAmount;

          // 1) Deduct gift card balance and mark inactive when depleted
          await trx.giftCard.update({
            where: { id: card.id },
            data: {
              remainingBalance: newBalance,
              isActive: newBalance > 0,
            },
          });

          // 2) Record usage
          await trx.giftCardUsage.create({
            data: {
              giftCardId: card.id,
              invoiceId: invoice.id,
              encounterId: invoice.encounterId,
              amountUsed: payAmount,
              patientId: invoice.patientId,
              usedByUserId: req.user?.id ?? null,
            },
          });

          // 3) Apply payment using shared settlement logic
          const { updatedInvoice, paidTotal } = await applyPaymentToInvoice(trx, {
            invoice,
            payAmount,
            methodStr,
            meta,
            createdByUserId: req.user?.id || null,
          });

          return { updatedInvoice, paidTotal };
        });

        const { updatedInvoice, paidTotal } = result;

        // Broadcast SSE
        const appointmentIdForSse = invoice.encounter?.appointmentId ?? null;
        if (appointmentIdForSse) {
          try {
            const apptForBroadcast = await prisma.appointment.findUnique({
              where: { id: appointmentIdForSse },
              include: {
                patient: { select: { id: true, name: true, ovog: true, phone: true, patientBook: true } },
                doctor: { select: { id: true, name: true, ovog: true } },
                branch: { select: { id: true, name: true } },
              },
            });
            if (apptForBroadcast?.scheduledAt) {
              const apptDate = apptForBroadcast.scheduledAt.toISOString().slice(0, 10);
              sseBroadcast(
                "appointment_updated",
                { ...apptForBroadcast, encounterId: invoice.encounterId },
                apptDate,
                apptForBroadcast.branchId
              );
            }
          } catch (sseErr) {
            console.error("SSE broadcast error after gift card settlement (non-fatal):", sseErr);
          }
        }

        return res.json({
          id: updatedInvoice.id,
          branchId: updatedInvoice.branchId,
          encounterId: updatedInvoice.encounterId,
          patientId: updatedInvoice.patientId,
          status: updatedInvoice.statusLegacy,
          totalBeforeDiscount: updatedInvoice.totalBeforeDiscount,
          discountPercent: updatedInvoice.discountPercent,
          collectionDiscountAmount: updatedInvoice.collectionDiscountAmount || 0,
          finalAmount: updatedInvoice.finalAmount,
          totalAmountLegacy: updatedInvoice.totalAmount,
          paidTotal,
          unpaidAmount: Math.max(baseAmount - paidTotal, 0),
          hasEBarimt: !!updatedInvoice.eBarimtReceipt,
          items: updatedInvoice.items.map((it) => ({
            id: it.id,
            itemType: it.itemType,
            serviceId: it.serviceId,
            productId: it.productId,
            name: it.name,
            unitPrice: it.unitPrice,
            quantity: it.quantity,
            lineTotal: it.lineTotal,
          })),
          payments: updatedInvoice.payments.map((p) => ({
            id: p.id,
            amount: p.amount,
            method: p.method,
            timestamp: p.timestamp,
            createdByUser: p.createdBy ? { id: p.createdBy.id, name: p.createdBy.name || null, ovog: p.createdBy.ovog || null } : null,
          })),
        });
      } catch (err) {
        console.error("GIFT_CARD settlement transaction error:", err);
        return res
          .status(400)
          .json({ error: err.message || "Төлбөр бүртгэхэд алдаа гарлаа." });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // SPECIAL CASE: WALLET (Хэтэвч)
    // ─────────────────────────────────────────────────────────────
    if (methodStr === "WALLET") {
      try {
        const result = await prisma.$transaction(async (trx) => {
          const { updatedInvoice, paidTotal } = await applyWalletSettlement(trx, {
            invoice,
            payAmount,
            methodStr,
            meta,
            createdByUserId: req.user?.id || null,
          });
          return { updatedInvoice, paidTotal };
        });

        const { updatedInvoice, paidTotal } = result;

        const appointmentIdForSse = invoice.encounter?.appointmentId ?? null;
        if (appointmentIdForSse) {
          try {
            const apptForBroadcast = await prisma.appointment.findUnique({
              where: { id: appointmentIdForSse },
              include: {
                patient: { select: { id: true, name: true, ovog: true, phone: true, patientBook: true } },
                doctor: { select: { id: true, name: true, ovog: true } },
                branch: { select: { id: true, name: true } },
              },
            });
            if (apptForBroadcast?.scheduledAt) {
              const apptDate = apptForBroadcast.scheduledAt.toISOString().slice(0, 10);
              sseBroadcast(
                "appointment_updated",
                { ...apptForBroadcast, encounterId: invoice.encounterId },
                apptDate,
                apptForBroadcast.branchId
              );
            }
          } catch (sseErr) {
            console.error("SSE broadcast error after wallet settlement (non-fatal):", sseErr);
          }
        }

        return res.json({
          id: updatedInvoice.id,
          branchId: updatedInvoice.branchId,
          encounterId: updatedInvoice.encounterId,
          patientId: updatedInvoice.patientId,
          status: updatedInvoice.statusLegacy,
          totalBeforeDiscount: updatedInvoice.totalBeforeDiscount,
          discountPercent: updatedInvoice.discountPercent,
          collectionDiscountAmount: updatedInvoice.collectionDiscountAmount || 0,
          finalAmount: updatedInvoice.finalAmount,
          totalAmountLegacy: updatedInvoice.totalAmount,
          paidTotal,
          unpaidAmount: Math.max(baseAmount - paidTotal, 0),
          hasEBarimt: !!updatedInvoice.eBarimtReceipt,
          items: updatedInvoice.items.map((it) => ({
            id: it.id,
            itemType: it.itemType,
            serviceId: it.serviceId,
            productId: it.productId,
            name: it.name,
            unitPrice: it.unitPrice,
            quantity: it.quantity,
            lineTotal: it.lineTotal,
          })),
          payments: updatedInvoice.payments.map((p) => ({
            id: p.id,
            amount: p.amount,
            method: p.method,
            timestamp: p.timestamp,
            qpayTxnId: p.qpayTxnId,
            createdByUser: p.createdBy ? { id: p.createdBy.id, name: p.createdBy.name || null, ovog: p.createdBy.ovog || null } : null,
          })),
        });
      } catch (err) {
        console.error("WALLET settlement transaction error:", err);
        return res
          .status(400)
          .json({ error: err.message || "Төлбөр бүртгэхэд алдаа гарлаа." });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // DEFAULT: other methods (CASH, QPAY, POS, TRANSFER, etc.)
    // ─────────────────────────────────────────────────────────────

    // QPAY idempotency check
    if (methodStr === "QPAY") {
      const qpayPaymentId =
        meta && typeof meta.qpayPaymentId === "string"
          ? meta.qpayPaymentId.trim()
          : null;

      if (qpayPaymentId) {
        // Check if payment already exists with this qpayTxnId
        const existingPayment = await prisma.payment.findFirst({
          where: {
            invoiceId,
            qpayTxnId: qpayPaymentId,
          },
        });

        if (existingPayment) {
          // Already settled with this QPay payment ID - return current invoice state
          const currentInvoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
              items: true,
              payments: { include: { createdBy: { select: { id: true, name: true, ovog: true } } } },
              eBarimtReceipt: true,
            },
          });

          if (!currentInvoice) {
            return res.status(404).json({ error: "Invoice not found" });
          }

          const payments = currentInvoice.payments || [];
          const paidTotal = computePaidTotal(payments);

          return res.json({
            id: currentInvoice.id,
            branchId: currentInvoice.branchId,
            encounterId: currentInvoice.encounterId,
            patientId: currentInvoice.patientId,
            status: currentInvoice.statusLegacy,
            totalBeforeDiscount: currentInvoice.totalBeforeDiscount,
            discountPercent: currentInvoice.discountPercent,
            collectionDiscountAmount: currentInvoice.collectionDiscountAmount || 0,
            finalAmount: currentInvoice.finalAmount,
            totalAmountLegacy: currentInvoice.totalAmount,
            paidTotal,
            unpaidAmount: Math.max(baseAmount - paidTotal, 0),
            hasEBarimt: !!currentInvoice.eBarimtReceipt,
            items: currentInvoice.items.map((it) => ({
              id: it.id,
              itemType: it.itemType,
              serviceId: it.serviceId,
              productId: it.productId,
              name: it.name,
              unitPrice: it.unitPrice,
              quantity: it.quantity,
              lineTotal: it.lineTotal,
            })),
            payments: payments.map((p) => ({
              id: p.id,
              amount: p.amount,
              method: p.method,
              timestamp: p.timestamp,
              qpayTxnId: p.qpayTxnId,
              createdByUser: p.createdBy ? { id: p.createdBy.id, name: p.createdBy.name || null, ovog: p.createdBy.ovog || null } : null,
            })),
          });
        }
      }
    }

    const qpayTxnId =
      methodStr === "QPAY" && meta && typeof meta.qpayPaymentId === "string"
        ? meta.qpayPaymentId.trim() || null
        : null;

    const updated = await prisma.$transaction(async (trx) => {
      return applyPaymentToInvoice(trx, {
        invoice,
        payAmount,
        methodStr,
        meta,
        qpayTxnId,
        createdByUserId: req.user?.id || null,
      });
    });

    const { updatedInvoice, paidTotal } = updated;

    // Broadcast SSE so Appointments page reflects status change immediately
    const appointmentIdForSse = invoice.encounter?.appointmentId ?? null;
    if (appointmentIdForSse) {
      try {
        const apptForBroadcast = await prisma.appointment.findUnique({
          where: { id: appointmentIdForSse },
          include: {
            patient: { select: { id: true, name: true, ovog: true, phone: true, patientBook: true } },
            doctor: { select: { id: true, name: true, ovog: true } },
            branch: { select: { id: true, name: true } },
          },
        });
        if (apptForBroadcast?.scheduledAt) {
          const apptDate = apptForBroadcast.scheduledAt.toISOString().slice(0, 10);
          // Include encounterId so the receptionist billing button works without a refresh.
          sseBroadcast(
            "appointment_updated",
            { ...apptForBroadcast, encounterId: invoice.encounterId },
            apptDate,
            apptForBroadcast.branchId
          );
        }
      } catch (sseErr) {
        console.error("SSE broadcast error after settlement (non-fatal):", sseErr);
      }
    }

    return res.json({
      id: updatedInvoice.id,
      branchId: updatedInvoice.branchId,
      encounterId: updatedInvoice.encounterId,
      patientId: updatedInvoice.patientId,
      status: updatedInvoice.statusLegacy,
      totalBeforeDiscount: updatedInvoice.totalBeforeDiscount,
      discountPercent: updatedInvoice.discountPercent,
      collectionDiscountAmount: updatedInvoice.collectionDiscountAmount || 0,
      finalAmount: updatedInvoice.finalAmount,
      totalAmountLegacy: updatedInvoice.totalAmount,
      paidTotal,
      unpaidAmount: Math.max(baseAmount - paidTotal, 0),
      hasEBarimt: !!updatedInvoice.eBarimtReceipt,
      items: updatedInvoice.items.map((it) => ({
        id: it.id,
        itemType: it.itemType,
        serviceId: it.serviceId,
        productId: it.productId,
        name: it.name,
        unitPrice: it.unitPrice,
        quantity: it.quantity,
        lineTotal: it.lineTotal,
      })),
      payments: updatedInvoice.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        timestamp: p.timestamp,
        qpayTxnId: p.qpayTxnId,
        createdByUser: p.createdBy ? { id: p.createdBy.id, name: p.createdBy.name || null, ovog: p.createdBy.ovog || null } : null,
      })),
    });
  } catch (err) {
    console.error("POST /api/invoices/:id/settlement error:", err);
    return res.status(500).json({ error: "Failed to settle invoice payment." });
  }
});

/**
 * PATCH /api/invoices/:id/buyer
 *
 * Update buyer type and TIN for e-Barimt on an invoice.
 * Body: { buyerType: "B2C"|"B2B", buyerTin?: string|null }
 */
router.patch("/:id/buyer", async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    if (!invoiceId || Number.isNaN(invoiceId)) {
      return res.status(400).json({ error: "Invalid invoice id." });
    }

    const { buyerType, buyerTin } = req.body || {};

    if (!buyerType || (buyerType !== "B2C" && buyerType !== "B2B")) {
      return res.status(400).json({ error: "buyerType must be 'B2C' or 'B2B'." });
    }

    if (buyerType === "B2B") {
      const tin = typeof buyerTin === "string" ? buyerTin.trim() : "";
      if (!tin) {
        return res.status(400).json({ error: "buyerTin is required for B2B buyer type." });
      }
      if (!/^\d{11}$/.test(tin) && !/^\d{14}$/.test(tin)) {
        return res
          .status(400)
          .json({ error: "buyerTin must be exactly 11 or 14 digits." });
      }
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { eBarimtReceipt: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    if (invoice.eBarimtReceipt) {
      return res.status(409).json({
        error: "e-Barimt баримт аль хэдийн гаргасан тул худалдан авагчийн мэдээллийг өөрчлөх боломжгүй.",
      });
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        buyerType,
        buyerTin: buyerType === "B2B" ? (typeof buyerTin === "string" ? buyerTin.trim() : null) : null,
      },
    });

    return res.json({
      id: updatedInvoice.id,
      buyerType: updatedInvoice.buyerType,
      buyerTin: updatedInvoice.buyerTin,
    });
  } catch (err) {
    console.error("PATCH /api/invoices/:id/buyer error:", err);
    return res.status(500).json({ error: "Failed to update buyer info." });
  }
});

export default router;
