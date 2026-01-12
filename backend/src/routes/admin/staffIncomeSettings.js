import express from "express";
import prisma from "../../db.js";

const router = express.Router();

/**
 * GET /api/admin/staff-income-settings
 * Must match frontend shape exactly.
 */
router.get("/staff-income-settings", async (_req, res) => {
  try {
    // TODO: wire real storage later (Settings table, etc.)
    const whiteningDeductAmountMnt = 0;

    // IMPORTANT: ensure this role matches your DB values.
    // If your DB role values are uppercase, change to "DOCTOR".
    const doctors = await prisma.user.findMany({
      where: { role: "doctor" },
      select: {
        id: true,
        ovog: true,
        name: true,
        email: true,
      },
      orderBy: { name: "asc" },
    });

    const configs = await prisma.doctorCommissionConfig.findMany({
      select: {
        doctorId: true,
        orthoPct: true,
        defectPct: true,
        surgeryPct: true,
        generalPct: true,
        monthlyGoalAmountMnt: true,
        updatedAt: true,
      },
    });

    const cfgByDoctorId = new Map(configs.map((c) => [c.doctorId, c]));

    const rows = doctors.map((d) => {
      const cfg = cfgByDoctorId.get(d.id);
      return {
        doctorId: d.id,
        ovog: d.ovog ?? null,
        name: d.name ?? null,
        email: d.email ?? null,

        orthoPct: Number(cfg?.orthoPct ?? 0),
        defectPct: Number(cfg?.defectPct ?? 0),
        surgeryPct: Number(cfg?.surgeryPct ?? 0),
        generalPct: Number(cfg?.generalPct ?? 0),

        monthlyGoalAmountMnt: Number(cfg?.monthlyGoalAmountMnt ?? 0),
        configUpdatedAt: cfg?.updatedAt ?? null,
      };
    });

    return res.json({
      whiteningDeductAmountMnt,
      doctors: rows,
    });
  } catch (e) {
    console.error("Failed to load staff income settings", e);
    return res.status(500).json({ error: "Failed to load staff income settings" });
  }
});

export default router;
