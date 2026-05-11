export const SCHEDULE_REQUIRED_ROLES = new Set([
  "doctor",
  "nurse",
  "receptionist",
  "sterilization",
]);

export function enforceStandardShiftCheckInWindow() {
  // Intentionally no-op. Attendance check-in time windows are not restricted
  // by fixed shift start time; schedule presence and geofence rules still apply.
}

export function enforceStandardShiftCheckout() {
  // Intentionally no-op. Early check-out is allowed and only recorded.
}
