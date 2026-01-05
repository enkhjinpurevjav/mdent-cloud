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
  } catch (e) {
    res.status(400).json({ error: "Category already exists or invalid" });
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
  const items = await prisma.sterilizationItem.findMany({ orderBy: [{ categoryId: "asc" }, { name: "asc" }] });
  res.json(items);
});

router.post("/sterilization/items", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const categoryId = Number(req.body?.categoryId);

  if (!name) return res.status(400).json({ error: "name is required" });
  if (!categoryId) return res.status(400).json({ error: "categoryId is required" });

  try {
    const created = await prisma.sterilizationItem.create({
      data: { name, categoryId },
    });
    res.json(created);
  } catch (e) {
    res.status(400).json({ error: "Item already exists or invalid" });
  }
});

router.delete("/sterilization/items/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid id" });

  await prisma.sterilizationItem.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
