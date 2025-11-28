import express from "express";
import prisma from "../db.js";

const router = express.Router();

// Helper for Cyrillic regNo format: /^[\u0400-\u04FF]{2}\d{8}$/
function isValidRegNo(regNo) {
  return /^[\u0400-\u04FF]{2}\d{8}$/.test(regNo);
}

// POST /api/patients
router.post("/", async (req, res) => {
  // your registration logic...
});

// GET /api/patients - list all patients
router.get("/", async (req, res) => {
  try {
    const patients = await prisma.patient.findMany({
      include: { patientBook: true }
    });
    res.json(patients);
  } catch (err) {
    console.error("GET /api/patients error:", err);
    res.status(500).json({ error: "failed to fetch patients" });
  }
});

export default router;
