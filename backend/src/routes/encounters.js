import express from "express";
import prisma from "../db.js";

const router = express.Router();

// GET /api/encounters/:id (detailed view for admin)
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
        // Use the actual relation field name from schema.prisma
        diagnoses: {
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

    // Rename diagnoses -> encounterDiagnoses to match frontend type
    const result = {
      ...encounter,
      encounterDiagnoses: encounter.diagnoses,
    };

    return res.json(result);
  } catch (err) {
    console.error("GET /api/encounters/:id error:", err);
    return res.status(500).json({ error: "Failed to load encounter" });
  }
});

export default router;
