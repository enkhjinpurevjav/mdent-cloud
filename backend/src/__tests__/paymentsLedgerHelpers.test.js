import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPaymentsSummary,
  deriveLedgerStatus,
  getReversalPaymentId,
  isReversalEntryPayment,
} from "../routes/payments.js";

test("payment reversal helpers", async (t) => {
  await t.test("detects reversal entry rows", () => {
    assert.equal(isReversalEntryPayment({ meta: { reversalOfPaymentId: 12 } }), true);
    assert.equal(isReversalEntryPayment({ meta: { reversalOfPaymentId: "13" } }), true);
    assert.equal(isReversalEntryPayment({ meta: { note: "x" } }), false);
  });

  await t.test("extracts reversal payment id and status", () => {
    assert.equal(getReversalPaymentId({ meta: { reversalPaymentId: 99 } }), 99);
    assert.equal(getReversalPaymentId({ meta: { reversalPaymentId: "100" } }), 100);
    assert.equal(getReversalPaymentId({ meta: { reversalPaymentId: 0 } }), null);
    assert.equal(deriveLedgerStatus({ meta: { reversalPaymentId: 5 } }), "reversed");
    assert.equal(deriveLedgerStatus({ meta: {} }), "active");
  });
});

test("buildPaymentsSummary", () => {
  const summary = buildPaymentsSummary([
    { amount: 10000, status: "active" },
    { amount: 5000, status: "reversed" },
    { amount: 2000, status: "active" },
  ]);

  assert.deepEqual(summary, {
    totalPayments: 3,
    activeTotal: 12000,
    reversedTotal: 5000,
    netCollected: 7000,
  });
});
