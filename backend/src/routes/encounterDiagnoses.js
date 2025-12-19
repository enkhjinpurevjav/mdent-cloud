import { Router } from "express";
import prisma from "../db.js";

const router = Router();

// GET /api/encounters/:id/diagnoses
router.get("/encounters/:id/diagnoses", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Encounter ID буруу." });
    }

    const rows = await prisma.encounterDiagnosis.findMany({
      where: { encounterId },
      include: { diagnosis: true },
      orderBy: { createdAt: "asc" },
    });

    res.json(rows);
  } catch (e) {
    console.error("GET /api/encounters/:id/diagnoses failed", e);
    res.status(500).json({ error: "Онош ачаалахад алдаа гарлаа." });
  }
});

// PUT /api/encounters/:id/diagnoses
router.put("/encounters/:id/diagnoses", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Encounter ID буруу." });
    }

    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];

    // Example item: { diagnosisId: number, selectedProblemIds: number[], note?: string }
    const cleaned = items
      .filter((it) => it && typeof it.diagnosisId === "number")
      .map((it) => {
        const diagnosisId = Number(it.diagnosisId);
        const selectedProblemIds = Array.isArray(it.selectedProblemIds)
          ? it.selectedProblemIds
              .map((id) => Number(id))
              .filter((n) => !Number.isNaN(n))
          : [];
        const note =
          typeof it.note === "string" && it.note.trim()
            ? it.note.trim()
            : null;

        return { diagnosisId, selectedProblemIds, note };
      });

    await prisma.$transaction([
      prisma.encounterDiagnosis.deleteMany({ where: { encounterId } }),
      ...cleaned.map((it) =>
        prisma.encounterDiagnosis.create({
          data: {
            encounterId,
            diagnosisId: it.diagnosisId,
            selectedProblemIds: it.selectedProblemIds,
            note: it.note,
          },
        })
      ),
    ]);

    const updated = await prisma.encounterDiagnosis.findMany({
      where: { encounterId },
      include: { diagnosis: true },
    });

    res.json(updated);
  } catch (e) {
    console.error("PUT /api/encounters/:id/diagnoses failed", e);
    res.status(500).json({ error: "Онош хадгалахад алдаа гарлаа." });
  }
});

export default router;
