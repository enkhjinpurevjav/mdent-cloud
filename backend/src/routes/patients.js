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
    console.error("Error fetching patients:", err);
    res.status(500).json({ error: "failed to fetch patients" });
  }
});

// POST /api/patients
router.post("/", async (req, res) => {
  try {
    const { ovog, name, regNo, phone, branchId, bookNumber } = req.body;

    // Basic validation
    if (!ovog || !name || !regNo || !phone || !branchId || !bookNumber) {
      return res.status(400).json({ error: "Missing required fields" });
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
            bookNumber,
          },
        },
      },
      include: { patientBook: true },
    });

    res.status(201).json(patient);
  } catch (err) {
    console.error("Error creating patient:", err);
    res.status(500).json({ error: "failed to create patient" });
  }
});

// IMPORTANT: use CommonJS export if rest of backend does
export default router;
