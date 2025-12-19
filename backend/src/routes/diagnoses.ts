import { Router } from "express";
import { prisma } from "../prisma"; // adjust path to your prisma client

const router = Router();

// GET /api/diagnoses?query=...
router.get("/", async (req, res) => {
  try {
    const q = (req.query.query as string | undefined)?.trim();
    const where = q
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
      orderBy: { code: "asc" },
    });

    res.json(list);
  } catch (e) {
    console.error("GET /api/diagnoses failed", e);
    res.status(500).json({ error: "Оношийг ачаалахад алдаа гарлаа." });
  }
});

// POST /api/diagnoses
router.post("/", async (req, res) => {
  try {
    const { code, name, description } = req.body || {};
    if (!code?.trim() || !name?.trim()) {
      return res.status(400).json({ error: "Код болон нэр заавал." });
    }

    const dx = await prisma.diagnosis.create({
      data: {
        code: code.trim(),
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    res.status(201).json(dx);
  } catch (e: any) {
    console.error("POST /api/diagnoses failed", e);
    if (e.code === "P2002") {
      return res
        .status(409)
        .json({ error: "Ижил кодтой онош аль хэдийн бүртгэгдсэн байна." });
    }
    res.status(500).json({ error: "Онош нэмэхэд алдаа гарлаа." });
  }
});

// PATCH /api/diagnoses/:id
router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID буруу." });

    const { code, name, description } = req.body || {};

    const dx = await prisma.diagnosis.update({
      where: { id },
      data: {
        ...(code !== undefined && { code: code?.trim() }),
        ...(name !== undefined && { name: name?.trim() }),
        ...(description !== undefined && {
          description: description?.trim() || null,
        }),
      },
    });

    res.json(dx);
  } catch (e: any) {
    console.error("PATCH /api/diagnoses/:id failed", e);
    if (e.code === "P2002") {
      return res
        .status(409)
        .json({ error: "Ижил кодтой онош аль хэдийн бүртгэгдсэн байна." });
    }
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Онош олдсонгүй." });
    }
    res.status(500).json({ error: "Онош засахад алдаа гарлаа." });
  }
});

// DELETE /api/diagnoses/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID буруу." });

    await prisma.diagnosis.delete({ where: { id } });
    res.status(204).end();
  } catch (e: any) {
    console.error("DELETE /api/diagnoses/:id failed", e);
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Онош олдсонгүй." });
    }
    // If later referenced by EncounterDiagnosis, you can block delete with better error
    res.status(500).json({ error: "Онош устгахад алдаа гарлаа." });
  }
});

export default router;
