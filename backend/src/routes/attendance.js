import express from "express";
import prisma from "../db.js";
import { haversineDistanceM } from "../utils/geo.js";
import {
  ATTENDANCE_ATTEMPT_RESULT,
  ATTENDANCE_ATTEMPT_TYPE,
  ATTENDANCE_FAILURE_CODE,
  getAttemptFailureCode,
  getErrorMessage,
  getErrorStatus,
  withErrMeta,
  hasErrorStatus,
} from "../utils/attendanceAttemptLog.js";
import { getEffectiveAttendancePolicy, isWithinScheduleWindow } from "../utils/attendancePolicy.js";
import {
  SCHEDULE_AHEAD_ROLES,
  enforceStandardShiftCheckInWindow,
  enforceStandardShiftCheckout,
} from "../utils/attendanceWorkRules.js";

const router = express.Router();

const MONGOLIA_OFFSET_MS = 8 * 60 * 60_000; // UTC+8
const MS_PER_MINUTE = 60_000;

/**
 * Validate and parse geo body { lat, lng, accuracyM }.
 * Returns { lat, lng, accuracyM } on success or throws with a message.
 */
function parseGeoBody(body) {
  const { lat, lng, accuracyM } = body || {};

  if (typeof lat !== "number" || typeof lng !== "number" || typeof accuracyM !== "number") {
    const err = new Error("lat, lng, accuracyM тоон утгаар илгээх шаардлагатай.");
    err.status = 400;
    throw err;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    const err = new Error("lat/lng утга буруу байна.");
    err.status = 400;
    throw err;
  }
  if (accuracyM <= 0) {
    const err = new Error("accuracyM эерэг тоо байх ёстой.");
    err.status = 400;
    throw err;
  }

  return { lat, lng, accuracyM };
}

async function logAttendanceAttempt(data) {
  try {
    await prisma.attendanceAttempt.create({ data });
  } catch (e) {
    // Attempt logging should never block attendance actions.
    console.error("AttendanceAttempt log error:", e);
  }
}


/** Returns today's date string (YYYY-MM-DD) in Mongolia timezone (UTC+8). */
function mongoliaDateString(now) {
  const shifted = new Date(now.getTime() + MONGOLIA_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Automatically resolve the attendance branchId for the given user and role.
 *
 * - doctor / nurse / receptionist / sterilization: if today's schedule exists,
 *   use scheduled branch and enforce schedule window.
 *   If no schedule exists, fall back to user's primary branch and allow unscheduled record.
 * - all other roles: return the user's primary User.branchId.
 */
async function resolveAttendanceBranch(userId, role, now) {
  if (SCHEDULE_AHEAD_ROLES.has(role)) {
    const todayYmd = mongoliaDateString(now);
    const dayStart = new Date(`${todayYmd}T00:00:00.000+08:00`);
    const dayEnd = new Date(`${todayYmd}T23:59:59.999+08:00`);

    let schedule = null;
    if (role === "doctor") {
      schedule = await prisma.doctorSchedule.findFirst({
        where: { doctorId: userId, date: { gte: dayStart, lte: dayEnd } },
        select: { branchId: true, startTime: true, endTime: true },
      });
    } else if (role === "nurse") {
      schedule = await prisma.nurseSchedule.findFirst({
        where: { nurseId: userId, date: { gte: dayStart, lte: dayEnd } },
        select: { branchId: true, startTime: true, endTime: true },
      });
    } else if (role === "receptionist") {
      schedule = await prisma.receptionSchedule.findFirst({
        where: { receptionId: userId, date: { gte: dayStart, lte: dayEnd } },
        select: { branchId: true, startTime: true, endTime: true },
      });
    }

    if (schedule) {
      const policy = await getEffectiveAttendancePolicy({
        prisma,
        role,
        branchId: schedule.branchId,
      });

      const { withinWindow } = isWithinScheduleWindow({
        now,
        ymd: todayYmd,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        earlyCheckInMinutes: policy.earlyCheckInMinutes,
      });

      if (!withinWindow) {
        throw withErrMeta(
          new Error(
            `Ирц бүртгэх цаг болоогүй байна. ` +
              `Таны хуваарийн цаг: ${schedule.startTime}–${schedule.endTime} ` +
              `(${policy.earlyCheckInMinutes} минут эрт бүртгэх боломжтой).`
          ),
          ATTENDANCE_FAILURE_CODE.SCHEDULE_WINDOW_CLOSED,
          403
        );
      }
      return schedule.branchId;
    }
  }

  // If no schedule exists (or role is non-scheduled), use primary branch.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { branchId: true },
  });
  if (!user?.branchId) {
    throw withErrMeta(
      new Error("Таны бүртгэлд үндсэн салбар тохируулаагүй байна. Администраторт хандана уу."),
      ATTENDANCE_FAILURE_CODE.SCHEDULE_NOT_FOUND,
      403
    );
  }
  return user.branchId;
}

/**
 * Enforce geofence against a specific branch.
 * Accuracy must be <=MAX_ACCURACY_M and GPS distance <= branch radius.
 * Throws with status 403 on violation.
 */
async function enforceGeofenceForBranch(branchId, lat, lng, accuracyM, policy) {
  const minAccuracyM = policy?.minAccuracyM ?? 100;
  const enforceGeofence = policy?.enforceGeofence ?? true;

  if (accuracyM > minAccuracyM) {
    throw withErrMeta(
      new Error(
        `Таны байршлын нарийвчлал ${accuracyM}м байна (хязгаар: ${minAccuracyM}м). ` +
          "GPS дохио сайжрах хүртэл хүлээнэ үү."
      ),
      ATTENDANCE_FAILURE_CODE.LOW_ACCURACY,
      403
    );
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, name: true, geoLat: true, geoLng: true, geoRadiusM: true },
  });

  if (!branch?.geoLat || !branch?.geoLng) {
    throw withErrMeta(
      new Error("Таны салбарын байршил тохируулаагүй байна. Администраторт хандана уу."),
      ATTENDANCE_FAILURE_CODE.MISSING_BRANCH_GEO,
      400
    );
  }

  const radiusM = branch.geoRadiusM;
  const distM = haversineDistanceM(lat, lng, branch.geoLat, branch.geoLng);

  if (enforceGeofence && distM > radiusM) {
    throw withErrMeta(
      new Error(
        `Та салбараас ${Math.round(distM)}м зайтай байна (зөвшөөрөгдөх хязгаар: ${radiusM}м). ` +
          "Салбарын ойролцоо орж ирнэ үү."
      ),
      ATTENDANCE_FAILURE_CODE.OUTSIDE_GEOFENCE,
      403
    );
  }

  return { distM, radiusM };
}

/**
 * GET /api/attendance/me
 * Returns today's attendance status: open session (if any) and recent history.
 */
router.get("/me", async (req, res) => {
  try {
    const userId = req.user.id;

    // Find open session (checked in but not yet checked out)
    const openSession = await prisma.attendanceSession.findFirst({
      where: { userId, checkOutAt: null },
      orderBy: { checkInAt: "desc" },
    });

    // Last 10 sessions for history
    const recent = await prisma.attendanceSession.findMany({
      where: {
        userId,
        checkInAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { checkInAt: "desc" },
      take: 10,
    });

    res.json({
      checkedIn: !!openSession,
      openSession: openSession ?? null,
      recent,
    });
  } catch (err) {
    console.error("GET /api/attendance/me error:", err);
    res.status(500).json({ error: "Серверийн алдаа гарлаа." });
  }
});

/**
 * POST /api/attendance/check-in
 * Body: { lat: number, lng: number, accuracyM: number }
 * The attendance branch is automatically determined from today's schedule
 * (for schedule-first roles) or the user's primary branch.
 */
router.post("/check-in", async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  let lat = null;
  let lng = null;
  let accuracyM = null;
  let branchId = null;
  let policy = null;

  try {
    ({ lat, lng, accuracyM } = parseGeoBody(req.body));
    const now = new Date();

    // Automatically resolve which branch this worker is attending today
    branchId = await resolveAttendanceBranch(userId, role, now);
    policy = await getEffectiveAttendancePolicy({
      prisma,
      role,
      branchId,
    });
    enforceStandardShiftCheckInWindow(role, now);

    // Enforce geofence against the resolved branch
    const geo = await enforceGeofenceForBranch(branchId, lat, lng, accuracyM, policy);

    // Check for existing open session
    const existing = await prisma.attendanceSession.findFirst({
      where: { userId, checkOutAt: null },
    });
    if (existing) {
      await logAttendanceAttempt({
        userId,
        branchId,
        attemptType: ATTENDANCE_ATTEMPT_TYPE.CHECK_IN,
        result: ATTENDANCE_ATTEMPT_RESULT.FAIL,
        failureCode: ATTENDANCE_FAILURE_CODE.OPEN_SESSION_EXISTS,
        failureMessage: "Та аль хэдийн ирц бүртгэсэн байна. Эхлээд гарах бүртгэл хийнэ үү.",
        lat,
        lng,
        accuracyM: Math.round(accuracyM),
        distanceM: Math.round(geo.distM),
        radiusM: Math.round(geo.radiusM),
      });
      return res
        .status(409)
        .json({ error: "Та аль хэдийн ирц бүртгэсэн байна. Эхлээд гарах бүртгэл хийнэ үү." });
    }

    const session = await prisma.attendanceSession.create({
      data: {
        userId,
        branchId,
        checkInAt: new Date(),
        checkInLat: lat,
        checkInLng: lng,
        checkInAccuracyM: Math.round(accuracyM),
      },
    });

    await logAttendanceAttempt({
      userId,
      branchId,
      attemptType: ATTENDANCE_ATTEMPT_TYPE.CHECK_IN,
      result: ATTENDANCE_ATTEMPT_RESULT.SUCCESS,
      lat,
      lng,
      accuracyM: Math.round(accuracyM),
      distanceM: Math.round(geo.distM),
      radiusM: Math.round(geo.radiusM),
    });

    res.status(201).json({ session });
  } catch (err) {
    let geo = null;
    if (branchId && lat != null && lng != null && typeof accuracyM === "number") {
      const branch = await prisma.branch
        .findUnique({
          where: { id: branchId },
          select: { geoLat: true, geoLng: true, geoRadiusM: true },
        })
        .catch(() => null);
      if (branch?.geoLat && branch?.geoLng) {
        const radiusM = branch.geoRadiusM;
        geo = {
          distM: haversineDistanceM(lat, lng, branch.geoLat, branch.geoLng),
          radiusM,
        };
      }
    }
    await logAttendanceAttempt({
      userId,
      branchId,
      attemptType: ATTENDANCE_ATTEMPT_TYPE.CHECK_IN,
      result: ATTENDANCE_ATTEMPT_RESULT.FAIL,
      failureCode: getAttemptFailureCode(err),
      failureMessage: getErrorMessage(err),
      lat,
      lng,
      accuracyM: typeof accuracyM === "number" ? Math.round(accuracyM) : null,
      distanceM: geo ? Math.round(geo.distM) : null,
      radiusM: geo ? Math.round(geo.radiusM) : null,
    });
    if (hasErrorStatus(err)) {
      return res.status(getErrorStatus(err)).json({ error: getErrorMessage(err) });
    }
    console.error("POST /api/attendance/check-in error:", err);
    res.status(500).json({ error: "Серверийн алдаа гарлаа." });
  }
});

/**
 * POST /api/attendance/check-out
 * Body: { lat: number, lng: number, accuracyM: number }
 * Geofence is enforced against the branch recorded at check-in time to
 * prevent switching branches between check-in and check-out.
 */
router.post("/check-out", async (req, res) => {
  const userId = req.user.id;
  let lat = null;
  let lng = null;
  let accuracyM = null;
  let branchId = null;
  let role = req.user.role;
  let policy = null;

  try {
    ({ lat, lng, accuracyM } = parseGeoBody(req.body));

    // Must have open session first
    const openSession = await prisma.attendanceSession.findFirst({
      where: { userId, checkOutAt: null },
      orderBy: { checkInAt: "desc" },
    });
    if (!openSession) {
      await logAttendanceAttempt({
        userId,
        attemptType: ATTENDANCE_ATTEMPT_TYPE.CHECK_OUT,
        result: ATTENDANCE_ATTEMPT_RESULT.FAIL,
        failureCode: ATTENDANCE_FAILURE_CODE.OPEN_SESSION_NOT_FOUND,
        failureMessage: "Ирц бүртгэл олдсонгүй. Эхлээд ирц бүртгэнэ үү.",
        lat,
        lng,
        accuracyM: Math.round(accuracyM),
      });
      return res
        .status(409)
        .json({ error: "Ирц бүртгэл олдсонгүй. Эхлээд ирц бүртгэнэ үү." });
    }

    branchId = openSession.branchId;
    policy = await getEffectiveAttendancePolicy({
      prisma,
      role,
      branchId,
    });

    // Use the session's branchId to prevent branch-switching on check-out
    const geo = await enforceGeofenceForBranch(
      openSession.branchId,
      lat,
      lng,
      accuracyM,
      policy
    );
    const now = new Date();
    enforceStandardShiftCheckout({
      role,
      checkInAt: openSession.checkInAt,
      checkOutAt: now,
    });

    const updated = await prisma.attendanceSession.update({
      where: { id: openSession.id },
      data: {
        checkOutAt: now,
        checkOutLat: lat,
        checkOutLng: lng,
        checkOutAccuracyM: Math.round(accuracyM),
      },
    });

    await logAttendanceAttempt({
      userId,
      branchId: openSession.branchId,
      attemptType: ATTENDANCE_ATTEMPT_TYPE.CHECK_OUT,
      result: ATTENDANCE_ATTEMPT_RESULT.SUCCESS,
      lat,
      lng,
      accuracyM: Math.round(accuracyM),
      distanceM: Math.round(geo.distM),
      radiusM: Math.round(geo.radiusM),
    });

    res.json({ session: updated });
  } catch (err) {
    let geo = null;
    if (branchId && lat != null && lng != null && typeof accuracyM === "number") {
      const branch = await prisma.branch
        .findUnique({
          where: { id: branchId },
          select: { geoLat: true, geoLng: true, geoRadiusM: true },
        })
        .catch(() => null);
      if (branch?.geoLat && branch?.geoLng) {
        const radiusM = branch.geoRadiusM;
        geo = {
          distM: haversineDistanceM(lat, lng, branch.geoLat, branch.geoLng),
          radiusM,
        };
      }
    }
    await logAttendanceAttempt({
      userId,
      branchId,
      attemptType: ATTENDANCE_ATTEMPT_TYPE.CHECK_OUT,
      result: ATTENDANCE_ATTEMPT_RESULT.FAIL,
      failureCode: getAttemptFailureCode(err),
      failureMessage: getErrorMessage(err),
      lat,
      lng,
      accuracyM: typeof accuracyM === "number" ? Math.round(accuracyM) : null,
      distanceM: geo ? Math.round(geo.distM) : null,
      radiusM: geo ? Math.round(geo.radiusM) : null,
    });
    if (hasErrorStatus(err)) {
      return res.status(getErrorStatus(err)).json({ error: getErrorMessage(err) });
    }
    console.error("POST /api/attendance/check-out error:", err);
    res.status(500).json({ error: "Серверийн алдаа гарлаа." });
  }
});

/**
 * GET /api/attendance/attempts
 * Admin-only audit feed for latest attendance attempts.
 */
router.get("/attempts", async (req, res) => {
  try {
    const requesterRole = req.user?.role || null;
    const authBypassed = process.env.DISABLE_AUTH === "true";
    if (
      !authBypassed &&
      requesterRole !== "admin" &&
      requesterRole !== "super_admin"
    ) {
      return res.status(403).json({ error: "Forbidden. Insufficient role." });
    }

    const takeRaw = Number(req.query.take || 100);
    const take = Math.max(1, Math.min(500, Number.isFinite(takeRaw) ? takeRaw : 100));
    const userId = req.query.userId ? Number(req.query.userId) : null;
    const branchId = req.query.branchId ? Number(req.query.branchId) : null;
    const result = req.query.result ? String(req.query.result) : null;

    const where = {};
    if (userId) where.userId = userId;
    if (branchId) where.branchId = branchId;
    if (result === ATTENDANCE_ATTEMPT_RESULT.SUCCESS || result === ATTENDANCE_ATTEMPT_RESULT.FAIL) {
      where.result = result;
    }

    const items = await prisma.attendanceAttempt.findMany({
      where,
      orderBy: { attemptAt: "desc" },
      take,
      include: {
        user: {
          select: { id: true, name: true, ovog: true, email: true, role: true },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
    });

    return res.json({ items });
  } catch (err) {
    console.error("GET /api/attendance/attempts error:", err);
    return res.status(500).json({ error: "Серверийн алдаа гарлаа." });
  }
});

/**
 * PATCH /api/attendance/session/:id
 * Admin-only correction with immutable audit trail.
 */
router.patch("/session/:id", async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden. Insufficient role." });
    }

    const sessionId = Number(req.params.id);
    if (!sessionId || Number.isNaN(sessionId)) {
      return res.status(400).json({ error: "Invalid session id." });
    }

    const {
      newCheckInAt,
      newCheckOutAt,
      reasonCode,
      reasonText,
      approvedByUserId,
    } = req.body || {};

    if (!newCheckInAt || !reasonCode) {
      return res.status(400).json({ error: "newCheckInAt and reasonCode are required." });
    }

    const existing = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      select: { id: true, checkInAt: true, checkOutAt: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "Attendance session not found." });
    }

    const nextCheckInAt = new Date(newCheckInAt);
    const nextCheckOutAt = newCheckOutAt ? new Date(newCheckOutAt) : null;
    if (Number.isNaN(nextCheckInAt.getTime())) {
      return res.status(400).json({ error: "Invalid newCheckInAt." });
    }
    if (nextCheckOutAt && Number.isNaN(nextCheckOutAt.getTime())) {
      return res.status(400).json({ error: "Invalid newCheckOutAt." });
    }
    if (nextCheckOutAt && nextCheckOutAt < nextCheckInAt) {
      return res.status(400).json({ error: "newCheckOutAt must be after newCheckInAt." });
    }

    const [updated] = await prisma.$transaction([
      prisma.attendanceSession.update({
        where: { id: sessionId },
        data: {
          checkInAt: nextCheckInAt,
          checkOutAt: nextCheckOutAt,
          requiresReview: false,
          reviewReason: null,
        },
      }),
      prisma.attendanceSessionEdit.create({
        data: {
          sessionId,
          editedByUserId: req.user.id,
          approvedByUserId: approvedByUserId ?? null,
          oldCheckInAt: existing.checkInAt,
          oldCheckOutAt: existing.checkOutAt,
          newCheckInAt: nextCheckInAt,
          newCheckOutAt: nextCheckOutAt,
          reasonCode: String(reasonCode),
          reasonText: reasonText ? String(reasonText) : null,
        },
      }),
    ]);

    return res.json({ session: updated });
  } catch (err) {
    console.error("PATCH /api/attendance/session/:id error:", err);
    return res.status(500).json({ error: "Серверийн алдаа гарлаа." });
  }
});

/**
 * PATCH /api/attendance/session/:id/overtime-approval
 * Admin-only overtime approval state persistence.
 */
router.patch("/session/:id/overtime-approval", async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden. Insufficient role." });
    }

    const sessionId = Number(req.params.id);
    if (!sessionId || Number.isNaN(sessionId)) {
      return res.status(400).json({ error: "Invalid session id." });
    }

    const approved = req.body?.approved;
    if (typeof approved !== "boolean") {
      return res.status(400).json({ error: "approved boolean is required." });
    }

    const existing = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      select: { id: true, checkOutAt: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "Attendance session not found." });
    }
    if (!existing.checkOutAt) {
      return res.status(409).json({ error: "Open session overtime cannot be approved yet." });
    }

    const updated = await prisma.attendanceSession.update({
      where: { id: sessionId },
      data: {
        overtimeApproved: approved,
        overtimeApprovedAt: approved ? new Date() : null,
        overtimeApprovedByUserId: approved ? req.user.id : null,
      },
      select: {
        id: true,
        overtimeApproved: true,
        overtimeApprovedAt: true,
        overtimeApprovedByUserId: true,
      },
    });

    return res.json({ session: updated });
  } catch (err) {
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Attendance session not found." });
    }
    console.error("PATCH /api/attendance/session/:id/overtime-approval error:", err);
    return res.status(500).json({ error: "Серверийн алдаа гарлаа." });
  }
});

/**
 * POST /api/attendance/auto-close
 * Admin-only helper endpoint to close stale open sessions.
 */
router.post("/auto-close", async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden. Insufficient role." });
    }

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, role: true, branchId: true },
    });

    const openSessions = await prisma.attendanceSession.findMany({
      where: { checkOutAt: null },
      select: { id: true, userId: true, branchId: true, checkInAt: true },
    });

    const userById = new Map(users.map((u) => [u.id, u]));
    let closedCount = 0;

    for (const s of openSessions) {
      const user = userById.get(s.userId);
      if (!user) continue;
      const policy = await getEffectiveAttendancePolicy({
        prisma,
        role: user.role,
        branchId: s.branchId,
      });
      const cutoff = new Date(
        s.checkInAt.getTime() + (policy.autoCloseAfterMinutes ?? 720) * MS_PER_MINUTE
      );
      if (new Date() < cutoff) continue;

      await prisma.attendanceSession.update({
        where: { id: s.id },
        data: {
          checkOutAt: cutoff,
          requiresReview: true,
          reviewReason: "AUTO_CLOSED_BY_POLICY",
        },
      });
      closedCount += 1;
    }

    return res.json({ closedCount });
  } catch (err) {
    console.error("POST /api/attendance/auto-close error:", err);
    return res.status(500).json({ error: "Серверийн алдаа гарлаа." });
  }
});

export default router;
