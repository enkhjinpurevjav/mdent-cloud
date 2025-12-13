import express from "express";
import prisma from "../db.js";

const router = express.Router();

// Helper: get next available numeric bookNumber as string
async function generateNextBookNumber() {
  // Find the PatientBook with the largest numeric bookNumber
  const last = await prisma.patientBook.findFirst({
    where: {
      // only consider all-digit bookNumbers
      bookNumber: { not: "" },
    },
    orderBy: {
      // order by cast(bookNumber as integer) is not portable via Prisma,
      // so we just sort by id desc and parse, assuming newest has highest number.
      id: "desc",
    },
  });

  let next = 1;

  if (last && last.bookNumber) {
    const match = last.bookNumber.match(/^\d+$/);
    if (match) {
      const current = parseInt(last.bookNumber, 10);
      if (!Number.isNaN(current) && current >= 1) {
        next = current + 1;
      }
    }
  }

  // Return as plain string; caller can still validate length if needed
  return String(next);
}

// GET /api/patients
router.get("/", async (_req, res) => {
  try {
    const patients = await prisma.patient.findMany({
      include: { patientBook: true },
      orderBy: { id: "desc" },
    });
    res.json(patients);
  } catch (err) {
    console.error("Error fetching patients:", err);
    res.status(500).json({ error: "failed to fetch patients" });
  }
});

// POST /api/patients
router.post("/", async (req, res) => {
  try {
    const { ovog, name, regNo, phone, branchId, bookNumber } = req.body;

    // Basic validation
    if (!ovog || !name || !regNo || !phone || !branchId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate regNo uniqueness at application level (DB will also enforce)
    const existingByRegNo = await prisma.patient.findUnique({
      where: { regNo },
    });
    if (existingByRegNo) {
      return res.status(400).json({ error: "This regNo is already registered" });
    }

    let finalBookNumber = bookNumber ? String(bookNumber).trim() : "";

    if (finalBookNumber) {
      // Manual entry: must be 1–6 digits, numeric only
      if (!/^\d{1,6}$/.test(finalBookNumber)) {
        return res.status(400).json({
          error: "Картын дугаар нь 1-6 оронтой зөвхөн тоо байх ёстой",
        });
      }

      // Check uniqueness
      const existingBook = await prisma.patientBook.findUnique({
        where: { bookNumber: finalBookNumber },
      });
      if (existingBook) {
        return res.status(400).json({
          error: "Энэ картын дугаар аль хэдийн бүртгэгдсэн байна",
        });
      }
    } else {
      // Auto-generate bookNumber if empty
      const candidate = await generateNextBookNumber();

      if (!/^\d{1,6}$/.test(candidate)) {
        return res.status(500).json({
          error:
            "Автомат картын дугаар үүсгэхэд алдаа гарлаа (тоо 6 орноос хэтэрсэн)",
        });
      }

      finalBookNumber = candidate;
    }

    const patient = await prisma.patient.create({
      data: {
        ovog,
        name,
        regNo,
        phone,
        branchId: Number(branchId),
        patientBook: {
          create: {
            bookNumber: finalBookNumber,
          },
        },
      },
      include: { patientBook: true },
    });

    res.status(201).json(patient);
  } catch (err) {
    console.error("Error creating patient:", err);

    // Handle unique constraint errors from Prisma
    if (err.code === "P2002") {
      if (err.meta && err.meta.target && Array.isArray(err.meta.target)) {
        if (err.meta.target.includes("regNo")) {
          return res.status(400).json({
            error: "This regNo is already registered",
          });
        }
        if (err.meta.target.includes("bookNumber")) {
          return res.status(400).json({
            error: "Энэ картын дугаар аль хэдийн бүртгэгдсэн байна",
          });
        }
      }
    }

    res.status(500).json({ error: "failed to create patient" });
  }
});

export default router;
