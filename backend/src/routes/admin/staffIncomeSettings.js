import express from "express";
import prisma from "../../db.js";

const router = express.Router();

/**
 * GET /api/admin/staff-income-settings
 *
 * Returns:
 * - doctors: list of doctors with their goal + commission %
 * - (optional) any global settings you later add
 */
router.get("/staff-income-settings", async (_req, res) => {
  try {
    // Adjust roles if your enum uses different values
    const doctors = await prisma.user.findMany({
      where: { role: "doctor" },
      orderBy: [{ calendarOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        branchId: true,
        generalPct: true,
        monthlyGoalAmountMnt: true,
      },
    });

    return res.json({
      doctors,
    });
  } catch (e) {
    console.error("Failed to load staff income settings", e);
    return res.status(500).json({ error: "Failed to load staff income settings" });
  }
});

export default router;
