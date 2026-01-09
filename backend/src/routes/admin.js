import express from "express";
import prisma from "../db.js";

const router = express.Router();

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

// ...keep existing payment-method/provider routes above

// ==========================================================
// EMPLOYEE BENEFITS ADMIN (Finance) - Option A
// ==========================================================

router.get("/employee-benefits", async (_req, res) => {
  try {
    // Active benefits only; option A assumes one active benefit per employee.
    // Order ensures we pick the latest updated active record if duplicates exist.
    const benefits = await prisma.employeeBenefit.findMany({
      where: { isActive: true },
      include: { employee: true, usages: true },
      orderBy: [{ employeeId: "asc" }, { updatedAt: "desc" }],
    });

    const byEmployee = new Map();

    for (const b of benefits) {
      const emp = b.employee;
      if (!emp) continue;

      // pick only first active benefit per employee
      if (byEmployee.has(emp.id)) continue;

      const usedAmount = (b.usages || []).reduce(
        (sum, u) => sum + Number(u.amountUsed || 0),
        0
      );

      byEmployee.set(emp.id, {
        userId: emp.id,
        ovog: emp.ovog || "",
        name: emp.name || "",
        email: emp.email,
        role: emp.role,

        benefitId: b.id,
        code: b.code,
        initialAmount: Number(b.initialAmount || 0),
        remainingAmount: Number(b.remainingAmount || 0),
        fromDate: b.fromDate,
        toDate: b.toDate,
        isActive: b.isActive,

        totalAmount: Number(b.initialAmount || 0),
        usedAmount,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      });
    }

    const rows = Array.from(byEmployee.values());

    rows.sort((a, b) => {
      const an = `${a.ovog || ""} ${a.name || ""}`.trim();
      const bn = `${b.ovog || ""} ${b.name || ""}`.trim();
      return an.localeCompare(bn, "mn");
    });

    return res.json({ employees: rows });
  } catch (e) {
    console.error("GET /api/admin/employee-benefits failed:", e);
    return res.status(500).json({ error: "Failed to load employee benefits." });
  }
});

/**
 * GET /api/admin/employee-benefits
 * Option A: 1 active benefit per employee.
 * Returns employee row + ACTIVE benefit fields (benefitId, code, initialAmount, remainingAmount...)
 */
router.get("/employee-benefits", async (req, res) => {
  try {
    const benefits = await prisma.employeeBenefit.findMany({
      where: { isActive: true },
      include: { employee: true, usages: true },
      orderBy: [{ employeeId: "asc" }, { updatedAt: "desc" }],
    });

    const byEmployee = new Map();

    for (const b of benefits) {
      const emp = b.employee;
      if (!emp) continue;

      // Option A: first active benefit per employeeId only
      if (byEmployee.has(emp.id)) continue;

      const used = (b.usages || []).reduce((s, u) => s + Number(u.amountUsed || 0), 0);

      byEmployee.set(emp.id, {
        userId: emp.id,
        ovog: emp.ovog || "",
        name: emp.name || "",
        email: emp.email,
        role: emp.role,

        // ✅ show/manage code ("real pass")
        benefitId: b.id,
        code: b.code,
        initialAmount: Number(b.initialAmount || 0),
        remainingAmount: Number(b.remainingAmount || 0),
        fromDate: b.fromDate,
        toDate: b.toDate,
        isActive: b.isActive,

        // summary
        totalAmount: Number(b.initialAmount || 0),
        usedAmount: used,
        remainingAmountSummary: Number(b.remainingAmount || 0),

        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      });
    }

    const rows = Array.from(byEmployee.values());

    rows.sort((a, b) => {
      const an = `${a.ovog || ""} ${a.name || ""}`.trim();
      const bn = `${b.ovog || ""} ${b.name || ""}`.trim();
      return an.localeCompare(bn, "mn");
    });

    return res.json({ employees: rows });
  } catch (e) {
    console.error("GET /api/admin/employee-benefits failed:", e);
    return res.status(500).json({ error: "Failed to load employee benefits." });
  }
});

/**
 * PATCH /api/admin/employee-benefits/:id
 * Edit EmployeeBenefit record (code, amounts, dates, active)
 */
router.patch("/employee-benefits/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid benefit id" });
  }

  const { code, initialAmount, remainingAmount, fromDate, toDate, isActive } =
    req.body || {};

  try {
    const data = {};

    if (code !== undefined) data.code = String(code).trim();
    if (initialAmount !== undefined)
      data.initialAmount = Math.round(Number(initialAmount));
    if (remainingAmount !== undefined)
      data.remainingAmount = Math.round(Number(remainingAmount));
    if (fromDate !== undefined) data.fromDate = fromDate ? new Date(fromDate) : null;
    if (toDate !== undefined) data.toDate = toDate ? new Date(toDate) : null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.employeeBenefit.update({
      where: { id },
      data,
    });

    return res.json({ benefit: updated });
  } catch (e) {
    console.error("PATCH /api/admin/employee-benefits/:id failed:", e);
    return res.status(500).json({ error: "Failed to update employee benefit." });
  }
});

// ==========================================================
// STAFF INCOME SETTINGS (Finance Configuration)
// ==========================================================

/**
 * GET /api/admin/staff-income-settings
 * Returns whitening deduct amount and doctors with their commission configs
 */
router.get("/staff-income-settings", async (_req, res) => {
  try {
    // Fetch the whitening deduct amount from Settings
    const whiteningDeductSetting = await prisma.settings.findUnique({
      where: { key: "finance.homeBleachingDeductAmountMnt" },
    });
    
    const whiteningDeductAmountMnt = whiteningDeductSetting 
      ? Number(whiteningDeductSetting.value) || 0 
      : 0;

    // Fetch all doctors with their commission configs
    const doctors = await prisma.user.findMany({
      where: { role: "doctor" },
      include: { commissionConfig: true },
      orderBy: [{ ovog: "asc" }, { name: "asc" }],
    });

    const doctorsWithConfig = doctors.map((doctor) => ({
      doctorId: doctor.id,
      ovog: doctor.ovog || "",
      name: doctor.name || "",
      email: doctor.email,
      orthoPct: doctor.commissionConfig?.orthoPct || 0,
      defectPct: doctor.commissionConfig?.defectPct || 0,
      surgeryPct: doctor.commissionConfig?.surgeryPct || 0,
      generalPct: doctor.commissionConfig?.generalPct || 0,
    }));

    return res.json({
      whiteningDeductAmountMnt,
      doctors: doctorsWithConfig,
    });
  } catch (error) {
    console.error("GET /api/admin/staff-income-settings failed:", error);
    return res.status(500).json({ error: "Failed to load staff income settings." });
  }
});

/**
 * PUT /api/admin/staff-income-settings
 * Updates whitening deduct amount and doctor commission configs
 * Body: { whiteningDeductAmountMnt: number, doctors: [{ doctorId, orthoPct, defectPct, surgeryPct, generalPct }] }
 */
router.put("/staff-income-settings", async (req, res) => {
  const { whiteningDeductAmountMnt, doctors } = req.body || {};

  // Validate inputs
  if (whiteningDeductAmountMnt === undefined || whiteningDeductAmountMnt === null) {
    return res.status(400).json({ error: "whiteningDeductAmountMnt is required" });
  }

  if (!Array.isArray(doctors)) {
    return res.status(400).json({ error: "doctors must be an array" });
  }

  // Validate numeric value
  const deductAmount = Number(whiteningDeductAmountMnt);
  if (isNaN(deductAmount) || deductAmount < 0) {
    return res.status(400).json({ error: "whiteningDeductAmountMnt must be a non-negative number" });
  }

  // Validate each doctor config
  for (const doc of doctors) {
    if (!doc.doctorId || isNaN(Number(doc.doctorId))) {
      return res.status(400).json({ error: "Each doctor must have a valid doctorId" });
    }

    const orthoPct = Number(doc.orthoPct);
    const defectPct = Number(doc.defectPct);
    const surgeryPct = Number(doc.surgeryPct);
    const generalPct = Number(doc.generalPct);

    if (isNaN(orthoPct) || isNaN(defectPct) || isNaN(surgeryPct) || isNaN(generalPct)) {
      return res.status(400).json({ 
        error: `Invalid percentage values for doctor ${doc.doctorId}` 
      });
    }

    if (orthoPct < 0 || defectPct < 0 || surgeryPct < 0 || generalPct < 0) {
      return res.status(400).json({ 
        error: `Percentage values must be non-negative for doctor ${doc.doctorId}` 
      });
    }
  }

  try {
    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Upsert Settings key
      await tx.settings.upsert({
        where: { key: "finance.homeBleachingDeductAmountMnt" },
        update: { value: String(deductAmount) },
        create: { 
          key: "finance.homeBleachingDeductAmountMnt", 
          value: String(deductAmount) 
        },
      });

      // Upsert each doctor commission config
      for (const doc of doctors) {
        const doctorId = Number(doc.doctorId);
        const orthoPct = Number(doc.orthoPct);
        const defectPct = Number(doc.defectPct);
        const surgeryPct = Number(doc.surgeryPct);
        const generalPct = Number(doc.generalPct);

        await tx.doctorCommissionConfig.upsert({
          where: { doctorId },
          update: {
            orthoPct,
            defectPct,
            surgeryPct,
            generalPct,
          },
          create: {
            doctorId,
            orthoPct,
            defectPct,
            surgeryPct,
            generalPct,
          },
        });
      }
    });

    return res.json({ success: true, message: "Staff income settings saved successfully" });
  } catch (error) {
    console.error("PUT /api/admin/staff-income-settings failed:", error);
    return res.status(500).json({ error: "Failed to save staff income settings." });
  }
});

export default router;
