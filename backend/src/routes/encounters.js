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
// PUT /api/encounters/:id/services
// Body: { items: { serviceId: number; quantity?: number; toothCode?: string | null }[] }
router.put("/:id/services", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }

    const { items } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items must be an array" });
    }

    await prisma.$transaction(async (trx) => {
      // Remove old services for this encounter
      await trx.encounterService.deleteMany({
        where: { encounterId },
      });

      // Insert new ones
      for (const item of items) {
        if (!item.serviceId) continue;
        await trx.encounterService.create({
          data: {
            encounterId,
            serviceId: item.serviceId,
            quantity: item.quantity ?? 1,
            toothCode: item.toothCode ?? null,
          },
        });
      }
    });

    const updated = await prisma.encounterService.findMany({
      where: { encounterId },
      include: { service: true },
      orderBy: { id: "asc" },
    });

    return res.json(updated);
  } catch (err) {
    console.error("PUT /api/encounters/:id/services error:", err);
    return res.status(500).json({ error: "Failed to save services" });
  }
});
export default router;
