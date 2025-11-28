import express from "express";
import prisma from "../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  // This runs when GET /api/patients is called
  try {
    const patients = await prisma.patient.findMany({
      include: { patientBook: true }
    });
    res.json(patients); // Send all patients as JSON
  } catch (err) {
    res.status(500).json({ error: "failed to fetch patients" });
  }
});

export default router;
