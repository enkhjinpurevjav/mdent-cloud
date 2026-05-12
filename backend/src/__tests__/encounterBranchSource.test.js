import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getEncounterAppointmentBranchId } from "../routes/encounters.js";

describe("getEncounterAppointmentBranchId", () => {
  it("prefers appointment branchId when available", () => {
    const branchId = getEncounterAppointmentBranchId({
      appointment: { branchId: 5 },
      patientBook: { patient: { branchId: 2 } },
    });

    assert.equal(branchId, 5);
  });

  it("falls back to patient branchId when appointment branch is missing", () => {
    const branchId = getEncounterAppointmentBranchId({
      appointment: { branchId: null },
      patientBook: { patient: { branchId: 2 } },
    });

    assert.equal(branchId, 2);
  });

  it("returns null when both branch sources are invalid", () => {
    assert.equal(getEncounterAppointmentBranchId({}), null);
    assert.equal(
      getEncounterAppointmentBranchId({
        appointment: { branchId: 0 },
        patientBook: { patient: { branchId: -1 } },
      }),
      null
    );
  });
});
