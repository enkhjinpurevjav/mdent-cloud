import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getEffectiveAttendancePolicy } from "../utils/attendancePolicy.js";

describe("getEffectiveAttendancePolicy", () => {
  it("returns highest priority matching branch+role policy", async () => {
    const policy = getEffectiveAttendancePolicy({
      branchId: 3,
      role: "doctor",
      policies: [
      {
        id: 1,
        branchId: null,
        role: null,
        priority: 1,
        isActive: true,
        earlyCheckInMinutes: 120,
        lateGraceMinutes: 0,
        earlyLeaveGraceMinutes: 0,
        autoCloseAfterMinutes: 720,
        minAccuracyM: 100,
        enforceGeofence: true,
      },
      {
        id: 2,
        branchId: 3,
        role: "doctor",
        priority: 20,
        isActive: true,
        earlyCheckInMinutes: 90,
        lateGraceMinutes: 5,
        earlyLeaveGraceMinutes: 10,
        autoCloseAfterMinutes: 600,
        minAccuracyM: 50,
        enforceGeofence: true,
      },
      ],
    });
    assert.equal(policy.earlyCheckInMinutes, 90);
    assert.equal(policy.lateGraceMinutes, 5);
    assert.equal(policy.minAccuracyM, 50);
  });

  it("falls back to defaults when no policy rows exist", async () => {
    const policy = getEffectiveAttendancePolicy({
      branchId: null,
      role: "nurse",
      policies: [],
    });
    assert.equal(policy.earlyCheckInMinutes, 120);
    assert.equal(policy.autoCloseAfterMinutes, 720);
    assert.equal(policy.minAccuracyM, 100);
    assert.equal(policy.enforceGeofence, true);
  });
});
