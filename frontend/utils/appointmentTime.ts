/**
 * Shared appointment time helpers.
 *
 * All appointment timestamps (scheduledAt / endAt) are naive wall-clock strings
 * ("YYYY-MM-DD HH:mm:ss") in Mongolia time.  Never use new Date(naiveString) or
 * toISOString() for these values.  Use the helpers below everywhere.
 */

import {
  formatNaiveHm,
  getBusinessYmd,
  parseNaiveTimestamp,
} from "./businessTime";

export { getBusinessYmd as businessTodayYmd };

/**
 * Format a naive start/end pair as "HH:mm – HH:mm" (or just "HH:mm" when
 * endNaive is absent).  Timezone-safe: reads components from the naive strings
 * directly, never from a JS Date.
 */
export function formatApptRange(
  startNaive: string,
  endNaive?: string | null
): string {
  if (!startNaive) return "";
  const start = formatNaiveHm(startNaive);
  if (!endNaive) return start;
  const end = formatNaiveHm(endNaive);
  return `${start} – ${end}`;
}

/**
 * Format a naive timestamp as "YYYY.MM.DD HH:mm" (dot-separated, Mongolia wall
 * clock).  Timezone-safe: reads components from the naive string directly.
 */
export function formatApptDateTime(naive: string): string {
  const parsed = parseNaiveTimestamp(naive);
  if (!parsed) return "-";
  const [y, m, d] = parsed.ymd.split("-");
  return `${y}.${m}.${d} ${parsed.hm}`;
}

/**
 * Add (or subtract) a number of calendar days to a YYYY-MM-DD string.
 * Arithmetic is done in fake-UTC so browser timezone does not affect the
 * result (same strategy as doctor/appointments.tsx addDaysYmd).
 */
export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Return true if the YYYY-MM-DD string falls on a Saturday (6) or Sunday (0).
 * Uses UTC arithmetic so browser timezone does not affect the weekday.
 */
export function isWeekendYmd(ymd: string): boolean {
  const w = new Date(ymd + "T00:00:00Z").getUTCDay();
  return w === 0 || w === 6;
}
