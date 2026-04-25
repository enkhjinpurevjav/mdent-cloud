import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getCloseWithoutPaymentActorIds } from "../routes/encounters.js";

describe("getCloseWithoutPaymentActorIds", () => {
  it("uses direct doctor session as closer", () => {
    assert.deepEqual(
      getCloseWithoutPaymentActorIds({
        reqUser: { id: 10, role: "doctor" },
        kioskUser: null,
      }),
      { effectiveDoctorId: 10, closedByUserId: 10 }
    );
  });

  it("uses doctor kiosk user as closer instead of branch kiosk account", () => {
    assert.deepEqual(
      getCloseWithoutPaymentActorIds({
        reqUser: { id: 20, role: "branch_kiosk" },
        kioskUser: { id: 30, role: "doctor_kiosk" },
      }),
      { effectiveDoctorId: 30, closedByUserId: 30 }
    );
  });

  it("keeps admin session as closer without doctor ownership check", () => {
    assert.deepEqual(
      getCloseWithoutPaymentActorIds({
        reqUser: { id: 40, role: "admin" },
        kioskUser: null,
      }),
      { effectiveDoctorId: null, closedByUserId: 40 }
    );
  });
});
