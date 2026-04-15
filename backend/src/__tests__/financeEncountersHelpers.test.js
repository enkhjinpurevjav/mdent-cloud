import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEncounterFinanceRow,
  buildEncounterSummary,
  deriveEncounterBillingStatus,
} from "../routes/financeEncounters.js";

test("deriveEncounterBillingStatus", async (t) => {
  await t.test("returns close_without_payment first", () => {
    assert.equal(
      deriveEncounterBillingStatus({
        closedWithoutPayment: true,
        invoice: null,
        totalAmount: 0,
        paidAmount: 0,
      }),
      "close_without_payment"
    );
  });

  await t.test("maps no-invoice and voided to no_invoice", () => {
    assert.equal(
      deriveEncounterBillingStatus({
        closedWithoutPayment: false,
        invoice: null,
        totalAmount: 0,
        paidAmount: 0,
      }),
      "no_invoice"
    );
    assert.equal(
      deriveEncounterBillingStatus({
        closedWithoutPayment: false,
        invoice: { statusLegacy: "voided" },
        totalAmount: 100,
        paidAmount: 0,
      }),
      "no_invoice"
    );
  });

  await t.test("maps free/unpaid/partial/paid", () => {
    assert.equal(
      deriveEncounterBillingStatus({
        closedWithoutPayment: false,
        invoice: { statusLegacy: "paid" },
        totalAmount: 0,
        paidAmount: 0,
      }),
      "free"
    );
    assert.equal(
      deriveEncounterBillingStatus({
        closedWithoutPayment: false,
        invoice: { statusLegacy: "unpaid" },
        totalAmount: 100,
        paidAmount: 0,
      }),
      "unpaid"
    );
    assert.equal(
      deriveEncounterBillingStatus({
        closedWithoutPayment: false,
        invoice: { statusLegacy: "partial" },
        totalAmount: 100,
        paidAmount: 40,
      }),
      "partial"
    );
    assert.equal(
      deriveEncounterBillingStatus({
        closedWithoutPayment: false,
        invoice: { statusLegacy: "paid" },
        totalAmount: 100,
        paidAmount: 100,
      }),
      "paid"
    );
  });
});

test("buildEncounterFinanceRow and summary", () => {
  const row = buildEncounterFinanceRow({
    id: 10,
    appointment: { status: "completed", scheduledAt: new Date("2026-04-15T10:00:00.000Z") },
    doctor: { id: 1, name: "Doctor" },
    patientBook: {
      patient: {
        id: 20,
        name: "Patient",
        phone: "99112233",
        branch: { id: 3, name: "Central" },
      },
    },
    invoice: {
      id: 100,
      statusLegacy: "partial",
      finalAmount: 50000,
      totalAmount: 50000,
      payments: [{ amount: 20000 }],
    },
    closedWithoutPayment: false,
    closedWithoutPaymentNote: null,
    closedWithoutPaymentAt: null,
  });

  assert.equal(row.billingStatus, "partial");
  assert.equal(row.paidAmount, 20000);
  assert.equal(row.remainingAmount, 30000);
  assert.equal(row.appointment.scheduledAt, "2026-04-15T10:00:00.000Z");

  const summary = buildEncounterSummary([
    row,
    { ...row, id: 11, billingStatus: "no_invoice", closedWithoutPayment: { value: false } },
    { ...row, id: 12, billingStatus: "free", closedWithoutPayment: { value: false } },
    { ...row, id: 13, billingStatus: "paid", closedWithoutPayment: { value: true } },
  ]);

  assert.deepEqual(summary, {
    totalEncounters: 4,
    noInvoice: 1,
    invoicedUnpaidOrPartial: 1,
    freeEncounters: 1,
    closedWithoutPayment: 1,
  });
});
