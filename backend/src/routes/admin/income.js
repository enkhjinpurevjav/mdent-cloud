import express from "express";
import prisma from "../../db.js";

const router = express.Router();

const INCLUDED_METHODS = new Set([
  "CASH",
  "POS",
  "TRANSFER",
  "QPAY",
  "WALLET",
  "VOUCHER",
  "OTHER", // when active -> treated as CASH
]);

const EXCLUDED_METHODS = new Set(["EMPLOYEE_BENEFIT"]);

const OVERRIDE_METHODS = new Set(["INSURANCE", "APPLICATION"]);

// Home bleaching: serviceId=110 (Service.code=151)
const HOME_BLEACHING_SERVICE_ID = 110;

function inRange(ts, start, end) {
  return ts >= start && ts < end;
}

router.get("/doctors-income", async (req, res) => {
  const { startDate, endDate, branchId } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate and endDate are required parameters." });
  }

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  try {
    // Settings: home bleaching deduction amount
    const homeBleachingDeductSetting = await prisma.settings.findUnique({
      where: { key: "finance.homeBleachingDeductAmountMnt" },
    });
    const homeBleachingDeductAmountMnt = Number(homeBleachingDeductSetting?.value || 0) || 0;

    const invoices = await prisma.invoice.findMany({
      where: {
        ...(branchId ? { branchId: Number(branchId) } : {}),
        OR: [
          { createdAt: { gte: start, lt: endExclusive } },
          { payments: { some: { timestamp: { gte: start, lt: endExclusive } } } },
        ],
      },
      include: {
        encounter: {
          include: {
            doctor: {
              include: {
                branch: true,
                commissionConfig: true,
              },
            },
          },
        },
        items: {
          include: { service: true },
        },
        payments: true,
      },
    });

    const byDoctor = new Map();

    for (const inv of invoices) {
      const doctor = inv.encounter?.doctor;
      if (!doctor) continue;

      const cfg = doctor.commissionConfig;
      const doctorId = doctor.id;

      if (!byDoctor.has(doctorId)) {
        byDoctor.set(doctorId, {
          doctorId,
          doctorName: doctor.name,
          branchName: doctor.branch?.name,
          startDate: String(startDate),
          endDate: String(endDate),

          doctorSalesMnt: 0,
          doctorIncomeMnt: 0,
          monthlyGoalAmountMnt: Number(cfg?.monthlyGoalAmountMnt || 0),
        });
      }

      const acc = byDoctor.get(doctorId);

      const payments = inv.payments || [];
      const hasOverride = payments.some((p) => OVERRIDE_METHODS.has(String(p.method).toUpperCase()));

      // ---------- service net after discount via multiplier ----------
      const totalBefore = Number(inv.totalBeforeDiscount || 0);
      const finalAmount = Number(inv.finalAmount || 0);
      const netMultiplier = totalBefore > 0 ? finalAmount / totalBefore : 0;

      const serviceItems = (inv.items || []).filter((it) => it.itemType === "SERVICE");
      const serviceGross = serviceItems.reduce(
        (sum, it) => sum + Number(it.lineTotal || it.unitPrice * it.quantity || 0),
        0
      );
      const serviceNetAfterDiscount = serviceGross * netMultiplier;

      // ---------- SALES ----------
      if (hasOverride) {
        // insurance/application override: invoice-based, only when invoice PAID
        const status = String(inv.statusLegacy || "").toLowerCase();
        if (status === "paid") {
          acc.doctorSalesMnt += serviceNetAfterDiscount * 0.9;
        }
      } else {
        // payment-split based by Payment.timestamp in range
        let included = 0;
        let barterSum = 0;

        for (const p of payments) {
          const method = String(p.method || "").toUpperCase();
          const ts = new Date(p.timestamp);
          if (!inRange(ts, start, endExclusive)) continue;

          const amt = Number(p.amount || 0);

          if (EXCLUDED_METHODS.has(method)) continue;

          if (method === "BARTER") {
            barterSum += amt;
            continue;
          }

          if (INCLUDED_METHODS.has(method)) {
            included += amt;
          }
        }

        const barterIncluded = Math.max(0, barterSum - 800000);
        acc.doctorSalesMnt += included + barterIncluded;

        // barter also contributes to income via generalPct
        const generalPct = Number(cfg?.generalPct || 0);
        acc.doctorIncomeMnt += barterIncluded * (generalPct / 100);
      }

      // ---------- INCOME (Phase A: invoice-based, PAID invoices by invoice.createdAt range) ----------
      // We still apply override feeMultiplier to income base if INSURANCE/APPLICATION exists.
      const status = String(inv.statusLegacy || "").toLowerCase();
      if (status === "paid" && inv.createdAt >= start && inv.createdAt < endExclusive) {
        const orthoPct = Number(cfg?.orthoPct || 0);
        const defectPct = Number(cfg?.defectPct || 0);
        const surgeryPct = Number(cfg?.surgeryPct || 0);
        const generalPct = Number(cfg?.generalPct || 0);

        const feeMultiplier = hasOverride ? 0.9 : 1;

        for (const it of serviceItems) {
          const lineGross = Number(it.lineTotal || it.unitPrice * it.quantity || 0);
          const lineNet = lineGross * netMultiplier * feeMultiplier;

          const service = it.service;

          // 1) X-ray rule: all IMAGING category is x-ray -> 5%
          if (service?.category === "IMAGING") {
            acc.doctorIncomeMnt += lineNet * 0.05;
            continue;
          }

          // 2) Home bleaching rule: serviceId=110 (code 151)
          if (it.serviceId === HOME_BLEACHING_SERVICE_ID) {
            const base = Math.max(0, lineNet - homeBleachingDeductAmountMnt);
            acc.doctorIncomeMnt += base * (generalPct / 100);
            continue;
          }

          // 3) Default category pct mapping
          let pct = generalPct;
          if (service?.category === "ORTHODONTIC_TREATMENT") pct = orthoPct;
          else if (service?.category === "DEFECT_CORRECTION") pct = defectPct;
          else if (service?.category === "SURGERY") pct = surgeryPct;

          acc.doctorIncomeMnt += lineNet * (pct / 100);
        }
      }
    }

    const doctors = Array.from(byDoctor.values()).map((d) => {
      const goal = Number(d.monthlyGoalAmountMnt || 0);
      const sales = Number(d.doctorSalesMnt || 0);

      return {
        doctorId: d.doctorId,
        doctorName: d.doctorName,
        branchName: d.branchName,
        startDate: d.startDate,
        endDate: d.endDate,

        // Keeping legacy response keys so frontend works without changes:
        revenue: Math.round(sales),
        commission: Math.round(d.doctorIncomeMnt),
        monthlyGoal: Math.round(goal),
        progressPercent: goal > 0 ? Math.round((sales / goal) * 10000) / 100 : 0,
      };
    });

    if (!doctors.length) return res.status(404).json({ error: "No income data found." });
    return res.json(doctors);
  } catch (error) {
    console.error("Error in fetching doctor incomes:", error);
    return res.status(500).json({ error: "Failed to fetch doctor incomes." });
  }
});

export default router;
