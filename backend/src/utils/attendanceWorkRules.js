import { ATTENDANCE_FAILURE_CODE, withErrMeta } from "./attendanceAttemptLog.js";

const MONGOLIA_OFFSET_MS = 8 * 60 * 60_000; // UTC+8
const STANDARD_SHIFT_START_A = 9 * 60;
const STANDARD_SHIFT_START_B = 10 * 60;

export const SCHEDULE_AHEAD_ROLES = new Set([
  "doctor",
  "nurse",
  "receptionist",
  "marketing",
  "sterilization",
]);

export const STANDARD_SHIFT_EXCLUDED_ROLES = new Set([
  ...SCHEDULE_AHEAD_ROLES,
  "branch_kiosk",
  "doctor_kiosk",
]);

function mongoliaWeekday(now) {
  const shifted = new Date(now.getTime() + MONGOLIA_OFFSET_MS);
  return shifted.getUTCDay();
}

function mongoliaMinutesOfDay(now) {
  const shifted = new Date(now.getTime() + MONGOLIA_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

function isWeekendInMongolia(now) {
  const weekday = mongoliaWeekday(now);
  return weekday === 0 || weekday === 6;
}

function isStandardShiftRole(role) {
  return !STANDARD_SHIFT_EXCLUDED_ROLES.has(role);
}

export function enforceStandardShiftCheckInWindow(role, now) {
  if (!isStandardShiftRole(role) || isWeekendInMongolia(now)) return;

  const mins = mongoliaMinutesOfDay(now);
  const withinAllowedWindow = mins >= STANDARD_SHIFT_START_A;
  if (!withinAllowedWindow) {
    throw withErrMeta(
      new Error(
        "Энэ үүргийн ажилтан ажлын өдөр 09:00 эсвэл 10:00 цагийн ээлжээр ирцээ эхлүүлэх ёстой."
      ),
      ATTENDANCE_FAILURE_CODE.SCHEDULE_WINDOW_CLOSED,
      403
    );
  }
}

export function enforceStandardShiftCheckout({ role, checkInAt }) {
  if (!isStandardShiftRole(role) || isWeekendInMongolia(checkInAt)) return;
}
