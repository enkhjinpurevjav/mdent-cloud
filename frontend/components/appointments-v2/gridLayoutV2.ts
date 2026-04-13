import type { Appointment, ScheduledDoctor, TimeSlot } from "../appointments/types";
import { naiveToFakeUtcDate } from "../../utils/businessTime";
import { MAX_APPOINTMENTS_PER_SLOT, getSlotOccupancyForDoctor } from "./slotCapacity";

type Lane = 0 | 1;

type TimeRange = {
  id: number;
  startMs: number;
  endMs: number;
};

export function getVisibleAppointmentsV2(appointments: Appointment[]) {
  return appointments.filter((appointment) => String(appointment.status || "").toLowerCase() !== "cancelled");
}

export function rangesOverlap(a: TimeRange, b: TimeRange) {
  return a.startMs < b.endMs && a.endMs > b.startMs;
}

function toRange(appointment: Appointment): TimeRange {
  const startMs = naiveToFakeUtcDate(appointment.scheduledAt).getTime();
  const endMs = appointment.endAt
    ? Math.max(startMs + 1, naiveToFakeUtcDate(appointment.endAt).getTime())
    : startMs + 30 * 60_000;
  return { id: appointment.id, startMs, endMs };
}

export function assignStableTwoLanes(appointments: Appointment[]) {
  const sorted = [...appointments].sort((a, b) => {
    const sa = naiveToFakeUtcDate(a.scheduledAt).getTime();
    const sb = naiveToFakeUtcDate(b.scheduledAt).getTime();
    return sa - sb || a.id - b.id;
  });
  const laneByAppointmentId: Record<number, Lane> = {};
  const overlappingAppointmentIds = new Set<number>();
  const laneEndMs: Record<Lane, number> = { 0: Number.NEGATIVE_INFINITY, 1: Number.NEGATIVE_INFINITY };

  const active: Array<{ id: number; lane: Lane; endMs: number }> = [];
  for (const appointment of sorted) {
    const range = toRange(appointment);
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (active[i].endMs <= range.startMs) active.splice(i, 1);
    }

    for (const item of active) {
      overlappingAppointmentIds.add(item.id);
      overlappingAppointmentIds.add(appointment.id);
    }

    const lane0Busy = laneEndMs[0] > range.startMs;
    const lane1Busy = laneEndMs[1] > range.startMs;
    let lane: Lane = 0;
    if (!lane0Busy) lane = 0;
    else if (!lane1Busy) lane = 1;
    else lane = laneEndMs[0] <= laneEndMs[1] ? 0 : 1;

    laneByAppointmentId[appointment.id] = lane;
    laneEndMs[lane] = Math.max(laneEndMs[lane], range.endMs);
    active.push({ id: appointment.id, lane, endMs: range.endMs });
  }

  return { laneByAppointmentId, overlappingAppointmentIds };
}

export function computeDoctorSlotOccupancy({
  appointments,
  scheduledDoctors,
  timeSlots,
  resolveDoctorBranchIdForDay,
}: {
  appointments: Appointment[];
  scheduledDoctors: ScheduledDoctor[];
  timeSlots: TimeSlot[];
  resolveDoctorBranchIdForDay: (doctor: ScheduledDoctor) => string;
}) {
  const byDoctorId: Record<number, Record<string, number>> = {};
  for (const doctor of scheduledDoctors) {
    const branchId = Number(resolveDoctorBranchIdForDay(doctor));
    if (!branchId || Number.isNaN(branchId)) continue;
    const occupancyBySlotLabel: Record<string, number> = {};
    for (const slot of timeSlots) {
      occupancyBySlotLabel[slot.label] = getSlotOccupancyForDoctor({
        appointments,
        doctorId: doctor.id,
        branchId,
        slotStartMs: slot.start.getTime(),
      });
    }
    byDoctorId[doctor.id] = occupancyBySlotLabel;
  }
  return byDoctorId;
}

export function getFullAndOverCapacityLabels(occupancyBySlotLabel: Record<string, number>) {
  const full: Record<string, true> = {};
  const over: Record<string, true> = {};
  for (const [slotLabel, occupancy] of Object.entries(occupancyBySlotLabel)) {
    if (occupancy >= MAX_APPOINTMENTS_PER_SLOT) full[slotLabel] = true;
    if (occupancy > MAX_APPOINTMENTS_PER_SLOT) over[slotLabel] = true;
  }
  return { fullSlotLabels: full, overCapacitySlotLabels: over };
}
