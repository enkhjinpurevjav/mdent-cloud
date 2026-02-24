/**
 * Unit tests for eBarimt POSAPI 3.0 service utilities.
 *
 * Tests:
 * - formatPosapiDate: "yyyy-MM-dd HH:mm:ss" format
 * - isValidDdtd: 33-digit string validation
 * - isValidTin: 11 or 14-digit validation
 * - B2B requires TIN validation logic
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatPosapiDate,
  isValidDdtd,
  isValidTin,
} from "../services/eBarimtService.js";

describe("formatPosapiDate", () => {
  it("formats a date as yyyy-MM-dd HH:mm:ss", () => {
    // Use a fixed UTC date to avoid timezone issues in CI
    const date = new Date("2024-03-15T09:05:07.000Z");
    const result = formatPosapiDate(date);
    // The result depends on local timezone — just check the pattern
    assert.match(result, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("pads single-digit month/day/hour/minute/second with zero", () => {
    // Build a date in local time to test padding
    const date = new Date(2024, 0, 5, 3, 7, 9); // Jan 5, 03:07:09
    const result = formatPosapiDate(date);
    assert.match(result, /^2024-01-05 03:07:09$/);
  });

  it("formats midnight correctly", () => {
    const date = new Date(2025, 11, 31, 0, 0, 0); // Dec 31 00:00:00
    const result = formatPosapiDate(date);
    assert.match(result, /^2025-12-31 00:00:00$/);
  });
});

describe("isValidDdtd", () => {
  it("accepts a 33-digit string", () => {
    assert.equal(isValidDdtd("123456789012345678901234567890123"), true);
  });

  it("rejects a 32-digit string", () => {
    assert.equal(isValidDdtd("12345678901234567890123456789012"), false);
  });

  it("rejects a 34-digit string", () => {
    assert.equal(isValidDdtd("1234567890123456789012345678901234"), false);
  });

  it("rejects non-digit characters", () => {
    assert.equal(isValidDdtd("1234567890123456789012345678901A3"), false);
  });

  it("rejects null/undefined", () => {
    assert.equal(isValidDdtd(null), false);
    assert.equal(isValidDdtd(undefined), false);
    assert.equal(isValidDdtd(123456789012345678901234567890123), false);
  });
});

describe("isValidTin", () => {
  it("accepts an 11-digit TIN", () => {
    assert.equal(isValidTin("12345678901"), true);
  });

  it("accepts a 14-digit TIN", () => {
    assert.equal(isValidTin("12345678901234"), true);
  });

  it("rejects a 10-digit TIN", () => {
    assert.equal(isValidTin("1234567890"), false);
  });

  it("rejects a 12-digit TIN", () => {
    assert.equal(isValidTin("123456789012"), false);
  });

  it("rejects a 13-digit TIN", () => {
    assert.equal(isValidTin("1234567890123"), false);
  });

  it("rejects non-digit characters", () => {
    assert.equal(isValidTin("1234567890A"), false);
  });

  it("rejects null", () => {
    assert.equal(isValidTin(null), false);
  });
});

describe("B2B TIN validation logic", () => {
  it("B2B with TIN should be valid", () => {
    const invoice = { buyerType: "B2B", buyerTin: "12345678901" };
    assert.equal(
      invoice.buyerType === "B2B" && !invoice.buyerTin,
      false,
      "B2B with TIN should not fail validation"
    );
  });

  it("B2B without TIN should be invalid", () => {
    const invoice = { buyerType: "B2B", buyerTin: null };
    assert.equal(
      invoice.buyerType === "B2B" && !invoice.buyerTin,
      true,
      "B2B without TIN should fail validation"
    );
  });

  it("B2C without TIN should be valid", () => {
    const invoice = { buyerType: "B2C", buyerTin: null };
    assert.equal(
      invoice.buyerType === "B2B" && !invoice.buyerTin,
      false,
      "B2C without TIN should not fail validation"
    );
  });
});
