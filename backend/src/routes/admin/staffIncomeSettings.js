import express from "express";
import prisma from "../../db.js";

const router = express.Router();

// This should match what you already have in DB (image7)
const WHITENING_KEY = "finance.homeBleachingDeductAmountMnt";

async function loadWhiteningDeductAmountMnt() {
  const row = await prisma.settings.findFirst({
    where: { key: WHITENING_KEY },
    select: { value: true },
  });

  const n = Number(row?.value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function saveWhiteningDeductAmountMnt(valueNumber) {
  // value is TEXT in DB, so store as string
  const value = String(valueNumber);

  const existing = await prisma.settings.findFirst({
    where: { key: WHITENING_KEY },
    select: { id: true },
  });

  if (existing) {
    await prisma.settings.update({
      where: { id: existing.id },
      data: { value },
    });
  } else {
    await prisma.settings.create({
      data: { key: WHITENING_KEY, value },
    });
  }
}

/**
 * GET /api/admin/staff-income-settings
 */
router.get("/staff-income-settings", async (_req, res) => {
  try {
    const whiteningDeductAmountMnt = await loadWhiteningDeductAmountMnt();

    // If your role values are uppercase (DOCTOR), change here.
    const doctors = await prisma.user.findMany({
      where: { role: "doctor" },
      select: { id: true, ovog: true, name: true, email: true },
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
    return res.status(500).json({ error: e?.message || "Failed to load staff income settings" });
  }
});

/**
 * PUT /api/admin/staff-income-settings
 */
router.put("/staff-income-settings", async (req, res) => {
  try {
    const body = req.body || {};
    const whitening = Number(body.whiteningDeductAmountMnt ?? 0);
    const doctors = Array.isArray(body.doctors) ? body.doctors : [];

    if (!Number.isFinite(whitening) || whitening < 0) {
      return res.status(400).json({ error: "whiteningDeductAmountMnt must be >= 0" });
    }

    // Persist whitening to Settings table
    await saveWhiteningDeductAmountMnt(whitening);

    // Persist doctors configs
    for (const d of doctors) {
      const doctorId = Number(d.doctorId);
      if (!doctorId || !Number.isFinite(doctorId)) continue;

      const orthoPct = Number(d.orthoPct ?? 0);
      const defectPct = Number(d.defectPct ?? 0);
      const surgeryPct = Number(d.surgeryPct ?? 0);
      const generalPct = Number(d.generalPct ?? 0);
      const monthlyGoalAmountMnt = Number(d.monthlyGoalAmountMnt ?? 0);

      const pcts = [orthoPct, defectPct, surgeryPct, generalPct];
      if (pcts.some((x) => !Number.isFinite(x) || x < 0)) {
        return res.status(400).json({ error: "Percent values must be >= 0 numbers" });
      }
      if (!Number.isFinite(monthlyGoalAmountMnt) || monthlyGoalAmountMnt < 0) {
        return res.status(400).json({ error: "monthlyGoalAmountMnt must be >= 0" });
      }

      await prisma.doctorCommissionConfig.upsert({
        where: { doctorId },
        update: { orthoPct, defectPct, surgeryPct, generalPct, monthlyGoalAmountMnt },
        create: { doctorId, orthoPct, defectPct, surgeryPct, generalPct, monthlyGoalAmountMnt },
      });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("Failed to save staff income settings", e);
    return res.status(500).json({ error: e?.message || "Failed to save staff income settings" });
  }
});

export default router;
