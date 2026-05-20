import prisma from "../db.js";
import {
  parseAttendanceAttemptRetentionDays,
  getAttendanceAttemptRetentionCutoff,
} from "../utils/attendanceAttemptRetention.js";

export async function cleanupExpiredAttendanceAttempts({
  prismaClient = prisma,
  retentionDays = parseAttendanceAttemptRetentionDays(
    process.env.ATTENDANCE_ATTEMPT_RETENTION_DAYS
  ),
  now = new Date(),
} = {}) {
  const cutoff = getAttendanceAttemptRetentionCutoff({ now, retentionDays });
  const deleted = await prismaClient.attendanceAttempt.deleteMany({
    where: {
      attemptAt: { lt: cutoff },
    },
  });

  return {
    deletedCount: deleted.count,
    retentionDays,
    cutoff,
  };
}
