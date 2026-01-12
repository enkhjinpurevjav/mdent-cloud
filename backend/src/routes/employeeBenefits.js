import express from "express";
import prisma from "../db.js";

const router = express.Router();

/**
 * ADMIN
 * GET /api/admin/employee-benefits
 * Must return: { employees: EmployeeBenefitRow[] }
 */
router.get("/employee-benefits", async (_req, res) => {
  try {
    const benefits = await prisma.employeeBenefit.findMany({
      orderBy: { id: "asc" },
      include: {
        employee: {
          select: {
            id: true,
            ovog: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Map DB -> frontend row shape
    const employees = benefits.map((b) => {
      const initial = Number(b.initialAmount || 0);
      const remaining = Number(b.remainingAmount || 0);
      const used = Math.max(0, initial - remaining);

      return {
        userId: b.employeeId,
        ovog: b.employee?.ovog ?? "",
        name: b.employee?.name ?? "",
        email: b.employee?.email ?? "",
        role: b.employee?.role ?? "",

        benefitId: b.id,
        code: b.code,
        initialAmount: initial,
        remainingAmount: remaining,
        fromDate: b.fromDate,
        toDate: b.toDate,
        isActive: b.isActive,

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

// (keep your existing verify routes below)
router.post("/employee-benefit/verify", async (req, res) => {
  const body = req.body || {};
  const code = body.code;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "code is required" });
  }

  try {
    const benefit = await prisma.employeeBenefit.findFirst({
      where: {
        code: code.trim(),
        isActive: true,
        OR: [{ fromDate: null }, { fromDate: { lte: new Date() } }],
        OR: [{ toDate: null }, { toDate: { gte: new Date() } }],
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

router.post("/voucher/verify", async (req, res) => {
  // unchanged...
});

export default router;
