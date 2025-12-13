import express from "express";
import prisma from "../db.js";

const router = express.Router();

// Helper: get next available numeric bookNumber as string
async function generateNextBookNumber() {
  const last = await prisma.patientBook.findFirst({
    where: {
      bookNumber: { not: "" },
    },
    orderBy: {
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
    const {
      ovog,
      name,
      regNo,
      phone,
      branchId,
      bookNumber,
      gender,
      citizenship,
      emergencyPhone,
    } = req.body || {};

    // Minimal required fields: name, phone, branchId
    if (!name || !phone || !branchId) {
      return res.status(400).json({
        error: "name, phone, branchId are required",
      });
    }

    // Optional regNo: only enforce unique if provided
    let finalRegNo = regNo ? String(regNo).trim() : null;
    if (finalRegNo) {
      const existingByRegNo = await prisma.patient.findUnique({
        where: { regNo: finalRegNo },
      });
      if (existingByRegNo) {
        return res
          .status(400)
          .json({ error: "This regNo is already registered" });
      }
    }

    // Gender is optional, but if present must be "эр" or "эм"
    let finalGender = null;
    if (typeof gender === "string" && gender.trim() !== "") {
      const g = gender.trim();
      if (g !== "эр" && g !== "эм") {
        return res
          .status(400)
          .json({ error: "gender must be 'эр' or 'эм' if provided" });
      }
      finalGender = g;
    }

    // Handle bookNumber (optional, auto-generate if blank)
    let finalBookNumber = bookNumber ? String(bookNumber).trim() : "";

    if (finalBookNumber) {
      // Manual: must be 1–6 digits
      if (!/^\d{1,6}$/.test(finalBookNumber)) {
        return res.status(400).json({
          error: "Картын дугаар нь 1-6 оронтой зөвхөн тоо байх ёстой",
        });
      }

      const existingBook = await prisma.patientBook.findUnique({
        where: { bookNumber: finalBookNumber },
      });
      if (existingBook) {
        return res.status(400).json({
          error: "Энэ картын дугаар аль хэдийн бүртгэгдсэн байна",
        });
      }
    } else {
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
        ovog: ovog ? String(ovog).trim() : null,
        name: String(name).trim(),
        regNo: finalRegNo, // may be null
        phone: String(phone).trim(),
        branchId: Number(branchId),

        // New optional fields
        gender: finalGender,
        citizenship: citizenship
          ? String(citizenship).trim()
          : undefined, // let Prisma default("Mongolian") apply when undefined
        emergencyPhone: emergencyPhone
          ? String(emergencyPhone).trim()
          : null,

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

    if (err.code === "P2002") {
      if (err.meta && err.meta.target && Array.isArray(err.meta.target)) {
        if (err.meta.target.includes("regNo")) {
          return res
            .status(400)
            .json({ error: "This regNo is already registered" });
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

// PATCH /api/patients/:id
router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid patient id" });
    }

    const {
      ovog,
      name,
      regNo,
      phone,
      gender,
      birthDate,
      address,
      bloodType,
      citizenship,
      emergencyPhone,
      notes,
    } = req.body || {};

    const data = {};

    if (ovog !== undefined) {
      data.ovog = ovog === "" ? null : String(ovog).trim();
    }
    if (name !== undefined) {
      data.name = String(name).trim();
    }
    if (regNo !== undefined) {
      data.regNo = regNo === "" ? null : String(regNo).trim();
    }
    if (phone !== undefined) {
      data.phone = phone === "" ? null : String(phone).trim();
    }

    // gender: optional, must be "эр" or "эм" if provided
    if (gender !== undefined) {
      if (!gender) {
        data.gender = null;
      } else if (gender === "эр" || gender === "эм") {
        data.gender = gender;
      } else {
        return res.status(400).json({
          error: "gender must be 'эр' or 'эм' if provided",
        });
      }
    }

    // birthDate comes as "YYYY-MM-DD" or null/empty
    if (birthDate !== undefined) {
      if (!birthDate) {
        data.birthDate = null;
      } else {
        const d = new Date(birthDate);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({
            error: "Invalid birthDate format (expected YYYY-MM-DD)",
          });
        }
        data.birthDate = d;
      }
    }

    if (address !== undefined) {
      data.address = address === "" ? null : String(address).trim();
    }
    if (bloodType !== undefined) {
      data.bloodType = bloodType === "" ? null : String(bloodType).trim();
    }
    if (citizenship !== undefined) {
      data.citizenship =
        citizenship === "" ? null : String(citizenship).trim();
    }
    if (emergencyPhone !== undefined) {
      data.emergencyPhone =
        emergencyPhone === "" ? null : String(emergencyPhone).trim();
    }
    if (notes !== undefined) {
      data.notes = notes === "" ? null : String(notes).trim();
    }

    const updated = await prisma.patient.update({
      where: { id },
      data,
    });

    return res.json({ patient: updated });
  } catch (err) {
    console.error("Error updating patient:", err);
    if (err.code === "P2025") {
      // Prisma "record not found"
      return res.status(404).json({ error: "Patient not found" });
    }
    // Handle unique regNo violation if you keep regNo unique
    if (err.code === "P2002" && err.meta?.target?.includes("regNo")) {
      return res
        .status(400)
        .json({ error: "This regNo is already registered" });
    }
    return res.status(500).json({ error: "failed to update patient" });
  }
});

// GET /api/patients/profile/by-book/:bookNumber
router.get("/profile/by-book/:bookNumber", async (req, res) => {
  try {
    const { bookNumber } = req.params;

    if (!bookNumber) {
      return res.status(400).json({ error: "bookNumber is required" });
    }

    const pb = await prisma.patientBook.findUnique({
      where: { bookNumber },
      include: {
        patient: {
          include: {
            branch: true,
          },
        },
      },
    });

    if (!pb || !pb.patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const patient = pb.patient;

    // Load encounters for this patientBook
    const encounters = await prisma.encounter.findMany({
      where: { patientBookId: pb.id },
      orderBy: { visitDate: "desc" },
      include: {
        doctor: true,
        invoice: {
          include: {
            payment: true,
            eBarimtReceipt: true,
            invoiceItems: {
              include: { procedure: true },
            },
          },
        },
        chartTeeth: {
          include: {
            chartNotes: true,
          },
        },
        media: true,
      },
    });

    // Optional: aggregate invoices/payment history
    const invoices = encounters
      .map((e) => e.invoice)
      .filter((inv) => !!inv);

    const media = encounters.flatMap((e) => e.media || []);

    // Load all appointments for this patient (across branches)
    const appointments = await prisma.appointment.findMany({
      where: { patientId: patient.id },
      orderBy: { scheduledAt: "desc" },
    });

    res.json({
      patient,
      patientBook: { id: pb.id, bookNumber: pb.bookNumber },
      encounters,
      invoices,
      media,
      appointments,
    });
  } catch (err) {
    console.error("GET /api/patients/profile/by-book/:bookNumber error:", err);
    res.status(500).json({ error: "failed to load patient profile" });
  }
});

export default router;
