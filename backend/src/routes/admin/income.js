import express from "express";
import prisma from "../../db.js";

const router = express.Router();

/**
 * GET /api/admin/doctors-income
 * General doctor income report
 * Filters:
 * - startDate (required)
 * - endDate (required)
 * - branchId (optional, null for "Бүх салбар")
 */
router.get("/doctors-income", async (req, res) => {
  const { startDate, endDate, branchId } = req.query;

  // Validation: Ensure startDate and endDate are provided
  if (!startDate || !endDate) {
    return res
      .status(400)
      .json({ error: "startDate and endDate are required parameters." });
  }

  console.log("Received filters:", { startDate, endDate, branchId });

  try {
    const doctors = await prisma.$queryRaw`
      SELECT 
        d.id AS doctorId,
        d.name AS doctorName,
        b.name AS branchName,
        SUM(i."totalAmount") AS revenue,
        SUM(ii."price" * ii."quantity" * d."generalPct" / 100) AS commission,
        d."monthlyGoalAmountMnt" AS monthlyGoal,
        CASE
          WHEN d."monthlyGoalAmountMnt" > 0 THEN ROUND(SUM(i."totalAmount") / d."monthlyGoalAmountMnt" * 100, 2)
          ELSE 0
        END AS progressPercent
      FROM 
        public."Invoice" i
      INNER JOIN 
        public."InvoiceItem" ii ON ii."invoiceId" = i."id"
      INNER JOIN 
        public."Encounter" e ON e."id" = i."encounterId"
      INNER JOIN 
        public."User" d ON d."id" = e."doctorId"
      INNER JOIN 
        public."Branch" b ON b."id" = d."branchId"
      WHERE 
        i."status" = 'paid'
        AND i."createdAt" BETWEEN ${startDate} AND ${endDate}
        AND (${branchId ? `b."id" = ${branchId}` : 'TRUE'})
      GROUP BY 
        d."id", d."name", b."name", d."monthlyGoalAmountMnt";
    `;

    if (!doctors || doctors.length === 0) {
      console.log("No data found for filters:", { startDate, endDate, branchId });
      return res.status(404).json({ error: "No income data found." });
    }

    console.log("Fetched doctor income data:", doctors);
    res.json(doctors);
  } catch (error) {
    console.error("Error in fetching doctor incomes:", error);
    return res.status(500).json({ error: "Failed to fetch doctor incomes." });
  }
});

/**
 * GET /api/admin/doctors-income/:doctorId/details
 * Detailed breakdown of income for a single doctor
 * Filters:
 * - startDate (required)
 * - endDate (required)
 * - doctorId (path parameter, required)
 */
router.get("/doctors-income/:doctorId/details", async (req, res) => {
  const { doctorId } = req.params;
  const { startDate, endDate } = req.query;

  // Validation: Ensure required parameters are present
  if (!doctorId || !startDate || !endDate) {
    return res
      .status(400)
      .json({ error: "doctorId, startDate, and endDate are required parameters." });
  }

  console.log("Fetching detailed breakdown for:", { doctorId, startDate, endDate });

  try {
    const breakdown = await prisma.$queryRaw`
      SELECT 
        p."name" AS procedureName,
        SUM(ii."price" * ii."quantity") AS revenue,
        d."generalPct" AS commissionPercent,
        SUM(ii."price" * ii."quantity" * d."generalPct" / 100) AS doctorShare
      FROM 
        public."Invoice" i
      INNER JOIN 
        public."InvoiceItem" ii ON ii."invoiceId" = i."id"
      INNER JOIN 
        public."Procedure" p ON p."id" = ii."procedureId"
      INNER JOIN 
        public."Encounter" e ON e."id" = i."encounterId"
      INNER JOIN 
        public."User" d ON d."id" = e."doctorId"
      WHERE 
        i."status" = 'paid'
        AND i."createdAt" BETWEEN ${startDate} AND ${endDate}
        AND d."id" = ${doctorId}
      GROUP BY 
        p."name", d."generalPct";
    `;

    const totals = breakdown.reduce(
      (acc, cur) => {
        acc.totalRevenue += cur.revenue;
        acc.totalDoctorShare += cur.doctorShare;
        return acc;
      },
      { totalRevenue: 0, totalDoctorShare: 0 }
    );

    console.log("Fetched detailed income breakdown:", breakdown);

    res.json({
      doctorId: doctorId,
      startDate,
      endDate,
      breakdown,
      totals: {
        totalRevenue: totals.totalRevenue,
        totalDoctorShare: totals.totalDoctorShare,
      },
    });
  } catch (error) {
    console.error("Error in fetching detailed income breakdown:", error);
    return res.status(500).json({ error: "Failed to fetch detailed income breakdown." });
  }
});

export default router;
