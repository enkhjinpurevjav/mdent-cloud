import express from "express";
import prisma from "../db.js";

const router = express.Router();

// GET /api/patients
router.get("/", async (_req, res) => {
  try {
    const patients = await prisma.patient.findMany({
      include: { patientBook: true },
      orderBy: { id: "desc" },
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

    if (!name || !regNo || !phone || !branchId || !bookNumber) {
      return res.status(400).json({ error: "missing required fields" });
    }

    const patient = await prisma.patient.create({
      data: {
        ovog: (ovog ?? "").trim() || null,
        name: String(name).trim(),
        regNo: String(regNo).trim(),
        phone: String(phone).trim(),
        branchId: Number(branchId),
        patientBook: {
          create: { bookNumber: String(bookNumber).trim() },
        },
      },
      include: { patientBook: true },
    });

    res.status(201).json(patient);
  } catch (err) {
    res.status(500).json({ error: "failed to create patient" });
  }
});

export default router;
