import express from "express";
import prisma from "../db.js";

const router = express.Router();

/**
 * =========================
 * ADMIN: Employee vouchers page
 * =========================
 * Frontend (employee-vouchers.tsx) expects:
 * - GET    /api/admin/employee-benefits        -> { employees: EmployeeBenefitRow[] }
 * - POST   /api/admin/employee-benefits        -> create benefit
 * - PATCH  /api/admin/employee-benefits/:id    -> update benefit
 * - DELETE /api/admin/employee-benefits/:userId -> deactivate benefits for employee
 */

/**
 * GET /api/admin/employee-benefits
 * Returns rows for "Ажилчдын ваучер" admin page.
 *
 * Note:
 * - UI uses key={userId} so it expects (roughly) one row per employee.
 * - If multiple benefits exist per employee, we return the latest (by updatedAt/createdAt/id).
 */
router.get("/employee-benefits", async (_req, res) => {
  try {
    const benefits = await prisma.employeeBenefit.findMany({
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            // Do NOT select 'ovog' here unless you are 100% sure the column exists in Prisma schema.
          },
        },
      },
    });

    // Keep only the latest benefit per employeeId (because frontend key = userId)
    const latestByEmployee = new Map();
    for (const b of benefits) {
      if (!latestByEmployee.has(b.employeeId)) {
        latestByEmployee.set(b.employeeId, b);
      }
    }

    const employees = Array.from(latestByEmployee.values()).map((b) => {
      const initial = Number(b.initialAmount || 0);
      const remaining = Number(b.remainingAmount || 0);
      const used = Math.max(0, initial - remaining);

      return {
        userId: b.employeeId,
        ovog: "", // frontend supports this field but it may not exist in DB; keep empty for compatibility
        name: b.employee?.name ?? "",
        email: b.employee?.email ?? "",
        role: b.employee?.role ?? "",

        benefitId: b.id,
        code: b.code,
        initialAmount: initial,
        remainingAmount: remaining,
        fromDate: b.fromDate,
        toDate: b.toDate,
        isActive: !!b.isActive,

        totalAmount: initial,
        usedAmount: used,

        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      };
    });

    return res.json({ employees });
  } catch (e) {
    console.error("Failed to load employee benefits", e);
    return res.status(500).json({ error: "Failed to load employee benefits" });
  }
});

/**
 * POST /api/admin/employee-benefits
 * Body: { employeeId: number, code: string, initialAmount: number }
 */
router.post("/employee-benefits", async (req, res) => {
  try {
    const body = req.body || {};
    const employeeId = Number(body.employeeId);
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const initialAmount = Number(body.initialAmount);

    if (!employeeId || !Number.isFinite(employeeId)) {
      return res.status(400).json({ error: "employeeId is required" });
    }
    if (!code) {
      return res.status(400).json({ error: "code is required" });
    }
    if (!Number.isFinite(initialAmount) || initialAmount <= 0) {
      return res.status(400).json({ error: "initialAmount must be > 0" });
    }

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const existing = await prisma.employeeBenefit.findFirst({
      where: { code },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({ error: "Энэ код аль хэдийн бүртгэгдсэн байна." });
    }

    const created = await prisma.employeeBenefit.create({
      data: {
        employeeId,
        code,
        initialAmount,
        remainingAmount: initialAmount,
        isActive: true,
      },
      select: { id: true },
    });

    return res.json({ ok: true, benefitId: created.id });
  } catch (e) {
    console.error("Failed to add employee benefit", e);
    return res.status(500).json({ error: "Failed to add benefit" });
  }
});

/**
 * PATCH /api/admin/employee-benefits/:benefitId
 * Body: { code, initialAmount, remainingAmount, fromDate, toDate, isActive }
 */
router.patch("/employee-benefits/:benefitId", async (req, res) => {
  try {
    const benefitId = Number(req.params.benefitId);
    if (!benefitId || !Number.isFinite(benefitId)) {
      return res.status(400).json({ error: "Invalid benefitId" });
    }

    const body = req.body || {};
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const initialAmount = Number(body.initialAmount);
    const remainingAmount = Number(body.remainingAmount);
    const fromDate = body.fromDate ? new Date(body.fromDate) : null;
    const toDate = body.toDate ? new Date(body.toDate) : null;
    const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

    if (!code) return res.status(400).json({ error: "code is required" });
    if (!Number.isFinite(initialAmount) || initialAmount <= 0) {
      return res.status(400).json({ error: "initialAmount must be > 0" });
    }
    if (!Number.isFinite(remainingAmount) || remainingAmount < 0) {
      return res.status(400).json({ error: "remainingAmount must be >= 0" });
    }
    if (remainingAmount > initialAmount) {
      return res.status(400).json({ error: "remainingAmount cannot exceed initialAmount" });
    }

    const dup = await prisma.employeeBenefit.findFirst({
      where: { code, NOT: { id: benefitId } },
      select: { id: true },
    });
    if (dup) {
      return res.status(409).json({ error: "Энэ код өөр ажилтанд бүртгэгдсэн байна." });
    }

    const updated = await prisma.employeeBenefit.update({
      where: { id: benefitId },
      data: {
        code,
        initialAmount,
        remainingAmount,
        fromDate,
        toDate,
        isActive,
      },
      select: { id: true },
    });

    return res.json({ ok: true, benefitId: updated.id });
  } catch (e) {
    console.error("Failed to update employee benefit", e);
    return res.status(500).json({ error: "Failed to update benefit" });
  }
});

/**
 * DELETE /api/admin/employee-benefits/:userId
 * Deactivates all benefits for the employee (removes from list in UI).
 */
router.delete("/employee-benefits/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId || !Number.isFinite(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    await prisma.employeeBenefit.updateMany({
      where: { employeeId: userId },
      data: { isActive: false },
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("Failed to remove employee benefits", e);
    return res.status(500).json({ error: "Failed to remove" });
  }
});

/**
 * =========================
 * BILLING: verify endpoints (your original code)
 * =========================
 */

// POST /api/billing/employee-benefit/verify
router.post("/employee-benefit/verify", async (req, res) => {
  const body = req.body || {};
  const code = body.code;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "code is required" });
  }

  try {
    // IMPORTANT FIX:
    // In your original snippet you had two separate "OR" keys.
    // In JS objects, the second OR overwrites the first one.
    // Correct is: AND: [ { OR: fromDate... }, { OR: toDate... } ]
    const benefit = await prisma.employeeBenefit.findFirst({
      where: {
        code: code.trim(),
        isActive: true,
        AND: [
          { OR: [{ fromDate: null }, { fromDate: { lte: new Date() } }] },
          { OR: [{ toDate: null }, { toDate: { gte: new Date() } }] },
        ],
      },
      include: {
        employee: true,
      },
    });

    if (!benefit) {
      return res
        .status(404)
        .json({ error: "Ажилтны код олдсонгүй эсвэл хүчингүй байна." });
    }

    return res.json({
      employeeId: benefit.employeeId,
      employeeName: benefit.employee ? benefit.employee.name : null,
      remainingAmount: benefit.remainingAmount,
    });
  } catch (e) {
    console.error("Failed to verify employee benefit code", e);
    return res.status(500).json({ error: "Серверийн алдаа." });
  }
});

/**
 * POST /api/billing/voucher/verify
 */
router.post("/voucher/verify", async (req, res) => {
  const body = req.body || {};
  const { type, code } = body;

  if (!type || (type !== "MARKETING" && type !== "GIFT")) {
    return res.status(400).json({
      error: "Купоны төрөл буруу. MARKETING эсвэл GIFT байх ёстой.",
    });
  }

  if (!code || typeof code !== "string") {
    return res
      .status(400)
      .json({ error: "Купон / Ваучер кодыг оруулах шаардлагатай." });
  }

  try {
    if (type === "MARKETING") {
      const MAX_VALUE = 15000;

      return res.json({
        type,
        code: code.trim(),
        maxAmount: MAX_VALUE,
      });
    }

    if (type === "GIFT") {
      return res.status(400).json({
        error: "GIFT төрлийн бэлгийн картын backend логик хараахан хийгдээгүй байна.",
      });
    }

    return res.status(400).json({ error: "Invalid voucher request." });
  } catch (e) {
    console.error("Failed to verify voucher code", e);
    return res.status(500).json({ error: "Серверийн алдаа." });
  }
});

export default router;
