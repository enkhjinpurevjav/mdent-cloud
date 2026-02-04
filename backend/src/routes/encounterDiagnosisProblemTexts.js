import express from "express";
import prisma from "../db.js";


const router = express.Router();

/**
 * PUT /api/encounter-diagnosis-problem-texts/:id
 * Update a problem text row
 */
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid problem text id" });
    }

    const { text, order } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Text is required" });
    }

    const problemText = await prisma.encounterDiagnosisProblemText.update({
      where: { id },
      data: {
        text: text.trim(),
        order: order ?? undefined,
      },
    });

    res.json(problemText);
  } catch (err) {
    console.error("Error updating problem text:", err);
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Problem text not found" });
    }
    res.status(500).json({ error: "Failed to update problem text" });
  }
});

/**
 * DELETE /api/encounter-diagnosis-problem-texts/:id
 * Delete a problem text row
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid problem text id" });
    }

    await prisma.encounterDiagnosisProblemText.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (err) {
    console.error("Error deleting problem text:", err);
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Problem text not found" });
    }
    res.status(500).json({ error: "Failed to delete problem text" });
  }
});

export default router;
