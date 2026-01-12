import express from "express";
import prisma from "../../db.js";

const router = express.Router();

router.get("/staff-income-settings", async (_req, res) => {
  try {
    // Load doctors
    const doctors = await prisma.user.findMany({
      where: { role: "doctor" }, // adjust to your enum if needed
      select: { id: true, name: true, branchId: true },
      orderBy: { name: "asc" },
    });

    // Load configs
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

    const configByDoctorId = new Map(configs.map((c) => [c.doctorId, c]));

    const rows = doctors.map((d) => {
      const cfg = configByDoctorId.get(d.id);
      return {
        doctorId: d.id,
        doctorName: d.name,
        branchId: d.branchId,
        goalAmount: cfg?.monthlyGoalAmountMnt ?? 0,
        orthoPct: cfg?.orthoPct ?? 0,
        defectPct: cfg?.defectPct ?? 0,
        surgeryPct: cfg?.surgeryPct ?? 0,
        generalPct: cfg?.generalPct ?? 0,
        updatedAt: cfg?.updatedAt ?? null,
      };
    });

    return res.json({ doctors: rows });
  } catch (e) {
    console.error("Failed to load staff income settings", e);
    return res.status(500).json({ error: "Failed to load staff income settings" });
  }
});

export default router;
