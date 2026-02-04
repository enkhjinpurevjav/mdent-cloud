import express from "express";
import prisma from "../db.js";


const router = express.Router();

/**
 * PUT /api/encounter-service-texts/:id
 * Update a service text row
 */
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid service text id" });
    }

    const { text, order } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Text is required" });
    }

    const serviceText = await prisma.encounterServiceText.update({
      where: { id },
      data: {
        text: text.trim(),
        order: order ?? undefined,
      },
    });

    res.json(serviceText);
  } catch (err) {
    console.error("Error updating service text:", err);
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Service text not found" });
    }
    res.status(500).json({ error: "Failed to update service text" });
  }
});

/**
 * DELETE /api/encounter-service-texts/:id
 * Delete a service text row
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid service text id" });
    }

    await prisma.encounterServiceText.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (err) {
    console.error("Error deleting service text:", err);
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Service text not found" });
    }
    res.status(500).json({ error: "Failed to delete service text" });
  }
});

export default router;
