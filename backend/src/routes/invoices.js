import express from "express";
import prisma from "../db.js";

const router = express.Router();

/**
 * Helper: compute paid total from a list of payments.
 */
function computePaidTotal(payments) {
  return (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

/**
 * Helper: get branchId/patientId for financial + stock ops from an invoice object
 * (Invoice.branchId and Invoice.patientId are nullable in schema).
 */
function getInvoiceBranchAndPatient(invoice) {
  const patient = invoice?.encounter?.patientBook?.patient;
  const branchId = invoice.branchId ?? patient?.branchId ?? null;
  const patientId = invoice.patientId ?? patient?.id ?? null;
  return { branchId, patientId };
}

/**
 * Helper: create SALE stock movements once when invoice becomes fully paid.
 *
 * IMPORTANT:
 * - Your original desired approach was "on paid LedgerEntry".
 * - This settlement route currently creates Payment rows, not LedgerEntry rows.
 * - Therefore idempotency here is keyed by invoiceId (type=SALE).
 * - If you later create LedgerEntry in this route, you can key by ledgerEntryId instead.
 */
async function ensureSaleStockMovementsOnce(trx, invoice, invoiceId, methodStr) {
  // Only create SALE movements if there are PRODUCT invoice items
  const productItems = (invoice?.items || []).filter(
    (it) => it.itemType === "PRODUCT" && it.productId && it.quantity
  );
  if (productItems.length === 0) return;

  const { branchId } = getInvoiceBranchAndPatient(invoice);
  if (!branchId) {
    // If branchId is missing, we cannot create valid movements
    throw new Error("Cannot determine branchId for stock movement.");
  }

  // Idempotency: if we already created SALE movements for this invoice, do nothing
  const already = await trx.productStockMovement.findFirst({
    where: { invoiceId: invoiceId, type: "SALE" },
    select: { id: true },
  });
  if (already) return;

  await trx.productStockMovement.createMany({
    data: productItems.map((it) => ({
      branchId,
      productId: it.productId,
      type: "SALE",
      quantityDelta: -Math.abs(Math.trunc(it.quantity)),
      invoiceId: invoiceId,
      ledgerEntryId: null,
      note: `Auto SALE on invoice paid (method=${methodStr})`,
    })),
  });
}

/**
 * POST /api/invoices/:id/settlement
 *
 * Body:
 * {
 *   amount: number;        // required, >0
 *   method: "CASH" | "QPAY" | "POS" | "TRANSFER" | "INSURANCE" | "VOUCHER" | ...,
 *   issueEBarimt?: boolean; // optional; if true and fully paid, attempt e-Barimt
 *   meta?: { ... }          // optional extra info (employeeCode, voucherCode, etc.)
 * }
 */
router.post("/:id/settlement", async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    if (!invoiceId || Number.isNaN(invoiceId)) {
      return res.status(400).json({ error: "Invalid invoice id" });
    }

    const { amount, method, issueEBarimt, meta } = req.body || {};

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

    const hadEBarimt = !!invoice.eBarimtReceipt;

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

          // 3) Create payment row (legacy Payment table)
          await trx.payment.create({
            data: {
              invoiceId,
              amount: payAmount,
              method: methodStr,
              meta: meta || null,
              timestamp: new Date(),
            },
          });

          // 4) Re-read all payments to compute new totals
          const payments = await trx.payment.findMany({
            where: { invoiceId },
          });
          const paidTotal = computePaidTotal(payments);

          // 5) Decide new statusLegacy
          let statusLegacy = invoice.statusLegacy || "unpaid";
          if (paidTotal >= baseAmount) {
            statusLegacy = "paid";
          } else if (paidTotal > 0) {
            statusLegacy = "partial";
          } else {
            statusLegacy = "unpaid";
          }

          // ✅ NEW: If fully paid, decrement stock once (SALE movements)
          if (paidTotal >= baseAmount) {
            await ensureSaleStockMovementsOnce(
              trx,
              invoice,
              invoiceId,
              methodStr
            );
          }

          // 6) Optionally issue e-Barimt
          let eBarimtReceipt = invoice.eBarimtReceipt;
          if (
            !hadEBarimt &&
            !eBarimtReceipt &&
            paidTotal >= baseAmount &&
            issueEBarimt === true
          ) {
            const receiptNumber = `MDENT-${invoiceId}-${Date.now()}`;
            const receipt = await trx.eBarimtReceipt.create({
              data: {
                invoiceId,
                receiptNumber,
                timestamp: new Date(),
              },
            });
            eBarimtReceipt = receipt;
          }

          // 7) Update invoice with new statusLegacy
          const updatedInvoice = await trx.invoice.update({
            where: { id: invoiceId },
            data: {
              statusLegacy,
            },
            include: {
              items: true,
              payments: true,
              eBarimtReceipt: true,
            },
          });

          return { updatedInvoice, paidTotal };
        });

        const { updatedInvoice, paidTotal } = result;

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
              payments: true,
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
            })),
          });
        }
      }
    }

    const updated = await prisma.$transaction(async (trx) => {
      // 1) Create new payment row
      const paymentData = {
        invoiceId,
        amount: payAmount,
        method: methodStr,
        meta: meta || null,
        timestamp: new Date(),
      };

      // Add qpayTxnId if QPAY method (for backward compatibility)
      if (methodStr === "QPAY") {
        const qpayPaymentId =
          meta && typeof meta.qpayPaymentId === "string"
            ? meta.qpayPaymentId.trim()
            : null;
        paymentData.qpayTxnId = qpayPaymentId;
      }

      await trx.payment.create({
        data: paymentData,
      });

      // 2) Re-read all payments to compute new totals
      const payments = await trx.payment.findMany({
        where: { invoiceId },
      });
      const paidTotal = computePaidTotal(payments);

      // 3) Decide new statusLegacy
      let statusLegacy = invoice.statusLegacy || "unpaid";
      if (paidTotal >= baseAmount) {
        statusLegacy = "paid";
      } else if (paidTotal > 0) {
        statusLegacy = "partial";
      } else {
        statusLegacy = "unpaid";
      }

      // ✅ NEW: If fully paid, decrement stock once (SALE movements)
      if (paidTotal >= baseAmount) {
        await ensureSaleStockMovementsOnce(trx, invoice, invoiceId, methodStr);
      }

      // 4) Optionally issue e-Barimt if fully paid and requested and not already issued
      let eBarimtReceipt = invoice.eBarimtReceipt;
      if (
        !hadEBarimt &&
        !eBarimtReceipt &&
        paidTotal >= baseAmount &&
        issueEBarimt === true
      ) {
        const receiptNumber = `MDENT-${invoiceId}-${Date.now()}`;
        const receipt = await trx.eBarimtReceipt.create({
          data: {
            invoiceId,
            receiptNumber,
            timestamp: new Date(),
          },
        });
        eBarimtReceipt = receipt;
      }

      // 5) Update invoice with new statusLegacy
      const updatedInvoice = await trx.invoice.update({
        where: { id: invoiceId },
        data: {
          statusLegacy,
        },
        include: {
          items: true,
          payments: true,
          eBarimtReceipt: true,
        },
      });

      // 6) Update appointment status based on payment totals
      if (invoice.encounter?.appointmentId) {
        let newAppointmentStatus;
        
        if (paidTotal === 0) {
          newAppointmentStatus = "ready_to_pay";
        } else if (paidTotal >= baseAmount) {
          newAppointmentStatus = "completed";
        } else {
          // 0 < paidTotal < baseAmount
          newAppointmentStatus = "partial_paid";
        }

        await trx.appointment.update({
          where: { id: invoice.encounter.appointmentId },
          data: { status: newAppointmentStatus },
        });
      }

      return { updatedInvoice, paidTotal };
    });

    const { updatedInvoice, paidTotal } = updated;

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
      })),
    });
  } catch (err) {
    console.error("POST /api/invoices/:id/settlement error:", err);
    return res.status(500).json({ error: "Failed to settle invoice payment." });
  }
});

export default router;
