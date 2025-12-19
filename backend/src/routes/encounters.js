import express from "express";
import prisma from "../db.js";

const router = express.Router();

/**
 * GET /api/encounters/:id
 * Detailed encounter view for admin page.
 */
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
        // Relation field on Encounter in schema.prisma
        diagnoses: {
          include: { diagnosis: true },
          orderBy: { createdAt: "asc" },
        },
        // Relation field on Encounter in schema.prisma
        encounterServices: {
          include: {
            service: true,
          },
          orderBy: { id: "asc" },
        },
        // chartTeeth: true, // for future tooth chart
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

/**
 * PUT /api/encounters/:id/diagnoses
 * Replaces all EncounterDiagnosis rows for this encounter.
 * Body: { items: { diagnosisId, selectedProblemIds, note }[] }
 */
router.put("/:id/diagnoses", async (req, res) => {
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
      // 1) Remove all existing diagnoses for this encounter
      await trx.encounterDiagnosis.deleteMany({
        where: { encounterId },
      });

      // 2) Recreate from payload
      for (const item of items) {
        if (!item.diagnosisId) continue;

        await trx.encounterDiagnosis.create({
          data: {
            encounterId,
            diagnosisId: item.diagnosisId,
            selectedProblemIds: item.selectedProblemIds ?? [],
            note: item.note ?? null,
          },
        });
      }
    });

    const updated = await prisma.encounterDiagnosis.findMany({
      where: { encounterId },
      include: { diagnosis: true },
      orderBy: { id: "asc" },
    });

    return res.json(updated);
  } catch (err) {
    console.error("PUT /api/encounters/:id/diagnoses failed", err);
    return res.status(500).json({ error: "Failed to save diagnoses" });
  }
});

/**
 * PUT /api/encounters/:id/services
 * Replaces all EncounterService rows for this encounter.
 * Body: { items: { serviceId, quantity?, toothCode? }[] }
 * NOTE: toothCode is currently ignored because EncounterService has no such field.
 */
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
      // Delete all existing services for this encounter
      await trx.encounterService.deleteMany({
        where: { encounterId },
      });

      for (const item of items) {
        if (!item.serviceId) continue;

        // Look up current service price
        const svc = await trx.service.findUnique({
          where: { id: item.serviceId },
          select: { price: true },
        });
        if (!svc) continue;

        await trx.encounterService.create({
          data: {
            encounterId,
            serviceId: item.serviceId,
            quantity: item.quantity ?? 1,
            price: svc.price, // REQUIRED field on EncounterService
            // toothCode is not stored yet; add to schema later if needed
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
