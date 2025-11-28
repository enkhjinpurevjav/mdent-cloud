import express from "express";
import prisma from "../db.js";

const router = express.Router();

// GET /api/encounters - list encounters
router.get("/", async (req, res) => {
  try {
    const encounters = await prisma.encounter.findMany({
      orderBy: { id: "asc" },
      include: { patientBook: true, doctor: true },
    });
    res.json(encounters);
  } catch (err) {
    console.error("GET /api/encounters error:", err);
    res.status(500).json({ error: "Failed to fetch encounters" });
  }
});

// Add any needed POST/PUT/DELETE endpoints here later

export default router;
