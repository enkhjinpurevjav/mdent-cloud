import express from "express";
import prisma from "../../db.js"; // Prisma client for database access

const router = express.Router();

// General income report
router.get("/doctors-income", async (req, res) => {
  const { startDate, endDate, branchId } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate and endDate are required." });
  }

  try {
    const doctors = await prisma.doctor.findMany({
      where: {
        ...(branchId ? { branchId: Number(branchId) } : {}),
      },
      include: {
        branch: true,
        invoices: {
          where: {
            createdAt: { gte: new Date(startDate), lte: new Date(endDate) },
            status: "paid",
          },
        },
      },
    });

    const results = doctors.map((doctor) => {
      const revenue = doctor.invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      const commission = doctor.invoices.reduce(
        (sum, inv) =>
          sum +
          inv.invoiceItems.reduce(
            (subSum, item) => subSum + item.price * item.quantity * Number(doctor.generalPct) / 100,
            0,
          ),
        0,
      );

      return {
        doctorId: doctor.id,
        doctorName: doctor.name,
        branchName: doctor.branch?.name || null,
        startDate,
        endDate,
        revenue,
        commission,
        monthlyGoal: doctor.monthlyGoalAmountMnt || 0,
        progressPercent: Math.round((revenue / (doctor.monthlyGoalAmountMnt || 1)) * 100),
      };
    });

    res.json(results);
  } catch (error) {
    console.error("Failed to fetch doctor incomes:", error);
    res.status(500).json({ error: "Failed to fetch incomes" });
  }
});

// Detailed income breakdown per doctor
router.get("/doctors-income/:doctorId/details", async (req, res) => {
  const { doctorId } = req.params;
  const { startDate, endDate } = req.query;

  if (!doctorId || !startDate || !endDate) {
    return res.status(400).json({ error: "doctorId, startDate, and endDate are required." });
  }

  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: Number(doctorId) },
      include: {
        invoices: {
          where: {
            createdAt: { gte: new Date(startDate), lte: new Date(endDate) },
            status: "paid",
          },
          include: {
            invoiceItems: {
              include: { procedure: true },
            },
          },
        },
      },
    });

    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found." });
    }

    const breakdown = doctor.invoices.flatMap((invoice) =>
      invoice.invoiceItems.map((item) => ({
        type: item.procedure?.name || "Unknown",
        revenue: Number(item.price) * Number(item.quantity),
        percent: doctor.generalPct || 0,
        doctorShare:
          Number(item.price) * Number(item.quantity) * (Number(doctor.generalPct) / 100),
      })),
    );

    const totals = breakdown.reduce(
      (acc, cur) => {
        acc.totalRevenue += cur.revenue;
        acc.totalCommission += cur.doctorShare;
        return acc;
      },
      { totalRevenue: 0, totalCommission: 0 },
    );

    res.json({
      doctorName: doctor.name,
      startDate,
      endDate,
      breakdown,
      totals: {
        totalRevenue: totals.totalRevenue,
        totalCommission: totals.totalCommission,
        monthlyGoal: doctor.monthlyGoalAmountMnt || 0,
        progressPercent: Math.round((totals.totalRevenue / (doctor.monthlyGoalAmountMnt || 1)) * 100),
      },
    });
  } catch (error) {
    console.error("Failed to fetch detailed income:", error);
    res.status(500).json({ error: "Failed to fetch detailed income" });
  }
});

export default router;
