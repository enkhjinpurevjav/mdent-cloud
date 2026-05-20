export const DEFAULT_ATTENDANCE_ATTEMPT_RETENTION_DAYS = 5;

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseAttendanceAttemptRetentionDays(value) {
  const parsed = toFiniteNumber(value);
  if (parsed == null) return DEFAULT_ATTENDANCE_ATTEMPT_RETENTION_DAYS;
  const rounded = Math.floor(parsed);
  if (rounded < 1) return DEFAULT_ATTENDANCE_ATTEMPT_RETENTION_DAYS;
  return rounded;
}

export function getAttendanceAttemptRetentionCutoff({
  now = new Date(),
  retentionDays = DEFAULT_ATTENDANCE_ATTEMPT_RETENTION_DAYS,
} = {}) {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}
