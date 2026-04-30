import { Router } from "express";
import prisma from "../../db.js";
import {
  buildDailySessionAggregateMap,
  mongoliaDateString,
  mongoliaWallClockMinutes,
  parseHHMM,
} from "../../utils/attendanceReport.js";
import { computeAttendanceKpis, toAttendanceCsv } from "../../utils/attendanceReport.js";
import { STANDARD_SHIFT_EXCLUDED_ROLES } from "../../utils/attendanceWorkRules.js";

const router = Router();
const STANDARD_SHIFT_REQUIRED_MINUTES = 8 * 60;
function isMongoliaWeekday(ymd) {
  const dt = new Date(`${ymd}T00:00:00.000+08:00`);
  const weekday = dt.getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

function getUnscheduledRequiredMinutes(role, ymd) {
  if (STANDARD_SHIFT_EXCLUDED_ROLES.has(role)) return null;
  return isMongoliaWeekday(ymd) ? STANDARD_SHIFT_REQUIRED_MINUTES : null;
}

/**
 * GET /api/admin/attendance
 *
 * Schedule-driven attendance report (includes Absent rows) + Unscheduled attendance.
 *
 * Query params:
 *   fromTs    - ISO timestamp for start of range (required)
 *   toTs      - ISO timestamp for end of range   (required)
 *   branchId  - optional number
 *   userId    - optional number
 *   status    - optional: all | present | open | absent | unscheduled
 *   page      - default 1
 *   pageSize  - default 50
 */
router.get("/attendance", async (req, res) => {
  try {
    const { fromTs, toTs, branchId, userId, status, page, pageSize } =
      req.query;

    if (!fromTs || !toTs) {
      return res.status(400).json({ error: "fromTs and toTs are required" });
    }

    const from = new Date(fromTs);
    const to = new Date(toTs);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return res
        .status(400)
        .json({ error: "fromTs and toTs must be valid ISO timestamps" });
    }

    const pageNum = Math.max(1, parseInt(page || "1", 10) || 1);
    const pageSizeNum = Math.max(
      1,
      Math.min(200, parseInt(pageSize || "50", 10) || 50)
    );

    const filterBranchId = branchId ? Number(branchId) : null;
    const filterUserId = userId ? Number(userId) : null;
    const filterStatus =
      status && status !== "all" ? String(status) : null;

    // ------------------------------------------------------------------
    // 1. Load schedules for doctors / nurses / receptionists in range
    // ------------------------------------------------------------------
    const scheduleWhere = {
      date: { gte: from, lte: to },
    };
    if (filterBranchId) scheduleWhere.branchId = filterBranchId;

    const [doctorSchedules, nurseSchedules, receptionSchedules] =
      await Promise.all([
        prisma.doctorSchedule.findMany({
          where: filterUserId
            ? { ...scheduleWhere, doctorId: filterUserId }
            : scheduleWhere,
          include: {
            doctor: {
              select: { id: true, name: true, ovog: true, email: true, role: true },
            },
            branch: { select: { id: true, name: true } },
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        }),
        prisma.nurseSchedule.findMany({
          where: filterUserId
            ? { ...scheduleWhere, nurseId: filterUserId }
            : scheduleWhere,
          include: {
            nurse: {
              select: { id: true, name: true, ovog: true, email: true, role: true },
            },
            branch: { select: { id: true, name: true } },
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        }),
        prisma.receptionSchedule.findMany({
          where: filterUserId
            ? { ...scheduleWhere, receptionId: filterUserId }
            : scheduleWhere,
          include: {
            reception: {
              select: { id: true, name: true, ovog: true, email: true, role: true },
            },
            branch: { select: { id: true, name: true } },
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        }),
      ]);

    // ------------------------------------------------------------------
    // 2. Load all AttendanceSessions in the range
    // ------------------------------------------------------------------
    const sessionWhere = {
      checkInAt: { gte: from, lte: to },
    };
    if (filterBranchId) sessionWhere.branchId = filterBranchId;
    if (filterUserId) sessionWhere.userId = filterUserId;

    const sessions = await prisma.attendanceSession.findMany({
      where: sessionWhere,
      include: {
        user: {
          select: { id: true, name: true, ovog: true, email: true, role: true },
        },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { checkInAt: "asc" },
    });

    // ------------------------------------------------------------------
    // 3. Build per-user/day attendance aggregate (UTC+8 day key)
    // ------------------------------------------------------------------
    const sessionAggregateMap = buildDailySessionAggregateMap(sessions);

    // Track which session keys have been matched to a schedule row
    const matchedSessionKeys = new Set();

    // ------------------------------------------------------------------
    // 4. Build scheduled rows
    // ------------------------------------------------------------------
    const rows = [];

    // Helper: merge schedule + session into a report row
    function buildRow(scheduleEntry) {
      const { user, branch, date, startTime, endTime, note } = scheduleEntry;
      const dateStr = mongoliaDateString(date);
      const key = `${user.id}:${dateStr}`;
      const aggregate = sessionAggregateMap.get(key) || null;

      // Mark this session key as "matched" so we don't include it again as unscheduled
      if (aggregate) {
        matchedSessionKeys.add(key);
      }

      // Compute status + metrics
      let rowStatus = "absent";
      let durationMinutes = null;
      let lateMinutes = null;
      let earlyLeaveMinutes = null;
      let checkInAt = null;
      let checkOutAt = null;
      let sessionCount = 0;

      if (aggregate) {
        rowStatus = aggregate.hasOpenSession ? "open" : "present";
        durationMinutes = aggregate.totalDurationMinutes;
        checkInAt = aggregate.firstCheckInAt.toISOString();
        checkOutAt = aggregate.latestCheckOutAt?.toISOString() || null;
        sessionCount = aggregate.sessionCount;

        // Late / early calculations using wall-clock HH:MM comparison.
        // Schedule startTime/endTime are "HH:MM" strings.
        // Attendance timestamps are converted to Mongolia wall-clock values (UTC+8).
        const schedStartMins = parseHHMM(startTime);
        const schedEndMins = parseHHMM(endTime);

        if (schedStartMins !== null) {
          const checkInMins = mongoliaWallClockMinutes(aggregate.firstCheckInAt);
          const diff = checkInMins - schedStartMins;
          if (diff >= 1) lateMinutes = diff;
        }

        if (schedEndMins !== null && aggregate.latestCheckOutAt) {
          const checkOutMins = mongoliaWallClockMinutes(aggregate.latestCheckOutAt);
          const diff = schedEndMins - checkOutMins;
          if (diff >= 1) earlyLeaveMinutes = diff;
        }
      }

      const schedStartMins = parseHHMM(startTime);
      const schedEndMins = parseHHMM(endTime);
      const scheduleDurationMinutes =
        schedStartMins !== null && schedEndMins !== null
          ? Math.max(0, schedEndMins - schedStartMins)
          : null;
      const attendanceRatePercent =
        typeof durationMinutes === "number" &&
        scheduleDurationMinutes !== null &&
        scheduleDurationMinutes > 0
          ? Math.round((durationMinutes / scheduleDurationMinutes) * 1000) / 10
          : null;

      return {
        rowType: "scheduled",
        sessionId: aggregate?.firstSession?.id ?? null,
        userId: user.id,
        userName: user.name,
        userOvog: user.ovog,
        userEmail: user.email,
        userRole: user.role,
        branchId: branch.id,
        branchName: branch.name,
        scheduledDate: dateStr,
        scheduledStart: startTime,
        scheduledEnd: endTime,
        scheduleNote: note || null,
        checkInAt,
        checkOutAt,
        durationMinutes,
        lateMinutes,
        earlyLeaveMinutes,
        sessionCount,
        requiredMinutes: scheduleDurationMinutes,
        attendanceRatePercent,
        correctionCount: 0,
        exceptionFlags: aggregate?.hasOpenSession ? "OPEN_SESSION" : "",
        isAutoClosed: false,
        autoCloseReason: null,
        reviewReason: null,
        status: rowStatus,
      };
    }

    // Doctor schedules
    for (const s of doctorSchedules) {
      rows.push(buildRow({ ...s, user: s.doctor }));
    }

    // Nurse schedules
    for (const s of nurseSchedules) {
      rows.push(buildRow({ ...s, user: s.nurse }));
    }

    // Reception schedules
    for (const s of receptionSchedules) {
      rows.push(buildRow({ ...s, user: s.reception }));
    }

    // ------------------------------------------------------------------
    // 5. Add unscheduled attendance rows (sessions not matched to any schedule)
    // ------------------------------------------------------------------
    for (const [key, aggregate] of sessionAggregateMap.entries()) {
      const [userIdStr, dateStr] = key.split(":");
      const userIdNum = Number(userIdStr);

      // Skip if this user+date was matched to a schedule row
      if (matchedSessionKeys.has(key)) continue;

      const firstSession = aggregate.firstSession;
      const durationMinutes = aggregate.totalDurationMinutes;
      const requiredMinutes = getUnscheduledRequiredMinutes(
        firstSession.user.role,
        dateStr
      );
      const attendanceRatePercent =
        typeof durationMinutes === "number" &&
        requiredMinutes !== null &&
        requiredMinutes > 0
          ? Math.round((durationMinutes / requiredMinutes) * 1000) / 10
          : null;

      rows.push({
        rowType: "unscheduled",
        sessionId: firstSession.id,
        userId: userIdNum,
        userName: firstSession.user.name,
        userOvog: firstSession.user.ovog,
        userEmail: firstSession.user.email,
        userRole: firstSession.user.role,
        branchId: firstSession.branch.id,
        branchName: firstSession.branch.name,
        scheduledDate: dateStr,
        scheduledStart: null,
        scheduledEnd: null,
        scheduleNote: null,
        checkInAt: aggregate.firstCheckInAt.toISOString(),
        checkOutAt: aggregate.latestCheckOutAt?.toISOString() || null,
        durationMinutes,
        lateMinutes: null,
        earlyLeaveMinutes: null,
        sessionCount: aggregate.sessionCount,
        requiredMinutes,
        attendanceRatePercent,
        correctionCount: 0,
        exceptionFlags: aggregate.hasOpenSession ? "OPEN_SESSION,UNSCHEDULED" : "UNSCHEDULED",
        isAutoClosed: false,
        autoCloseReason: null,
        reviewReason: null,
        status: aggregate.hasOpenSession ? "open" : "unscheduled",
      });
    }

    // ------------------------------------------------------------------
    // 6. Filter by status
    // ------------------------------------------------------------------
    const filtered = filterStatus
      ? rows.filter((r) => r.status === filterStatus)
      : rows;

    // Sort: by scheduledDate then by userName
    filtered.sort((a, b) => {
      const d = a.scheduledDate.localeCompare(b.scheduledDate);
      if (d !== 0) return d;
      const nameA = `${a.userOvog || ""}${a.userName || ""}`;
      const nameB = `${b.userOvog || ""}${b.userName || ""}`;
      return nameA.localeCompare(nameB);
    });

    // ------------------------------------------------------------------
    // 7. Paginate
    // ------------------------------------------------------------------
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSizeNum));
    const safePage = Math.min(pageNum, totalPages);
    const items = filtered.slice(
      (safePage - 1) * pageSizeNum,
      safePage * pageSizeNum
    );

    const summary = computeAttendanceKpis(filtered);

    return res.json({
      items,
      summary,
      page: safePage,
      pageSize: pageSizeNum,
      total,
      totalPages,
    });
  } catch (err) {
    console.error("GET /api/admin/attendance error:", err);
    return res.status(500).json({ error: "Серверийн алдаа гарлаа." });
  }
});

/**
 * GET /api/admin/attendance/kpis
 * Lightweight KPI summary for the selected attendance range.
 */
router.get("/attendance/kpis", async (req, res) => {
  try {
    const { fromTs, toTs, branchId, userId } = req.query;
    if (!fromTs || !toTs) {
      return res.status(400).json({ error: "fromTs and toTs are required" });
    }
    const from = new Date(fromTs);
    const to = new Date(toTs);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return res
        .status(400)
        .json({ error: "fromTs and toTs must be valid ISO timestamps" });
    }

    const filterBranchId = branchId ? Number(branchId) : null;
    const filterUserId = userId ? Number(userId) : null;

    const sessionWhere = {
      checkInAt: { gte: from, lte: to },
    };
    if (filterBranchId) sessionWhere.branchId = filterBranchId;
    if (filterUserId) sessionWhere.userId = filterUserId;

    const sessions = await prisma.attendanceSession.findMany({
      where: sessionWhere,
      include: {
        user: {
          select: { id: true, name: true, ovog: true, email: true, role: true },
        },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { checkInAt: "asc" },
    });

    const kpis = computeAttendanceKpis(
      Array.from(buildDailySessionAggregateMap(sessions).values()).map((a) => ({
        status: a.hasOpenSession ? "open" : "present",
        lateMinutes: null,
      }))
    );

    return res.json({ ...kpis, totalSessionRows: sessions.length });
  } catch (err) {
    console.error("GET /api/admin/attendance/kpis error:", err);
    return res.status(500).json({ error: "Серверийн алдаа гарлаа." });
  }
});

/**
 * GET /api/admin/attendance/export
 * Export attendance rows as CSV for payroll-safe monthly usage.
 */
router.get("/attendance/export", async (req, res) => {
  try {
    const { fromTs, toTs, branchId, userId, status } = req.query;
    if (!fromTs || !toTs) {
      return res.status(400).json({ error: "fromTs and toTs are required" });
    }
    const from = new Date(fromTs);
    const to = new Date(toTs);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return res
        .status(400)
        .json({ error: "fromTs and toTs must be valid ISO timestamps" });
    }

    const filterBranchId = branchId ? Number(branchId) : null;
    const filterUserId = userId ? Number(userId) : null;
    const filterStatus = status && status !== "all" ? String(status) : null;

    const scheduleWhere = {
      date: { gte: from, lte: to },
    };
    if (filterBranchId) scheduleWhere.branchId = filterBranchId;

    const [doctorSchedules, nurseSchedules, receptionSchedules] =
      await Promise.all([
        prisma.doctorSchedule.findMany({
          where: filterUserId
            ? { ...scheduleWhere, doctorId: filterUserId }
            : scheduleWhere,
          include: {
            doctor: {
              select: { id: true, name: true, ovog: true, email: true, role: true },
            },
            branch: { select: { id: true, name: true } },
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        }),
        prisma.nurseSchedule.findMany({
          where: filterUserId
            ? { ...scheduleWhere, nurseId: filterUserId }
            : scheduleWhere,
          include: {
            nurse: {
              select: { id: true, name: true, ovog: true, email: true, role: true },
            },
            branch: { select: { id: true, name: true } },
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        }),
        prisma.receptionSchedule.findMany({
          where: filterUserId
            ? { ...scheduleWhere, receptionId: filterUserId }
            : scheduleWhere,
          include: {
            reception: {
              select: { id: true, name: true, ovog: true, email: true, role: true },
            },
            branch: { select: { id: true, name: true } },
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        }),
      ]);

    const sessionWhere = {
      checkInAt: { gte: from, lte: to },
    };
    if (filterBranchId) sessionWhere.branchId = filterBranchId;
    if (filterUserId) sessionWhere.userId = filterUserId;

    const sessions = await prisma.attendanceSession.findMany({
      where: sessionWhere,
      include: {
        user: {
          select: { id: true, name: true, ovog: true, email: true, role: true },
        },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { checkInAt: "asc" },
    });

    const sessionAggregateMap = buildDailySessionAggregateMap(sessions);
    const matchedSessionKeys = new Set();
    const rows = [];

    function buildRow(scheduleEntry) {
      const { user, branch, date, startTime, endTime, note } = scheduleEntry;
      const dateStr = mongoliaDateString(date);
      const key = `${user.id}:${dateStr}`;
      const aggregate = sessionAggregateMap.get(key) || null;
      if (aggregate) matchedSessionKeys.add(key);

      let rowStatus = "absent";
      let durationMinutes = null;
      let lateMinutes = null;
      let earlyLeaveMinutes = null;
      let checkInAt = null;
      let checkOutAt = null;
      let sessionCount = 0;
      let exceptionFlags = "";

      if (aggregate) {
        rowStatus = aggregate.hasOpenSession ? "open" : "present";
        durationMinutes = aggregate.totalDurationMinutes;
        checkInAt = aggregate.firstCheckInAt.toISOString();
        checkOutAt = aggregate.latestCheckOutAt?.toISOString() || null;
        sessionCount = aggregate.sessionCount;
        const schedStartMins = parseHHMM(startTime);
        const schedEndMins = parseHHMM(endTime);
        if (schedStartMins !== null) {
          const checkInMins = mongoliaWallClockMinutes(aggregate.firstCheckInAt);
          const diff = checkInMins - schedStartMins;
          if (diff >= 1) lateMinutes = diff;
        }
        if (schedEndMins !== null && aggregate.latestCheckOutAt) {
          const checkOutMins = mongoliaWallClockMinutes(aggregate.latestCheckOutAt);
          const diff = schedEndMins - checkOutMins;
          if (diff >= 1) earlyLeaveMinutes = diff;
        }
        if (aggregate.hasOpenSession) exceptionFlags = "OPEN_SESSION";
      }

      return {
        rowType: "scheduled",
        userId: user.id,
        userName: user.name,
        userOvog: user.ovog,
        userEmail: user.email,
        userRole: user.role,
        branchId: branch.id,
        branchName: branch.name,
        scheduledDate: dateStr,
        scheduledStart: startTime,
        scheduledEnd: endTime,
        scheduleNote: note || null,
        checkInAt,
        checkOutAt,
        durationMinutes,
        lateMinutes,
        earlyLeaveMinutes,
        sessionCount,
        correctionCount: 0,
        exceptionFlags,
        status: rowStatus,
      };
    }

    for (const s of doctorSchedules) rows.push(buildRow({ ...s, user: s.doctor }));
    for (const s of nurseSchedules) rows.push(buildRow({ ...s, user: s.nurse }));
    for (const s of receptionSchedules) rows.push(buildRow({ ...s, user: s.reception }));

    for (const [key, aggregate] of sessionAggregateMap.entries()) {
      const [userIdStr, dateStr] = key.split(":");
      if (matchedSessionKeys.has(key)) continue;
      const firstSession = aggregate.firstSession;
      const requiredMinutes = getUnscheduledRequiredMinutes(
        firstSession.user.role,
        dateStr
      );
      const attendanceRatePercent =
        requiredMinutes !== null && requiredMinutes > 0
          ? Math.round((aggregate.totalDurationMinutes / requiredMinutes) * 1000) / 10
          : null;
      rows.push({
        rowType: "unscheduled",
        userId: Number(userIdStr),
        userName: firstSession.user.name,
        userOvog: firstSession.user.ovog,
        userEmail: firstSession.user.email,
        userRole: firstSession.user.role,
        branchId: firstSession.branch.id,
        branchName: firstSession.branch.name,
        scheduledDate: dateStr,
        scheduledStart: null,
        scheduledEnd: null,
        scheduleNote: null,
        checkInAt: aggregate.firstCheckInAt.toISOString(),
        checkOutAt: aggregate.latestCheckOutAt?.toISOString() || null,
        durationMinutes: aggregate.totalDurationMinutes,
        lateMinutes: null,
        earlyLeaveMinutes: null,
        sessionCount: aggregate.sessionCount,
        requiredMinutes,
        attendanceRatePercent,
        correctionCount: 0,
        exceptionFlags: aggregate.hasOpenSession ? "OPEN_SESSION,UNSCHEDULED" : "UNSCHEDULED",
        status: aggregate.hasOpenSession ? "open" : "unscheduled",
      });
    }

    const filtered = filterStatus ? rows.filter((r) => r.status === filterStatus) : rows;
    filtered.sort((a, b) => {
      const d = a.scheduledDate.localeCompare(b.scheduledDate);
      if (d !== 0) return d;
      const nameA = `${a.userOvog || ""}${a.userName || ""}`;
      const nameB = `${b.userOvog || ""}${b.userName || ""}`;
      return nameA.localeCompare(nameB);
    });

    const csv = toAttendanceCsv(filtered);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-export-${from.toISOString().slice(0, 10)}-${to
        .toISOString()
        .slice(0, 10)}.csv"`
    );
    return res.status(200).send("\uFEFF" + csv);
  } catch (err) {
    console.error("GET /api/admin/attendance/export error:", err);
    return res.status(500).json({ error: "Серверийн алдаа гарлаа." });
  }
});

export default router;
