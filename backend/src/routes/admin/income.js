import express from "express";
import prisma from "../../db.js";

const router = express.Router();

router.get("/doctors-income", async (req, res) => {
  const { startDate, endDate, branchId } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate and endDate are required parameters." });
  }

  try {
    const doctors = await prisma.$queryRaw`
      SELECT 
        d."id" AS "doctorId",
        d."name" AS "doctorName",
        b."name" AS "branchName",

        -- ✅ date-only strings (no time)
        TO_CHAR(${startDate}::date, 'YYYY-MM-DD') AS "startDate",
        TO_CHAR(${endDate}::date, 'YYYY-MM-DD') AS "endDate",

        SUM(i."finalAmount") AS "revenue",

        SUM(ii."unitPrice" * ii."quantity" * COALESCE(cfg."generalPct", 0) / 100) AS "commission",
        COALESCE(cfg."monthlyGoalAmountMnt", 0) AS "monthlyGoal",

        CASE
          WHEN COALESCE(cfg."monthlyGoalAmountMnt", 0) > 0
            THEN ROUND((SUM(i."finalAmount") / COALESCE(cfg."monthlyGoalAmountMnt", 0))::numeric * 100, 2)
          ELSE 0
        END AS "progressPercent"

      FROM public."Invoice" i
      INNER JOIN public."InvoiceItem" ii ON ii."invoiceId" = i."id"
      INNER JOIN public."Encounter" e ON e."id" = i."encounterId"
      INNER JOIN public."User" d ON d."id" = e."doctorId"
      INNER JOIN public."Branch" b ON b."id" = d."branchId"
      LEFT JOIN public."DoctorCommissionConfig" cfg ON cfg."doctorId" = d."id"

      WHERE 
        LOWER(i."status") = 'paid'
        AND i."createdAt" >= ${startDate}::date
        AND i."createdAt" < (${endDate}::date + interval '1 day')
        AND (COALESCE(${branchId}::text, '') = '' OR b."id" = ${branchId}::int)

      GROUP BY
        d."id",
        d."name",
        b."name",
        cfg."monthlyGoalAmountMnt",
        ${startDate}::date,
        ${endDate}::date
    `;

    if (!doctors || doctors.length === 0) {
      return res.status(404).json({ error: "No income data found." });
    }

    return res.json(doctors);
  } catch (error) {
    console.error("Error in fetching doctor incomes:", error);
    return res.status(500).json({ error: "Failed to fetch doctor incomes." });
  }
});

router.get("/doctors-income/:doctorId/details", async (req, res) => {
  const { doctorId } = req.params;
  const { startDate, endDate } = req.query;

  if (!doctorId || !startDate || !endDate) {
    return res.status(400).json({
      error: "doctorId, startDate, and endDate are required parameters.",
    });
  }

  try {
    const breakdown = await prisma.$queryRaw`
      SELECT 
        ii."name" AS "itemName",
        ii."itemType" AS "itemType",
        SUM(ii."unitPrice" * ii."quantity") AS "revenue",
        COALESCE(cfg."generalPct", 0) AS "commissionPercent",
        SUM(ii."unitPrice" * ii."quantity" * COALESCE(cfg."generalPct", 0) / 100) AS "doctorShare"
      FROM public."Invoice" i
      INNER JOIN public."InvoiceItem" ii ON ii."invoiceId" = i."id"
      INNER JOIN public."Encounter" e ON e."id" = i."encounterId"
      INNER JOIN public."User" d ON d."id" = e."doctorId"
      LEFT JOIN public."DoctorCommissionConfig" cfg ON cfg."doctorId" = d."id"
      WHERE 
        LOWER(i."status") = 'paid'
        AND i."createdAt" >= ${startDate}::date
        AND i."createdAt" < (${endDate}::date + interval '1 day')
        AND d."id" = ${Number(doctorId)}::int
      GROUP BY ii."name", ii."itemType", cfg."generalPct"
      ORDER BY "revenue" DESC
    `;

    const totals = (breakdown || []).reduce(
      (acc, cur) => {
        acc.totalRevenue += Number(cur.revenue || 0);
        acc.totalDoctorShare += Number(cur.doctorShare || 0);
        return acc;
      },
      { totalRevenue: 0, totalDoctorShare: 0 }
    );

    return res.json({
      doctorId,
      startDate: String(startDate),
      endDate: String(endDate),
      breakdown,
      totals,
    });
  } catch (error) {
    console.error("Error in fetching detailed income breakdown:", error);
    return res.status(500).json({ error: "Failed to fetch detailed income breakdown." });
  }
});

export default router;
