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

  // Seed one user for each role (admin, doctor, receptionist, accountant, nurse, manager)
  const roles = [
    { email: "admin@mdent.local", role: "admin", password: adminPassword },           // admin password from ENV
    { email: "doctor@mdent.local", role: "doctor", password: "doctor123" },
    { email: "receptionist@mdent.local", role: "receptionist", password: "reception123" },
    { email: "accountant@mdent.local", role: "accountant", password: "accountant123" },
    { email: "nurse@mdent.local", role: "nurse", password: "nurse123" },
    { email: "manager@mdent.local", role: "manager", password: "manager123" },
  ];

  for (const user of roles) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await prisma.user.upsert({
      where: { email: user.email },
      update: { password: passwordHash, role: user.role, branchId: branch.id },
      create: {
        email: user.email,
        password: passwordHash,
        role: user.role,
        name: user.role.charAt(0).toUpperCase() + user.role.slice(1),
        branchId: branch.id,
      },
    });
  }

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
      where: { patientId: existingPatient.id },
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
    users: roles.map(u => u.email),
    patient: patient.name,
  });

  // Seed: PREVIOUS marker service for split payment workflow
  // This service is attached by doctors to indicate "previous balance continuation".
  // It is excluded from doctor income and clinic revenue calculations.
  await prisma.service.upsert({
    where: { code: "PREVIOUS_MARKER" },
    update: {},
    create: {
      code: "PREVIOUS_MARKER",
      category: "PREVIOUS",
      name: "Бусад",
      price: 0,
      isActive: true,
      description: "Өмнөх үлдэгдлийн тэмдэглэгч үйлчилгээ (хувааж төлөх горимыг идэвхжүүлнэ)",
    },
  });

  // Seed: ServiceCategoryConfig defaults (durationMinutes=30) for all categories
  const serviceCategories = [
    "ORTHODONTIC_TREATMENT",
    "IMAGING",
    "DEFECT_CORRECTION",
    "ADULT_TREATMENT",
    "WHITENING",
    "CHILD_TREATMENT",
    "SURGERY",
    "PREVIOUS",
  ];
  for (const category of serviceCategories) {
    await prisma.serviceCategoryConfig.upsert({
      where: { category },
      update: {},
      create: { category, durationMinutes: 30, isActive: true },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// ...
patient = await prisma.patient.create({
  data: {
    regNo: "0000000000",
    name: seedPatientName,
    phone: "70000000",
    branchId: branch.id,
    patientBook: { create: { bookNumber: `BOOK-${Date.now()}` } },
  },
});
// ...
