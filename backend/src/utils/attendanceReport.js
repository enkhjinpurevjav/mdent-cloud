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
 * Parse YYYY-MM-DD + HH:MM in Mongolia timezone and return UTC Date.
 */
export function parseMongoliaDateTime(ymd, timeStr) {
  return new Date(`${ymd}T${timeStr}:00.000+08:00`);
}

/**
 * Return [start,end] day bounds in Mongolia timezone for provided date.
 */
export function mongoliaDayBounds(date) {
  const ymd = mongoliaDateString(date);
  return {
    ymd,
    start: new Date(`${ymd}T00:00:00.000+08:00`),
    end: new Date(`${ymd}T23:59:59.999+08:00`),
  };
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

export function computeAttendanceKpis(rows) {
  const totalRows = rows.length;
  let presentCount = 0;
  let openCount = 0;
  let absentCount = 0;
  let unscheduledCount = 0;
  let lateTotal = 0;
  let lateCount = 0;

  for (const row of rows) {
    if (row.status === "present") presentCount += 1;
    else if (row.status === "open") openCount += 1;
    else if (row.status === "absent") absentCount += 1;
    else if (row.status === "unscheduled") unscheduledCount += 1;

    if (typeof row.lateMinutes === "number" && row.lateMinutes > 0) {
      lateTotal += row.lateMinutes;
      lateCount += 1;
    }
  }

  const attended = presentCount + openCount;
  const attendanceRatePercent = totalRows > 0 ? Math.round((attended / totalRows) * 1000) / 10 : 0;
  const avgLateMinutes = lateCount > 0 ? Math.round((lateTotal / lateCount) * 10) / 10 : 0;

  return {
    totalRows,
    presentCount,
    openCount,
    absentCount,
    unscheduledCount,
    avgLateMinutes,
    attendanceRatePercent,
  };
}

function csvCell(value) {
  const raw = value == null ? "" : String(value);
  return `"${raw.replaceAll('"', '""')}"`;
}

export function toAttendanceCsv(rows) {
  const headers = [
    "Date",
    "Branch",
    "Role",
    "Employee",
    "Status",
    "SessionCount",
    "ScheduledStart",
    "ScheduledEnd",
    "CheckInAt",
    "CheckOutAt",
    "WorkedMinutes",
    "LateMinutes",
    "EarlyLeaveMinutes",
    "CorrectionCount",
    "ExceptionFlags",
  ];

  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.scheduledDate,
        row.branchName,
        row.userRole,
        `${row.userOvog || ""} ${row.userName || ""}`.trim(),
        row.status,
        row.sessionCount ?? 0,
        row.scheduledStart ?? "",
        row.scheduledEnd ?? "",
        row.checkInAt ?? "",
        row.checkOutAt ?? "",
        row.durationMinutes ?? "",
        row.lateMinutes ?? "",
        row.earlyLeaveMinutes ?? "",
        row.correctionCount ?? 0,
        row.exceptionFlags ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return lines.join("\n");
}
