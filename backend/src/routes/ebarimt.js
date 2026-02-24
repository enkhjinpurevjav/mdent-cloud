/**
 * eBarimt POSAPI 3.0 Routes
 *
 * Mounted at /api/ebarimt in index.js.
 * All routes require authentication (authenticateJWT).
 */

import express from "express";
import prisma from "../db.js";
import { authenticateJWT } from "../middleware/auth.js";
import {
  issueEbarimtForInvoice,
  refundEbarimtByInvoice,
} from "../services/eBarimtService.js";
import * as posapi from "../services/posapiClient.js";
import { sendOperatorMerchantRequest } from "../services/posapiClient.js";

const router = express.Router();

// All ebarimt routes require auth
router.use(authenticateJWT);

// ---------------------------------------------------------------------------
// POST /api/ebarimt/invoices/:invoiceId/issue  — manual issue / retry
// ---------------------------------------------------------------------------
router.post("/invoices/:invoiceId/issue", async (req, res) => {
  try {
    const invoiceId = Number(req.params.invoiceId);
    if (!invoiceId || isNaN(invoiceId)) {
      return res.status(400).json({ error: "Invalid invoiceId" });
    }

    const result = await issueEbarimtForInvoice(invoiceId, req.user?.id);

    if (!result.success) {
      return res.status(502).json({
        error: result.errorMessage || "eBarimt гаргахад алдаа гарлаа",
      });
    }

    // Return ddtd and any display data (qrData etc) to client for printing
    return res.json({
      success: true,
      ddtd: result.ddtd,
      receiptForDisplay: result.receiptForDisplay || null,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ebarimt/invoices/:invoiceId/refund
// ---------------------------------------------------------------------------
router.post("/invoices/:invoiceId/refund", async (req, res) => {
  try {
    const invoiceId = Number(req.params.invoiceId);
    if (!invoiceId || isNaN(invoiceId)) {
      return res.status(400).json({ error: "Invalid invoiceId" });
    }

    await refundEbarimtByInvoice(invoiceId, req.user?.id);

    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/ebarimt/posapi/info
// ---------------------------------------------------------------------------
router.get("/posapi/info", async (_req, res) => {
  try {
    const data = await posapi.getInfo();
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ebarimt/posapi/send  — send to unified system
// ---------------------------------------------------------------------------
router.post("/posapi/send", async (_req, res) => {
  try {
    const data = await posapi.sendToUnifiedSystem();
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/ebarimt/bank-accounts?tin=...
// ---------------------------------------------------------------------------
router.get("/bank-accounts", async (req, res) => {
  try {
    const { tin } = req.query;
    if (!tin) {
      return res.status(400).json({ error: "tin query parameter is required" });
    }
    const data = await posapi.getBankAccountsByTin(tin);
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Operator Merchant Request
// ---------------------------------------------------------------------------

// POST /api/ebarimt/operator/merchant-request
router.post("/operator/merchant-request", async (req, res) => {
  try {
    const { posNo, merchantTin } = req.body || {};
    if (!posNo || !merchantTin) {
      return res
        .status(400)
        .json({ error: "posNo and merchantTin are required" });
    }

    const token = process.env.POSAPI_OPERATOR_TOKEN || "";
    const apiKey = process.env.POSAPI_OPERATOR_API_KEY || "";

    if (!token || !apiKey) {
      return res.status(500).json({
        error:
          "POSAPI_OPERATOR_TOKEN and POSAPI_OPERATOR_API_KEY must be configured",
      });
    }

    const payload = { posNo, merchantTin };

    // Create request record (PENDING)
    const record = await prisma.operatorMerchantRequest.create({
      data: {
        posNo,
        merchantTin,
        status: "PENDING",
        rawRequest: payload,
        requestedAt: new Date(),
      },
    });

    let rawResponse = null;
    let errorMessage = null;
    let finalStatus = "PENDING";

    try {
      rawResponse = await sendOperatorMerchantRequest(payload, token, apiKey);
      finalStatus = "PENDING"; // approval is manual admin action
    } catch (err) {
      errorMessage = err.message;
      rawResponse = err.responseData || null;
      finalStatus = "FAILED";
    }

    const updated = await prisma.operatorMerchantRequest.update({
      where: { id: record.id },
      data: {
        status: finalStatus,
        rawResponse: rawResponse || null,
        errorMessage: errorMessage || null,
      },
    });

    if (finalStatus === "FAILED") {
      return res.status(502).json({
        error: errorMessage,
        requestId: updated.id,
      });
    }

    return res.json({ success: true, requestId: updated.id, status: finalStatus });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/ebarimt/operator/merchant-request/:id/approve
router.post("/operator/merchant-request/:id/approve", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const record = await prisma.operatorMerchantRequest.findUnique({
      where: { id },
    });
    if (!record) {
      return res.status(404).json({ error: "Request not found" });
    }

    const updated = await prisma.operatorMerchantRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        decidedAt: new Date(),
      },
    });

    return res.json({ success: true, id: updated.id, status: updated.status });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/ebarimt/operator/merchant-request/:id
router.get("/operator/merchant-request/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const record = await prisma.operatorMerchantRequest.findUnique({
      where: { id },
    });
    if (!record) {
      return res.status(404).json({ error: "Request not found" });
    }

    return res.json(record);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
