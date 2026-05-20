import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_ATTENDANCE_ATTEMPT_RETENTION_DAYS,
  getAttendanceAttemptRetentionCutoff,
  parseAttendanceAttemptRetentionDays,
} from "../utils/attendanceAttemptRetention.js";
import { cleanupExpiredAttendanceAttempts } from "../services/attendanceAttemptCleanup.js";

describe("attendance attempt retention helpers", () => {
  it("falls back to default retention days for invalid values", () => {
    assert.equal(parseAttendanceAttemptRetentionDays(undefined), DEFAULT_ATTENDANCE_ATTEMPT_RETENTION_DAYS);
    assert.equal(parseAttendanceAttemptRetentionDays(""), DEFAULT_ATTENDANCE_ATTEMPT_RETENTION_DAYS);
    assert.equal(parseAttendanceAttemptRetentionDays("0"), DEFAULT_ATTENDANCE_ATTEMPT_RETENTION_DAYS);
    assert.equal(parseAttendanceAttemptRetentionDays("-3"), DEFAULT_ATTENDANCE_ATTEMPT_RETENTION_DAYS);
  });

  it("accepts positive numeric retention days", () => {
    assert.equal(parseAttendanceAttemptRetentionDays("5"), 5);
    assert.equal(parseAttendanceAttemptRetentionDays(7), 7);
    assert.equal(parseAttendanceAttemptRetentionDays("9.9"), 9);
  });

  it("builds cutoff based on retention window", () => {
    const now = new Date("2026-05-20T00:00:00.000Z");
    const cutoff = getAttendanceAttemptRetentionCutoff({ now, retentionDays: 5 });
    assert.equal(cutoff.toISOString(), "2026-05-15T00:00:00.000Z");
  });
});

describe("cleanupExpiredAttendanceAttempts", () => {
  it("deletes attempts older than retention cutoff", async () => {
    const calls = [];
    const prismaClient = {
      attendanceAttempt: {
        deleteMany: async (args) => {
          calls.push(args);
          return { count: 12 };
        },
      },
    };
    const now = new Date("2026-05-20T00:00:00.000Z");

    const result = await cleanupExpiredAttendanceAttempts({
      prismaClient,
      retentionDays: 5,
      now,
    });

    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].where.attemptAt.lt.toISOString(),
      "2026-05-15T00:00:00.000Z"
    );
    assert.equal(result.deletedCount, 12);
    assert.equal(result.retentionDays, 5);
    assert.equal(result.cutoff.toISOString(), "2026-05-15T00:00:00.000Z");
  });
});
