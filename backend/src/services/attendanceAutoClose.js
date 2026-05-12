import prisma from "../db.js";

const MONGOLIA_OFFSET_MS = 8 * 60 * 60_000; // UTC+8
const AUTO_CLOSE_HOUR = 23;
const AUTO_CLOSE_MINUTE = 30;

function toMongoliaShifted(date) {
  return new Date(date.getTime() + MONGOLIA_OFFSET_MS);
}

function mongoliaYmd(date) {
  return toMongoliaShifted(date).toISOString().slice(0, 10);
}

function isAfterAutoCloseTimeInMongolia(date) {
  const shifted = toMongoliaShifted(date);
  const h = shifted.getUTCHours();
  const m = shifted.getUTCMinutes();
  const s = shifted.getUTCSeconds();
  const ms = shifted.getUTCMilliseconds();

  if (h > AUTO_CLOSE_HOUR) return true;
  if (h < AUTO_CLOSE_HOUR) return false;
  if (m > AUTO_CLOSE_MINUTE) return true;
  if (m < AUTO_CLOSE_MINUTE) return false;
  return s > 0 || ms > 0;
}

export function calculateAutoCloseCheckoutAt(checkInAt) {
  const baseYmd = mongoliaYmd(checkInAt);
  let cutoff = new Date(`${baseYmd}T23:30:00.000+08:00`);

  // Check-ins after 23:30 local should auto-close at next day's 23:30.
  if (isAfterAutoCloseTimeInMongolia(checkInAt)) {
    cutoff = new Date(cutoff.getTime() + 24 * 60 * 60_000);
  }

  return cutoff;
}

export async function autoCloseOpenAttendanceSessions({
  prismaClient = prisma,
  now = new Date(),
} = {}) {
  const openSessions = await prismaClient.attendanceSession.findMany({
    where: { checkOutAt: null },
    select: { id: true, checkInAt: true },
  });

  let closedCount = 0;

  for (const session of openSessions) {
    const cutoff = calculateAutoCloseCheckoutAt(session.checkInAt);
    if (now < cutoff) continue;

    const updated = await prismaClient.attendanceSession.updateMany({
      where: { id: session.id, checkOutAt: null },
      data: {
        checkOutAt: cutoff,
        requiresReview: true,
        reviewReason: "AUTO_CLOSED_23_30",
      },
    });
    if (updated.count > 0) {
      closedCount += 1;
    }
  }

  return { closedCount, scannedCount: openSessions.length };
}

