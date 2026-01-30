import { Router } from "express";
import prisma from "../db.js";

const router = Router();

// GET /api/diagnoses/:id/problems
router.get("/diagnoses/:id/problems", async (req, res) => {
  try {
    const diagnosisId = Number(req.params.id);
    if (!diagnosisId || Number.isNaN(diagnosisId)) {
      return res.status(400).json({ error: "Diagnosis ID буруу." });
    }

    const problems = await prisma.diagnosisProblem.findMany({
      where: { diagnosisId, active: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });

    res.json(problems);
  } catch (e) {
    console.error("GET /api/diagnoses/:id/problems failed", e);
    res.status(500).json({
      error: "Оношийн проблемуудыг ачаалахад алдаа гарлаа.",
    });
  }
});

// POST /api/diagnoses/:id/problems
router.post("/diagnoses/:id/problems", async (req, res) => {
  try {
    const diagnosisId = Number(req.params.id);
    if (!diagnosisId || Number.isNaN(diagnosisId)) {
      return res.status(400).json({ error: "Diagnosis ID буруу." });
    }
    const { label, order } = req.body || {};
    const labelStr = label ? String(label).trim() : "";

    if (!labelStr) {
      return res
        .status(400)
        .json({ error: "Проблемын нэр заавал." });
    }

    const problem = await prisma.diagnosisProblem.create({
      data: {
        diagnosisId,
        label: labelStr,
        order:
          typeof order === "number" && !Number.isNaN(order)
            ? order
            : 0,
      },
    });

    res.status(201).json(problem);
  } catch (e) {
    console.error("POST /api/diagnoses/:id/problems failed", e);
    res
      .status(500)
      .json({ error: "Проблем нэмэхэд алдаа гарлаа." });
  }
});

// PATCH /api/diagnosis-problems/:id
router.patch("/diagnosis-problems/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: "ID буруу." });
    }

    const { label, order, active } = req.body || {};
    const data = {};

    if (label !== undefined) {
      data.label = label ? String(label).trim() : null;
    }
    if (order !== undefined) {
      data.order = Number(order) || 0;
    }
    if (active !== undefined) {
      data.active = !!active;
    }

    const updated = await prisma.diagnosisProblem.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (e) {
    console.error("PATCH /api/diagnosis-problems/:id failed", e);
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Проблем олдсонгүй." });
    }
    res
      .status(500)
      .json({ error: "Проблем засахад алдаа гарлаа." });
  }
});

// DELETE /api/diagnosis-problems/:id
router.delete("/diagnosis-problems/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: "ID буруу." });
    }

    await prisma.diagnosisProblem.delete({ where: { id } });
    res.status(204).end();
  } catch (e) {
    console.error("DELETE /api/diagnosis-problems/:id failed", e);
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Проблем олдсонгүй." });
    }
    res
      .status(500)
      .json({ error: "Проблем устгахад алдаа гарлаа." });
  }
});

export default router;
