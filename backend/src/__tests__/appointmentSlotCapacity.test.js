import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findFirstFullSlot,
  getOverlappedSlotStarts,
  getSlotOccupancy,
  shouldCountAppointmentInSlot,
} from "../utils/appointmentSlotCapacity.js";

function d(v) {
  return new Date(v);
}

describe("appointmentSlotCapacity", () => {
  it("ignores cancelled appointments", () => {
    const slotStart = d("2026-04-13T09:00:00.000Z");
    const occupancy = getSlotOccupancy({
      slotStart,
      appointments: [
        {
          status: "cancelled",
          scheduledAt: d("2026-04-13T09:00:00.000Z"),
          endAt: d("2026-04-13T09:30:00.000Z"),
        },
      ],
      now: d("2026-04-13T08:00:00.000Z"),
    });
    assert.equal(occupancy, 0);
  });

  it("does not count no_show for future slots, but counts for historical slots", () => {
    const now = d("2026-04-13T10:00:00.000Z");
    assert.equal(
      shouldCountAppointmentInSlot({
        status: "no_show",
        slotStart: d("2026-04-13T10:30:00.000Z"),
        now,
      }),
      false
    );
    assert.equal(
      shouldCountAppointmentInSlot({
        status: "no_show",
        slotStart: d("2026-04-13T09:30:00.000Z"),
        now,
      }),
      true
    );
  });

  it("counts long appointments in every overlapped slot", () => {
    const slots = getOverlappedSlotStarts({
      start: d("2026-04-13T09:10:00.000Z"),
      end: d("2026-04-13T10:20:00.000Z"),
    });
    assert.deepEqual(slots.map((s) => s.toISOString()), [
      "2026-04-13T09:00:00.000Z",
      "2026-04-13T09:30:00.000Z",
      "2026-04-13T10:00:00.000Z",
    ]);
  });

  it("finds a full slot when 2 overlapping appointments already exist", () => {
    const fullSlot = findFirstFullSlot({
      appointments: [
        {
          id: 1,
          status: "booked",
          scheduledAt: d("2026-04-13T09:00:00.000Z"),
          endAt: d("2026-04-13T09:30:00.000Z"),
        },
        {
          id: 2,
          status: "confirmed",
          scheduledAt: d("2026-04-13T09:05:00.000Z"),
          endAt: d("2026-04-13T09:35:00.000Z"),
        },
      ],
      start: d("2026-04-13T09:00:00.000Z"),
      end: d("2026-04-13T09:30:00.000Z"),
      now: d("2026-04-13T08:00:00.000Z"),
    });
    assert.equal(fullSlot?.toISOString(), "2026-04-13T09:00:00.000Z");
  });
});
