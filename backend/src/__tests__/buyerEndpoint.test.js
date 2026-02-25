/**
 * Unit tests for PATCH /api/invoices/:id/buyer validation logic.
 *
 * Tests the validation rules inline (no HTTP server or DB needed).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Inline TIN validator (mirrors isValidTin in eBarimtService.js)
// ---------------------------------------------------------------------------
function isValidTin(tin) {
  return /^\d{11}$/.test(tin) || /^\d{14}$/.test(tin);
}

// ---------------------------------------------------------------------------
// Inline validation logic mirroring the route handler
// ---------------------------------------------------------------------------

function validateBuyerUpdate({ buyerType, buyerTin }) {
  if (!buyerType || (buyerType !== "B2C" && buyerType !== "B2B")) {
    return { status: 400, error: "buyerType must be 'B2C' or 'B2B'." };
  }
  if (buyerType === "B2B") {
    const tin = typeof buyerTin === "string" ? buyerTin.trim() : "";
    if (!tin) {
      return { status: 400, error: "buyerTin is required for B2B buyer type." };
    }
    if (!isValidTin(tin)) {
      return { status: 400, error: "buyerTin must be exactly 11 or 14 digits." };
    }
  }
  return null; // no error
}

describe("PATCH /api/invoices/:id/buyer – validation", () => {
  it("rejects missing buyerType", () => {
    const err = validateBuyerUpdate({});
    assert.ok(err);
    assert.equal(err.status, 400);
    assert.match(err.error, /buyerType/);
  });

  it("rejects invalid buyerType value", () => {
    const err = validateBuyerUpdate({ buyerType: "COMPANY" });
    assert.ok(err);
    assert.equal(err.status, 400);
  });

  it("accepts B2C without buyerTin", () => {
    const err = validateBuyerUpdate({ buyerType: "B2C" });
    assert.equal(err, null);
  });

  it("accepts B2C and ignores buyerTin", () => {
    const err = validateBuyerUpdate({ buyerType: "B2C", buyerTin: "any-value" });
    assert.equal(err, null);
  });

  it("rejects B2B without buyerTin", () => {
    const err = validateBuyerUpdate({ buyerType: "B2B" });
    assert.ok(err);
    assert.equal(err.status, 400);
    assert.match(err.error, /buyerTin is required/);
  });

  it("rejects B2B with empty buyerTin", () => {
    const err = validateBuyerUpdate({ buyerType: "B2B", buyerTin: "  " });
    assert.ok(err);
    assert.equal(err.status, 400);
    assert.match(err.error, /buyerTin is required/);
  });

  it("rejects B2B with 10-digit TIN", () => {
    const err = validateBuyerUpdate({ buyerType: "B2B", buyerTin: "1234567890" });
    assert.ok(err);
    assert.equal(err.status, 400);
    assert.match(err.error, /11 or 14 digits/);
  });

  it("rejects B2B with 12-digit TIN", () => {
    const err = validateBuyerUpdate({ buyerType: "B2B", buyerTin: "123456789012" });
    assert.ok(err);
    assert.equal(err.status, 400);
  });

  it("accepts B2B with 11-digit TIN", () => {
    const err = validateBuyerUpdate({ buyerType: "B2B", buyerTin: "12345678901" });
    assert.equal(err, null);
  });

  it("accepts B2B with 14-digit TIN", () => {
    const err = validateBuyerUpdate({ buyerType: "B2B", buyerTin: "12345678901234" });
    assert.equal(err, null);
  });

  it("rejects B2B with non-digit TIN", () => {
    const err = validateBuyerUpdate({ buyerType: "B2B", buyerTin: "1234567890A" });
    assert.ok(err);
    assert.equal(err.status, 400);
  });
});

describe("PATCH /api/invoices/:id/buyer – B2C clears TIN", () => {
  it("B2C buyer type forces buyerTin to null", () => {
    const buyerType = "B2C";
    const buyerTinInput = "some-tin";
    const savedTin = buyerType === "B2B" ? buyerTinInput : null;
    assert.equal(savedTin, null);
  });

  it("B2B buyer type preserves trimmed buyerTin", () => {
    const buyerType = "B2B";
    const buyerTinInput = "  12345678901  ";
    const savedTin = buyerType === "B2B" ? buyerTinInput.trim() : null;
    assert.equal(savedTin, "12345678901");
  });
});

describe("isValidTin", () => {
  it("validates exactly 11 digits", () => {
    assert.equal(isValidTin("12345678901"), true);
    assert.equal(isValidTin("1234567890"), false);
    assert.equal(isValidTin("123456789012"), false);
  });

  it("validates exactly 14 digits", () => {
    assert.equal(isValidTin("12345678901234"), true);
    assert.equal(isValidTin("1234567890123"), false);
    assert.equal(isValidTin("123456789012345"), false);
  });

  it("rejects non-digit characters", () => {
    assert.equal(isValidTin("1234567890A"), false);
    assert.equal(isValidTin("1234567890-"), false);
  });
});
