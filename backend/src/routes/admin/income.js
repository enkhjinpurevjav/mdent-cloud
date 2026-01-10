import express from "express";
import prisma from "../../db.js"; // Prisma client for database access

const router = express.Router();

// General income report
router.get("/doctors-income", async (req, res) => {
  const { startDate, endDate, branchId } = req.query;
  console.log("Received filters:", { startDate, endDate, branchId });

  try {
    const doctors = await prisma.$queryRaw`
      SELECT d.id AS doctorId, d.name AS doctorName, b.name AS branchName, 
            SUM(i.totalAmount) AS revenue, 
            SUM(ii.price * ii.quantity * d.generalPct / 100) AS commission, 
            d.monthlyGoalAmountMnt AS monthlyGoal
      FROM Invoice i
      INNER JOIN InvoiceItem ii ON ii.invoiceId = i.id
      INNER JOIN Encounter e ON e.id = i.encounterId
      INNER JOIN User d ON d.id = e.doctorId
      INNER JOIN Branch b ON b.id = d.branchId
      WHERE i.status = 'paid' 
        AND i.createdAt BETWEEN ${startDate} AND ${endDate}
        AND (b.id = ${branchId} OR ${branchId} IS NULL)
      GROUP BY d.id, d.name, b.name, d.monthlyGoalAmountMnt;
    `;
    res.json(doctors);
  } catch (error) {
    console.error("Query error:", error);
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
