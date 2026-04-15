import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPaymentLedgerRow,
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

test("buildPaymentLedgerRow includes encounter appointment schedule data for drawer", () => {
  const row = buildPaymentLedgerRow({
    id: 1,
    timestamp: "2026-04-15T20:00:00.000Z",
    method: "transfer",
    amount: 10000,
    meta: {},
    invoice: {
      id: 100,
      statusLegacy: "paid",
      branch: null,
      patient: null,
      encounter: {
        appointment: {
          scheduledAt: "2026-04-15T20:00:00.000Z",
        },
        doctor: null,
        patientBook: null,
      },
    },
    createdBy: null,
  });

  assert.equal(row.invoice?.encounter?.appointment?.scheduledAt, "2026-04-15T20:00:00.000Z");
});
