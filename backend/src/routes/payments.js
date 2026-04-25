import express from "express";
import prisma from "../db.js";
import { requireRole } from "../middleware/auth.js";
import { computePaidTotal } from "../services/settlementService.js";

const router = express.Router();

const DEFAULT_PAGE_SIZE = 20;
const MIN_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const STATUS_VALUES = new Set(["all", "active", "reversed"]);
const NONE_PAYMENT_METHOD_FILTER = "__none__";

function normalizeMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function parseDateOnlyStart(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const dt = new Date(`${value}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseDateOnlyEndExclusive(value) {
  const start = parseDateOnlyStart(value);
  if (!start) return null;
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function normalizeMethod(method) {
  return String(method || "").trim().toLowerCase();
}

function parsePaymentMethodFilter(value) {
  if (value == null || value === "") return null;
  const rawValues = Array.isArray(value) ? value : String(value).split(",");
  return rawValues
    .map((v) => normalizeMethod(v))
    .filter(Boolean);
}

function safeMeta(meta) {
  return meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
}

function parseIntOrNull(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function displayReferenceOrNote(payment) {
  const meta = safeMeta(payment.meta);
  const reference = typeof meta.reference === "string" ? meta.reference.trim() : "";
  const note = typeof meta.note === "string" ? meta.note.trim() : "";
  return reference || note || null;
}

function displayNote(payment) {
  const meta = safeMeta(payment.meta);
  const note = typeof meta.note === "string" ? meta.note.trim() : "";
  return note || null;
}

export function isReversalEntryPayment(payment) {
  const meta = safeMeta(payment?.meta);
  return Number.isInteger(Number(meta.reversalOfPaymentId));
}

export function getReversalPaymentId(payment) {
  const meta = safeMeta(payment?.meta);
  const reversalPaymentId = Number(meta.reversalPaymentId);
  return Number.isInteger(reversalPaymentId) && reversalPaymentId > 0 ? reversalPaymentId : null;
}

export function deriveLedgerStatus(payment) {
  return getReversalPaymentId(payment) ? "reversed" : "active";
}

function isInvoiceVoidedStatus(statusLegacy) {
  const status = String(statusLegacy || "").trim().toLowerCase();
  return status === "voided" || status === "void" || status === "canceled" || status === "cancelled";
}

function resolvePatient(payment) {
  return (
    payment.invoice?.patient ||
    payment.invoice?.encounter?.patientBook?.patient || {
      id: null,
      name: null,
      ovog: null,
      phone: null,
      regNo: null,
    }
  );
}

function fmtUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name ?? null,
    ovog: user.ovog ?? null,
  };
}

export function buildPaymentLedgerRow(payment) {
  const patient = resolvePatient(payment);
  const method = normalizeMethod(payment.method);

  const reversalInfo = getReversalPaymentId(payment)
    ? {
        reversalPaymentId: getReversalPaymentId(payment),
        reversedAt: safeMeta(payment.meta).reversedAt || null,
        reversedByUser: fmtUser(payment.reversalPayment?.createdBy || null),
        reason:
          typeof safeMeta(payment.meta).reversalReason === "string"
            ? safeMeta(payment.meta).reversalReason
            : null,
      }
    : null;

  return {
    id: payment.id,
    timestamp: payment.timestamp,
    method,
    amount: Number(payment.amount || 0),
    status: deriveLedgerStatus(payment),
    reference: displayReferenceOrNote(payment),
    note: displayNote(payment),
    isWallet: method === "wallet",
    invoice: payment.invoice
      ? {
          id: payment.invoice.id,
          statusLegacy: payment.invoice.statusLegacy ?? null,
          encounter: payment.invoice.encounter
            ? {
                appointment: payment.invoice.encounter.appointment
                  ? {
                      scheduledAt: payment.invoice.encounter.appointment.scheduledAt ?? null,
                    }
                  : null,
              }
            : null,
        }
      : null,
    patient: {
      id: patient.id ?? null,
      name: patient.name ?? null,
      ovog: patient.ovog ?? null,
      phone: patient.phone ?? null,
      regNo: patient.regNo ?? null,
    },
    doctor: payment.invoice?.encounter?.doctor
      ? {
          id: payment.invoice.encounter.doctor.id,
          name: payment.invoice.encounter.doctor.name ?? null,
          ovog: payment.invoice.encounter.doctor.ovog ?? null,
        }
      : null,
    branch: payment.invoice?.branch
      ? {
          id: payment.invoice.branch.id,
          name: payment.invoice.branch.name,
        }
      : null,
    createdByUser: fmtUser(payment.createdBy),
    reversal: reversalInfo,
  };
}

export function buildPaymentsSummary(rows = []) {
  const initial = {
    totalPayments: 0,
    activeTotal: 0,
    reversedTotal: 0,
    netCollected: 0,
  };

  const summary = rows.reduce((acc, row) => {
    // Reversed amounts are shown as absolute totals on summary cards.
    const amount = Math.abs(Number(row.amount || 0));
    acc.totalPayments += 1;
    if (row.status === "reversed") {
      acc.reversedTotal = normalizeMoney(acc.reversedTotal + amount);
    } else {
      acc.activeTotal = normalizeMoney(acc.activeTotal + amount);
    }
    acc.netCollected = normalizeMoney(acc.activeTotal - acc.reversedTotal);
    return acc;
  }, initial);

  return summary;
}

function matchesPatient(row, patientSearch) {
  if (!patientSearch) return true;
  const needle = patientSearch.toLowerCase();
  const fields = [row.patient.name, row.patient.ovog, row.patient.phone, row.patient.regNo];
  return fields.some((value) => String(value || "").toLowerCase().includes(needle));
}

function matchesCreatedBy(row, createdBy) {
  if (!createdBy) return true;
  const needle = createdBy.toLowerCase();
  const user = row.createdByUser;
  if (!user) return false;
  return (
    String(user.id).includes(needle) ||
    String(user.name || "").toLowerCase().includes(needle) ||
    String(user.ovog || "").toLowerCase().includes(needle)
  );
}

async function updateInvoiceAndAppointmentAfterPaymentChange(trx, invoiceId) {
  const invoice = await trx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      totalAmount: true,
      finalAmount: true,
      encounter: { select: { appointmentId: true } },
    },
  });

  if (!invoice) return;

  const payments = await trx.payment.findMany({ where: { invoiceId: invoice.id } });
  const paidTotal = computePaidTotal(payments);
  const invoiceAmount = Number(
    invoice.finalAmount != null ? Number(invoice.finalAmount) : Number(invoice.totalAmount || 0)
  );

  let statusLegacy = "unpaid";
  if (paidTotal >= invoiceAmount) statusLegacy = "paid";
  else if (paidTotal > 0) statusLegacy = "partial";

  await trx.invoice.update({
    where: { id: invoice.id },
    data: { statusLegacy },
  });

  const appointmentId = invoice.encounter?.appointmentId ?? null;
  if (appointmentId) {
    let appointmentStatus = "ready_to_pay";
    if (paidTotal >= invoiceAmount) appointmentStatus = "completed";
    else if (paidTotal > 0) appointmentStatus = "partial_paid";

    await trx.appointment.update({
      where: { id: appointmentId },
      data: { status: appointmentStatus },
    });
  }
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
    const rawPageSize =
      req.query.pageSize == null || req.query.pageSize === ""
        ? DEFAULT_PAGE_SIZE
        : Number(req.query.pageSize);
    if (Number.isNaN(rawPageSize)) {
      return res.status(400).json({ error: "Invalid pageSize query parameter." });
    }
    const pageSize = Math.min(Math.max(rawPageSize, MIN_PAGE_SIZE), MAX_PAGE_SIZE);

    const branchId = parseIntOrNull(req.query.branchId);
    const invoiceId = parseIntOrNull(req.query.invoiceId);
    const paymentMethodFilter = parsePaymentMethodFilter(req.query.paymentMethods);
    const statusRaw = typeof req.query.status === "string" ? req.query.status.trim().toLowerCase() : "all";
    const status = STATUS_VALUES.has(statusRaw) ? statusRaw : "all";
    const patientSearch = typeof req.query.patientSearch === "string" ? req.query.patientSearch.trim() : "";
    const createdBy = typeof req.query.createdBy === "string" ? req.query.createdBy.trim() : "";

    const where = {
      timestamp: { gte: fromDate, lt: toDateExclusive },
    };

    if (invoiceId) where.invoiceId = invoiceId;
    if (paymentMethodFilter && !paymentMethodFilter.includes(NONE_PAYMENT_METHOD_FILTER)) {
      const selectedMethods = Array.from(new Set(paymentMethodFilter));
      if (selectedMethods.length > 0) {
        where.OR = selectedMethods.map((method) => ({
          method: { equals: method, mode: "insensitive" },
        }));
      }
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { timestamp: "desc" },
      include: {
        createdBy: { select: { id: true, name: true, ovog: true } },
        invoice: {
          select: {
            id: true,
            statusLegacy: true,
            branchId: true,
            branch: { select: { id: true, name: true } },
            patient: {
              select: { id: true, name: true, ovog: true, phone: true, regNo: true },
            },
            encounter: {
              select: {
                doctor: { select: { id: true, name: true, ovog: true } },
                patientBook: {
                  select: {
                    patient: {
                      select: { id: true, name: true, ovog: true, phone: true, regNo: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    let rows = payments
      .filter((payment) => !isReversalEntryPayment(payment))
      .map((payment) => buildPaymentLedgerRow(payment));

    if (paymentMethodFilter?.includes(NONE_PAYMENT_METHOD_FILTER)) {
      rows = [];
    }

    if (branchId) {
      rows = rows.filter((row) => row.branch?.id === branchId);
    }
    if (status !== "all") {
      rows = rows.filter((row) => row.status === status);
    }
    if (patientSearch) {
      rows = rows.filter((row) => matchesPatient(row, patientSearch));
    }
    if (createdBy) {
      rows = rows.filter((row) => matchesCreatedBy(row, createdBy));
    }

    const summary = buildPaymentsSummary(rows);
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
    console.error("GET /api/payments error:", err);
    return res.status(500).json({ error: "Failed to fetch payments." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const paymentId = Number(req.params.id);
    if (!paymentId || Number.isNaN(paymentId)) {
      return res.status(400).json({ error: "Invalid payment id." });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        createdBy: { select: { id: true, name: true, ovog: true } },
        invoice: {
          select: {
            id: true,
            statusLegacy: true,
            branch: { select: { id: true, name: true } },
            patient: {
              select: { id: true, name: true, ovog: true, phone: true, regNo: true },
            },
            encounter: {
              select: {
                doctor: { select: { id: true, name: true, ovog: true } },
                appointment: { select: { scheduledAt: true } },
                patientBook: {
                  select: {
                    patient: {
                      select: { id: true, name: true, ovog: true, phone: true, regNo: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment || isReversalEntryPayment(payment)) {
      return res.status(404).json({ error: "Payment not found." });
    }

    const reversalPaymentId = getReversalPaymentId(payment);
    const reversalPayment = reversalPaymentId
      ? await prisma.payment.findUnique({
          where: { id: reversalPaymentId },
          include: {
            createdBy: { select: { id: true, name: true, ovog: true } },
          },
        })
      : null;

    const row = buildPaymentLedgerRow({
      ...payment,
      reversalPayment,
    });

    return res.json({
      ...row,
      reversal: row.reversal
        ? {
            ...row.reversal,
            reversalPayment: reversalPayment
              ? {
                  id: reversalPayment.id,
                  amount: reversalPayment.amount,
                  method: normalizeMethod(reversalPayment.method),
                  timestamp: reversalPayment.timestamp,
                }
              : null,
          }
        : null,
    });
  } catch (err) {
    console.error("GET /api/payments/:id error:", err);
    return res.status(500).json({ error: "Failed to fetch payment details." });
  }
});

router.post("/:id/reverse", requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const paymentId = Number(req.params.id);
    if (!paymentId || Number.isNaN(paymentId)) {
      return res.status(400).json({ error: "Invalid payment id." });
    }

    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!reason) {
      return res.status(400).json({ error: "Reversal reason is required." });
    }

    const currentUserId = Number(req.user?.id || 0);
    if (!currentUserId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const result = await prisma.$transaction(async (trx) => {
      const original = await trx.payment.findUnique({
        where: { id: paymentId },
        include: {
          invoice: {
            select: {
              id: true,
              patientId: true,
              statusLegacy: true,
            },
          },
        },
      });

      if (!original || isReversalEntryPayment(original)) {
        throw new Error("NOT_FOUND");
      }
      if (getReversalPaymentId(original)) {
        throw new Error("ALREADY_REVERSED");
      }
      if (!original.invoice) {
        throw new Error("INVOICE_NOT_FOUND");
      }
      if (isInvoiceVoidedStatus(original.invoice.statusLegacy)) {
        throw new Error("INVOICE_VOIDED");
      }
      if (Number(original.amount || 0) <= 0) {
        throw new Error("PAYMENT_AMOUNT_MUST_BE_POSITIVE");
      }

      const originalMeta = safeMeta(original.meta);
      const reversedAt = new Date();

      const reversalPayment = await trx.payment.create({
        data: {
          invoiceId: original.invoiceId,
          amount: -Math.abs(Number(original.amount || 0)),
          method: original.method,
          timestamp: reversedAt,
          createdByUserId: currentUserId,
          qpayTxnId: null,
          meta: {
            reversalOfPaymentId: original.id,
            reason,
          },
        },
      });

      await trx.payment.update({
        where: { id: original.id },
        data: {
          meta: {
            ...originalMeta,
            reversalPaymentId: reversalPayment.id,
            reversedAt: reversedAt.toISOString(),
            reversedByUserId: currentUserId,
            reversalReason: reason,
          },
        },
      });

      if (normalizeMethod(original.method) === "wallet" && original.invoice.patientId) {
        await trx.balanceAdjustmentLog.create({
          data: {
            patientId: original.invoice.patientId,
            amount: Math.abs(Number(original.amount || 0)),
            reason: `Wallet payment reversal; paymentId=${original.id}; invoiceId=${original.invoiceId}; reason=${reason}`,
            createdById: currentUserId,
          },
        });
      }

      await updateInvoiceAndAppointmentAfterPaymentChange(trx, original.invoiceId);

      return {
        paymentId: original.id,
        reversalPaymentId: reversalPayment.id,
      };
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    if (err?.message === "NOT_FOUND") {
      return res.status(404).json({ error: "Payment not found." });
    }
    if (err?.message === "ALREADY_REVERSED") {
      return res.status(409).json({ error: "Payment already reversed." });
    }
    if (err?.message === "INVOICE_VOIDED") {
      return res.status(409).json({ error: "Linked invoice is voided." });
    }
    if (err?.message === "INVOICE_NOT_FOUND") {
      return res.status(404).json({ error: "Linked invoice not found." });
    }
    if (err?.message === "PAYMENT_AMOUNT_MUST_BE_POSITIVE") {
      return res.status(400).json({ error: "Only active payments can be reversed." });
    }

    console.error("POST /api/payments/:id/reverse error:", err);
    return res.status(500).json({ error: "Failed to reverse payment." });
  }
});

export default router;
