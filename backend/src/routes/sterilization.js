import express from "express";
import prisma from "../db.js";

const router = express.Router();

/**
 * Helper: build minimal unique prefix for each branch.
 * Example:
 *  - Maral -> M (if no other branch starts with M)
 *  - Maral + Mandakh -> MA and MN (2 letters, may expand if needed)
 */
function computeBranchPrefixes(branches) {
  const normalized = branches.map((b) => ({
    id: b.id,
    name: String(b.name || "").trim(),
    upper: String(b.name || "").trim().toUpperCase(),
  }));

  // start with 1 letter, expand until unique for all
  const prefixes = {};
  let len = 1;

  while (len <= 10) {
    const used = new Map(); // prefix -> branchId
    let ok = true;

    for (const b of normalized) {
      const p = b.upper.slice(0, Math.min(len, b.upper.length || 1));
      if (!p) continue;

      if (used.has(p) && used.get(p) !== b.id) {
        ok = false;
      } else {
        used.set(p, b.id);
      }
    }

    if (ok) {
      for (const b of normalized) {
        const p = b.upper.slice(0, Math.min(len, b.upper.length || 1));
        prefixes[b.id] = p || "X";
      }
      return prefixes;
    }

    len += 1;
  }

  // fallback
  for (const b of normalized) prefixes[b.id] = (b.upper.slice(0, 3) || "X");
  return prefixes;
}

// GET nurses (specialists)
router.get("/sterilization/specialists", async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { role: "nurse" },
    select: { id: true, name: true, ovog: true, email: true, branchId: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  res.json(users);
});

// GET branch code prefixes
router.get("/sterilization/branch-prefixes", async (_req, res) => {
  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
  const prefixes = computeBranchPrefixes(branches);
  res.json(prefixes); // { [branchId]: "M" or "MA" ... }
});

// POST create indicator
router.post("/sterilization/indicators", async (req, res) => {
  const branchId = Number(req.body?.branchId);
  const packageName = String(req.body?.packageName || "").trim();
  const code = String(req.body?.code || "").trim();
  const specialistUserId = Number(req.body?.specialistUserId);
  const packageQuantity = Number(req.body?.packageQuantity ?? 1);
  const indicatorDateRaw = req.body?.indicatorDate;

  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  if (!branchId) return res.status(400).json({ error: "branchId is required" });
  if (!packageName) return res.status(400).json({ error: "packageName is required" });
  if (!code) return res.status(400).json({ error: "code is required" });
  if (!specialistUserId) return res.status(400).json({ error: "specialistUserId is required" });

  if (!Number.isFinite(packageQuantity) || packageQuantity < 1) {
    return res.status(400).json({ error: "packageQuantity must be >= 1" });
  }

  const indicatorDate = new Date(indicatorDateRaw || "");
  if (Number.isNaN(indicatorDate.getTime())) {
    return res.status(400).json({ error: "indicatorDate is invalid" });
  }

  // items must be item ids
  const itemIds = items.map((x) => Number(x)).filter(Boolean);
  if (itemIds.length === 0) {
    return res.status(400).json({ error: "At least 1 item is required" });
  }

  try {
    const created = await prisma.sterilizationIndicator.create({
      data: {
        branchId,
        packageName, // ✅ REQUIRED FIELD
        code,
        indicatorDate,
        specialistUserId,
        packageQuantity: Math.floor(packageQuantity),
        items: { create: itemIds.map((itemId) => ({ itemId })) },
      },
      include: {
        branch: { select: { id: true, name: true } },
        specialist: { select: { id: true, name: true, ovog: true, email: true } },
        items: { include: { item: true } },
      },
    });
    res.json(created);
  } catch (e) {
    res.status(400).json({ error: "Indicator create failed" });
  }
});

// --- Sterilization settings: Categories ---
router.get("/sterilization/categories", async (_req, res) => {
  const cats = await prisma.sterilizationCategory.findMany({
    orderBy: { name: "asc" },
  });
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
    res.status(400).json({ error: "Category update failed (maybe duplicate name)" });
  }
});

router.delete("/sterilization/categories/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid id" });

  await prisma.sterilizationCategory.delete({ where: { id } });
  res.json({ ok: true });
});

// --- Sterilization settings: Items ---
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

  if (!name) return res.status(400).json({ error: "name is required" });
  if (!categoryId) return res.status(400).json({ error: "categoryId is required" });
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

  if (name !== undefined && !name) return res.status(400).json({ error: "name cannot be empty" });
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

// GET active indicators (produced/used/current)
router.get("/sterilization/indicators/active", async (req, res) => {
  const branchId = req.query.branchId ? Number(req.query.branchId) : null;
  const q = String(req.query.q || "").trim().toLowerCase();

  const where = {
    ...(branchId ? { branchId } : {}),
    ...(q
      ? {
          OR: [
            { packageName: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const indicators = await prisma.sterilizationIndicator.findMany({
    where,
    orderBy: [{ indicatorDate: "desc" }, { id: "desc" }],
    select: {
      id: true,
      branchId: true,
      packageName: true,
      code: true,
      indicatorDate: true,
      packageQuantity: true,
      branch: { select: { id: true, name: true } },
      specialist: { select: { id: true, name: true, ovog: true, email: true } },
      uses: { select: { usedQuantity: true } },
    },
  });

  const rows = indicators
    .map((it) => {
      const used = (it.uses || []).reduce((sum, u) => sum + (u.usedQuantity || 0), 0);
      const produced = it.packageQuantity || 0;
      const current = Math.max(0, produced - used);

      return {
        id: it.id,
        branch: it.branch,
        branchId: it.branchId,
        packageName: it.packageName,
        code: it.code,
        indicatorDate: it.indicatorDate,
        produced,
        used,
        current,
        specialist: it.specialist,
      };
    })
    // Active = current > 0
    .filter((x) => x.current > 0);

  res.json(rows);
});

export default router;
