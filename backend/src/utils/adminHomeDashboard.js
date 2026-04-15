import {
  ADMIN_HOME_EXCLUDED_APPOINTMENT_STATUSES,
  ADMIN_HOME_SLOT_MINUTES,
} from "../constants/dashboard.js";

const EXCLUDED_STATUS_SET = new Set(ADMIN_HOME_EXCLUDED_APPOINTMENT_STATUSES);
const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function hmToMinutes(value) {
  if (!value) return 0;
  const [h, m] = String(value).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function computeScheduleStatsByBranch(schedules) {
  const branchStats = new Map();

  for (const sch of schedules) {
    const startMins = hmToMinutes(sch.startTime);
    const endMins = hmToMinutes(sch.endTime);
    const shiftMinutes = endMins - startMins;
    const possibleSlots = Math.floor(shiftMinutes / ADMIN_HOME_SLOT_MINUTES);
    if (possibleSlots <= 0) continue;

    if (!branchStats.has(sch.branchId)) {
      branchStats.set(sch.branchId, { possibleSlots: 0, doctorIds: new Set() });
    }
    const stat = branchStats.get(sch.branchId);
    stat.possibleSlots += possibleSlots;
    stat.doctorIds.add(sch.doctorId);
  }

  return branchStats;
}

export function computeFilledSlotsByBranch(appointments) {
  const seen = new Set();
  const filledByBranch = new Map();

  for (const appt of appointments) {
    const status = String(appt.status || "").toLowerCase();
    if (EXCLUDED_STATUS_SET.has(status)) continue;
    if (!appt.doctorId) continue;

    if (!(appt.scheduledAt instanceof Date) || Number.isNaN(appt.scheduledAt.getTime())) continue;

    const startAt = appt.scheduledAt;
    const endAt =
      appt.endAt instanceof Date && !Number.isNaN(appt.endAt.getTime()) ? appt.endAt : null;
    const durationMinutes = endAt ? (endAt.getTime() - startAt.getTime()) / 60000 : 0;
    const slotSpan = Math.max(1, Math.ceil(durationMinutes / ADMIN_HOME_SLOT_MINUTES));

    const dateKey = `${startAt.getFullYear()}-${String(startAt.getMonth() + 1).padStart(2, "0")}-${String(
      startAt.getDate()
    ).padStart(2, "0")}`;
    const startSlotIndex = Math.floor(
      (startAt.getHours() * 60 + startAt.getMinutes()) / ADMIN_HOME_SLOT_MINUTES
    );
    const endSlotIndexExclusive = startSlotIndex + slotSpan;

    for (let slotIndex = startSlotIndex; slotIndex < endSlotIndexExclusive; slotIndex += 1) {
      const doctorSlotKey = `${appt.branchId}:${appt.doctorId}:${dateKey}:${slotIndex}`;
      if (seen.has(doctorSlotKey)) continue;
      seen.add(doctorSlotKey);
      filledByBranch.set(appt.branchId, (filledByBranch.get(appt.branchId) || 0) + 1);
    }
  }

  return filledByBranch;
}

export function getLocalDayRange(day) {
  if (!YMD_REGEX.test(String(day || ""))) return null;
  const [year, month, date] = String(day).split("-").map(Number);
  const start = new Date(year, month - 1, date, 0, 0, 0, 0);
  if (
    start.getFullYear() !== year ||
    start.getMonth() !== month - 1 ||
    start.getDate() !== date
  ) {
    return null;
  }
  const endExclusive = new Date(year, month - 1, date + 1, 0, 0, 0, 0);
  return { start, endExclusive };
}

export function computeSalesTodayByBranch(payments) {
  const salesByBranch = new Map();

  for (const payment of payments) {
    const branchId = payment.invoice?.branchId;
    if (!branchId) continue;
    salesByBranch.set(branchId, (salesByBranch.get(branchId) || 0) + Number(payment.amount || 0));
  }

  return salesByBranch;
}
