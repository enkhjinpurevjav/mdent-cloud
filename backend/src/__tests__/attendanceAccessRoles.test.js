import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canAccessAttendanceAdminFeatures } from "../utils/attendanceAccess.js";

describe("canAccessAttendanceAdminFeatures", () => {
  it("allows admin, super_admin, and hr roles", () => {
    assert.equal(
      canAccessAttendanceAdminFeatures({
        requesterRole: "admin",
        authBypassed: false,
      }),
      true
    );
    assert.equal(
      canAccessAttendanceAdminFeatures({
        requesterRole: "super_admin",
        authBypassed: false,
      }),
      true
    );
    assert.equal(
      canAccessAttendanceAdminFeatures({
        requesterRole: "hr",
        authBypassed: false,
      }),
      true
    );
  });

  it("blocks non-attendance-admin roles when auth is enabled", () => {
    assert.equal(
      canAccessAttendanceAdminFeatures({
        requesterRole: "marketing",
        authBypassed: false,
      }),
      false
    );
    assert.equal(
      canAccessAttendanceAdminFeatures({
        requesterRole: "receptionist",
        authBypassed: false,
      }),
      false
    );
    assert.equal(
      canAccessAttendanceAdminFeatures({
        requesterRole: null,
        authBypassed: false,
      }),
      false
    );
  });

  it("allows any role when auth is bypassed", () => {
    assert.equal(
      canAccessAttendanceAdminFeatures({
        requesterRole: "receptionist",
        authBypassed: true,
      }),
      true
    );
    assert.equal(
      canAccessAttendanceAdminFeatures({
        requesterRole: null,
        authBypassed: true,
      }),
      true
    );
  });
});

