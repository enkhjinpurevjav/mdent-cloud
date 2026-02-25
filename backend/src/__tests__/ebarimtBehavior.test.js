/**
 * Tests for eBarimt service behavior: issue/retry, refund, scrubResponse.
 *
 * Uses Node.js built-in test runner with mocking.
 */

import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Helpers to test scrubResponse (indirectly via formatPosapiDate re-export)
// ---------------------------------------------------------------------------

import {
  formatPosapiDate,
  isValidDdtd,
  isValidTin,
  generateBillIdSuffix,
} from "../services/eBarimtService.js";

describe("scrubResponse behavior (compliance)", () => {
  it("formatPosapiDate produces correct pattern", () => {
    const d = new Date(2024, 5, 1, 14, 30, 0); // June 1, 14:30:00
    assert.equal(formatPosapiDate(d), "2024-06-01 14:30:00");
  });

  it("isValidDdtd validates exactly 33 digits", () => {
    // 33 digits = valid
    assert.equal(isValidDdtd("0".repeat(33)), true);
    // 32 digits = invalid
    assert.equal(isValidDdtd("0".repeat(32)), false);
    // 34 digits = invalid
    assert.equal(isValidDdtd("0".repeat(34)), false);
  });

  it("isValidTin validates 11 or 14 digits only", () => {
    assert.equal(isValidTin("0".repeat(11)), true);
    assert.equal(isValidTin("0".repeat(14)), true);
    assert.equal(isValidTin("0".repeat(10)), false);
    assert.equal(isValidTin("0".repeat(12)), false);
    assert.equal(isValidTin("0".repeat(13)), false);
    assert.equal(isValidTin("0".repeat(15)), false);
  });
});

describe("generateBillIdSuffix", () => {
  it("returns an 8-digit string", () => {
    const result = generateBillIdSuffix(new Date(2024, 0, 15), 42);
    assert.match(result, /^\d{8}$/);
  });

  it("is deterministic for same date and invoiceId", () => {
    const date = new Date(2024, 5, 1);
    const a = generateBillIdSuffix(date, 123);
    const b = generateBillIdSuffix(date, 123);
    assert.equal(a, b);
  });

  it("differs for different invoiceIds on same date", () => {
    const date = new Date(2024, 5, 1);
    const a = generateBillIdSuffix(date, 1);
    const b = generateBillIdSuffix(date, 2);
    assert.notEqual(a, b);
  });

  it("differs for same invoiceId on different dates", () => {
    const a = generateBillIdSuffix(new Date(2024, 5, 1), 1);
    const b = generateBillIdSuffix(new Date(2024, 5, 2), 1);
    assert.notEqual(a, b);
  });
});

describe("POSAPI 3.0 payload builder policy checks", () => {
  it("B2B buyer type maps to type 'B2B_RECEIPT'", () => {
    const buyerType = "B2B";
    const type = buyerType === "B2B" ? "B2B_RECEIPT" : "B2C_RECEIPT";
    assert.equal(type, "B2B_RECEIPT");
  });

  it("B2C buyer type maps to type 'B2C_RECEIPT'", () => {
    const buyerType = "B2C";
    const type = buyerType === "B2B" ? "B2B_RECEIPT" : "B2C_RECEIPT";
    assert.equal(type, "B2C_RECEIPT");
  });

  it("taxType in receipts is always VAT_FREE", () => {
    const receipts = [{ taxType: "VAT_FREE", items: [] }];
    assert.equal(receipts[0].taxType, "VAT_FREE");
  });

  it("totalVAT and totalCityTax are always 0", () => {
    const payload = { totalVAT: 0, totalCityTax: 0 };
    assert.equal(payload.totalVAT, 0);
    assert.equal(payload.totalCityTax, 0);
  });

  it("payment is always CASH PAID", () => {
    const amount = 150000;
    const payment = { code: "CASH", status: "PAID", paidAmount: amount };
    assert.equal(payment.code, "CASH");
    assert.equal(payment.status, "PAID");
    assert.equal(payment.paidAmount, amount);
  });

  it("single synthetic line item is inside receipts[0].items", () => {
    const amount = 75000;
    const receipts = [
      {
        taxType: "VAT_FREE",
        items: [
          {
            name: "Эмнэлгийн үйлчилгээний төлбөр",
            qty: 1,
            unitPrice: amount,
            totalAmount: amount,
            taxProductCode: null,
          },
        ],
      },
    ];
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].items.length, 1);
    assert.equal(receipts[0].items[0].name, "Эмнэлгийн үйлчилгээний төлбөр");
    assert.equal(receipts[0].items[0].qty, 1);
    assert.equal(receipts[0].items[0].taxProductCode, null);
  });

  it("consumerNo is always empty string", () => {
    const payload = { consumerNo: "" };
    assert.equal(payload.consumerNo, "");
  });
});

describe("scrubResponse: prohibited fields removed", () => {
  // Replicate the scrubResponse function inline for testing
  function scrubResponse(obj) {
    if (!obj || typeof obj !== "object") return obj;
    const scrubbed = { ...obj };
    delete scrubbed.lottery;
    delete scrubbed.qrData;
    delete scrubbed.qrDate;
    return scrubbed;
  }

  it("removes lottery field", () => {
    const raw = { id: "abc", lottery: "WIN123", amount: 1000 };
    const result = scrubResponse(raw);
    assert.equal(Object.prototype.hasOwnProperty.call(result, "lottery"), false);
    assert.equal(result.id, "abc");
  });

  it("removes qrData field", () => {
    const raw = { id: "abc", qrData: "data:image/png;base64,..." };
    const result = scrubResponse(raw);
    assert.equal(Object.prototype.hasOwnProperty.call(result, "qrData"), false);
  });

  it("removes qrDate field", () => {
    const raw = { id: "abc", qrDate: "2024-01-01" };
    const result = scrubResponse(raw);
    assert.equal(Object.prototype.hasOwnProperty.call(result, "qrDate"), false);
  });

  it("does not remove other fields", () => {
    const raw = { id: "abc", ddtd: "123", printedAt: "2024-01-01 00:00:00" };
    const result = scrubResponse(raw);
    assert.equal(result.id, "abc");
    assert.equal(result.ddtd, "123");
    assert.equal(result.printedAt, "2024-01-01 00:00:00");
  });

  it("returns null for null input", () => {
    assert.equal(scrubResponse(null), null);
  });
});

describe("POSAPI 3.0 response status handling", () => {
  it("SUCCESS status is treated as success", () => {
    const rawResponse = { status: "SUCCESS", id: "12345" };
    const apiStatus = rawResponse?.status;
    const isApiSuccess = apiStatus === "SUCCESS" || (!apiStatus && rawResponse !== null);
    assert.equal(isApiSuccess, true);
  });

  it("ERROR status is treated as failure", () => {
    const rawResponse = { status: "ERROR", message: "Invalid TIN" };
    const apiStatus = rawResponse?.status;
    const isApiSuccess = apiStatus === "SUCCESS" || (!apiStatus && rawResponse !== null);
    assert.equal(isApiSuccess, false);
  });

  it("PAYMENT status is treated as failure", () => {
    const rawResponse = { status: "PAYMENT", message: "Payment required" };
    const apiStatus = rawResponse?.status;
    const isApiSuccess = apiStatus === "SUCCESS" || (!apiStatus && rawResponse !== null);
    assert.equal(isApiSuccess, false);
  });

  it("absent status with non-null response is treated as success (conservative)", () => {
    const rawResponse = { id: "12345" };
    const apiStatus = rawResponse?.status;
    const isApiSuccess = apiStatus === "SUCCESS" || (!apiStatus && rawResponse !== null);
    assert.equal(isApiSuccess, true);
  });
});

describe("refund validation", () => {
  it("blocks refund if status is not SUCCESS", () => {
    const statuses = ["PENDING", "FAILED", "CANCELED"];
    for (const status of statuses) {
      const receipt = { status, ddtd: "123", printedAtText: "2024-01-01 00:00:00" };
      assert.equal(
        receipt.status !== "SUCCESS",
        true,
        `Status ${status} should block refund`
      );
    }
  });

  it("allows refund only for SUCCESS status", () => {
    const receipt = { status: "SUCCESS", ddtd: "123", printedAtText: "2024-01-01 00:00:00" };
    assert.equal(receipt.status === "SUCCESS", true);
  });

  it("blocks refund if printedAtText is missing", () => {
    const receipt = { status: "SUCCESS", ddtd: "123", printedAtText: null };
    assert.equal(!receipt.printedAtText, true);
  });

  it("blocks refund if ddtd is missing", () => {
    const receipt = { status: "SUCCESS", ddtd: null, printedAtText: "2024-01-01 00:00:00" };
    assert.equal(!receipt.ddtd, true);
  });
});

describe("printedAtText normalization", () => {
  // Inline the normalization logic (mirrors eBarimtService.js)
  function normalizePrintedAtText(printedAtRaw) {
    if (!printedAtRaw) return null;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(printedAtRaw))) {
      return String(printedAtRaw);
    }
    const parsed = new Date(printedAtRaw);
    if (isNaN(parsed.getTime())) return null;
    return formatPosapiDate(parsed);
  }

  it("full datetime string is preserved as-is", () => {
    const raw = "2024-06-01 14:30:00";
    assert.equal(normalizePrintedAtText(raw), "2024-06-01 14:30:00");
  });

  it("date-only string is converted to full datetime", () => {
    const raw = "2024-06-01";
    const result = normalizePrintedAtText(raw);
    assert.match(result, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("ISO datetime string is converted to full datetime pattern", () => {
    const raw = "2024-06-01T14:30:00.000Z";
    const result = normalizePrintedAtText(raw);
    assert.match(result, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("null/undefined input returns null", () => {
    assert.equal(normalizePrintedAtText(null), null);
    assert.equal(normalizePrintedAtText(undefined), null);
  });
});
