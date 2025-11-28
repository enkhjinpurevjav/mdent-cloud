import express from "express";
import prisma from "../db.js";
const router = express.Router();

// GET /api/patients - returns all patients
router.get("/", async (req, res) => {
  try {
    const patients = await prisma.patient.findMany({
      include: { patientBook: true }
    });
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: "failed to fetch patients" });
  }
});

// POST /api/patients - create new patient
router.post("/", async (req, res) => {
  // ... validation & creation logic
});

export default router;
