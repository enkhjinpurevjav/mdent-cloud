import express from "express";
import prisma from "../db.js";
import * as qpayService from "../services/qpayService.js";

const router = express.Router();

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
 * GET/POST /api/qpay/callback
 * QPay callback endpoint (webhook)
 * Minimal implementation - log and return 200
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

    // Try to map to intent if possible
    if (invoice_id) {
      const intent = await prisma.qPayIntent.findUnique({
        where: { qpayInvoiceId: String(invoice_id) },
      });

      if (intent && intent.status !== "PAID") {
        await prisma.qPayIntent.update({
          where: { qpayInvoiceId: String(invoice_id) },
          data: {
            status: "PAID",
            qpayPaymentId: payment_id ? String(payment_id) : intent.qpayPaymentId,
            updatedAt: new Date(),
          },
        });
        console.log(`QPay callback: Updated intent ${intent.id} to PAID`);
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

    // Try to map to intent if possible
    if (invoice_id) {
      const intent = await prisma.qPayIntent.findUnique({
        where: { qpayInvoiceId: String(invoice_id) },
      });

      if (intent && intent.status !== "PAID") {
        await prisma.qPayIntent.update({
          where: { qpayInvoiceId: String(invoice_id) },
          data: {
            status: "PAID",
            qpayPaymentId: payment_id ? String(payment_id) : intent.qpayPaymentId,
            updatedAt: new Date(),
          },
        });
        console.log(`QPay callback: Updated intent ${intent.id} to PAID`);
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
