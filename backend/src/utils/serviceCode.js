import prisma from "../db.js";

/**
 * Generate next service code like S0001, S0002...
 * Looks at the last non-null code and increments the numeric part.
 */
export async function generateNextServiceCode() {
  const last = await prisma.service.findFirst({
    where: { code: { not: null } },
    orderBy: { id: "desc" },
    select: { code: true },
  });

  let nextNumber = 1;
  if (last && last.code) {
    const match = last.code.match(/^S(\d+)$/);
    if (match) {
      nextNumber = Number(match[1]) + 1;
    }
  }

  return `S${String(nextNumber).padStart(4, "0")}`;
}
