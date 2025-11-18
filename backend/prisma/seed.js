// backend/prisma/seed.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD || "admin";
  const hashed = await bcrypt.hash(adminPassword, 10);

  // Branch: find by name (not unique), create if missing, or update address
  const branchName = "Main Branch";
  let branch = await prisma.branch.findFirst({ where: { name: branchName } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: { name: branchName, address: "Main clinic (seeded)" },
    });
  } else {
    branch = await prisma.branch.update({
      where: { id: branch.id },
      data: { address: "Main clinic (seeded)" },
    });
  }

  // Admin user: email is unique, so upsert is fine
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

  // Seed Patient: name is not unique, so findFirst + create/update
  const seedPatientName = "Seed Patient";
  const existingPatient = await prisma.patient.findFirst({
    where: { name: seedPatientName, branchId: branch.id },
  });

  let patient;
  if (!existingPatient) {
    patient = await prisma.patient.create({
      data: {
        regNo: "0000000000",
        name: seedPatientName,
        phone: "70000000",
        branchId: branch.id,
        book: { create: { bookNumber: `BOOK-${Date.now()}` } },
      },
    });
  } else {
    // Ensure the patient has a book
    const existingBook = await prisma.patientBook.findUnique({
      where: { patientId: existingPatient.id }, // patientId is unique in schema
    });
    if (!existingBook) {
      await prisma.patientBook.create({
        data: {
          patientId: existingPatient.id,
          bookNumber: `BOOK-${Date.now()}`,
        },
      });
    }
    patient = existingPatient;
  }

  console.log("Seed completed:", {
    branch: branch.name,
    admin: "admin@mdent.local",
    patient: patient.name,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
