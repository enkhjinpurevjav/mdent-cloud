import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  enforceStandardShiftCheckInWindow,
  enforceStandardShiftCheckout,
} from "../utils/attendanceWorkRules.js";

function expectNoThrow(fn) {
  assert.doesNotThrow(fn);
}

function expectWindowClosedError(fn) {
  assert.throws(fn, (err) => {
    assert.equal(err?.failureCode, "SCHEDULE_WINDOW_CLOSED");
    assert.equal(err?.status, 403);
    return true;
  });
}

describe("attendanceWorkRules", () => {
  it("allows weekday check-in at or after 09:00 for standard roles", () => {
    // Monday 2026-05-04 09:30 in UTC+8
    const now = new Date("2026-05-04T01:30:00.000Z");
    expectNoThrow(() => enforceStandardShiftCheckInWindow("other", now));
    const late = new Date("2026-05-04T06:00:00.000Z"); // 14:00 UTC+8
    expectNoThrow(() => enforceStandardShiftCheckInWindow("other", late));
  });

  it("rejects weekday check-in before 09:00 for standard roles", () => {
    const before = new Date("2026-05-04T00:59:00.000Z"); // 08:59 UTC+8
    expectWindowClosedError(() => enforceStandardShiftCheckInWindow("other", before));
  });

  it("does not enforce fixed check-in window on weekends or scheduled roles", () => {
    const weekend = new Date("2026-05-03T03:00:00.000Z"); // Sunday 11:00 UTC+8
    const weekday = new Date("2026-05-04T03:00:00.000Z"); // Monday 11:00 UTC+8
    expectNoThrow(() => enforceStandardShiftCheckInWindow("other", weekend));
    expectNoThrow(() => enforceStandardShiftCheckInWindow("doctor", weekday));
  });

  it("does not block weekday check-out for standard roles", () => {
    const inAtNine = new Date("2026-05-04T01:00:00.000Z");
    const outEarly = new Date("2026-05-04T02:00:00.000Z");
    const inLate = new Date("2026-05-04T06:00:00.000Z");
    const outLate = new Date("2026-05-04T06:30:00.000Z");
    expectNoThrow(() =>
      enforceStandardShiftCheckout({
        role: "other",
        checkInAt: inAtNine,
        checkOutAt: outEarly,
      })
    );
    expectNoThrow(() =>
      enforceStandardShiftCheckout({
        role: "other",
        checkInAt: inLate,
        checkOutAt: outLate,
      })
    );
  });
});
