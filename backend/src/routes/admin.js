import express from "express";
import prisma from "../db.js";
import incomeRoutes from "./admin/income.js";

const router = express.Router(); // Create the router object

// Attach the income routes
router.use("/income", incomeRoutes);

// ==========================================================
// PAYMENT METHODS ADMIN
// ==========================================================
router.get("/payment-methods", async (_req, res) => {
  try {
    const methods = await prisma.paymentMethodConfig.findMany({
      orderBy: { sortOrder: "asc" },
      include: { providers: { orderBy: { sortOrder: "asc" } } },
    });
    res.json({ methods });
  } catch (error) {
    console.error("Failed to load payment methods:", error);
    res.status(500).json({ error: "Failed to load payment methods" });
  }
});

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

    const updated = await prisma.paymentMethodConfig.update({ where: { id }, data });
    res.json(updated);
  } catch (error) {
    console.error("Failed to update payment method:", error);
    res.status(500).json({ error: "Failed to update payment method" });
  }
});

// ==========================================================
// PAYMENT PROVIDERS ADMIN
// ==========================================================
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

    const updated = await prisma.paymentProviderConfig.update({ where: { id }, data });
    res.json(updated);
  } catch (error) {
    console.error("Failed to update payment provider:", error);
    res.status(500).json({ error: "Failed to update payment provider" });
  }
});

router.delete("/payment-providers/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid provider ID" });
  }

  try {
    await prisma.paymentProviderConfig.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete payment provider:", error);
    res.status(500).json({ error: "Failed to delete payment provider" });
  }
});

// ==========================================================
// ADDITIONAL ADMIN ROUTES
// ==========================================================

// Other routes, such as EMPLOYEE BENEFITS and STAFF INCOME SETTINGS, remain unchanged in the correct implementation

// ==========================================================
// DOCTOR PERMISSION: canCloseEncounterWithoutPayment
// ==========================================================

/**
 * PATCH /api/admin/users/:id
 * Update doctor-specific permissions.
 * Supported fields: canCloseEncounterWithoutPayment (boolean)
 */
router.patch("/users/:id", async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId || Number.isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  const { canCloseEncounterWithoutPayment } = req.body || {};

  if (canCloseEncounterWithoutPayment === undefined) {
    return res.status(400).json({ error: "No updatable fields provided." });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(404).json({ error: "User not found." });
    }

    if (user.role !== "doctor") {
      return res.status(400).json({ error: "canCloseEncounterWithoutPayment can only be set for doctors." });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { canCloseEncounterWithoutPayment: Boolean(canCloseEncounterWithoutPayment) },
      select: { id: true, role: true, canCloseEncounterWithoutPayment: true },
    });

    return res.json(updated);
  } catch (err) {
    console.error("PATCH /api/admin/users/:id error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
