import { ATTENDANCE_FAILURE_CODE, withErrMeta } from "./attendanceAttemptLog.js";

const MONGOLIA_OFFSET_MS = 8 * 60 * 60_000; // UTC+8
const MS_PER_MINUTE = 60_000;
const STANDARD_SHIFT_START_A = 9 * 60;
const STANDARD_SHIFT_START_B = 10 * 60;
const STANDARD_SHIFT_END_A = 10 * 60;
const STANDARD_SHIFT_END_B = 11 * 60;
const STANDARD_CHECKOUT_A = 17 * 60;
const STANDARD_CHECKOUT_B = 18 * 60;
const STANDARD_SHIFT_REQUIRED_MINUTES = 8 * 60;

export const SCHEDULE_AHEAD_ROLES = new Set([
  "doctor",
  "nurse",
  "receptionist",
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
  const withinAllowedWindow =
    mins >= STANDARD_SHIFT_START_A && mins < STANDARD_SHIFT_END_B;
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

function getStandardShiftFromCheckIn(checkInAt) {
  const checkInMinutes = mongoliaMinutesOfDay(checkInAt);
  if (
    checkInMinutes >= STANDARD_SHIFT_START_A &&
    checkInMinutes < STANDARD_SHIFT_END_A
  ) {
    return { start: "09:00", minCheckout: STANDARD_CHECKOUT_A };
  }
  if (
    checkInMinutes >= STANDARD_SHIFT_START_B &&
    checkInMinutes < STANDARD_SHIFT_END_B
  ) {
    return { start: "10:00", minCheckout: STANDARD_CHECKOUT_B };
  }
  return null;
}

export function enforceStandardShiftCheckout({ role, checkInAt, checkOutAt }) {
  if (!isStandardShiftRole(role) || isWeekendInMongolia(checkInAt)) return;

  const shift = getStandardShiftFromCheckIn(checkInAt);
  if (!shift) {
    throw withErrMeta(
      new Error(
        "Энэ үүргийн ажилтан ажлын өдөр 09:00 эсвэл 10:00 цагийн ээлжээр ирцээ эхлүүлэх ёстой."
      ),
      ATTENDANCE_FAILURE_CODE.SCHEDULE_WINDOW_CLOSED,
      403
    );
  }

  const checkOutMinutes = mongoliaMinutesOfDay(checkOutAt);
  if (checkOutMinutes < shift.minCheckout) {
    throw withErrMeta(
      new Error(
        `Та ${shift.start} эхэлсэн тул ${String(
          Math.floor(shift.minCheckout / 60)
        ).padStart(2, "0")}:00 цагаас өмнө гарах боломжгүй.`
      ),
      ATTENDANCE_FAILURE_CODE.SCHEDULE_WINDOW_CLOSED,
      403
    );
  }

  const durationMinutes = Math.max(
    0,
    Math.round((checkOutAt.getTime() - checkInAt.getTime()) / MS_PER_MINUTE)
  );
  if (durationMinutes < STANDARD_SHIFT_REQUIRED_MINUTES) {
    throw withErrMeta(
      new Error(
        "Ажлын өдөр 8 цаг ажиллахаас өмнө гарах боломжгүй. 09:00 эхэлсэн бол 17:00, 10:00 эхэлсэн бол 18:00 цагаас хойш гарах ёстой."
      ),
      ATTENDANCE_FAILURE_CODE.SCHEDULE_WINDOW_CLOSED,
      403
    );
  }
}
