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

export default router;
