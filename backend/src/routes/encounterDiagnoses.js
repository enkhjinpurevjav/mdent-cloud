import express from "express";
import prisma from "../db.js";
import { authenticateJWT } from "../middleware/auth.js";

const router = express.Router();

/**
 * POST /api/encounter-diagnoses/:id/problem-texts
 * Create a problem text row
 */
router.post("/:id/problem-texts", authenticateJWT, async (req, res) => {
  try {
    const encounterDiagnosisId = Number(req.params.id);
    if (!encounterDiagnosisId || Number.isNaN(encounterDiagnosisId)) {
      return res.status(400).json({ error: "Invalid encounter diagnosis id" });
    }

    // Verify diagnosis exists
    const diagnosis = await prisma.encounterDiagnosis.findUnique({
      where: { id: encounterDiagnosisId },
    });
    if (!diagnosis) {
      return res.status(404).json({ error: "Encounter diagnosis not found" });
    }

    const { text, order } = req.body;

    const problemText = await prisma.encounterDiagnosisProblemText.create({
      data: {
        encounterDiagnosisId,
        text: (text || "").trim(),
        order: order ?? 0,
      },
    });

    res.status(201).json(problemText);
  } catch (err) {
    console.error("Error creating problem text:", err);
    res.status(500).json({ error: "Failed to create problem text" });
  }
});

/**
 * PUT /api/encounter-diagnoses/:id/problem-texts/sync
 * Sync problem texts - batch update to match provided list
 */
router.put("/:id/problem-texts/sync", authenticateJWT, async (req, res) => {
  try {
    const encounterDiagnosisId = Number(req.params.id);
    if (!encounterDiagnosisId || Number.isNaN(encounterDiagnosisId)) {
      return res.status(400).json({ error: "Invalid encounter diagnosis id" });
    }

    // Verify diagnosis exists
    const diagnosis = await prisma.encounterDiagnosis.findUnique({
      where: { id: encounterDiagnosisId },
    });
    if (!diagnosis) {
      return res.status(404).json({ error: "Encounter diagnosis not found" });
    }

    const { texts } = req.body;
    if (!Array.isArray(texts)) {
      return res.status(400).json({ error: "texts must be an array" });
    }

    // Trim texts and filter out empty ones
    const nonEmptyTexts = texts
      .map(t => (typeof t === 'string' ? t.trim() : ''))
      .filter(t => t.length > 0);

    // Delete all existing texts first (simpler than complex upsert logic)
    await prisma.encounterDiagnosisProblemText.deleteMany({
      where: { encounterDiagnosisId },
    });

    // Create new texts with proper order
    const createdTexts = await Promise.all(
      nonEmptyTexts.map((text, index) =>
        prisma.encounterDiagnosisProblemText.create({
          data: {
            encounterDiagnosisId,
            text,
            order: index,
          },
        })
      )
    );

    res.json(createdTexts);
  } catch (err) {
    console.error("Error syncing problem texts:", err);
    res.status(500).json({ error: "Failed to sync problem texts" });
  }
});

export default router;
