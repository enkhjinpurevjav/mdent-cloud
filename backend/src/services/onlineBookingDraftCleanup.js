import prisma from "../db.js";

const ACTIVE_DRAFT_STATUSES = ["PENDING_PAYMENT", "VERIFIED"];
const TERMINAL_DRAFT_STATUSES = ["EXPIRED", "CANCELLED"];

/**
 * Marks expired online booking drafts and deletes old terminal drafts.
 */
export async function cleanupExpiredOnlineBookingDrafts({
  deleteTerminalOlderThanHours = 24,
} = {}) {
  const now = new Date();

  const expired = await prisma.onlineBookingDraft.updateMany({
    where: {
      status: { in: ACTIVE_DRAFT_STATUSES },
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  const deleteBefore = new Date(
    now.getTime() - deleteTerminalOlderThanHours * 60 * 60 * 1000
  );
  const deleted = await prisma.onlineBookingDraft.deleteMany({
    where: {
      status: { in: TERMINAL_DRAFT_STATUSES },
      updatedAt: { lt: deleteBefore },
    },
  });

  return {
    markedExpiredCount: expired.count,
    deletedCount: deleted.count,
  };
}
