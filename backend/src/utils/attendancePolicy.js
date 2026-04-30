import prisma from "../db.js";
import { parseMongoliaDateTime } from "./attendanceReport.js";

const DEFAULT_POLICY = Object.freeze({
  id: 0,
  branchId: null,
  role: null,
  priority: -1,
  isActive: true,
  earlyCheckInMinutes: 120,
  lateGraceMinutes: 0,
  earlyLeaveGraceMinutes: 0,
  autoCloseAfterMinutes: 720,
  minAccuracyM: 100,
  enforceGeofence: true,
});

export function normalizePolicy(policy) {
  return {
    ...DEFAULT_POLICY,
    ...(policy || {}),
  };
}

export function selectPolicyFromCandidates({ candidates, branchId, role }) {
  const normalized = candidates.map((p) => normalizePolicy(p));

  const branchRole = normalized.find((p) => p.branchId === branchId && p.role === role);
  if (branchRole) return branchRole;

  const roleOnly = normalized.find((p) => p.branchId == null && p.role === role);
  if (roleOnly) return roleOnly;

  const branchOnly = normalized.find((p) => p.branchId === branchId && p.role == null);
  if (branchOnly) return branchOnly;

  const global = normalized.find((p) => p.branchId == null && p.role == null);
  if (global) return global;

  return normalizePolicy(null);
}

/**
 * Resolve attendance policy by priority:
 * 1) branch+role
 * 2) role-only
 * 3) branch-only
 * 4) global (null branch, null role)
 * Fallback to DEFAULT_POLICY.
 */
export async function getEffectiveAttendancePolicy({
  prisma: prismaClient = prisma,
  branchId,
  role,
}) {
  const candidates = await prismaClient.attendancePolicy.findMany({
    where: { isActive: true },
    orderBy: [{ priority: "desc" }, { id: "asc" }],
  });
  return selectPolicyFromCandidates({ candidates, branchId, role });
}

export function isWithinScheduleWindow({ now, ymd, startTime, endTime, earlyCheckInMinutes }) {
  const startDt = parseMongoliaDateTime(ymd, startTime);
  const endDt = parseMongoliaDateTime(ymd, endTime);
  const earlyStart = new Date(startDt.getTime() - earlyCheckInMinutes * 60_000);
  return {
    startDt,
    endDt,
    earlyStart,
    withinWindow: now >= earlyStart && now <= endDt,
  };
}
