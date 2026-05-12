import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getUlaanbaatarYmd,
  isFoodOrderingOpenAt,
  resolveFoodOrderTargetYmd,
  addDaysToYmd,
  toOrderDateFromYmd,
} from "../utils/foodOrderWindow.js";

describe("food order window helpers", () => {
  it("returns Ulaanbaatar date correctly across UTC boundary", () => {
    const date = new Date("2026-05-07T16:30:00.000Z"); // 2026-05-08 00:30 in UB
    assert.equal(getUlaanbaatarYmd(date), "2026-05-08");
  });

  it("allows ordering in 21:00-09:59 window and blocks 10:00-20:59", () => {
    assert.equal(isFoodOrderingOpenAt(new Date("2026-05-08T01:59:00.000Z")), true); // 09:59 UB
    assert.equal(isFoodOrderingOpenAt(new Date("2026-05-08T02:00:00.000Z")), false); // 10:00 UB
    assert.equal(isFoodOrderingOpenAt(new Date("2026-05-08T12:59:00.000Z")), false); // 20:59 UB
    assert.equal(isFoodOrderingOpenAt(new Date("2026-05-08T13:00:00.000Z")), true); // 21:00 UB
  });

  it("resolves target order date based on ordering window", () => {
    assert.equal(
      resolveFoodOrderTargetYmd(new Date("2026-05-08T01:30:00.000Z")), // 09:30 UB
      "2026-05-08"
    );
    assert.equal(
      resolveFoodOrderTargetYmd(new Date("2026-05-08T13:30:00.000Z")), // 21:30 UB
      "2026-05-09"
    );
  });

  it("adds date boundaries and validates date input", () => {
    assert.equal(addDaysToYmd("2026-05-08", 1), "2026-05-09");
    assert.throws(() => toOrderDateFromYmd("2026/05/08"), /orderDate must be YYYY-MM-DD/);
  });
});
