import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildAttemptMeta,
  getAutoCloseAt,
  getAttemptFailureCode,
  hasErrorStatus,
} from "../utils/attendanceAttemptLog.js";

describe("attendance attempt log helpers", () => {
  it("maps known error messages to stable failure codes", () => {
    assert.equal(
      getAttemptFailureCode(new Error("Өнөөдрийн ажлын хуваарь олдсонгүй. Администраторт хандана уу.")),
      "SCHEDULE_NOT_FOUND"
    );
    assert.equal(
      getAttemptFailureCode(new Error("GPS дохио сайжрах хүртэл хүлээнэ үү.")),
      "LOW_ACCURACY"
    );
    assert.equal(
      getAttemptFailureCode(new Error("Салбарын ойролцоо орж ирнэ үү.")),
      "OUTSIDE_GEOFENCE"
    );
  });

  it("falls back to UNKNOWN_ERROR for unclassified errors", () => {
    assert.equal(getAttemptFailureCode(new Error("random error")), "UNKNOWN_ERROR");
  });

  it("builds metadata only when distance/radius values are valid numbers", () => {
    assert.deepEqual(buildAttemptMeta({ distanceM: 12.4, radiusM: 150 }), {
      distanceM: 12.4,
      radiusM: 150,
    });
    assert.deepEqual(buildAttemptMeta({ distanceM: null, radiusM: 150 }), null);
    assert.deepEqual(buildAttemptMeta({ distanceM: 12.4, radiusM: null }), null);
  });

  it("recognizes custom error status field", () => {
    const err = new Error("status");
    err.status = 403;
    assert.equal(hasErrorStatus(err), true);
    assert.equal(hasErrorStatus(new Error("no status")), false);
  });

  it("computes auto-close time from check-in and policy minutes", () => {
    const checkInAt = new Date("2026-05-01T00:00:00.000Z");
    const autoCloseAt = getAutoCloseAt(checkInAt, 120);
    assert.equal(autoCloseAt.toISOString(), "2026-05-01T02:00:00.000Z");
  });
});
