import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPaymentMethodSummary, derivePaymentStatus } from "../routes/invoices.js";

describe("invoice finance status rules", () => {
  it("matches unpaid/partial/paid/overpaid mapping", () => {
    assert.equal(derivePaymentStatus(100, 0), "unpaid");
    assert.equal(derivePaymentStatus(100, 20), "partial");
    assert.equal(derivePaymentStatus(100, 100), "paid");
    assert.equal(derivePaymentStatus(100, 130), "overpaid");
  });
});

describe("invoice payment method summary", () => {
  it("builds mixed payment label and wallet detection", () => {
    const summary = buildPaymentMethodSummary([
      { method: "cash", amount: 50000 },
      { method: "QPAY", amount: 25000 },
      { method: "WALLET", amount: 10000 },
    ]);

    assert.equal(summary.methods.length, 3);
    assert.equal(summary.hasWallet, true);
    assert.match(summary.label, /Mixed/i);
  });
});
