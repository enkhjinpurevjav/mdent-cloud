import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  autoCloseOpenAttendanceSessions,
  calculateAutoCloseCheckoutAt,
} from "../services/attendanceAutoClose.js";

describe("calculateAutoCloseCheckoutAt", () => {
  it("uses same-day 23:30 for check-ins before cutoff", () => {
    const checkInAt = new Date("2026-05-12T10:00:00.000+08:00");
    const cutoff = calculateAutoCloseCheckoutAt(checkInAt);
    assert.equal(cutoff.toISOString(), "2026-05-12T15:30:00.000Z");
  });

  it("uses next-day 23:30 for check-ins after cutoff", () => {
    const checkInAt = new Date("2026-05-12T23:45:00.000+08:00");
    const cutoff = calculateAutoCloseCheckoutAt(checkInAt);
    assert.equal(cutoff.toISOString(), "2026-05-13T15:30:00.000Z");
  });

  it("keeps same-day 23:30 for check-ins exactly at cutoff", () => {
    const checkInAt = new Date("2026-05-12T23:30:00.000+08:00");
    const cutoff = calculateAutoCloseCheckoutAt(checkInAt);
    assert.equal(cutoff.toISOString(), "2026-05-12T15:30:00.000Z");
  });
});

describe("autoCloseOpenAttendanceSessions", () => {
  it("closes only sessions whose cutoff time has passed", async () => {
    const updates = [];
    const prismaMock = {
      attendanceSession: {
        findMany: async () => [
          {
            id: 1,
            checkInAt: new Date("2026-05-12T08:00:00.000+08:00"),
          },
          {
            id: 2,
            checkInAt: new Date("2026-05-12T23:45:00.000+08:00"),
          },
        ],
        updateMany: async ({ where, data }) => {
          updates.push({ where, data });
          return { count: where.id === 1 ? 1 : 0 };
        },
      },
    };

    const now = new Date("2026-05-13T15:00:00.000Z");
    const result = await autoCloseOpenAttendanceSessions({
      prismaClient: prismaMock,
      now,
    });

    assert.equal(result.scannedCount, 2);
    assert.equal(result.closedCount, 1);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].where.id, 1);
    assert.equal(updates[0].where.checkOutAt, null);
    assert.equal(updates[0].data.reviewReason, "AUTO_CLOSED_23_30");
    assert.equal(
      updates[0].data.checkOutAt.toISOString(),
      "2026-05-12T15:30:00.000Z"
    );
  });
});

