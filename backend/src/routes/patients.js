import express from "express";
import prisma from "../db.js";

const router = express.Router();

// GET /api/patients
router.get("/", async (_req, res) => {
  try {
    const patients = await prisma.patient.findMany({
      include: { patientBook: true },
    });
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: "failed to fetch patients" });
  }
});

// POST /api/patients
router.post("/", async (req, res) => {
  try {
    const { ovog, name, regNo, phone, branchId, bookNumber } = req.body;

    // Basic validation
    if (!name || !regNo || !phone || !branchId || !bookNumber) {
      return res.status(400).json({ error: "missing required fields" });
    }

    const patient = await prisma.patient.create({
      data: {
        ovog: (ovog ?? "").trim() || null,
        name: name.trim(),
        regNo: regNo.trim(),
        phone: phone.trim(),
        branchId: Number(branchId), // ensure number
        patientBook: {
          create: { bookNumber: bookNumber.trim() },
        },
      },
      include: { patientBook: true },
    });

    return res.status(201).json(patient);
  } catch (err) {
    // Unique constraint or other DB errors can land here
    console.error("POST /api/patients error:", err);
    return res.status(500).json({ error: "failed to create patient" });
  }
});

export default router;
