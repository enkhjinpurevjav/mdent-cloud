import {
  ADMIN_HOME_EXCLUDED_APPOINTMENT_STATUSES,
  ADMIN_HOME_SLOT_MINUTES,
} from "../constants/dashboard.js";

const EXCLUDED_STATUS_SET = new Set(ADMIN_HOME_EXCLUDED_APPOINTMENT_STATUSES);

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

    const dateKey = `${appt.scheduledAt.getFullYear()}-${appt.scheduledAt.getMonth()}-${appt.scheduledAt.getDate()}`;
    const slotIndex = Math.floor(
      (appt.scheduledAt.getHours() * 60 + appt.scheduledAt.getMinutes()) /
        ADMIN_HOME_SLOT_MINUTES
    );
    const doctorSlotKey = `${appt.branchId}:${appt.doctorId}:${dateKey}:${slotIndex}`;
    if (seen.has(doctorSlotKey)) continue;
    seen.add(doctorSlotKey);

    filledByBranch.set(appt.branchId, (filledByBranch.get(appt.branchId) || 0) + 1);
  }

  return filledByBranch;
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
