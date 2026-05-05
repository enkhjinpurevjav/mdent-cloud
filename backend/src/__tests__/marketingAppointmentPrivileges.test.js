/**
 * Unit tests for marketing appointment privileges vs receptionist restrictions.
 *
 * Mirrors route-level guards in backend/src/routes/appointments.js:
 *  - POST /api/appointments
 *  - PATCH /api/appointments/:id
 *  - POST /api/appointments/:id/start-encounter
 *  - POST /api/appointments/:id/ensure-encounter
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

function canCreateCrossBranchWithStatus({ role, userBranchId, targetBranchId, normalizedStatus }) {
  if (role === "receptionist" && userBranchId !== targetBranchId) {
    return normalizedStatus === "booked";
  }
  return true;
}

function canEditCrossBranch({ role, userBranchId, appointmentBranchId }) {
  if (role === "receptionist" && userBranchId !== appointmentBranchId) {
    return false;
  }
  return true;
}

function canStartOrEnsureEncounter({ role }) {
  return role !== "receptionist";
}

describe("marketing vs receptionist — cross-branch create status guard", () => {
  it("blocks receptionist cross-branch create when status is not booked", () => {
    assert.equal(
      canCreateCrossBranchWithStatus({
        role: "receptionist",
        userBranchId: 1,
        targetBranchId: 2,
        normalizedStatus: "ongoing",
      }),
      false
    );
  });

  it("allows receptionist cross-branch create when status is booked", () => {
    assert.equal(
      canCreateCrossBranchWithStatus({
        role: "receptionist",
        userBranchId: 1,
        targetBranchId: 2,
        normalizedStatus: "booked",
      }),
      true
    );
  });

  it("allows marketing cross-branch create for non-booked statuses", () => {
    assert.equal(
      canCreateCrossBranchWithStatus({
        role: "marketing",
        userBranchId: 1,
        targetBranchId: 2,
        normalizedStatus: "ongoing",
      }),
      true
    );
    assert.equal(
      canCreateCrossBranchWithStatus({
        role: "marketing",
        userBranchId: 1,
        targetBranchId: 2,
        normalizedStatus: "ready_to_pay",
      }),
      true
    );
  });
});

describe("marketing vs receptionist — cross-branch edit guard", () => {
  it("blocks receptionist from editing other branch appointments", () => {
    assert.equal(
      canEditCrossBranch({
        role: "receptionist",
        userBranchId: 1,
        appointmentBranchId: 2,
      }),
      false
    );
  });

  it("allows marketing to edit other branch appointments", () => {
    assert.equal(
      canEditCrossBranch({
        role: "marketing",
        userBranchId: 1,
        appointmentBranchId: 2,
      }),
      true
    );
  });
});

describe("marketing vs receptionist — encounter start/ensure", () => {
  it("blocks receptionist from start/ensure encounter endpoints", () => {
    assert.equal(canStartOrEnsureEncounter({ role: "receptionist" }), false);
  });

  it("allows marketing to start/ensure encounter endpoints", () => {
    assert.equal(canStartOrEnsureEncounter({ role: "marketing" }), true);
  });
});
