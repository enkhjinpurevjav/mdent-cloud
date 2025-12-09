import { PrismaClient } from "@prisma/client";

export async function generateNextServiceCode(prisma: PrismaClient): Promise<string> {
  // Find last service with non-null code ordered by id
  const last = await prisma.service.findFirst({
    where: { code: { not: null } },
    orderBy: { id: "desc" },
    select: { code: true },
  });

  let nextNumber = 1;
  if (last?.code) {
    const match = last.code.match(/^S(\d+)$/);
    if (match) {
      nextNumber = Number(match[1]) + 1;
    }
  }

  return `S${String(nextNumber).padStart(4, "0")}`; // S0001, S0002, ...
}
