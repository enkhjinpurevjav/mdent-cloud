import express from "express";
import prisma from "../db.js";

const router = express.Router();

/**
 * Helper: compute paid total from a list of payments.
 */
function computePaidTotal(payments) {
  return (payments || []).reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );
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
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
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
          const updatedBenefit = await trx.employeeBenefit.update({
            where: { id: benefit.id },
            data: {
              remainingAmount: {
                decrement: payAmount,
              },
            },
          });

          // 2) Record usage
          await trx.employeeBenefitUsage.create({
            data: {
              employeeBenefitId: benefit.id,
              invoiceId: invoice.id,
              encounterId: invoice.encounterId,
              amountUsed: payAmount,
              patientId: invoice.patientId,
            },
          });

          // 3) Create payment row
          await trx.payment.create({
            data: {
              invoiceId,
              amount: payAmount,
              method: methodStr,
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

          // 6) Optionally issue e-Barimt (same logic as below)
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
        console.error(
          "EMPLOYEE_BENEFIT settlement transaction error:",
          err
        );
        return res
          .status(400)
          .json({ error: err.message || "Төлбөр бүртгэхэд алдаа гарлаа." });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // DEFAULT: other methods (CASH, QPAY, POS, TRANSFER, etc.)
    // ─────────────────────────────────────────────────────────────

    // Create payment + update invoice in a transaction
    const updated = await prisma.$transaction(async (trx) => {
      // 1) Create new payment row
      await trx.payment.create({
        data: {
          invoiceId,
          amount: payAmount,
          method: methodStr,
          timestamp: new Date(),
        },
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
    console.error("POST /api/invoices/:id/settlement error:", err);
    return res
      .status(500)
      .json({ error: "Failed to settle invoice payment." });
  }
});

export default router;
