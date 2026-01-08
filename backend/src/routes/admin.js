import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

// ==========================================================
// PAYMENT METHODS ADMIN
// ==========================================================

/**
 * GET /api/admin/payment-methods
 * List all payment methods (including inactive)
 */
router.get("/payment-methods", async (req, res) => {
  try {
    const methods = await prisma.paymentMethodConfig.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        providers: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    res.json({ methods });
  } catch (error) {
    console.error("Failed to load payment methods:", error);
    res.status(500).json({ error: "Failed to load payment methods" });
  }
});

/**
 * PATCH /api/admin/payment-methods/:id
 * Update a payment method (label, isActive, sortOrder)
 */
router.patch("/payment-methods/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { label, isActive, sortOrder } = req.body;

  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid payment method ID" });
  }

  try {
    const data = {};
    if (label !== undefined) data.label = String(label);
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (sortOrder !== undefined) data.sortOrder = Number(sortOrder);

    const updated = await prisma.paymentMethodConfig.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (error) {
    console.error("Failed to update payment method:", error);
    res.status(500).json({ error: "Failed to update payment method" });
  }
});

// ==========================================================
// PAYMENT PROVIDERS ADMIN
// ==========================================================

/**
 * GET /api/admin/payment-providers
 * List all payment providers (optionally filter by methodKey)
 */
router.get("/payment-providers", async (req, res) => {
  try {
    const { methodKey } = req.query;
    const where = methodKey ? { methodKey: String(methodKey) } : {};

    const providers = await prisma.paymentProviderConfig.findMany({
      where,
      orderBy: [{ methodKey: "asc" }, { sortOrder: "asc" }],
    });

    res.json({ providers });
  } catch (error) {
    console.error("Failed to load payment providers:", error);
    res.status(500).json({ error: "Failed to load payment providers" });
  }
});

/**
 * POST /api/admin/payment-providers
 * Create a new payment provider
 */
router.post("/payment-providers", async (req, res) => {
  const { methodKey, name, isActive, sortOrder, note } = req.body;

  if (!methodKey || !name) {
    return res.status(400).json({ error: "methodKey and name are required" });
  }

  try {
    const provider = await prisma.paymentProviderConfig.create({
      data: {
        methodKey: String(methodKey),
        name: String(name),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
        note: note ? String(note) : null,
      },
    });

    res.json(provider);
  } catch (error) {
    console.error("Failed to create payment provider:", error);
    res.status(500).json({ error: "Failed to create payment provider" });
  }
});

/**
 * PATCH /api/admin/payment-providers/:id
 * Update a payment provider
 */
router.patch("/payment-providers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, isActive, sortOrder, note } = req.body;

  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid provider ID" });
  }

  try {
    const data = {};
    if (name !== undefined) data.name = String(name);
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (sortOrder !== undefined) data.sortOrder = Number(sortOrder);
    if (note !== undefined) data.note = note ? String(note) : null;

    const updated = await prisma.paymentProviderConfig.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (error) {
    console.error("Failed to update payment provider:", error);
    res.status(500).json({ error: "Failed to update payment provider" });
  }
});

/**
 * DELETE /api/admin/payment-providers/:id
 * Delete a payment provider
 */
router.delete("/payment-providers/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid provider ID" });
  }

  try {
    await prisma.paymentProviderConfig.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete payment provider:", error);
    res.status(500).json({ error: "Failed to delete payment provider" });
  }
});


import express from "express";
import prisma from "../db.js";

const router = express.Router();

/**
 * GET /api/admin/employee-benefits
 * Lists only users who have at least one benefit (active or not - you choose).
 * We'll do: only benefits that areActive=true by default, but include totals anyway.
 */
router.get("/employee-benefits", async (req, res) => {
  try {
    // Load benefits with employee attached
    const benefits = await prisma.employeeBenefit.findMany({
      where: { isActive: true }, // change to {} if you want include inactive too
      include: { employee: true, usages: true },
      orderBy: { createdAt: "desc" },
    });

    // Aggregate per employeeId
    const byEmployee = new Map();

    for (const b of benefits) {
      const emp = b.employee;
      if (!emp) continue;

      const used = (b.usages || []).reduce((s, u) => s + Number(u.amountUsed || 0), 0);

      if (!byEmployee.has(emp.id)) {
        byEmployee.set(emp.id, {
          userId: emp.id,
          ovog: emp.ovog || "",
          name: emp.name || "",
          email: emp.email,
          role: emp.role,
          password: emp.password, // hashed
          totalAmount: 0,
          usedAmount: 0,
          remainingAmount: 0,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        });
      }

      const row = byEmployee.get(emp.id);
      row.totalAmount += Number(b.initialAmount || 0);
      row.usedAmount += used;
      row.remainingAmount += Number(b.remainingAmount || 0);

      // track min createdAt and max updatedAt across benefits
      if (b.createdAt && row.createdAt && b.createdAt < row.createdAt) row.createdAt = b.createdAt;
      if (b.updatedAt && row.updatedAt && b.updatedAt > row.updatedAt) row.updatedAt = b.updatedAt;
    }

    const rows = Array.from(byEmployee.values());

    // Sort by Mongolian Cyrillic-ish (best-effort) using localeCompare
    rows.sort((a, b) => {
      const an = `${a.ovog || ""} ${a.name || ""}`.trim();
      const bn = `${b.ovog || ""} ${b.name || ""}`.trim();
      return an.localeCompare(bn, "mn");
    });

    res.json({ employees: rows });
  } catch (e) {
    console.error("GET /api/admin/employee-benefits failed:", e);
    res.status(500).json({ error: "Failed to load employee benefits." });
  }
});

/**
 * POST /api/admin/employee-benefits
 * Creates a new benefit for a given employee.
 * Body: { employeeId, code, initialAmount, fromDate?, toDate? }
 */
router.post("/employee-benefits", async (req, res) => {
  const { employeeId, code, initialAmount, fromDate, toDate } = req.body || {};
  if (!employeeId || !code || initialAmount == null) {
    return res.status(400).json({ error: "employeeId, code, initialAmount are required" });
  }

  try {
    const amount = Number(initialAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "initialAmount must be > 0" });
    }

    const benefit = await prisma.employeeBenefit.create({
      data: {
        employeeId: Number(employeeId),
        code: String(code).trim(),
        initialAmount: Math.round(amount),
        remainingAmount: Math.round(amount),
        fromDate: fromDate ? new Date(fromDate) : null,
        toDate: toDate ? new Date(toDate) : null,
        isActive: true,
      },
      include: { employee: true },
    });

    res.json({ benefit });
  } catch (e) {
    console.error("POST /api/admin/employee-benefits failed:", e);
    res.status(500).json({ error: "Failed to create employee benefit." });
  }
});

/**
 * DELETE /api/admin/employee-benefits/:employeeId
 * Remove employee from the list by deactivating all their benefits.
 */
router.delete("/employee-benefits/:employeeId", async (req, res) => {
  const employeeId = Number(req.params.employeeId);
  if (!employeeId || Number.isNaN(employeeId)) {
    return res.status(400).json({ error: "Invalid employeeId" });
  }

  try {
    await prisma.employeeBenefit.updateMany({
      where: { employeeId },
      data: { isActive: false },
    });

    res.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/admin/employee-benefits/:employeeId failed:", e);
    res.status(500).json({ error: "Failed to remove employee benefit." });
  }
});

export default router;

export default router;
