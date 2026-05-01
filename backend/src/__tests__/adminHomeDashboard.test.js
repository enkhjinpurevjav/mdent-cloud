import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeFilledSlotsByBranch,
  computeImagingServiceCount,
  computeImagingServiceSalesFromItems,
  computeRecognizedSalesFromPayments,
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

describe("computeRecognizedSalesFromPayments", () => {
  it("caps recognized amount per invoice to avoid overpaid amounts", () => {
    const jan1 = new Date("2026-01-01T00:00:00.000Z");
    const jan2 = new Date("2026-01-02T00:00:00.000Z");
    const jan3 = new Date("2026-01-03T00:00:00.000Z");
    const jan4 = new Date("2026-01-04T00:00:00.000Z");
    const jan5 = new Date("2026-01-05T00:00:00.000Z");
    const jan6 = new Date("2026-01-06T00:00:00.000Z");

    const payments = [
      {
        id: 1,
        amount: 70_000,
        timestamp: jan2,
        invoiceId: 10,
        invoice: { id: 10, branchId: 1, finalAmount: 100_000, statusLegacy: "partial" },
      },
      {
        id: 2,
        amount: 50_000,
        timestamp: jan3,
        invoiceId: 10,
        invoice: { id: 10, branchId: 1, finalAmount: 100_000, statusLegacy: "paid" },
      },
      {
        id: 3,
        amount: 20_000,
        timestamp: jan4,
        invoiceId: 11,
        invoice: { id: 11, branchId: 2, totalAmount: 20_000, statusLegacy: "paid" },
      },
      {
        id: 4,
        amount: 10_000,
        timestamp: jan5,
        invoiceId: 12,
        invoice: { id: 12, branchId: 1, finalAmount: 90_000, statusLegacy: "voided" },
      },
    ];

    const result = computeRecognizedSalesFromPayments(payments, {
      windowStart: jan1,
      windowEnd: jan6,
    });

    assert.equal(result.total, 120_000);
    assert.equal(result.byBranch.get(1), 100_000);
    assert.equal(result.byBranch.get(2), 20_000);
  });

  it("applies includedMethods filter on top of capped recognition", () => {
    const jan1 = new Date("2026-01-01T00:00:00.000Z");
    const jan6 = new Date("2026-01-06T00:00:00.000Z");
    const payments = [
      {
        id: 1,
        amount: 100_000,
        method: "CASH",
        timestamp: new Date("2026-01-02T00:00:00.000Z"),
        invoiceId: 20,
        invoice: { id: 20, branchId: 1, finalAmount: 150_000, statusLegacy: "partial" },
      },
      {
        id: 2,
        amount: 80_000,
        method: "VOUCHER",
        timestamp: new Date("2026-01-03T00:00:00.000Z"),
        invoiceId: 20,
        invoice: { id: 20, branchId: 1, finalAmount: 150_000, statusLegacy: "paid" },
      },
      {
        id: 3,
        amount: 30_000,
        method: "BARTER",
        timestamp: new Date("2026-01-04T00:00:00.000Z"),
        invoiceId: 21,
        invoice: { id: 21, branchId: 2, finalAmount: 30_000, statusLegacy: "paid" },
      },
    ];

    const result = computeRecognizedSalesFromPayments(payments, {
      windowStart: jan1,
      windowEnd: jan6,
      includedMethods: ["CASH", "VOUCHER"],
    });

    // invoice #20 should still cap at 150, and BARTER payment should be excluded by method filter
    assert.equal(result.total, 150_000);
    assert.equal(result.byBranch.get(1), 150_000);
    assert.equal(result.byBranch.has(2), false);
  });

  it("includes wallet when requested while still excluding overpayment", () => {
    const jan1 = new Date("2026-01-01T00:00:00.000Z");
    const jan2 = new Date("2026-01-02T00:00:00.000Z");

    const result = computeRecognizedSalesFromPayments(
      [
        {
          id: 1,
          amount: 80_000,
          method: "CASH",
          timestamp: jan1,
          invoiceId: 30,
          invoice: { id: 30, branchId: 1, finalAmount: 100_000, statusLegacy: "partial" },
        },
        {
          id: 2,
          amount: 50_000,
          method: "WALLET",
          timestamp: jan1,
          invoiceId: 30,
          invoice: { id: 30, branchId: 1, finalAmount: 100_000, statusLegacy: "paid" },
        },
      ],
      {
        windowStart: jan1,
        windowEnd: jan2,
        includedMethods: ["CASH", "WALLET"],
      }
    );

    assert.equal(result.total, 100_000);
    assert.equal(result.byBranch.get(1), 100_000);
  });
});

describe("computeImagingServiceSalesFromItems", () => {
  it("sums imaging service net totals after invoice-level discount", () => {
    const total = computeImagingServiceSalesFromItems([
      {
        lineTotal: 100_000,
        quantity: 1,
        unitPrice: 100_000,
        invoice: { discountPercent: "ZERO" },
      },
      {
        lineTotal: 200_000,
        quantity: 1,
        unitPrice: 200_000,
        invoice: { discountPercent: "TEN" },
      },
      {
        lineTotal: 50_000,
        quantity: 1,
        unitPrice: 50_000,
        invoice: { discountPercent: "FIVE" },
      },
    ]);

    // 100,000 + 180,000 + 47,500 = 327,500
    assert.equal(total, 327_500);
  });
});

describe("computeImagingServiceCount", () => {
  it("sums positive quantities and ignores non-positive entries", () => {
    const count = computeImagingServiceCount([
      { quantity: 2 },
      { quantity: 3 },
      { quantity: 0 },
      { quantity: -1 },
      { quantity: null },
    ]);
    assert.equal(count, 5);
  });
});
