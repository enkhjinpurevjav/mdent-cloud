import express from "express";
import prisma from "../db.js";
import { authenticateJWT } from "../middleware/auth.js";

const router = express.Router();

/**
 * POST /api/encounter-services/:id/texts
 * Create a service text row
 */
router.post("/:id/texts", authenticateJWT, async (req, res) => {
  try {
    const encounterServiceId = Number(req.params.id);
    if (!encounterServiceId || Number.isNaN(encounterServiceId)) {
      return res.status(400).json({ error: "Invalid encounter service id" });
    }

    // Verify service exists
    const service = await prisma.encounterService.findUnique({
      where: { id: encounterServiceId },
    });
    if (!service) {
      return res.status(404).json({ error: "Encounter service not found" });
    }

    const { text, order } = req.body;

    const serviceText = await prisma.encounterServiceText.create({
      data: {
        encounterServiceId,
        text: (text || "").trim(),
        order: order ?? 0,
      },
    });

    res.status(201).json(serviceText);
  } catch (err) {
    console.error("Error creating service text:", err);
    res.status(500).json({ error: "Failed to create service text" });
  }
});

/**
 * PUT /api/encounter-services/:id/texts/sync
 * Sync service texts - batch update to match provided list
 */
router.put("/:id/texts/sync", authenticateJWT, async (req, res) => {
  try {
    const encounterServiceId = Number(req.params.id);
    if (!encounterServiceId || Number.isNaN(encounterServiceId)) {
      return res.status(400).json({ error: "Invalid encounter service id" });
    }

    // Verify service exists
    const service = await prisma.encounterService.findUnique({
      where: { id: encounterServiceId },
    });
    if (!service) {
      return res.status(404).json({ error: "Encounter service not found" });
    }

    const { texts } = req.body;
    if (!Array.isArray(texts)) {
      return res.status(400).json({ error: "texts must be an array" });
    }

    // Trim texts and filter out empty ones
    const nonEmptyTexts = texts
      .map(t => (typeof t === 'string' ? t.trim() : ''))
      .filter(t => t.length > 0);

    // Delete all existing texts first
    await prisma.encounterServiceText.deleteMany({
      where: { encounterServiceId },
    });

    // Create new texts with proper order
    const createdTexts = await Promise.all(
      nonEmptyTexts.map((text, index) =>
        prisma.encounterServiceText.create({
          data: {
            encounterServiceId,
            text,
            order: index,
          },
        })
      )
    );

    res.json(createdTexts);
  } catch (err) {
    console.error("Error syncing service texts:", err);
    res.status(500).json({ error: "Failed to sync service texts" });
  }
});

export default router;
