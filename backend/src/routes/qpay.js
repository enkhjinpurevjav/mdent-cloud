import express from "express";
import prisma from "../db.js";
import * as qpayService from "../services/qpayService.js";
import { BookingStatus } from "@prisma/client";
import { getOnlineBookingDepositAmount } from "../utils/onlineBookingConfig.js";
import { ensureOnlineAppointmentForBooking } from "../services/onlineBookingAppointmentSync.js";
import { ensureOnlineBookingPatientForPayment } from "../services/onlineBookingPatientSync.js";

const router = express.Router();

const ONLINE_BOOKING_DEPOSIT_AMOUNT = getOnlineBookingDepositAmount();

function toSafeDate(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

async function markOnlineBookingConfirmedAfterPaid(bookingId, payment = null) {
  await prisma.$transaction(async (tx) => {
    if (payment) {
      await tx.bookingDeposit.update({
        where: { bookingId },
        data: {
          status: "PAID",
          paidAmount: payment.paidAmount,
          qpayPaymentId: payment.paymentId || null,
          paidAt: payment.paidAt,
          raw: payment.raw ?? undefined,
        },
      });
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.ONLINE_CONFIRMED },
    });

    await tx.onlineBookingDraft.updateMany({
      where: { bookingId, status: { not: "PAID" } },
      data: { status: "PAID" },
    });
  });
}

async function syncOnlineBookingPaidSideEffects(bookingId) {
  try {
    await prisma.$transaction(async (tx) => {
      await ensureOnlineBookingPatientForPayment(tx, bookingId);
      await tx.onlineBookingDraft.updateMany({
        where: { bookingId, status: { not: "PAID" } },
        data: { status: "PAID" },
      });
    });
  } catch (patientErr) {
    console.error("QPay booking callback patient sync failed:", patientErr);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await ensureOnlineAppointmentForBooking(tx, bookingId);
    });
  } catch (appointmentErr) {
    console.error("QPay booking callback appointment sync failed:", appointmentErr);
  }
}

/**
 * POST /api/qpay/invoice
 * Create QPay invoice for an M Dent invoice
 * Body: { invoiceId: number, amount: number, description?: string }
 */
router.post("/invoice", async (req, res) => {
  try {
    const { invoiceId, amount, description } = req.body || {};

    // Validate inputs
    const invId = Number(invoiceId);
    const amt = Number(amount);

    if (!invId || Number.isNaN(invId) || invId <= 0) {
      return res.status(400).json({ error: "Valid invoiceId is required" });
    }

    if (!amt || Number.isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: "Valid amount > 0 is required" });
    }

    // Load invoice with patient info
    const invoice = await prisma.invoice.findUnique({
      where: { id: invId },
      include: {
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

    // Build description
    const patient = invoice.encounter?.patientBook?.patient;
    const patientName = patient
      ? `${patient.ovog || ""} ${patient.name || ""}`.trim() || `Patient #${patient.id}`
      : "Unknown";
    const desc =
      description ||
      `M Dent Invoice #${invId} for ${patientName}`;

    // Generate unique sender_invoice_no
    const senderInvoiceNo = `INV-${invId}-${Date.now()}`;

    // Call QPay service
    const qpayResponse = await qpayService.createInvoice({
      sender_invoice_no: senderInvoiceNo,
      amount: amt,
      description: desc,
    });

    // Determine environment
    const env = (process.env.QPAY_ENV || "sandbox").toLowerCase();

    // Persist QPayIntent
    const intent = await prisma.qPayIntent.create({
      data: {
        environment: env,
        objectType: "INVOICE",
        objectId: invId,
        qpayInvoiceId: qpayResponse.invoice_id,
        senderInvoiceNo: senderInvoiceNo,
        amount: amt,
        status: "NEW",
        raw: qpayResponse.raw || {},
      },
    });

    return res.json({
      qpayInvoiceId: intent.qpayInvoiceId,
      senderInvoiceNo: intent.senderInvoiceNo,
      amount: intent.amount,
      qrText: qpayResponse.qr_text,
      qrImage: qpayResponse.qr_image,
      urls: qpayResponse.urls,
    });
  } catch (err) {
    console.error("POST /api/qpay/invoice error:", err);
    return res.status(500).json({
      error: err.message || "Failed to create QPay invoice",
    });
  }
});

/**
 * POST /api/qpay/check
 * Check payment status for a QPay invoice
 * Body: { qpayInvoiceId: string }
 */
router.post("/check", async (req, res) => {
  try {
    const { qpayInvoiceId } = req.body || {};

    if (!qpayInvoiceId || typeof qpayInvoiceId !== "string") {
      return res.status(400).json({ error: "qpayInvoiceId is required" });
    }

    // Call QPay service
    const checkResult = await qpayService.checkInvoicePaid(qpayInvoiceId);

    // Find intent in DB
    const intent = await prisma.qPayIntent.findUnique({
      where: { qpayInvoiceId },
    });

    if (!intent) {
      return res.status(404).json({ error: "QPayIntent not found in database" });
    }

    // Update intent status
    const newStatus = checkResult.paid ? "PAID" : intent.status;
    const updateData = {
      status: newStatus,
      paidAmount: checkResult.paid ? checkResult.paidAmount : intent.paidAmount,
      qpayPaymentId: checkResult.paymentId || intent.qpayPaymentId,
      raw: checkResult.raw || intent.raw,
      updatedAt: new Date(),
    };

    await prisma.qPayIntent.update({
      where: { qpayInvoiceId },
      data: updateData,
    });

    return res.json({
      status: newStatus,
      paid: checkResult.paid,
      paidAmount: checkResult.paidAmount || 0,
      paymentId: checkResult.paymentId,
      transactionType: checkResult.transactionType,
      paidAt: checkResult.paidAt,
    });
  } catch (err) {
    console.error("POST /api/qpay/check error:", err);
    return res.status(500).json({
      error: err.message || "Failed to check QPay payment status",
    });
  }
});

/**
 * GET/POST /api/qpay/booking/callback
 * QPay booking deposit callback endpoint.
 * Validates token, calls payment/check, updates booking status.
 */
async function handleBookingCallback(bookingId, token, meta = {}) {
  const normalizedInvoiceId = meta.invoiceId ? String(meta.invoiceId) : null;
  const normalizedSenderInvoiceNo = meta.senderInvoiceNo ? String(meta.senderInvoiceNo) : null;
  const parsedBookingId = Number(bookingId);

  try {
    let deposit = null;

    if (!Number.isNaN(parsedBookingId) && parsedBookingId > 0) {
      deposit = await prisma.bookingDeposit.findUnique({
        where: { bookingId: parsedBookingId },
      });
    }

    if (!deposit && normalizedInvoiceId) {
      deposit = await prisma.bookingDeposit.findUnique({
        where: { qpayInvoiceId: normalizedInvoiceId },
      });
    }

    if (!deposit && normalizedSenderInvoiceNo) {
      deposit = await prisma.bookingDeposit.findUnique({
        where: { senderInvoiceNo: normalizedSenderInvoiceNo },
      });
    }

    if (!deposit) {
      console.warn("QPay booking callback: deposit not found", {
        bookingId,
        invoiceId: normalizedInvoiceId,
        senderInvoiceNo: normalizedSenderInvoiceNo,
      });
      return;
    }

    const bid = deposit.bookingId;
    if (token) {
      if (deposit.callbackToken !== String(token)) {
        console.warn("QPay booking callback: invalid token for bookingId", bid);
        return;
      }
    } else {
      const hasProviderIdentifiers = Boolean(normalizedInvoiceId || normalizedSenderInvoiceNo);
      const invoiceMatch = !normalizedInvoiceId
        || String(deposit.qpayInvoiceId) === normalizedInvoiceId;
      const senderMatch = !normalizedSenderInvoiceNo
        || String(deposit.senderInvoiceNo) === normalizedSenderInvoiceNo;

      // If callback did not return our query params, accept only when linked by QPay identifiers.
      if (!hasProviderIdentifiers || !invoiceMatch || !senderMatch) {
        console.warn("QPay booking callback: insufficient identifiers without token", {
          bookingId,
          invoiceId: normalizedInvoiceId,
          senderInvoiceNo: normalizedSenderInvoiceNo,
          resolvedBookingId: bid,
        });
        return;
      }
    }

    // Already settled
    if (deposit.status === "PAID") {
      await markOnlineBookingConfirmedAfterPaid(bid);
      await syncOnlineBookingPaidSideEffects(bid);
      return;
    }
    if (deposit.status === "EXPIRED" || deposit.status === "CANCELLED") {
      return;
    }

    // Call payment/check as source of truth
    const checkResult = await qpayService.checkInvoicePaid(deposit.qpayInvoiceId, deposit.branchId);

    if (checkResult.paid && checkResult.paidAmount >= ONLINE_BOOKING_DEPOSIT_AMOUNT) {
      await markOnlineBookingConfirmedAfterPaid(bid, {
        paidAmount: checkResult.paidAmount,
        paymentId: checkResult.paymentId || null,
        paidAt: toSafeDate(checkResult.paidAt) || new Date(),
        raw: checkResult.raw,
      });
      await syncOnlineBookingPaidSideEffects(bid);
      console.log(`QPay booking callback: bookingId=${bid} confirmed`);
    }
  } catch (err) {
    console.error("QPay booking callback handler error:", err);
  }
}

router.get("/booking/callback", async (req, res) => {
  const { bookingId, token } = req.query || {};
  // Respond 200 immediately
  res.status(200).send("OK");
  await handleBookingCallback(bookingId, token, {
    method: "GET",
    invoiceId: req.query?.invoice_id || req.query?.invoiceId || null,
    senderInvoiceNo: req.query?.sender_invoice_no || req.query?.senderInvoiceNo || null,
  });
});

router.post("/booking/callback", async (req, res) => {
  const bookingId = req.query.bookingId || req.body?.bookingId;
  const token = req.query.token || req.body?.token;
  // Respond 200 immediately
  res.status(200).json({ success: true });
  await handleBookingCallback(bookingId, token, {
    method: "POST",
    invoiceId:
      req.query?.invoice_id
      || req.query?.invoiceId
      || req.body?.invoice_id
      || req.body?.invoiceId
      || null,
    senderInvoiceNo:
      req.query?.sender_invoice_no
      || req.query?.senderInvoiceNo
      || req.body?.sender_invoice_no
      || req.body?.senderInvoiceNo
      || null,
  });
});

/**
 * GET/POST /api/qpay/callback
 * QPay callback endpoint (webhook) for invoice intents.
 * Hardened: verifies via payment/check instead of blindly setting PAID.
 */
router.get("/callback", async (req, res) => {
  try {
    const { payment_id, invoice_id, sender_invoice_no } = req.query || {};
    
    console.log("QPay callback (GET):", {
      payment_id,
      invoice_id,
      sender_invoice_no,
      query: req.query,
    });

    if (invoice_id) {
      const intent = await prisma.qPayIntent.findUnique({
        where: { qpayInvoiceId: String(invoice_id) },
      });

      if (intent && intent.status !== "PAID") {
        // Verify via payment/check
        try {
          const checkResult = await qpayService.checkInvoicePaid(String(invoice_id));
          if (checkResult.paid) {
            await prisma.qPayIntent.update({
              where: { qpayInvoiceId: String(invoice_id) },
              data: {
                status: "PAID",
                paidAmount: checkResult.paidAmount,
                qpayPaymentId: checkResult.paymentId || intent.qpayPaymentId,
                raw: checkResult.raw || intent.raw,
                updatedAt: new Date(),
              },
            });
            console.log(`QPay callback: Updated intent ${intent.id} to PAID`);
          }
        } catch (checkErr) {
          console.error("QPay callback: payment/check failed:", checkErr);
        }
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("GET /api/qpay/callback error:", err);
    return res.status(200).send("OK"); // Still return 200 to QPay
  }
});

router.post("/callback", async (req, res) => {
  try {
    const { payment_id, invoice_id, sender_invoice_no } = req.body || {};
    
    console.log("QPay callback (POST):", {
      payment_id,
      invoice_id,
      sender_invoice_no,
      body: req.body,
    });

    if (invoice_id) {
      const intent = await prisma.qPayIntent.findUnique({
        where: { qpayInvoiceId: String(invoice_id) },
      });

      if (intent && intent.status !== "PAID") {
        // Verify via payment/check
        try {
          const checkResult = await qpayService.checkInvoicePaid(String(invoice_id));
          if (checkResult.paid) {
            await prisma.qPayIntent.update({
              where: { qpayInvoiceId: String(invoice_id) },
              data: {
                status: "PAID",
                paidAmount: checkResult.paidAmount,
                qpayPaymentId: checkResult.paymentId || intent.qpayPaymentId,
                raw: checkResult.raw || intent.raw,
                updatedAt: new Date(),
              },
            });
            console.log(`QPay callback: Updated intent ${intent.id} to PAID`);
          }
        } catch (checkErr) {
          console.error("QPay callback: payment/check failed:", checkErr);
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("POST /api/qpay/callback error:", err);
    return res.status(200).json({ success: true }); // Still return 200 to QPay
  }
});

// Dev-only helper endpoint
if (process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_QPAY === "true") {
  router.post("/dev/create-test-invoice", async (req, res) => {
    try {
      const { invoiceId } = req.body || {};
      const invId = Number(invoiceId);

      if (!invId || Number.isNaN(invId)) {
        return res.status(400).json({ error: "Valid invoiceId required" });
      }

      const invoice = await prisma.invoice.findUnique({
        where: { id: invId },
        include: {
          encounter: {
            include: {
              patientBook: { include: { patient: true } },
            },
          },
        },
      });

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const amount = invoice.finalAmount || invoice.totalAmount || 1000;
      const patient = invoice.encounter?.patientBook?.patient;
      const patientName = patient
        ? `${patient.ovog || ""} ${patient.name || ""}`.trim() || `Patient #${patient.id}`
        : "Unknown";
      const desc = `TEST: M Dent Invoice #${invId} for ${patientName}`;
      const senderInvoiceNo = `TEST-INV-${invId}-${Date.now()}`;

      const qpayResponse = await qpayService.createInvoice({
        sender_invoice_no: senderInvoiceNo,
        amount,
        description: desc,
      });

      const env = (process.env.QPAY_ENV || "sandbox").toLowerCase();
      const intent = await prisma.qPayIntent.create({
        data: {
          environment: env,
          objectType: "INVOICE",
          objectId: invId,
          qpayInvoiceId: qpayResponse.invoice_id,
          senderInvoiceNo: senderInvoiceNo,
          amount,
          status: "NEW",
          raw: qpayResponse.raw || {},
        },
      });

      return res.json({
        message: "Test QPay invoice created",
        qpayInvoiceId: intent.qpayInvoiceId,
        senderInvoiceNo: intent.senderInvoiceNo,
        amount: intent.amount,
        qr_text: qpayResponse.qr_text,
        qrImage: qpayResponse.qr_image,
        urls: qpayResponse.urls,
      });
    } catch (err) {
      console.error("Dev test invoice creation error:", err);
      return res.status(500).json({
        error: err.message || "Failed to create test QPay invoice",
      });
    }
  });
}

export default router;
