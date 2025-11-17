// backend/prisma/seed.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD || "admin";
  const hashed = await bcrypt.hash(adminPassword, 10);

  // Upsert branch
  const branch = await prisma.branch.upsert({
    where: { name: "Main Branch" },
    update: { address: "Main clinic (seeded)" },
    create: { name: "Main Branch", address: "Main clinic (seeded)" },
  });

  // Upsert admin user
  await prisma.user.upsert({
    where: { email: "admin@mdent.local" },
    update: { password: hashed, role: "admin", branchId: branch.id },
    create: {
      email: "admin@mdent.local",
      password: hashed,
      role: "admin",
      branchId: branch.id,
    },
  });

  // Optionally create a sample patient + book
  const patient = await prisma.patient.upsert({
    where: { name: "Seed Patient" },
    update: {},
    create: {
      regNo: "0000000000",
      name: "Seed Patient",
      phone: "70000000",
      branchId: branch.id,
      book: { create: { bookNumber: `BOOK-${Date.now()}` } },
    },
  });

  console.log("Seed completed:", { branch: branch.name, admin: "admin@mdent.local", patient: patient.name });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
