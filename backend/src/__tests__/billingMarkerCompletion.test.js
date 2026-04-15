import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldCompleteMarkerAppointmentAfterBatchSettlement } from "../routes/billing.js";

describe("shouldCompleteMarkerAppointmentAfterBatchSettlement", () => {
  it("returns true when all marker completion conditions are met", () => {
    const shouldComplete = shouldCompleteMarkerAppointmentAfterBatchSettlement({
      hasMarker: true,
      closeOldBalance: true,
      currentBaseAmount: 0,
      amountForOld: 150000,
      appointmentStatus: "ready_to_pay",
      appointmentId: 123,
    });

    assert.equal(shouldComplete, true);
  });

  it("returns false when any required condition fails", () => {
    const shouldComplete = shouldCompleteMarkerAppointmentAfterBatchSettlement({
      hasMarker: true,
      closeOldBalance: false,
      currentBaseAmount: 0,
      amountForOld: 150000,
      appointmentStatus: "partial_paid",
      appointmentId: 123,
    });

    assert.equal(shouldComplete, false);
  });

  it("returns false when appointmentId is missing", () => {
    const shouldComplete = shouldCompleteMarkerAppointmentAfterBatchSettlement({
      hasMarker: true,
      closeOldBalance: true,
      currentBaseAmount: 0,
      amountForOld: 150000,
      appointmentStatus: "partial_paid",
      appointmentId: null,
    });

    assert.equal(shouldComplete, false);
  });
});
