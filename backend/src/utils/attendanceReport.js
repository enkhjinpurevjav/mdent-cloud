const MONGOLIA_OFFSET_MS = 8 * 60 * 60_000; // UTC+8
const MS_PER_MINUTE = 60_000;

/**
 * Convert a Date to YYYY-MM-DD in Mongolia timezone (UTC+8).
 */
export function mongoliaDateString(date) {
  const shifted = new Date(date.getTime() + MONGOLIA_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Convert a Date to wall-clock minutes since midnight in Mongolia timezone.
 */
export function mongoliaWallClockMinutes(date) {
  const shifted = new Date(date.getTime() + MONGOLIA_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/**
 * Parse a "HH:MM" time string into total minutes since midnight.
 * Returns null if the string is invalid.
 */
export function parseHHMM(timeStr) {
  if (!timeStr) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/**
 * Build per-user per-day attendance aggregates from raw sessions.
 *
 * Returns a map:
 *   key => `${userId}:${YYYY-MM-DD in UTC+8}`
 *   value => {
 *     firstSession,
 *     firstCheckInAt,
 *     latestCheckOutAt,
 *     hasOpenSession,
 *     totalDurationMinutes,
 *     sessionCount
 *   }
 */
export function buildDailySessionAggregateMap(sessions) {
  const sessionsByKey = new Map();

  for (const session of sessions) {
    const dateStr = mongoliaDateString(session.checkInAt);
    const key = `${session.userId}:${dateStr}`;
    const existing = sessionsByKey.get(key) || [];
    existing.push(session);
    sessionsByKey.set(key, existing);
  }

  const aggregateMap = new Map();

  for (const [key, groupedSessions] of sessionsByKey.entries()) {
    const sorted = [...groupedSessions].sort((a, b) => a.checkInAt - b.checkInAt);
    const firstSession = sorted[0];

    let latestCheckOutAt = null;
    let hasOpenSession = false;
    let totalDurationMinutes = 0;

    for (const session of sorted) {
      if (!session.checkOutAt) {
        hasOpenSession = true;
        continue;
      }

      const durationMinutes = Math.round(
        (session.checkOutAt.getTime() - session.checkInAt.getTime()) / MS_PER_MINUTE
      );
      totalDurationMinutes += Math.max(0, durationMinutes);

      if (!latestCheckOutAt || session.checkOutAt > latestCheckOutAt) {
        latestCheckOutAt = session.checkOutAt;
      }
    }

    aggregateMap.set(key, {
      firstSession,
      firstCheckInAt: firstSession.checkInAt,
      latestCheckOutAt,
      hasOpenSession,
      totalDurationMinutes,
      sessionCount: sorted.length,
    });
  }

  return aggregateMap;
}
