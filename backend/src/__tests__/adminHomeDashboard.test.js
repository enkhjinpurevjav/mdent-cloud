import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeFilledSlotsByBranch,
  getLocalDayRange,
  computeSalesTodayByBranch,
  computeScheduleStatsByBranch,
} from "../utils/adminHomeDashboard.js";

describe("computeScheduleStatsByBranch", () => {
  it("computes doctor count and possible slots with 30-minute granularity", () => {
    const stats = computeScheduleStatsByBranch([
      { branchId: 1, doctorId: 10, startTime: "09:00", endTime: "12:00" }, // 6
      { branchId: 1, doctorId: 11, startTime: "10:00", endTime: "11:30" }, // 3
      { branchId: 2, doctorId: 12, startTime: "09:00", endTime: "09:20" }, // 0
    ]);

    assert.equal(stats.get(1).possibleSlots, 9);
    assert.equal(stats.get(1).doctorIds.size, 2);
    assert.equal(stats.has(2), false);
  });
});

describe("computeFilledSlotsByBranch", () => {
  it("counts distinct doctor + slot coverage by duration, excluding canceled and no_show", () => {
    const start = new Date("2026-04-15T09:00:00.000Z");
    const nineThirty = new Date("2026-04-15T09:30:00.000Z");

    const filled = computeFilledSlotsByBranch([
      // 90-minute appt: 09:00, 09:30, 10:00
      {
        branchId: 1,
        doctorId: 10,
        scheduledAt: start,
        endAt: new Date("2026-04-15T10:30:00.000Z"),
        status: "booked",
      },
      // overlaps at 09:30 and 10:00, adds only 10:30 slot
      {
        branchId: 1,
        doctorId: 10,
        scheduledAt: nineThirty,
        endAt: new Date("2026-04-15T11:00:00.000Z"),
        status: "completed",
      },
      // null endAt fallback: 1 slot at 09:00 for a different doctor
      { branchId: 1, doctorId: 11, scheduledAt: start, endAt: null, status: "checked_in" },
      { branchId: 1, doctorId: 12, scheduledAt: start, endAt: nineThirty, status: "no_show" }, // excluded
      { branchId: 2, doctorId: 12, scheduledAt: start, endAt: nineThirty, status: "CANCELED" }, // excluded
    ]);

    assert.equal(filled.get(1), 5);
    assert.equal(filled.has(2), false);
  });
});

describe("getLocalDayRange", () => {
  it("returns [start, endExclusive) for valid YYYY-MM-DD", () => {
    const range = getLocalDayRange("2026-04-15");
    assert.ok(range);
    assert.equal(range.start.getHours(), 0);
    assert.equal(range.start.getMinutes(), 0);
    assert.equal(range.endExclusive.getDate() - range.start.getDate(), 1);
    assert.equal(range.endExclusive.getHours(), 0);
    assert.equal(range.endExclusive.getMinutes(), 0);
  });

  it("rejects invalid day format and impossible dates", () => {
    assert.equal(getLocalDayRange("2026-4-15"), null);
    assert.equal(getLocalDayRange("2026-02-31"), null);
  });
});

describe("computeSalesTodayByBranch", () => {
  it("sums positive external payments by branch", () => {
    const sales = computeSalesTodayByBranch([
      { amount: 100_000, invoice: { branchId: 1 } },
      { amount: 50_000, invoice: { branchId: 1 } },
      { amount: 25_500, invoice: { branchId: 2 } },
      { amount: 9_999, invoice: null },
    ]);

    assert.equal(sales.get(1), 150_000);
    assert.equal(sales.get(2), 25_500);
  });
});
