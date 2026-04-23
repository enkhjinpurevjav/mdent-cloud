import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getEncounterAppointmentBranchId,
  summarizePatientFinancials,
} from "../routes/billing.js";

describe("billing invoice branch source", () => {
  it("uses encounter appointment branchId when present", () => {
    const branchId = getEncounterAppointmentBranchId({
      appointment: { branchId: 2 },
    });

    assert.equal(branchId, 2);
  });

  it("returns null when appointment branchId is missing", () => {
    const branchId = getEncounterAppointmentBranchId({
      appointment: { branchId: null },
    });

    assert.equal(branchId, null);
  });

  it("returns null when encounter or appointment is missing", () => {
    assert.equal(getEncounterAppointmentBranchId(null), null);
    assert.equal(getEncounterAppointmentBranchId(undefined), null);
    assert.equal(getEncounterAppointmentBranchId({}), null);
    assert.equal(getEncounterAppointmentBranchId({ appointment: null }), null);
  });

  it("returns null for invalid branchId values", () => {
    assert.equal(
      getEncounterAppointmentBranchId({ appointment: { branchId: 0 } }),
      null
    );
    assert.equal(
      getEncounterAppointmentBranchId({ appointment: { branchId: -2 } }),
      null
    );
    assert.equal(
      getEncounterAppointmentBranchId({ appointment: { branchId: "abc" } }),
      null
    );
  });
});

describe("summarizePatientFinancials", () => {
  it("keeps walletAvailable independent from outstanding debt", () => {
    const result = summarizePatientFinancials({
      invoiceSnapshots: [
        // Existing overpayment bucket
        { billed: 0, paid: 30_000 },
        // New unpaid invoice should not consume wallet availability
        { billed: 35_000, paid: 0 },
      ],
      totalAdjustments: 0,
    });

    assert.equal(result.walletAvailable, 30_000);
    assert.equal(result.outstandingDebt, 35_000);
    assert.equal(result.balance, 5_000);
  });

  it("includes adjustment logs in walletAvailable", () => {
    const result = summarizePatientFinancials({
      invoiceSnapshots: [],
      totalAdjustments: 20_000,
    });

    assert.equal(result.walletAvailable, 20_000);
    assert.equal(result.outstandingDebt, 0);
    assert.equal(result.balance, -20_000);
  });
});
