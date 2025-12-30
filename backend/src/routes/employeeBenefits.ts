import express from "express";
import { prisma } from "../prismaClient"; // adjust import

const router = express.Router();

// POST /api/billing/employee-benefit/verify
router.post("/employee-benefit/verify", async (req, res) => {
  const { code, invoiceId, encounterId } = req.body || {};

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "code is required" });
  }

  try {
    const benefit = await prisma.employeeBenefit.findFirst({
      where: {
        code: code.trim(),
        isActive: true,
        OR: [
          { fromDate: null },
          { fromDate: { lte: new Date() } },
        ],
        OR: [
          { toDate: null },
          { toDate: { gte: new Date() } },
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
      employeeName: benefit.employee.name,
      remainingAmount: benefit.remainingAmount,
    });
  } catch (e) {
    console.error("Failed to verify employee benefit code", e);
    return res.status(500).json({ error: "Серверийн алдаа." });
  }
});

export default router;
