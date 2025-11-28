import express from "express";
import prisma from "../db.js";

const router = express.Router();

// GET /api/encounters - list all encounters
router.get("/", async (req, res) => {
  try {
    const encounters = await prisma.encounter.findMany({
      orderBy: { id: "asc" },
      include: { patientBook: true, doctor: true }
    });
    res.json(encounters);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch encounters" });
  }
});

// POST /api/encounters - add new encounter
router.post("/", async (req, res) => {
  const { patientBookId, doctorId, visitDate, notes } = req.body;
  if (!patientBookId || !doctorId || !visitDate) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const encounter = await prisma.encounter.create({
      data: { patientBookId, doctorId, visitDate, notes }
    });
    res.status(201).json(encounter);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create encounter" });
  }
});

export default router;
