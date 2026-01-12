import express from "express";
import prisma from "../db.js";

const router = express.Router();

/**
 * ADMIN
 * GET /api/admin/employee-benefits
 * Returns employee benefit records for admin UI.
 */
router.get("/employee-benefits", async (_req, res) => {
  try {
    const benefits = await prisma.employeeBenefit.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            branchId: true,
          },
        },
      },
    });

    return res.json(benefits);
  } catch (e) {
    console.error("Failed to load employee benefits", e);
    return res.status(500).json({ error: "Failed to load employee benefits" });
  }
});

// POST /api/billing/employee-benefit/verify
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
        error:
          "GIFT төрлийн бэлгийн картын backend логик хараахан хийгдээгүй байна.",
      });
    }

    return res.status(400).json({ error: "Invalid voucher request." });
  } catch (e) {
    console.error("Failed to verify voucher code", e);
    return res.status(500).json({ error: "Серверийн алдаа." });
  }
});

export default router;
