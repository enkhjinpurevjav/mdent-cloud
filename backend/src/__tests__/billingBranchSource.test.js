import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getEncounterAppointmentBranchId } from "../routes/billing.js";

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
});
