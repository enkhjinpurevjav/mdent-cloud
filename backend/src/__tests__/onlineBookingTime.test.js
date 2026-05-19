import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getUlaanbaatarMinuteOfDay,
  getUlaanbaatarYmd,
  isDateBeforeTodayInUlaanbaatar,
  isSlotInPastOrCurrentForDate,
} from "../utils/onlineBookingTime.js";

describe("onlineBookingTime utilities", () => {
  it("reads Mongolia wall-clock date/time from UTC timestamp", () => {
    const now = new Date("2026-05-19T07:44:00.000Z"); // 15:44 in Ulaanbaatar
    assert.equal(getUlaanbaatarYmd(now), "2026-05-19");
    assert.equal(getUlaanbaatarMinuteOfDay(now), 15 * 60 + 44);
  });

  it("marks earlier slots as past for today in Mongolia time", () => {
    const now = new Date("2026-05-19T07:44:00.000Z"); // 15:44 local
    const today = new Date("2026-05-19T00:00:00.000+08:00");

    assert.equal(isSlotInPastOrCurrentForDate(today, "15:00", now), true);
    assert.equal(isSlotInPastOrCurrentForDate(today, "15:44", now), true);
    assert.equal(isSlotInPastOrCurrentForDate(today, "16:00", now), false);
  });

  it("does not mark future-day slots as past", () => {
    const now = new Date("2026-05-19T07:44:00.000Z");
    const tomorrow = new Date("2026-05-20T00:00:00.000+08:00");

    assert.equal(isSlotInPastOrCurrentForDate(tomorrow, "09:00", now), false);
  });

  it("detects date before today in Mongolia timezone", () => {
    const now = new Date("2026-05-19T07:44:00.000Z");
    const yesterday = new Date("2026-05-18T00:00:00.000+08:00");
    const today = new Date("2026-05-19T00:00:00.000+08:00");

    assert.equal(isDateBeforeTodayInUlaanbaatar(yesterday, now), true);
    assert.equal(isDateBeforeTodayInUlaanbaatar(today, now), false);
  });
});

