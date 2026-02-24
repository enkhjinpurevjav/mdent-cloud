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
 * Environment variables:
 *   POSAPI_BASE_URL      – Base URL for POSAPI
 *   POSAPI_MERCHANT_TIN  – Merchant TIN
 *   POSAPI_POS_NO        – POS number
 *   POSAPI_BRANCH_NO     – Branch number
 *   POSAPI_DISTRICT_CODE – District code (default: "34")
 *   POSAPI_BILL_ID_SUFFIX – Bill ID suffix (optional)
 *   EBARIMT_SKIP         – "true" to skip external call (dev/CI/test)
 */

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
    merchantTin: process.env.POSAPI_MERCHANT_TIN || "",
    posNo: process.env.POSAPI_POS_NO || "",
    branchNo: process.env.POSAPI_BRANCH_NO || "",
    districtCode: process.env.POSAPI_DISTRICT_CODE || "34",
    billIdSuffix: process.env.POSAPI_BILL_ID_SUFFIX || "",
  };
}

/**
 * Build the POSAPI receipt payload for an invoice.
 */
function buildPayload(invoice, config) {
  const amount = Number(invoice.finalAmount ?? invoice.totalAmount ?? 0);
  const billId = `${invoice.id}${config.billIdSuffix}`;
  const buyerType = invoice.buyerType || "B2C";
  const customerTin = buyerType === "B2B" ? (invoice.buyerTin || null) : null;

  return {
    merchantTin: config.merchantTin,
    posNo: config.posNo,
    branchNo: config.branchNo,
    districtCode: config.districtCode,
    billId,
    // B2C=1 B2B=3
    billType: buyerType === "B2B" ? "3" : "1",
    customerTin,
    taxType: "VAT_FREE",
    totalAmount: amount,
    totalVAT: 0,
    totalCityTax: 0,
    items: [
      {
        name: "Эмнэлгийн үйлчилгээний төлбөр",
        qty: 1,
        unitPrice: amount,
        totalAmount: amount,
        taxProductCode: null,
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

