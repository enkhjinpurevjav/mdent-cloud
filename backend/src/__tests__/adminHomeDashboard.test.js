import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeFilledSlotsByBranch,
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
  it("counts distinct doctor + slot, excluding canceled and no_show", () => {
    const sameSlot = new Date("2026-04-15T09:00:00.000Z");
    const anotherSlot = new Date("2026-04-15T09:30:00.000Z");

    const filled = computeFilledSlotsByBranch([
      { branchId: 1, doctorId: 10, scheduledAt: sameSlot, status: "booked" },
      { branchId: 1, doctorId: 10, scheduledAt: sameSlot, status: "completed" }, // duplicate
      { branchId: 1, doctorId: 10, scheduledAt: anotherSlot, status: "checked_in" },
      { branchId: 1, doctorId: 11, scheduledAt: sameSlot, status: "no_show" }, // excluded
      { branchId: 2, doctorId: 12, scheduledAt: sameSlot, status: "CANCELED" }, // excluded
    ]);

    assert.equal(filled.get(1), 2);
    assert.equal(filled.has(2), false);
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
