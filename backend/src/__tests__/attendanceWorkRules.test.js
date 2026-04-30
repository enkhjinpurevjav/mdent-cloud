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
  it("allows weekday check-in inside 09:00-11:00 window for standard roles", () => {
    // Monday 2026-05-04 09:30 in UTC+8
    const now = new Date("2026-05-04T01:30:00.000Z");
    expectNoThrow(() => enforceStandardShiftCheckInWindow("other", now));
  });

  it("rejects weekday check-in before 09:00 and after 11:00 for standard roles", () => {
    const before = new Date("2026-05-04T00:59:00.000Z"); // 08:59 UTC+8
    const after = new Date("2026-05-04T03:00:00.000Z"); // 11:00 UTC+8
    expectWindowClosedError(() => enforceStandardShiftCheckInWindow("other", before));
    expectWindowClosedError(() => enforceStandardShiftCheckInWindow("other", after));
  });

  it("does not enforce fixed check-in window on weekends or scheduled roles", () => {
    const weekend = new Date("2026-05-03T03:00:00.000Z"); // Sunday 11:00 UTC+8
    const weekday = new Date("2026-05-04T03:00:00.000Z"); // Monday 11:00 UTC+8
    expectNoThrow(() => enforceStandardShiftCheckInWindow("other", weekend));
    expectNoThrow(() => enforceStandardShiftCheckInWindow("doctor", weekday));
  });

  it("enforces 17:00 / 18:00 earliest check-out based on 09:00 / 10:00 start", () => {
    const checkInAtNine = new Date("2026-05-04T01:00:00.000Z"); // 09:00 UTC+8
    const checkOutAt1659 = new Date("2026-05-04T08:59:00.000Z"); // 16:59 UTC+8
    const checkInAtTen = new Date("2026-05-04T02:00:00.000Z"); // 10:00 UTC+8
    const checkOutAt1759 = new Date("2026-05-04T09:59:00.000Z"); // 17:59 UTC+8

    expectWindowClosedError(() =>
      enforceStandardShiftCheckout({
        role: "other",
        checkInAt: checkInAtNine,
        checkOutAt: checkOutAt1659,
      })
    );
    expectWindowClosedError(() =>
      enforceStandardShiftCheckout({
        role: "other",
        checkInAt: checkInAtTen,
        checkOutAt: checkOutAt1759,
      })
    );
  });

  it("enforces minimum 8 hours worked on weekdays for standard roles", () => {
    const checkInAtTenThirty = new Date("2026-05-04T02:30:00.000Z"); // 10:30 UTC+8
    const checkOutAt1830 = new Date("2026-05-04T10:00:00.000Z"); // 18:00 UTC+8 (7h30m)

    expectWindowClosedError(() =>
      enforceStandardShiftCheckout({
        role: "other",
        checkInAt: checkInAtTenThirty,
        checkOutAt: checkOutAt1830,
      })
    );
  });

  it("allows valid 09:00-17:00 and 10:00-18:00 weekday check-outs", () => {
    const nineToFiveIn = new Date("2026-05-04T01:00:00.000Z");
    const nineToFiveOut = new Date("2026-05-04T09:00:00.000Z");
    const tenToSixIn = new Date("2026-05-04T02:00:00.000Z");
    const tenToSixOut = new Date("2026-05-04T10:00:00.000Z");

    expectNoThrow(() =>
      enforceStandardShiftCheckout({
        role: "other",
        checkInAt: nineToFiveIn,
        checkOutAt: nineToFiveOut,
      })
    );
    expectNoThrow(() =>
      enforceStandardShiftCheckout({
        role: "other",
        checkInAt: tenToSixIn,
        checkOutAt: tenToSixOut,
      })
    );
  });
});
