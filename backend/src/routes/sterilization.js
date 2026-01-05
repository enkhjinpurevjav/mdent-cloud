import express from "express";
import prisma from "../db.js";

const router = express.Router();

// Categories
router.get("/sterilization/categories", async (_req, res) => {
  const cats = await prisma.sterilizationCategory.findMany({ orderBy: { name: "asc" } });
  res.json(cats);
});

router.post("/sterilization/categories", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "name is required" });

  try {
    const created = await prisma.sterilizationCategory.create({ data: { name } });
    res.json(created);
  } catch {
    res.status(400).json({ error: "Category already exists or invalid" });
  }
});

router.patch("/sterilization/categories/:id", async (req, res) => {
  const id = Number(req.params.id);
  const name = String(req.body?.name || "").trim();
  if (!id) return res.status(400).json({ error: "invalid id" });
  if (!name) return res.status(400).json({ error: "name is required" });

  try {
    const updated = await prisma.sterilizationCategory.update({
      where: { id },
      data: { name },
    });
    res.json(updated);
  } catch {
    res.status(400).json({ error: "Category update failed" });
  }
});

router.delete("/sterilization/categories/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid id" });

  await prisma.sterilizationCategory.delete({ where: { id } });
  res.json({ ok: true });
});

// Items
router.get("/sterilization/items", async (_req, res) => {
  const items = await prisma.sterilizationItem.findMany({
    orderBy: [{ categoryId: "asc" }, { name: "asc" }],
  });
  res.json(items);
});

router.post("/sterilization/items", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const categoryId = Number(req.body?.categoryId);
 const quantityRaw = req.body?.quantity;
const quantity = quantityRaw === undefined || quantityRaw === null ? 1 : Number(quantityRaw);

if (!Number.isFinite(quantity) || quantity < 1) {
  return res.status(400).json({ error: "quantity must be >= 1" });
}

  try {
    const created = await prisma.sterilizationItem.create({
      data: { name, categoryId, quantity: Math.floor(quantity) },
    });
    res.json(created);
  } catch {
    res.status(400).json({ error: "Item already exists or invalid" });
  }
});

router.patch("/sterilization/items/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid id" });

  const name = req.body?.name !== undefined ? String(req.body?.name || "").trim() : undefined;
 const quantityRaw = req.body?.quantity;
const quantity = quantityRaw === undefined ? undefined : Number(quantityRaw);

if (quantity !== undefined && (!Number.isFinite(quantity) || quantity < 1)) {
  return res.status(400).json({ error: "quantity must be >= 1" });
}

  try {
    const updated = await prisma.sterilizationItem.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(quantity !== undefined ? { quantity: Math.floor(quantity) } : {}),
      },
    });
    res.json(updated);
  } catch {
    res.status(400).json({ error: "Item update failed" });
  }
});

router.delete("/sterilization/items/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid id" });

  await prisma.sterilizationItem.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
