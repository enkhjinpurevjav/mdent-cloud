import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getUlaanbaatarYmd,
  isFoodOrderingOpenAt,
  addDaysToYmd,
  toOrderDateFromYmd,
} from "../utils/foodOrderWindow.js";

describe("food order window helpers", () => {
  it("returns Ulaanbaatar date correctly across UTC boundary", () => {
    const date = new Date("2026-05-07T16:30:00.000Z"); // 2026-05-08 00:30 in UB
    assert.equal(getUlaanbaatarYmd(date), "2026-05-08");
  });

  it("allows ordering before 10:00 and blocks at 10:00", () => {
    assert.equal(isFoodOrderingOpenAt(new Date("2026-05-08T01:59:00.000Z")), true); // 09:59 UB
    assert.equal(isFoodOrderingOpenAt(new Date("2026-05-08T02:00:00.000Z")), false); // 10:00 UB
  });

  it("adds date boundaries and validates date input", () => {
    assert.equal(addDaysToYmd("2026-05-08", 1), "2026-05-09");
    assert.throws(() => toOrderDateFromYmd("2026/05/08"), /orderDate must be YYYY-MM-DD/);
  });
});
