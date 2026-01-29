import { Router } from "express";
import prisma from "../db.js";

const router = Router();

// GET /api/diagnoses?query=...
router.get("/", async (req, res) => {
  try {
    const rawQuery = req.query.query;
    const q =
      typeof rawQuery === "string" ? rawQuery.trim() : "";

    const where =
      q.length > 0
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {};

   const list = await prisma.diagnosis.findMany({
  where,
  include: {
    problems: {
      where: { active: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      select: { id: true, label: true, order: true, active: true, diagnosisId: true },
    },
  },
  orderBy: { code: "asc" },
});

    res.json(list);
  } catch (e) {
    console.error("GET /api/diagnoses failed", e);
    res
      .status(500)
      .json({ error: "Оношийг ачаалахад алдаа гарлаа." });
  }
});

// POST /api/diagnoses
router.post("/", async (req, res) => {
  try {
    const { code, name, description } = req.body || {};
    const codeStr = code ? String(code).trim() : "";
    const nameStr = name ? String(name).trim() : "";
    const descStr =
      typeof description === "string"
        ? description.trim()
        : description == null
        ? null
        : String(description).trim();

    if (!codeStr || !nameStr) {
      return res
        .status(400)
        .json({ error: "Код болон нэр заавал." });
    }

    const dx = await prisma.diagnosis.create({
      data: {
        code: codeStr,
        name: nameStr,
        description: descStr || null,
      },
    });

    res.status(201).json(dx);
  } catch (e) {
    console.error("POST /api/diagnoses failed", e);
    if (e.code === "P2002") {
      return res.status(409).json({
        error: "Ижил кодтой онош аль хэдийн бүртгэгдсэн байна.",
      });
    }
    res
      .status(500)
      .json({ error: "Онош нэмэхэд алдаа гарлаа." });
  }
});

// PATCH /api/diagnoses/:id
router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: "ID буруу." });
    }

    const { code, name, description } = req.body || {};
    const data = {};

    if (code !== undefined) {
      data.code = code ? String(code).trim() : null;
    }
    if (name !== undefined) {
      data.name = name ? String(name).trim() : null;
    }
    if (description !== undefined) {
      data.description = description
        ? String(description).trim()
        : null;
    }

    const dx = await prisma.diagnosis.update({
      where: { id },
      data,
    });

    res.json(dx);
  } catch (e) {
    console.error("PATCH /api/diagnoses/:id failed", e);
    if (e.code === "P2002") {
      return res.status(409).json({
        error: "Ижил кодтой онош аль хэдийн бүртгэгдсэн байна.",
      });
    }
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Онош олдсонгүй." });
    }
    res
      .status(500)
      .json({ error: "Онош засахад алдаа гарлаа." });
  }
});

// DELETE /api/diagnoses/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: "ID буруу." });
    }

    await prisma.diagnosis.delete({ where: { id } });
    res.status(204).end();
  } catch (e) {
    console.error("DELETE /api/diagnoses/:id failed", e);
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Онош олдсонгүй." });
    }
    res
      .status(500)
      .json({ error: "Онош устгахад алдаа гарлаа." });
  }
});

export default router;
