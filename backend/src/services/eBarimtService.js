/**
 * eBarimt POSAPI 3.0 Service
 *
 * Issues, retries, and refunds electronic receipts (касс баримт) via POSAPI 3.0.
 *
 * Policy:
 * - Issue only when invoice is fully paid.
 * - Single synthetic line item: "Эмнэлгийн үйлчилгээний төлбөр" qty=1 unitPrice=totalAmount.
 * - Tax: always VAT_FREE; totalVAT=0, totalCityTax=0.
 * - Payment: CASH PAID amount=totalAmount.
 * - On failure: mark FAILED, do NOT rollback settlement.
 * - Compliance: do NOT persist lottery, qrData, or qrDate in DB or logs.
 *
 * POSAPI 3.0 payload uses:
 *   type          – "B2C_RECEIPT" or "B2B_RECEIPT"
 *   billIdSuffix  – digits-only, deterministic per invoice per day (hash of YYYYMMDD-invoiceId)
 *   receipts[]    – array with taxType and items[]
 *
 * Environment variables:
 *   POSAPI_BASE_URL      – Base URL for POSAPI (e.g. http://100.76.13.118:7080)
 *   POSAPI_MERCHANT_TIN  – Merchant TIN (required)
 *   POSAPI_POS_NO        – POS number (required)
 *   POSAPI_BRANCH_NO     – Branch number, 3-digit string e.g. "001" (required)
 *   POSAPI_DISTRICT_CODE – District code, 4-digit string e.g. "2501" (required)
 *   POSAPI_CONSUMER_NO   – Tenant/final-consumer TIN sent as consumerNo (default: "30000000000")
 *   EBARIMT_SKIP         – "true" to skip external call (dev/CI/test)
 */

import crypto from "node:crypto";
import prisma from "../db.js";
import * as posapi from "./posapiClient.js";

/**
 * Format a Date to "yyyy-MM-dd HH:mm:ss" (used in POSAPI cancel requests).
 * @param {Date} date
 * @returns {string}
 */
export function formatPosapiDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

/**
 * Generate a digits-only billIdSuffix deterministic per invoice per day.
 * Uses SHA-256 of "YYYYMMDD-{invoiceId}", takes first 8 hex chars as decimal, zero-padded to 8 digits.
 * @param {Date} date
 * @param {number|string} invoiceId
 * @returns {string} 8-digit string
 */
export function generateBillIdSuffix(date, invoiceId) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const dateStr = `${y}${mo}${d}`;
  const hash = crypto
    .createHash("sha256")
    .update(`${dateStr}-${invoiceId}`)
    .digest("hex");
  const num = parseInt(hash.slice(0, 8), 16) % 100000000;
  return String(num).padStart(8, "0");
}

/**
 * Validate a DDTD (receipt ID): must be 33 digits.
 * @param {string} ddtd
 * @returns {boolean}
 */
export function isValidDdtd(ddtd) {
  return typeof ddtd === "string" && /^\d{33}$/.test(ddtd);
}

/**
 * Validate a TIN: must be 11 or 14 digits.
 * @param {string} tin
 * @returns {boolean}
 */
export function isValidTin(tin) {
  return typeof tin === "string" && /^(\d{11}|\d{14})$/.test(tin);
}

/**
 * Remove compliance-prohibited fields from a POSAPI response object before storing.
 * Fields: lottery, qrData, qrDate.
 * @param {object|null} obj
 * @returns {object|null}
 */
function scrubResponse(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const scrubbed = { ...obj };
  delete scrubbed.lottery;
  delete scrubbed.qrData;
  delete scrubbed.qrDate;
  return scrubbed;
}

function envConfig() {
  return {
    merchantTin: (process.env.POSAPI_MERCHANT_TIN || "").trim(),
    posNo: (process.env.POSAPI_POS_NO || "").trim(),
    branchNo: (process.env.POSAPI_BRANCH_NO || "").trim(),
    districtCode: (process.env.POSAPI_DISTRICT_CODE || "2501").trim(),
    consumerNo: (process.env.POSAPI_CONSUMER_NO || "99119911").trim(),
  };
}

/**
 * Build the POSAPI 3.0 receipt payload for an invoice.
 */
function buildPayload(invoice, config) {
  const amount = Number(invoice.finalAmount ?? invoice.totalAmount ?? 0);
  const buyerType = invoice.buyerType || "B2C";
  const type = buyerType === "B2B" ? "B2B_RECEIPT" : "B2C_RECEIPT";
  const billIdSuffix = generateBillIdSuffix(new Date(), invoice.id);

  const payload = {
    branchNo: config.branchNo,
    districtCode: config.districtCode,
    merchantTin: config.merchantTin,
    posNo: config.posNo,
    consumerNo: config.consumerNo,
    type,
    billIdSuffix,
    totalAmount: amount,
    totalVAT: 0,
    totalCityTax: 0,
    receipts: [
      {
        taxType: "VAT_FREE",
        merchantTin: config.merchantTin,
        items: [
          {
            name: "Эмнэлгийн үйлчилгээний төлбөр",
            barCode: "10000001",
            classificationCode: "4813000",
            measureUnit: "ш",
            qty: 1,
            unitPrice: amount,
            totalAmount: amount,
            taxProductCode: null,
          },
        ],
      },
    ],
    payments: [
      {
        code: "CASH",
        status: "PAID",
        paidAmount: amount,
      },
    ],
  };

  if (buyerType === "B2B") {
    payload.customerTin = invoice.buyerTin || null;
  }

  return payload;
}

/**
 * Issue an eBarimt receipt for a fully-paid invoice.
 * Creates/upserts EBarimtReceipt as PENDING, calls POSAPI, updates status.
 * Failures do NOT throw — they are stored as FAILED so admin can retry.
 *
 * @param {number} invoiceId
 * @param {number|null} [userId] — for audit (unused in DB currently)
 * @returns {Promise<{ success: boolean, ddtd?: string, errorMessage?: string, receiptForDisplay?: object }>}
 */
export async function issueEbarimtForInvoice(invoiceId, userId) {
  const skip =
    process.env.EBARIMT_SKIP === "true" || process.env.NODE_ENV === "test";

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true, eBarimtReceipt: true },
  });

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  const baseAmount = Number(invoice.finalAmount ?? invoice.totalAmount ?? 0);
  const paidTotal = (invoice.payments || []).reduce(
    (s, p) => s + Number(p.amount || 0),
    0
  );

  if (paidTotal < baseAmount) {
    throw new Error(
      `Invoice ${invoiceId} is not fully paid (paid=${paidTotal}, base=${baseAmount})`
    );
  }

  if (invoice.buyerType === "B2B" && !invoice.buyerTin) {
    throw new Error(
      "B2B баримт гаргахын тулд худалдан авагчийн ТТД шаардлагатай."
    );
  }

  const config = envConfig();

  // Validate required env vars
  const missingVars = [];
  if (!config.merchantTin) missingVars.push("POSAPI_MERCHANT_TIN");
  if (!config.posNo) missingVars.push("POSAPI_POS_NO");
  if (!config.branchNo) missingVars.push("POSAPI_BRANCH_NO");
  if (!config.districtCode) missingVars.push("POSAPI_DISTRICT_CODE");
  if (missingVars.length > 0) {
    throw new Error(`Missing required env vars: ${missingVars.join(", ")}`);
  }

  // Upsert receipt record as PENDING
  const receipt = await prisma.eBarimtReceipt.upsert({
    where: { invoiceId },
    create: {
      invoiceId,
      status: "PENDING",
      totalAmount: baseAmount,
      merchantTin: config.merchantTin || null,
      posNo: config.posNo || null,
      branchNo: config.branchNo || null,
      districtCode: config.districtCode || null,
      sentAt: new Date(),
    },
    update: {
      status: "PENDING",
      totalAmount: baseAmount,
      merchantTin: config.merchantTin || null,
      posNo: config.posNo || null,
      branchNo: config.branchNo || null,
      districtCode: config.districtCode || null,
      sentAt: new Date(),
      errorMessage: null,
    },
  });

  if (skip) {
    // Dev/CI: return a deterministic stub
    const stubDdtd = String(invoiceId).padStart(33, "0");
    const now = new Date();
    await prisma.eBarimtReceipt.update({
      where: { id: receipt.id },
      data: {
        status: "SUCCESS",
        ddtd: stubDdtd,
        printedAt: now,
        printedAtText: formatPosapiDate(now),
        confirmedAt: now,
        issueRawResponse: { stub: true, ddtd: stubDdtd },
      },
    });
    return { success: true, ddtd: stubDdtd };
  }

  const payload = buildPayload(invoice, config);

  let rawResponse = null;
  try {
    rawResponse = await posapi.issueReceipt(payload);
  } catch (err) {
    // Store failure, do NOT rollback
    await prisma.eBarimtReceipt.update({
      where: { id: receipt.id },
      data: {
        status: "FAILED",
        errorMessage: err.message,
        issueRawRequest: payload,
        issueRawResponse: err.responseData
          ? scrubResponse(err.responseData)
          : null,
      },
    });
    return { success: false, errorMessage: err.message };
  }

  const ddtd = rawResponse?.id || rawResponse?.ddtd || rawResponse?.billId;
  const printedAtRaw = rawResponse?.date || rawResponse?.printedAt;
  let printedAt = null;
  if (printedAtRaw) {
    printedAt = new Date(printedAtRaw);
    if (isNaN(printedAt.getTime())) printedAt = null;
  }
  let printedAtText = null;
  if (printedAtRaw) {
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(printedAtRaw))) {
      printedAtText = String(printedAtRaw);
    } else if (printedAt) {
      printedAtText = formatPosapiDate(printedAt);
    }
  }

  const scrubbedResponse = scrubResponse(rawResponse);

  // POSAPI 3.0 returns status: "SUCCESS" | "ERROR" | "PAYMENT"
  const apiStatus = rawResponse?.status;
  const isApiSuccess = apiStatus === "SUCCESS" || (!apiStatus && rawResponse !== null);

  if (!isApiSuccess) {
    const errMsg = rawResponse?.message || `POSAPI status: ${apiStatus}`;
    await prisma.eBarimtReceipt.update({
      where: { id: receipt.id },
      data: {
        status: "FAILED",
        errorMessage: errMsg,
        issueRawRequest: payload,
        issueRawResponse: scrubbedResponse,
      },
    });
    return { success: false, errorMessage: errMsg };
  }

  await prisma.eBarimtReceipt.update({
    where: { id: receipt.id },
    data: {
      status: "SUCCESS",
      ddtd: ddtd ? String(ddtd) : null,
      printedAt,
      printedAtText,
      confirmedAt: new Date(),
      issueRawRequest: payload,
      issueRawResponse: scrubbedResponse,
    },
  });

  // Return receipt data for immediate display/printing (qrData etc allowed in response, not in DB)
  const receiptForDisplay = rawResponse;

  return { success: true, ddtd: ddtd ? String(ddtd) : null, receiptForDisplay };
}

/**
 * Refund/cancel an eBarimt receipt by invoice ID.
 * Only allowed if receipt status is SUCCESS.
 * Calls POSAPI DELETE /rest/receipt.
 *
 * @param {number} invoiceId
 * @param {number|null} [userId]
 */
export async function refundEbarimtByInvoice(invoiceId, userId) {
  const receipt = await prisma.eBarimtReceipt.findUnique({
    where: { invoiceId },
  });

  if (!receipt) {
    throw new Error(`eBarimt баримт олдсонгүй (invoiceId=${invoiceId})`);
  }

  if (receipt.status !== "SUCCESS") {
    throw new Error(
      `Зөвхөн SUCCESS төлөвтэй баримтыг цуцалж болно (одоогийн төлөв: ${receipt.status})`
    );
  }

  if (!receipt.ddtd) {
    throw new Error("Баримтын ddtd (ID) байхгүй тул цуцлах боломжгүй.");
  }

  if (!receipt.printedAtText) {
    throw new Error(
      "Баримтын printedAt огноо байхгүй тул цуцлах боломжгүй."
    );
  }

  const skip =
    process.env.EBARIMT_SKIP === "true" || process.env.NODE_ENV === "test";

  const cancelRequest = { id: receipt.ddtd, date: receipt.printedAtText };

  if (skip) {
    await prisma.eBarimtReceipt.update({
      where: { id: receipt.id },
      data: {
        status: "CANCELED",
        cancelRawRequest: cancelRequest,
        cancelRawResponse: { stub: true },
      },
    });
    return { success: true };
  }

  let rawResponse = null;
  try {
    rawResponse = await posapi.refundReceipt(receipt.ddtd, receipt.printedAtText);
  } catch (err) {
    throw new Error(`POSAPI цуцлах алдаа: ${err.message}`);
  }

  await prisma.eBarimtReceipt.update({
    where: { id: receipt.id },
    data: {
      status: "CANCELED",
      cancelRawRequest: cancelRequest,
      cancelRawResponse: scrubResponse(rawResponse),
    },
  });

  return { success: true };
}

/**
 * Legacy shim: kept for backward compatibility with settlementService.js.
 * Issues eBarimt for a fully-paid invoice via the new service.
 * In legacy usage, errors are swallowed (settlement is NOT rolled back).
 *
 * @deprecated Use issueEbarimtForInvoice directly.
 */
export async function issueEBarimt({ invoiceId, amount, customerTin }) {
  const skip =
    process.env.EBARIMT_SKIP === "true" || process.env.NODE_ENV === "test";
  if (skip) {
    return `TEST-EBARIMT-${invoiceId}`;
  }
  const result = await issueEbarimtForInvoice(invoiceId, null);
  return result.ddtd || String(invoiceId);
}

