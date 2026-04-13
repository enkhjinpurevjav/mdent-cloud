import type { Appointment } from "../appointments/types";
import { SLOT_MINUTES } from "../appointments/time";
import { getBusinessHm, getBusinessYmd, naiveToFakeUtcDate } from "../../utils/businessTime";

export const MAX_APPOINTMENTS_PER_SLOT = 2;
export const SLOT_FULL_MESSAGE = "This slot is full";

function slotMs(slotMinutes = SLOT_MINUTES) {
  return slotMinutes * 60_000;
}

export function getBusinessNowFakeUtc(): Date {
  return naiveToFakeUtcDate(`${getBusinessYmd()} ${getBusinessHm()}:00`);
}

export function getAppointmentEndMs(appointment: Pick<Appointment, "scheduledAt" | "endAt">) {
  const startMs = naiveToFakeUtcDate(appointment.scheduledAt).getTime();
  if (appointment.endAt) {
    const endMs = naiveToFakeUtcDate(appointment.endAt).getTime();
    if (endMs > startMs) return endMs;
  }
  return startMs + slotMs();
}

export function isCountedForCapacity(appointment: Pick<Appointment, "status">, slotStartMs: number, nowMs: number) {
  const status = String(appointment.status || "").toLowerCase();
  if (status === "cancelled") return false;
  if (status === "no_show") return slotStartMs < nowMs;
  return true;
}

export function getOverlappedSlotStarts(startMs: number, endMs: number, slotMinutes = SLOT_MINUTES): number[] {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];
  const intervalMs = slotMs(slotMinutes);
  const slots: number[] = [];
  let cursor = Math.floor(startMs / intervalMs) * intervalMs;
  while (cursor < endMs) {
    slots.push(cursor);
    cursor += intervalMs;
  }
  return slots;
}

export function getSlotOccupancyForDoctor({
  appointments,
  doctorId,
  branchId,
  slotStartMs,
  slotMinutes = SLOT_MINUTES,
  excludeAppointmentId,
  now = getBusinessNowFakeUtc(),
}: {
  appointments: Appointment[];
  doctorId: number;
  branchId: number;
  slotStartMs: number;
  slotMinutes?: number;
  excludeAppointmentId?: number;
  now?: Date;
}) {
  const intervalMs = slotMs(slotMinutes);
  const slotEndMs = slotStartMs + intervalMs;
  const nowMs = now.getTime();
  let count = 0;

  for (const appointment of appointments) {
    if (excludeAppointmentId != null && appointment.id === excludeAppointmentId) continue;
    if (appointment.doctorId !== doctorId) continue;
    if (appointment.branchId !== branchId) continue;
    if (!isCountedForCapacity(appointment, slotStartMs, nowMs)) continue;
    const apptStartMs = naiveToFakeUtcDate(appointment.scheduledAt).getTime();
    const apptEndMs = getAppointmentEndMs(appointment);
    if (apptStartMs < slotEndMs && apptEndMs > slotStartMs) count += 1;
  }

  return count;
}

export function findFirstFullSlotForCandidate({
  appointments,
  doctorId,
  branchId,
  startNaive,
  endNaive,
  excludeAppointmentId,
  maxPerSlot = MAX_APPOINTMENTS_PER_SLOT,
  now = getBusinessNowFakeUtc(),
}: {
  appointments: Appointment[];
  doctorId: number;
  branchId: number;
  startNaive: string;
  endNaive: string;
  excludeAppointmentId?: number;
  maxPerSlot?: number;
  now?: Date;
}) {
  const startMs = naiveToFakeUtcDate(startNaive).getTime();
  const endMs = naiveToFakeUtcDate(endNaive).getTime();
  const slots = getOverlappedSlotStarts(startMs, endMs);
  for (const slotStartMs of slots) {
    const occupancy = getSlotOccupancyForDoctor({
      appointments,
      doctorId,
      branchId,
      slotStartMs,
      excludeAppointmentId,
      now,
    });
    if (occupancy >= maxPerSlot) {
      return { slotStartMs, occupancy };
    }
  }
  return null;
}
