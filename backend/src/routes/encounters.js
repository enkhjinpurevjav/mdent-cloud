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
          include: { branch: true },
        },
      },
    },
    doctor: true,
    diagnoses: {
      include: { diagnosis: true },
      orderBy: { createdAt: "asc" },
    },
    encounterServices: {
      include: {
        service: true, // this is your central Service model
      },
      orderBy: { id: "asc" },
    },
    // chartTeeth: true, // later for tooth chart
  },
});

if (!encounter) {
  return res.status(404).json({ error: "Encounter not found" });
}

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
