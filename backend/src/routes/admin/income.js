import express from "express";
import prisma from "../../db.js";

const router = express.Router();

// Payment method rules
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

function bucketKeyForService(service) {
  if (!service) return "GENERAL";
  if (service.category === "IMAGING") return "IMAGING";
  if (service.category === "ORTHODONTIC_TREATMENT") return "ORTHODONTIC_TREATMENT";
  if (service.category === "DEFECT_CORRECTION") return "DEFECT_CORRECTION";
  if (service.category === "SURGERY") return "SURGERY";
  return "GENERAL";
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

          // ✅ date-only strings (no time)
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
      
      // Separate IMAGING and NON-IMAGING services for doctor sales calculation
      const nonImagingServiceItems = serviceItems.filter(
        (it) => it.service?.category !== "IMAGING"
      );
      
      const nonImagingServiceGross = nonImagingServiceItems.reduce(
        (sum, it) => sum + Number(it.lineTotal || it.unitPrice * it.quantity || 0),
        0
      );
      const nonImagingServiceNetAfterDiscount = nonImagingServiceGross * netMultiplier;

      // ---------- SALES (exclude IMAGING services) ----------
      if (hasOverride) {
        // insurance/application override: invoice-based, only when invoice PAID
        const status = String(inv.statusLegacy || "").toLowerCase();
        if (status === "paid") {
          acc.doctorSalesMnt += nonImagingServiceNetAfterDiscount * 0.9;
        }
      } else {
        // payment-split based by Payment.timestamp in range
        // Allocate payments proportionally to NON-IMAGING services only
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

        // Calculate total service value (including IMAGING) for proportional allocation
        const totalServiceGross = serviceItems.reduce(
          (sum, it) => sum + Number(it.lineTotal || it.unitPrice * it.quantity || 0),
          0
        );
        const totalServiceNet = totalServiceGross * netMultiplier;
        
        // Allocate payments proportionally to non-IMAGING services
        const nonImagingRatio = totalServiceNet > 0 
          ? nonImagingServiceNetAfterDiscount / totalServiceNet 
          : 0;
        
        const allocatedIncluded = included * nonImagingRatio;
        const barterIncluded = Math.max(0, barterSum - 800000) * nonImagingRatio;
        
        acc.doctorSalesMnt += allocatedIncluded + barterIncluded;

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

          // 1) IMAGING rule: exclude from doctor income (0%)
          if (service?.category === "IMAGING") {
            // IMAGING services contribute 0 to doctor income
            continue;
          }

          // 2) Home bleaching rule: serviceId=110 (code 151)
          // NOTE: this subtracts per line item.
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

router.get("/doctors-income/:doctorId/details", async (req, res) => {
  const { doctorId } = req.params;
  const { startDate, endDate } = req.query;

  if (!doctorId || !startDate || !endDate) {
    return res.status(400).json({
      error: "doctorId, startDate, and endDate are required parameters.",
    });
  }

  const start = new Date(`${String(startDate)}T00:00:00.000Z`);
  const endExclusive = new Date(`${String(endDate)}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const DOCTOR_ID = Number(doctorId);

  const LABELS = {
    IMAGING: "Зураг авах",
    ORTHODONTIC_TREATMENT: "Гажиг заслын эмчилгээ",
    DEFECT_CORRECTION: "Согог засал",
    SURGERY: "Мэс засал",
    GENERAL: "Ерөнхий",
    BARTER_EXCESS: "Бартер (800,000₮-с дээш)",
  };

  function initBuckets(cfg) {
    return {
      IMAGING: { key: "IMAGING", label: LABELS.IMAGING, salesMnt: 0, incomeMnt: 0, pctUsed: 0 },
      ORTHODONTIC_TREATMENT: {
        key: "ORTHODONTIC_TREATMENT",
        label: LABELS.ORTHODONTIC_TREATMENT,
        salesMnt: 0,
        incomeMnt: 0,
        pctUsed: Number(cfg?.orthoPct || 0),
      },
      DEFECT_CORRECTION: {
        key: "DEFECT_CORRECTION",
        label: LABELS.DEFECT_CORRECTION,
        salesMnt: 0,
        incomeMnt: 0,
        pctUsed: Number(cfg?.defectPct || 0),
      },
      SURGERY: {
        key: "SURGERY",
        label: LABELS.SURGERY,
        salesMnt: 0,
        incomeMnt: 0,
        pctUsed: Number(cfg?.surgeryPct || 0),
      },
      GENERAL: {
        key: "GENERAL",
        label: LABELS.GENERAL,
        salesMnt: 0,
        incomeMnt: 0,
        pctUsed: Number(cfg?.generalPct || 0),
      },
      BARTER_EXCESS: {
        key: "BARTER_EXCESS",
        label: LABELS.BARTER_EXCESS,
        salesMnt: 0,
        incomeMnt: 0,
        pctUsed: Number(cfg?.generalPct || 0),
      },
    };
  }

  try {
    // Settings: home bleaching deduction amount
    const homeBleachingDeductSetting = await prisma.settings.findUnique({
      where: { key: "finance.homeBleachingDeductAmountMnt" },
    });
    const homeBleachingDeductAmountMnt = Number(homeBleachingDeductSetting?.value || 0) || 0;

    const invoices = await prisma.invoice.findMany({
      where: {
        encounter: { doctorId: DOCTOR_ID },
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
                commissionConfig: true,
              },
            },
          },
        },
        items: { include: { service: true } },
        payments: true,
      },
    });

    const cfg = invoices?.[0]?.encounter?.doctor?.commissionConfig || null;
    const buckets = initBuckets(cfg);

    let totalSalesMnt = 0;
    let totalIncomeMnt = 0;

    for (const inv of invoices) {
      const payments = inv.payments || [];
      const hasOverride = payments.some((p) => OVERRIDE_METHODS.has(String(p.method).toUpperCase()));

      const status = String(inv.statusLegacy || "").toLowerCase();
      const isPaid = status === "paid";

      const totalBefore = Number(inv.totalBeforeDiscount || 0);
      const finalAmount = Number(inv.finalAmount || 0);
      const netMultiplier = totalBefore > 0 ? finalAmount / totalBefore : 0;

      const serviceItems = (inv.items || []).filter((it) => it.itemType === "SERVICE");
      if (!serviceItems.length) continue;

      const invoiceCategoryNet = {
        IMAGING: 0,
        ORTHODONTIC_TREATMENT: 0,
        DEFECT_CORRECTION: 0,
        SURGERY: 0,
        GENERAL: 0,
      };

      for (const it of serviceItems) {
        const lineGross = Number(it.lineTotal || it.unitPrice * it.quantity || 0);
        const lineNet = lineGross * netMultiplier;
        const k = bucketKeyForService(it.service);
        invoiceCategoryNet[k] += lineNet;
      }

      const invoiceServiceNet =
        invoiceCategoryNet.IMAGING +
        invoiceCategoryNet.ORTHODONTIC_TREATMENT +
        invoiceCategoryNet.DEFECT_CORRECTION +
        invoiceCategoryNet.SURGERY +
        invoiceCategoryNet.GENERAL;

      // Calculate non-IMAGING service net for doctor sales allocation
      const invoiceNonImagingServiceNet =
        invoiceCategoryNet.ORTHODONTIC_TREATMENT +
        invoiceCategoryNet.DEFECT_CORRECTION +
        invoiceCategoryNet.SURGERY +
        invoiceCategoryNet.GENERAL;

      // ---------- SALES (category-first, exclude IMAGING) ----------
      if (hasOverride) {
        if (isPaid && inv.createdAt >= start && inv.createdAt < endExclusive) {
          const invoiceSalesBase = invoiceNonImagingServiceNet * 0.9;
          if (invoiceNonImagingServiceNet > 0) {
            for (const k of Object.keys(invoiceCategoryNet)) {
              if (k === "IMAGING") continue; // Skip IMAGING for sales
              const share = invoiceCategoryNet[k] / invoiceNonImagingServiceNet;
              const amt = invoiceSalesBase * share;
              buckets[k].salesMnt += amt;
              totalSalesMnt += amt;
            }
          }
        }
      } else {
        let includedPayments = 0;
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
            includedPayments += amt;
          }
        }

        const barterExcess = Math.max(0, barterSum - 800000);

        // Calculate non-IMAGING ratio once for both includedPayments and barterExcess
        const nonImagingRatio = invoiceServiceNet > 0 
          ? invoiceNonImagingServiceNet / invoiceServiceNet 
          : 0;

        // allocate only includedPayments proportionally to NON-IMAGING services
        if (invoiceServiceNet > 0 && includedPayments !== 0) {
          const allocatedIncluded = includedPayments * nonImagingRatio;
          
          if (invoiceNonImagingServiceNet > 0) {
            for (const k of Object.keys(invoiceCategoryNet)) {
              if (k === "IMAGING") continue; // Skip IMAGING for sales
              const share = invoiceCategoryNet[k] / invoiceNonImagingServiceNet;
              const amt = allocatedIncluded * share;
              buckets[k].salesMnt += amt;
              totalSalesMnt += amt;
            }
          }
        }

        // barter excess separate row (also exclude IMAGING proportion)
        if (barterExcess > 0) {
          const allocatedBarterExcess = barterExcess * nonImagingRatio;
          buckets.BARTER_EXCESS.salesMnt += allocatedBarterExcess;
          totalSalesMnt += allocatedBarterExcess;

          const generalPct = Number(cfg?.generalPct || 0);
          const barterIncome = allocatedBarterExcess * (generalPct / 100);
          buckets.BARTER_EXCESS.incomeMnt += barterIncome;
          totalIncomeMnt += barterIncome;
        }
      }

      // ---------- INCOME (invoice-based, category-first) ----------
      if (isPaid && inv.createdAt >= start && inv.createdAt < endExclusive) {
        const orthoPct = Number(cfg?.orthoPct || 0);
        const defectPct = Number(cfg?.defectPct || 0);
        const surgeryPct = Number(cfg?.surgeryPct || 0);
        const generalPct = Number(cfg?.generalPct || 0);

        const feeMultiplier = hasOverride ? 0.9 : 1;

        for (const it of serviceItems) {
          const lineGross = Number(it.lineTotal || it.unitPrice * it.quantity || 0);
          const lineNet = lineGross * netMultiplier * feeMultiplier;

          const service = it.service;

          // IMAGING -> 0% (excluded from doctor income)
          if (service?.category === "IMAGING") {
            // IMAGING services contribute 0 to doctor income
            continue;
          }

          // Home bleaching -> deduct then generalPct (income only)
          if (it.serviceId === HOME_BLEACHING_SERVICE_ID) {
            const base = Math.max(0, lineNet - homeBleachingDeductAmountMnt);
            const income = base * (generalPct / 100);
            buckets.GENERAL.incomeMnt += income;
            totalIncomeMnt += income;
            continue;
          }

          const k = bucketKeyForService(service);

          let pct = generalPct;
          if (k === "ORTHODONTIC_TREATMENT") pct = orthoPct;
          else if (k === "DEFECT_CORRECTION") pct = defectPct;
          else if (k === "SURGERY") pct = surgeryPct;

          const income = lineNet * (pct / 100);
          buckets[k].incomeMnt += income;
          totalIncomeMnt += income;
        }
      }
    }

    const categories = [
      buckets.IMAGING,
      buckets.ORTHODONTIC_TREATMENT,
      buckets.DEFECT_CORRECTION,
      buckets.SURGERY,
      buckets.GENERAL,
      buckets.BARTER_EXCESS,
    ].map((r) => ({
      ...r,
      salesMnt: Math.round(r.salesMnt),
      incomeMnt: Math.round(r.incomeMnt),
      pctUsed: Number(r.pctUsed || 0),
    }));

    return res.json({
      doctorId: DOCTOR_ID,
      startDate: String(startDate),
      endDate: String(endDate),
      categories,
      totals: {
        totalSalesMnt: Math.round(totalSalesMnt),
        totalIncomeMnt: Math.round(totalIncomeMnt),
      },
    });
  } catch (error) {
    console.error("Error in fetching category income breakdown:", error);
    return res.status(500).json({ error: "Failed to fetch detailed income breakdown." });
  }
});

export default router;
