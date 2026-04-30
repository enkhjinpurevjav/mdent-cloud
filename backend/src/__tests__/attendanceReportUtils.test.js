import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildDailySessionAggregateMap,
  mongoliaDateString,
  mongoliaWallClockMinutes,
  parseHHMM,
} from "../utils/attendanceReport.js";

describe("attendance report timezone helpers", () => {
  it("builds Mongolia date key (UTC+8)", () => {
    // 2026-04-30 20:30 UTC => 2026-05-01 04:30 UTC+8
    const dt = new Date("2026-04-30T20:30:00.000Z");
    assert.equal(mongoliaDateString(dt), "2026-05-01");
  });

  it("computes Mongolia wall-clock minutes (UTC+8)", () => {
    // 22:15Z => 06:15 UTC+8 => 375 mins
    const dt = new Date("2026-04-30T22:15:00.000Z");
    assert.equal(mongoliaWallClockMinutes(dt), 6 * 60 + 15);
  });

  it("parses valid HH:MM and rejects invalid values", () => {
    assert.equal(parseHHMM("09:45"), 585);
    assert.equal(parseHHMM(""), null);
    assert.equal(parseHHMM("9:5"), null);
    assert.equal(parseHHMM("abc"), null);
  });
});

describe("buildDailySessionAggregateMap", () => {
  it("aggregates multiple sessions in same Mongolia day", () => {
    const sessions = [
      {
        id: 1,
        userId: 10,
        checkInAt: new Date("2026-05-01T00:00:00.000Z"), // 08:00 UTC+8
        checkOutAt: new Date("2026-05-01T01:00:00.000Z"), // 09:00 UTC+8
      },
      {
        id: 2,
        userId: 10,
        checkInAt: new Date("2026-05-01T04:00:00.000Z"), // 12:00 UTC+8
        checkOutAt: new Date("2026-05-01T07:00:00.000Z"), // 15:00 UTC+8
      },
    ];

    const map = buildDailySessionAggregateMap(sessions);
    const aggregate = map.get("10:2026-05-01");

    assert.ok(aggregate);
    assert.equal(aggregate.sessionCount, 2);
    assert.equal(aggregate.totalDurationMinutes, 240); // 60 + 180
    assert.equal(aggregate.hasOpenSession, false);
    assert.equal(aggregate.firstCheckInAt.toISOString(), "2026-05-01T00:00:00.000Z");
    assert.equal(aggregate.latestCheckOutAt.toISOString(), "2026-05-01T07:00:00.000Z");
  });

  it("marks aggregate as open when any session is open", () => {
    const sessions = [
      {
        id: 1,
        userId: 11,
        checkInAt: new Date("2026-05-01T00:00:00.000Z"),
        checkOutAt: new Date("2026-05-01T01:00:00.000Z"),
      },
      {
        id: 2,
        userId: 11,
        checkInAt: new Date("2026-05-01T03:00:00.000Z"),
        checkOutAt: null,
      },
    ];

    const map = buildDailySessionAggregateMap(sessions);
    const aggregate = map.get("11:2026-05-01");

    assert.ok(aggregate);
    assert.equal(aggregate.sessionCount, 2);
    assert.equal(aggregate.totalDurationMinutes, 60);
    assert.equal(aggregate.hasOpenSession, true);
    assert.equal(aggregate.latestCheckOutAt.toISOString(), "2026-05-01T01:00:00.000Z");
  });

  it("keys sessions by Mongolia day boundary, not UTC day", () => {
    const sessions = [
      {
        id: 1,
        userId: 12,
        checkInAt: new Date("2026-04-30T18:00:00.000Z"), // 2026-05-01 02:00 UTC+8
        checkOutAt: new Date("2026-04-30T20:00:00.000Z"),
      },
    ];

    const map = buildDailySessionAggregateMap(sessions);
    assert.equal(map.has("12:2026-04-30"), false);
    assert.equal(map.has("12:2026-05-01"), true);
  });
});
