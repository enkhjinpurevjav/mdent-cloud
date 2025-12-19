import express from "express";
import prisma from "../db.js";

const router = express.Router();

// NEW: GET /api/encounters/:id (detailed view for admin)
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }

    const encounter = await prisma.encounter.findUnique({
      where: { id },
      include: {
        patientBook: {
          include: {
            patient: {
              include: {
                branch: true,
              },
            },
          },
        },
        doctor: true,
        encounterDiagnoses: {
          include: {
            diagnosis: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    res.json(encounter);
  } catch (err) {
    console.error("GET /api/encounters/:id error:", err);
    res.status(500).json({ error: "Failed to load encounter" });
  }
});

export default router;
