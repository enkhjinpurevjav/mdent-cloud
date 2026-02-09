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

// --- Sterilization settings: Items (Branch-Scoped Tool Master) ---
router.get("/sterilization/items", async (req, res) => {
  const branchId = req.query.branchId ? Number(req.query.branchId) : null;
  
  const where = branchId ? { branchId } : {};
  
  const items = await prisma.sterilizationItem.findMany({
    where,
    orderBy: [{ branchId: "asc" }, { categoryId: "asc" }, { name: "asc" }],
    include: {
      branch: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });
  res.json(items);
});

router.post("/sterilization/items", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const branchId = Number(req.body?.branchId);  // NEW: Required
  const categoryId = Number(req.body?.categoryId);
  const quantityRaw = req.body?.quantity;
  const quantity = quantityRaw === undefined || quantityRaw === null ? 1 : Number(quantityRaw);

  if (!name) return res.status(400).json({ error: "name is required" });
  if (!branchId) return res.status(400).json({ error: "branchId is required" });  // NEW
  if (!categoryId) return res.status(400).json({ error: "categoryId is required" });
  if (!Number.isFinite(quantity) || quantity < 1) {
    return res.status(400).json({ error: "quantity must be >= 1" });
  }

  try {
    const created = await prisma.sterilizationItem.create({
      data: { name, branchId, categoryId, quantity: Math.floor(quantity) },  // NEW: branchId
      include: {
        branch: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });
    res.json(created);
  } catch {
    res.status(400).json({ error: "Item already exists in this branch or invalid" });
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
      include: {
        branch: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });
    res.json(updated);
  } catch {
    res.status(400).json({ error: "Item update failed (possibly duplicate name in branch)" });
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

// GET sterilization report
// /api/sterilization/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&branchId=optional
// - todayCards: ALWAYS today's usage (calendar date) per branch
// - rows: usage summary per indicator within [from..to] (calendar dates) and optional branch filter
router.get("/sterilization/reports", async (req, res) => {
  try {
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    const branchIdParam = req.query.branchId ? Number(req.query.branchId) : null;

    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });
    }

    const [fy, fm, fd] = from.split("-").map(Number);
    const [ty, tm, td] = to.split("-").map(Number);
    if (!fy || !fm || !fd || !ty || !tm || !td) {
      return res.status(400).json({ error: "invalid date format" });
    }

    // Date range boundaries (calendar dates)
    const rangeStart = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
    const rangeEnd = new Date(ty, tm - 1, td, 23, 59, 59, 999);

    // Today's boundaries (calendar date, server time)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;

    const branches = await prisma.branch.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    const allowedBranchIds = branchIdParam
      ? branches.filter((b) => b.id === branchIdParam).map((b) => b.id)
      : branches.map((b) => b.id);

    // 1) TODAY CARDS: sum usedQuantity per branch where createdAt is today
    const todayUses = await prisma.encounterSterilizationPackageUse.findMany({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        indicator: { branchId: { in: allowedBranchIds } },
      },
      select: {
        usedQuantity: true,
        indicator: { select: { branchId: true } },
      },
    });

    const usedByBranchToday = new Map();
    for (const u of todayUses) {
      const bid = u.indicator?.branchId;
      if (!bid) continue;
      usedByBranchToday.set(bid, (usedByBranchToday.get(bid) || 0) + Number(u.usedQuantity || 0));
    }

    const todayCards = branches
      .filter((b) => allowedBranchIds.includes(b.id))
      .map((b) => ({
        branchId: b.id,
        branchName: b.name,
        usedTotal: usedByBranchToday.get(b.id) || 0,
      }));

    // 2) RANGE ROWS: group by indicator within date range
    const rangeUses = await prisma.encounterSterilizationPackageUse.findMany({
      where: {
        createdAt: { gte: rangeStart, lte: rangeEnd },
        indicator: { branchId: { in: allowedBranchIds } },
      },
      select: {
        usedQuantity: true,
        indicator: {
          select: {
            id: true,
            branchId: true,
            packageName: true,
            code: true,
            indicatorDate: true,
            packageQuantity: true,
            specialist: { select: { id: true, name: true, ovog: true, email: true } },
            branch: { select: { id: true, name: true } },
          },
        },
      },
    });

    const byIndicator = new Map();
    for (const u of rangeUses) {
      const ind = u.indicator;
      if (!ind) continue;

      const key = ind.id;
      const prev =
        byIndicator.get(key) || {
          indicatorId: ind.id,
          branchId: ind.branchId,
          branchName: ind.branch?.name || "",
          packageName: ind.packageName,
          code: ind.code,
          indicatorDate: ind.indicatorDate,
          createdQuantity: ind.packageQuantity || 0,
          usedQuantity: 0,
          specialist: ind.specialist || null,
        };

      prev.usedQuantity += Number(u.usedQuantity || 0);
      byIndicator.set(key, prev);
    }

    const rows = Array.from(byIndicator.values()).sort((a, b) => {
      const ad = new Date(a.indicatorDate).getTime();
      const bd = new Date(b.indicatorDate).getTime();
      return bd - ad;
    });

    return res.json({
      today: todayYmd,
      todayCards,
      from: rangeStart.toISOString(),
      to: rangeEnd.toISOString(),
      rows,
    });
  } catch (err) {
    console.error("GET /api/sterilization/reports error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
});

// ==========================================================
// V1 STERILIZATION: Autoclave Cycles
// ==========================================================

// POST create autoclave cycle with tool lines
router.post("/sterilization/cycles", async (req, res) => {
  try {
    const branchId = Number(req.body?.branchId);
    const code = String(req.body?.code || "").trim();
    const machineNumber = String(req.body?.machineNumber || "").trim();
    const completedAtRaw = req.body?.completedAt;
    const result = String(req.body?.result || "").toUpperCase();
    const operator = String(req.body?.operator || "").trim();
    const notes = req.body?.notes ? String(req.body?.notes).trim() : null;
    const toolLines = Array.isArray(req.body?.toolLines) ? req.body.toolLines : [];

    if (!branchId) return res.status(400).json({ error: "branchId is required" });
    if (!code) return res.status(400).json({ error: "code is required" });
    if (!machineNumber) return res.status(400).json({ error: "machineNumber is required" });
    if (!completedAtRaw) return res.status(400).json({ error: "completedAt is required" });
    if (!operator) return res.status(400).json({ error: "operator is required" });
    if (result !== "PASS" && result !== "FAIL") {
      return res.status(400).json({ error: "result must be PASS or FAIL" });
    }
    if (toolLines.length === 0) {
      return res.status(400).json({ error: "At least one tool line is required" });
    }

    const completedAt = new Date(completedAtRaw);
    if (Number.isNaN(completedAt.getTime())) {
      return res.status(400).json({ error: "completedAt is invalid" });
    }

    // Validate tool lines
    const validatedLines = [];
    for (const line of toolLines) {
      const toolId = Number(line.toolId);
      const producedQty = Number(line.producedQty);
      
      if (!toolId || !Number.isFinite(producedQty) || producedQty < 1) {
        return res.status(400).json({ error: "Each tool line must have valid toolId and producedQty >= 1" });
      }
      
      validatedLines.push({ toolId, producedQty: Math.floor(producedQty) });
    }

    const cycle = await prisma.autoclaveCycle.create({
      data: {
        branchId,
        code,
        machineNumber,
        completedAt,
        result,
        operator,
        notes,
        toolLines: {
          create: validatedLines,
        },
      },
      include: {
        branch: { select: { id: true, name: true } },
        toolLines: {
          include: {
            tool: { select: { id: true, name: true, quantity: true } },
          },
        },
      },
    });

    res.json(cycle);
  } catch (err) {
    console.error("POST /api/sterilization/cycles error:", err);
    if (err.code === "P2002") {
      return res.status(400).json({ error: "Cycle code already exists for this branch" });
    }
    return res.status(500).json({ error: "Failed to create cycle" });
  }
});

// GET list cycles by branch
router.get("/sterilization/cycles", async (req, res) => {
  try {
    const branchId = req.query.branchId ? Number(req.query.branchId) : null;
    const result = req.query.result ? String(req.query.result).toUpperCase() : null;
    
    const where = {
      ...(branchId ? { branchId } : {}),
      ...(result ? { result } : {}),
    };

    const cycles = await prisma.autoclaveCycle.findMany({
      where,
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
      include: {
        branch: { select: { id: true, name: true } },
        toolLines: {
          include: {
            tool: { select: { id: true, name: true, quantity: true } },
          },
        },
      },
    });

    res.json(cycles);
  } catch (err) {
    console.error("GET /api/sterilization/cycles error:", err);
    return res.status(500).json({ error: "Failed to list cycles" });
  }
});

// GET active indicators for doctor selection (PASS only, remaining > 0)
router.get("/sterilization/cycles/active-indicators", async (req, res) => {
  try {
    const branchId = req.query.branchId ? Number(req.query.branchId) : null;
    const toolId = req.query.toolId ? Number(req.query.toolId) : null;
    
    if (!branchId) {
      return res.status(400).json({ error: "branchId is required" });
    }

    // Build where clause for cycles
    const cycleWhere = {
      branchId,
      result: "PASS", // Only PASS cycles
      ...(toolId ? { toolLines: { some: { toolId } } } : {}),
    };

    const cycles = await prisma.autoclaveCycle.findMany({
      where: cycleWhere,
      include: {
        toolLines: {
          ...(toolId ? { where: { toolId } } : {}),
          include: {
            tool: { select: { id: true, name: true } },
            finalizedUsages: { select: { usedQty: true } },
          },
        },
      },
      orderBy: [{ completedAt: "desc" }],
    });

    // Compute remaining for each tool line
    const activeLines = [];
    for (const cycle of cycles) {
      for (const line of cycle.toolLines) {
        const produced = line.producedQty || 0;
        const used = (line.finalizedUsages || []).reduce((sum, u) => sum + (u.usedQty || 0), 0);
        const remaining = Math.max(0, produced - used);
        
        if (remaining > 0) {
          activeLines.push({
            cycleId: cycle.id,
            cycleCode: cycle.code,
            machineNumber: cycle.machineNumber,
            completedAt: cycle.completedAt,
            toolLineId: line.id,
            toolId: line.tool.id,
            toolName: line.tool.name,
            produced,
            used,
            remaining,
          });
        }
      }
    }

    res.json(activeLines);
  } catch (err) {
    console.error("GET /api/sterilization/cycles/active-indicators error:", err);
    return res.status(500).json({ error: "Failed to get active indicators" });
  }
});

// ==========================================================
// V1 STERILIZATION: Draft Attachments
// ==========================================================

// POST create draft attachment
router.post("/sterilization/draft-attachments", async (req, res) => {
  try {
    const encounterDiagnosisId = Number(req.body?.encounterDiagnosisId);
    const cycleId = Number(req.body?.cycleId);
    const toolId = Number(req.body?.toolId);
    const requestedQty = Number(req.body?.requestedQty) || 1;

    if (!encounterDiagnosisId) {
      return res.status(400).json({ error: "encounterDiagnosisId is required" });
    }
    if (!cycleId) {
      return res.status(400).json({ error: "cycleId is required" });
    }
    if (!toolId) {
      return res.status(400).json({ error: "toolId is required" });
    }
    if (!Number.isFinite(requestedQty) || requestedQty < 1) {
      return res.status(400).json({ error: "requestedQty must be >= 1" });
    }

    const draft = await prisma.sterilizationDraftAttachment.create({
      data: {
        encounterDiagnosisId,
        cycleId,
        toolId,
        requestedQty: Math.floor(requestedQty),
      },
      include: {
        cycle: {
          select: {
            id: true,
            code: true,
            machineNumber: true,
            completedAt: true,
          },
        },
        tool: { select: { id: true, name: true } },
      },
    });

    res.json(draft);
  } catch (err) {
    console.error("POST /api/sterilization/draft-attachments error:", err);
    return res.status(500).json({ error: "Failed to create draft attachment" });
  }
});

// DELETE remove draft attachment
router.delete("/sterilization/draft-attachments/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    await prisma.sterilizationDraftAttachment.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/sterilization/draft-attachments error:", err);
    return res.status(404).json({ error: "Draft attachment not found" });
  }
});

// ==========================================================
// V1 STERILIZATION: Mismatch Management
// ==========================================================

// GET mismatches by encounter
router.get("/sterilization/mismatches", async (req, res) => {
  try {
    const encounterId = req.query.encounterId ? Number(req.query.encounterId) : null;
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;
    
    const where = {
      ...(encounterId ? { encounterId } : {}),
      ...(status ? { status } : {}),
    };

    const mismatches = await prisma.sterilizationMismatch.findMany({
      where,
      include: {
        encounter: {
          select: {
            id: true,
            visitDate: true,
            patientBook: {
              select: {
                patient: { select: { id: true, name: true, ovog: true } },
              },
            },
          },
        },
        branch: { select: { id: true, name: true } },
        tool: { select: { id: true, name: true } },
        adjustments: {
          include: {
            resolvedBy: { select: { id: true, name: true, ovog: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    res.json(mismatches);
  } catch (err) {
    console.error("GET /api/sterilization/mismatches error:", err);
    return res.status(500).json({ error: "Failed to get mismatches" });
  }
});

// POST resolve mismatches for an encounter
router.post("/sterilization/mismatches/:encounterId/resolve", async (req, res) => {
  try {
    const encounterId = Number(req.params.encounterId);
    const resolvedByName = String(req.body?.resolvedByName || "").trim();
    const resolvedByUserId = req.body?.resolvedByUserId ? Number(req.body.resolvedByUserId) : null;
    const note = req.body?.note ? String(req.body.note).trim() : null;

    if (!encounterId) {
      return res.status(400).json({ error: "Invalid encounterId" });
    }
    if (!resolvedByName) {
      return res.status(400).json({ error: "resolvedByName is required" });
    }

    // TODO: Add role checking (nurse, manager, admin only)
    // For now, we'll allow any request with a resolvedByName

    // Get all unresolved mismatches for this encounter
    const unresolvedMismatches = await prisma.sterilizationMismatch.findMany({
      where: {
        encounterId,
        status: "UNRESOLVED",
      },
    });

    if (unresolvedMismatches.length === 0) {
      return res.status(400).json({ error: "No unresolved mismatches for this encounter" });
    }

    // Use transaction to resolve all mismatches
    const result = await prisma.$transaction(async (tx) => {
      const adjustments = [];
      const updatedMismatches = [];

      for (const mismatch of unresolvedMismatches) {
        // Create adjustment consumption
        const adjustment = await tx.sterilizationAdjustmentConsumption.create({
          data: {
            mismatchId: mismatch.id,
            encounterId: mismatch.encounterId,
            branchId: mismatch.branchId,
            toolId: mismatch.toolId,
            code: mismatch.code,
            quantity: mismatch.mismatchQty,
            resolvedByUserId,
            resolvedByName,
            note,
          },
        });
        adjustments.push(adjustment);

        // Mark mismatch as resolved
        const updated = await tx.sterilizationMismatch.update({
          where: { id: mismatch.id },
          data: { status: "RESOLVED" },
        });
        updatedMismatches.push(updated);
      }

      return { adjustments, mismatches: updatedMismatches };
    });

    res.json({
      message: `Resolved ${result.mismatches.length} mismatch(es)`,
      adjustments: result.adjustments,
      mismatches: result.mismatches,
    });
  } catch (err) {
    console.error("POST /api/sterilization/mismatches/:encounterId/resolve error:", err);
    return res.status(500).json({ error: "Failed to resolve mismatches" });
  }
});

export default router;
