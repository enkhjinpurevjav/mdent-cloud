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
        diagnoses: {
          include: { diagnosis: true },
          orderBy: { createdAt: "asc" },
        },
        encounterServices: {
          include: {
            service: true,
          },
          orderBy: { id: "asc" },
        },
        // chartTeeth can be loaded separately via chart-teeth endpoints
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

/**
 * PUT /api/encounters/:id/diagnoses
 * Replaces all EncounterDiagnosis rows for this encounter.
 * Body: { items: { diagnosisId, selectedProblemIds, note }[] }
 */
router.put("/:id/diagnoses", async (req, res) => {
  const encounterId = Number(req.params.id);
  if (!encounterId || Number.isNaN(encounterId)) {
    return res.status(400).json({ error: "Invalid encounter id" });
  }

  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "items must be an array" });
  }

  try {
    await prisma.$transaction(async (trx) => {
      // delete all existing diagnoses for this encounter
      await trx.encounterDiagnosis.deleteMany({
        where: { encounterId },
      });

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
 * Body: { items: { serviceId, quantity? }[] }
 */
router.put("/:id/services", async (req, res) => {
  const encounterId = Number(req.params.id);
  if (!encounterId || Number.isNaN(encounterId)) {
    return res.status(400).json({ error: "Invalid encounter id" });
  }

  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "items must be an array" });
  }

  try {
    await prisma.$transaction(async (trx) => {
      // delete existing services for this encounter
      await trx.encounterService.deleteMany({
        where: { encounterId },
      });

      for (const item of items) {
        if (!item.serviceId) continue;

        // look up current service price
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
            price: svc.price,
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

/**
 * GET /api/encounters/:id/chart-teeth
 * Returns all ChartTooth rows for this encounter (with ChartNote).
 */
router.get("/:id/chart-teeth", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }

    const chartTeeth = await prisma.chartTooth.findMany({
      where: { encounterId },
      orderBy: { id: "asc" },
      include: {
        chartNotes: true,
      },
    });

    return res.json(chartTeeth);
  } catch (err) {
    console.error("GET /api/encounters/:id/chart-teeth error:", err);
    return res.status(500).json({ error: "Failed to load tooth chart" });
  }
});

/**
 * PUT /api/encounters/:id/chart-teeth
 * Replaces all ChartTooth rows for this encounter.
 * Body: { teeth: { toothCode: string; status?: string; notes?: string }[] }
 */
router.put("/:id/chart-teeth", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }

    const { teeth } = req.body || {};
    if (!Array.isArray(teeth)) {
      return res.status(400).json({ error: "teeth must be an array" });
    }

    await prisma.$transaction(async (trx) => {
      await trx.chartTooth.deleteMany({ where: { encounterId } });

      for (const t of teeth) {
        if (!t || typeof t.toothCode !== "string" || !t.toothCode.trim()) {
          continue;
        }
        await trx.chartTooth.create({
          data: {
            encounterId,
            toothCode: t.toothCode.trim(),
            status: t.status || null,
            notes: t.notes || null,
          },
        });
      }
    });

    const updated = await prisma.chartTooth.findMany({
      where: { encounterId },
      orderBy: { id: "asc" },
      include: { chartNotes: true },
    });

    return res.json(updated);
  } catch (err) {
    console.error("PUT /api/encounters/:id/chart-teeth error:", err);
    return res.status(500).json({ error: "Failed to save tooth chart" });
  }
});

export default router;
