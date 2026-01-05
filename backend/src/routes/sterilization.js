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
  const code = String(req.body?.code || "").trim();
  const specialistUserId = Number(req.body?.specialistUserId);
  const packageQuantity = Number(req.body?.packageQuantity ?? 1);
  const indicatorDateRaw = req.body?.indicatorDate;
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  if (!branchId) return res.status(400).json({ error: "branchId is required" });
  if (!code) return res.status(400).json({ error: "code is required" });
  if (!specialistUserId) return res.status(400).json({ error: "specialistUserId is required" });

  if (!Number.isFinite(packageQuantity) || packageQuantity < 1) {
    return res.status(400).json({ error: "packageQuantity must be >= 1" });
  }

  const indicatorDate = new Date(indicatorDateRaw || "");
  if (Number.isNaN(indicatorDate.getTime())) {
    return res.status(400).json({ error: "indicatorDate is invalid" });
  }

  if (items.length === 0) {
    return res.status(400).json({ error: "At least 1 item is required" });
  }

  for (const it of items) {
    const itemId = Number(it?.itemId);
    const qty = Number(it?.quantity ?? 1);
    if (!itemId) return res.status(400).json({ error: "itemId is required" });
    if (!Number.isFinite(qty) || qty < 1) {
      return res.status(400).json({ error: "item quantity must be >= 1" });
    }
  }

  try {
    const created = await prisma.sterilizationIndicator.create({
      data: {
        branchId,
        code,
        indicatorDate,
        specialistUserId,
        packageQuantity: Math.floor(packageQuantity),
        items: {
          create: items.map((it) => ({
            itemId: Number(it.itemId),
            quantity: Math.floor(Number(it.quantity ?? 1)),
          })),
        },
      },
      include: {
        branch: { select: { id: true, name: true } },
        specialist: { select: { id: true, name: true, ovog: true, email: true } },
        items: { include: { item: true } },
      },
    });
    res.json(created);
  } catch {
    res.status(400).json({ error: "Indicator create failed (maybe duplicate code in branch)" });
  }
});

export default router;
