/**
 * GET /api/admin/reports/appointments/doctors-income
 *
 * Doctor income + sales performance report for the admin "Эмч" report page.
 * Uses the same income and sales calculation logic as Санхүү → Эмчийн Орлогын Тайлан.
 *
 * Query params:
 *   year       (optional; default current year) — used in monthly mode
 *   startDate  (optional, YYYY-MM-DD)
 *   endDate    (optional, YYYY-MM-DD) — inclusive
 *   branchId   (optional)
 *   doctorId   (optional)
 *
 * Response:
 *   {
 *     mode: "monthly" | "daily",
 *     year, startDate, endDate,
 *     scope: { branchId, doctorId },
 *     sales: {
 *       series: [{ key, valueMnt }],
 *       totalMnt,
 *       breakdown: { type: "branches"|"doctors"|"categories", rows: [{ id, label, valueMnt, pct }] }
 *     },
 *     income: {
 *       series: [{ key, valueMnt }],
 *       totalMnt,
 *       breakdown: { type, rows: [{ id, label, valueMnt, pct }] }
 *     },
 *     avgSalesPerCompletedAppt: {
 *       series: [{ key, valueMnt }],
 *       totalMnt,
 *       completedCount,
 *       breakdown: { type, rows: [{ id, label, avgMnt, salesMnt, completedCount, pctSales }] }
 *     },
 *     filters: { branches: [...], doctors: [...] }
 *   }
 */

import express from "express";
import prisma from "../../db.js";
import {
  discountPercentEnumToNumber,
  computeServiceNetProportionalDiscount,
  allocatePaymentProportionalByRemaining,
  hasOverridePaymentMethod,
} from "../../utils/incomeHelpers.js";

const router = express.Router();

// ── Constants (keep consistent with backend/src/routes/admin/income.js) ───────
const INCLUDED_METHODS = new Set([
  "CASH",
  "POS",
  "TRANSFER",
  "QPAY",
  "WALLET",
  "VOUCHER",
  "OTHER",
]);

const EXCLUDED_METHODS = new Set(["EMPLOYEE_BENEFIT"]);
// Wallet should follow normal allocation flow; only insurance/app use override rules.
const OVERRIDE_METHODS = new Set(["INSURANCE", "APPLICATION"]);

const HOME_BLEACHING_SERVICE_CODE = 151;
const BARTER_THRESHOLD_MNT = 800_000;

const CATEGORY_LABELS = {
  IMAGING: "Зураг авах",
  ORTHODONTIC_TREATMENT: "Гажиг заслын эмчилгээ",
  DEFECT_CORRECTION: "Согог засал",
  SURGERY: "Мэс засал",
  GENERAL: "Ерөнхий",
  BARTER_EXCESS: "Бартер (800,000₮-с дээш)",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function inRange(ts, start, endExclusive) {
  return ts >= start && ts < endExclusive;
}

function bucketKeyForService(service) {
  if (!service) return "GENERAL";
  if (service.category === "IMAGING") return "IMAGING";
  if (service.category === "ORTHODONTIC_TREATMENT") return "ORTHODONTIC_TREATMENT";
  if (service.category === "DEFECT_CORRECTION") return "DEFECT_CORRECTION";
  if (service.category === "SURGERY") return "SURGERY";
  return "GENERAL";
}

function enumerateDaysInclusive(startYmd, endYmd) {
  const days = [];
  const cur = new Date(`${startYmd}T00:00:00.000Z`);
  const last = new Date(`${endYmd}T00:00:00.000Z`);
  while (cur <= last) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

function calcPct(part, total) {
  if (!total || total <= 0) return 0;
  return Math.round((part / total) * 10000) / 100;
}

/**
 * Compute income for a list of invoices in [rangeStart, rangeEndExclusive)
 * Mirrors the algorithm from admin/income.js.
 */
function computeIncomeFromInvoices(
  invoices,
  rangeStart,
  rangeEndExclusive,
  homeBleachingDeductAmountMnt
) {
  let totalIncomeMnt = 0;

  const byCategory = new Map([
    ["IMAGING", 0],
    ["ORTHODONTIC_TREATMENT", 0],
    ["DEFECT_CORRECTION", 0],
    ["SURGERY", 0],
    ["GENERAL", 0],
    ["BARTER_EXCESS", 0],
  ]);

  for (const inv of invoices) {
    const doctor = inv.encounter?.doctor;
    if (!doctor) continue;

    const cfg = doctor.commissionConfig;
    const payments = inv.payments || [];
    const hasOverride = hasOverridePaymentMethod(payments);

    const discountPct = discountPercentEnumToNumber(inv.discountPercent);

    const serviceItems = (inv.items || []).filter(
      (it) => it.itemType === "SERVICE" && it.service?.category !== "PREVIOUS"
    );
    if (!serviceItems.length) continue;

    const lineNets = computeServiceNetProportionalDiscount(serviceItems, discountPct);

    const nonImagingServiceItems = serviceItems.filter(
      (it) => it.service?.category !== "IMAGING"
    );

    const totalAllServiceNet = serviceItems.reduce(
      (sum, it) => sum + (lineNets.get(it.id) || 0),
      0
    );
    const totalNonImagingNet = nonImagingServiceItems.reduce(
      (sum, it) => sum + (lineNets.get(it.id) || 0),
      0
    );

    const nonImagingRatio =
      totalAllServiceNet > 0 ? totalNonImagingNet / totalAllServiceNet : 0;

    const itemById = new Map(serviceItems.map((it) => [it.id, it]));
    const serviceLineIds = serviceItems.map((it) => it.id);

    const remainingDue = new Map(
      serviceItems.map((it) => [it.id, lineNets.get(it.id) || 0])
    );
    const itemAllocationBase = new Map(serviceItems.map((it) => [it.id, 0]));

    let barterSum = 0;

    const sortedPayments = [...payments].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    for (const p of sortedPayments) {
      const method = String(p.method || "").toUpperCase();
      const ts = new Date(p.timestamp);

      if (!inRange(ts, rangeStart, rangeEndExclusive)) continue;
      if (EXCLUDED_METHODS.has(method)) continue;

      if (method === "BARTER") {
        barterSum += Number(p.amount || 0);
        continue;
      }

      if (!INCLUDED_METHODS.has(method) && !OVERRIDE_METHODS.has(method)) continue;

      const payAmt = Number(p.amount || 0);
      const payAllocs = p.allocations || [];

      if (payAllocs.length > 0) {
        for (const alloc of payAllocs) {
          const item = itemById.get(alloc.invoiceItemId);
          if (!item) continue;

          const allocAmt = Number(alloc.amount || 0);
          itemAllocationBase.set(
            item.id,
            (itemAllocationBase.get(item.id) || 0) + allocAmt
          );
          remainingDue.set(
            item.id,
            Math.max(0, (remainingDue.get(item.id) || 0) - allocAmt)
          );
        }
      } else {
        const allocs = allocatePaymentProportionalByRemaining(
          payAmt,
          serviceLineIds,
          remainingDue
        );
        for (const [id, amt] of allocs) {
          itemAllocationBase.set(id, (itemAllocationBase.get(id) || 0) + amt);
        }
      }
    }

    // Barter excess income (via GENERAL pct) — same as income.js
    if (!hasOverride) {
      const generalPct = Number(cfg?.generalPct || 0);
      const barterExcess = Math.max(0, barterSum - BARTER_THRESHOLD_MNT);
      if (barterExcess > 0) {
        const allocatedBarterExcess = barterExcess * nonImagingRatio;
        const barterIncome = allocatedBarterExcess * (generalPct / 100);
        byCategory.set(
          "BARTER_EXCESS",
          (byCategory.get("BARTER_EXCESS") || 0) + barterIncome
        );
        totalIncomeMnt += barterIncome;
      }
    }

    // Income per service line
    const orthoPct = Number(cfg?.orthoPct || 0);
    const defectPct = Number(cfg?.defectPct || 0);
    const surgeryPct = Number(cfg?.surgeryPct || 0);
    const generalPct = Number(cfg?.generalPct || 0);
    const imagingPct = Number(cfg?.imagingPct || 0);
    const feeMultiplier = hasOverride ? 0.9 : 1;

    for (const it of serviceItems) {
      const service = it.service;
      const lineNet = (itemAllocationBase.get(it.id) || 0) * feeMultiplier;
      if (lineNet <= 0) continue;

      if (service?.category === "IMAGING") {
        if (it.meta?.assignedTo === "DOCTOR") {
          const income = lineNet * (imagingPct / 100);
          byCategory.set("IMAGING", (byCategory.get("IMAGING") || 0) + income);
          totalIncomeMnt += income;
        }
        continue;
      }

      if (Number(service?.code) === HOME_BLEACHING_SERVICE_CODE) {
        const base = Math.max(0, lineNet - homeBleachingDeductAmountMnt);
        const income = base * (generalPct / 100);
        byCategory.set("GENERAL", (byCategory.get("GENERAL") || 0) + income);
        totalIncomeMnt += income;
        continue;
      }

      const k = bucketKeyForService(service);
      let pct = generalPct;
      if (k === "ORTHODONTIC_TREATMENT") pct = orthoPct;
      else if (k === "DEFECT_CORRECTION") pct = defectPct;
      else if (k === "SURGERY") pct = surgeryPct;

      const income = lineNet * (pct / 100);
      byCategory.set(k, (byCategory.get(k) || 0) + income);
      totalIncomeMnt += income;
    }
  }

  return { incomeMnt: totalIncomeMnt, byCategory };
}

/**
 * Compute sales for a list of invoices in [rangeStart, rangeEndExclusive)
 * Mirrors the doctorSalesMnt algorithm from admin/income.js.
 * IMAGING is excluded from sales; barter excess included proportionally.
 * Override methods (INSURANCE/APPLICATION) use totalNonImagingNet * 0.9 when paid.
 */
export function computeSalesFromInvoices(
  invoices,
  rangeStart,
  rangeEndExclusive
) {
  let totalSalesMnt = 0;

  const byCategory = new Map([
    ["IMAGING", 0],
    ["ORTHODONTIC_TREATMENT", 0],
    ["DEFECT_CORRECTION", 0],
    ["SURGERY", 0],
    ["GENERAL", 0],
    ["BARTER_EXCESS", 0],
  ]);

  for (const inv of invoices) {
    const doctor = inv.encounter?.doctor;
    if (!doctor) continue;

    const payments = inv.payments || [];
    const hasOverride = hasOverridePaymentMethod(payments);

    const discountPct = discountPercentEnumToNumber(inv.discountPercent);

    const serviceItems = (inv.items || []).filter(
      (it) => it.itemType === "SERVICE" && it.service?.category !== "PREVIOUS"
    );
    if (!serviceItems.length) continue;

    const lineNets = computeServiceNetProportionalDiscount(serviceItems, discountPct);

    const nonImagingServiceItems = serviceItems.filter(
      (it) => it.service?.category !== "IMAGING"
    );

    const totalAllServiceNet = serviceItems.reduce(
      (sum, it) => sum + (lineNets.get(it.id) || 0),
      0
    );
    const totalNonImagingNet = nonImagingServiceItems.reduce(
      (sum, it) => sum + (lineNets.get(it.id) || 0),
      0
    );

    const nonImagingRatio =
      totalAllServiceNet > 0 ? totalNonImagingNet / totalAllServiceNet : 0;

    const itemById = new Map(serviceItems.map((it) => [it.id, it]));
    const serviceLineIds = serviceItems.map((it) => it.id);

    const remainingDue = new Map(
      serviceItems.map((it) => [it.id, lineNets.get(it.id) || 0])
    );
    const itemAllocationBase = new Map(serviceItems.map((it) => [it.id, 0]));

    let barterSum = 0;

    const sortedPayments = [...payments].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    for (const p of sortedPayments) {
      const method = String(p.method || "").toUpperCase();
      const ts = new Date(p.timestamp);

      if (!inRange(ts, rangeStart, rangeEndExclusive)) continue;
      if (EXCLUDED_METHODS.has(method)) continue;

      if (method === "BARTER") {
        barterSum += Number(p.amount || 0);
        continue;
      }

      if (!INCLUDED_METHODS.has(method) && !OVERRIDE_METHODS.has(method)) continue;

      const payAmt = Number(p.amount || 0);
      const payAllocs = p.allocations || [];

      if (payAllocs.length > 0) {
        for (const alloc of payAllocs) {
          const item = itemById.get(alloc.invoiceItemId);
          if (!item) continue;
          const allocAmt = Number(alloc.amount || 0);
          itemAllocationBase.set(item.id, (itemAllocationBase.get(item.id) || 0) + allocAmt);
          remainingDue.set(item.id, Math.max(0, (remainingDue.get(item.id) || 0) - allocAmt));
        }
      } else {
        const allocs = allocatePaymentProportionalByRemaining(
          payAmt,
          serviceLineIds,
          remainingDue
        );
        for (const [id, amt] of allocs) {
          itemAllocationBase.set(id, (itemAllocationBase.get(id) || 0) + amt);
        }
      }
    }

    if (hasOverride) {
      // Override invoices: invoice-level sales contribution when paid (mirrors income.js).
      const status = String(inv.statusLegacy || "").toLowerCase();
      if (status === "paid") {
        const salesAmt = totalNonImagingNet * 0.9;
        totalSalesMnt += salesAmt;

        // Distribute across non-imaging categories proportionally to lineNet.
        if (totalNonImagingNet > 0) {
          for (const it of nonImagingServiceItems) {
            const lineNet = lineNets.get(it.id) || 0;
            const ratio = lineNet / totalNonImagingNet;
            const k = bucketKeyForService(it.service);
            byCategory.set(k, (byCategory.get(k) || 0) + salesAmt * ratio);
          }
        }
      }
    } else {
      // Sum proportional allocations for non-IMAGING lines.
      for (const it of nonImagingServiceItems) {
        const allocAmt = itemAllocationBase.get(it.id) || 0;
        if (allocAmt <= 0) continue;
        const k = bucketKeyForService(it.service);
        byCategory.set(k, (byCategory.get(k) || 0) + allocAmt);
        totalSalesMnt += allocAmt;
      }

      // BARTER excess contributes to sales (proportional to non-imaging share).
      const barterExcess = Math.max(0, barterSum - BARTER_THRESHOLD_MNT);
      const barterIncluded = barterExcess * nonImagingRatio;
      if (barterIncluded > 0) {
        byCategory.set("BARTER_EXCESS", (byCategory.get("BARTER_EXCESS") || 0) + barterIncluded);
        totalSalesMnt += barterIncluded;
      }
    }
  }

  return { salesMnt: totalSalesMnt, byCategory };
}

// ── Endpoint ────────────────────────────────────────────────────────────────
router.get("/reports/appointments/doctors-income", async (req, res) => {
  try {
    const {
      year: yearParam,
      startDate: startDateParam,
      endDate: endDateParam,
      branchId: branchIdParam,
      doctorId: doctorIdParam,
    } = req.query;

    const currentYear = new Date().getFullYear();
    const yearRaw = yearParam ? Number(yearParam) : currentYear;
    const year = Number.isFinite(yearRaw) ? yearRaw : currentYear;

    const branchIdRaw = branchIdParam ? Number(branchIdParam) : null;
    const branchId = Number.isFinite(branchIdRaw) ? branchIdRaw : null;

    const doctorIdRaw = doctorIdParam ? Number(doctorIdParam) : null;
    const doctorId = Number.isFinite(doctorIdRaw) ? doctorIdRaw : null;

    const isDateRange = Boolean(startDateParam && endDateParam);
    const mode = isDateRange ? "daily" : "monthly";

    let startDateStr;
    let endDateStr;
    let rangeStart;
    let rangeEndExclusive;

    if (isDateRange) {
      startDateStr = String(startDateParam);
      endDateStr = String(endDateParam);

      rangeStart = new Date(`${startDateStr}T00:00:00.000Z`);
      rangeEndExclusive = new Date(`${endDateStr}T00:00:00.000Z`);
      rangeEndExclusive.setUTCDate(rangeEndExclusive.getUTCDate() + 1); // inclusive endDate
    } else {
      startDateStr = `${year}-01-01`;
      endDateStr = `${year}-12-31`;

      rangeStart = new Date(`${startDateStr}T00:00:00.000Z`);
      rangeEndExclusive = new Date(`${year + 1}-01-01T00:00:00.000Z`);
    }

    // Settings: home bleaching deduction amount
    const homeBleachingDeductSetting = await prisma.settings.findUnique({
      where: { key: "finance.homeBleachingDeductAmountMnt" },
    });
    const homeBleachingDeductAmountMnt =
      Number(homeBleachingDeductSetting?.value || 0) || 0;

    // Filter lists
    const [branches, doctors] = await Promise.all([
      prisma.branch.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: {
          // TODO: verify role enum value in your DB. If it's DOCTOR, change this.
          role: "doctor",
          ...(branchId ? { branchId } : {}),
        },
        select: { id: true, name: true, ovog: true, branchId: true },
        orderBy: { name: "asc" },
      }),
    ]);

    // Scope by doctor via encounter.doctorId (branch is invoice.branchId)
    const encounterFilter = {};
    if (doctorId) encounterFilter.doctorId = doctorId;

    const invoiceWhere = {
      OR: [
        { createdAt: { gte: rangeStart, lt: rangeEndExclusive } },
        { payments: { some: { timestamp: { gte: rangeStart, lt: rangeEndExclusive } } } },
      ],
      encounter: encounterFilter,
      ...(branchId ? { branchId } : {}), // ✅ branch-at-time
    };

    const [invoices, completedAppts] = await Promise.all([
      prisma.invoice.findMany({
        where: invoiceWhere,
        include: {
          branch: { select: { id: true, name: true } },
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
          payments: {
            include: {
              allocations: { select: { invoiceItemId: true, amount: true } },
            },
          },
        },
      }),
      prisma.appointment.findMany({
        where: {
          status: "completed",
          scheduledAt: { gte: rangeStart, lt: rangeEndExclusive },
          ...(branchId ? { branchId } : {}),
          ...(doctorId ? { doctorId } : {}),
        },
        select: { id: true, branchId: true, doctorId: true, scheduledAt: true },
      }),
    ]);

    // Pre-populate series buckets with zeros
    const bucketMap = new Map();
    const bucketSalesMap = new Map();
    const bucketCompletedMap = new Map();
    if (mode === "monthly") {
      for (let m = 1; m <= 12; m++) {
        const k = `${year}-${String(m).padStart(2, "0")}`;
        bucketMap.set(k, 0);
        bucketSalesMap.set(k, 0);
        bucketCompletedMap.set(k, 0);
      }
    } else {
      for (const d of enumerateDaysInclusive(startDateStr, endDateStr)) {
        bucketMap.set(d, 0);
        bucketSalesMap.set(d, 0);
        bucketCompletedMap.set(d, 0);
      }
    }

    // Count completed appointments per bucket / branch / doctor
    const apptByBranch = new Map(); // branchId -> count
    const apptByDoctor = new Map(); // doctorId -> count
    let totalCompletedCount = 0;

    for (const appt of completedAppts) {
      totalCompletedCount++;
      const iso = new Date(appt.scheduledAt).toISOString().slice(0, 10);
      const apptKey = mode === "monthly" ? iso.slice(0, 7) : iso;
      if (bucketCompletedMap.has(apptKey)) {
        bucketCompletedMap.set(apptKey, bucketCompletedMap.get(apptKey) + 1);
      }
      if (appt.branchId != null) {
        apptByBranch.set(appt.branchId, (apptByBranch.get(appt.branchId) || 0) + 1);
      }
      if (appt.doctorId != null) {
        apptByDoctor.set(appt.doctorId, (apptByDoctor.get(appt.doctorId) || 0) + 1);
      }
    }

    // Determine time-series bucket for an invoice: earliest in-range payment (non-excluded),
    // else createdAt if it falls in range.
    function getBucketKey(inv) {
      const sortedPayments = [...(inv.payments || [])].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      for (const p of sortedPayments) {
        const method = String(p.method || "").toUpperCase();
        if (EXCLUDED_METHODS.has(method)) continue;

        const ts = new Date(p.timestamp);
        if (!inRange(ts, rangeStart, rangeEndExclusive)) continue;

        const iso = ts.toISOString().slice(0, 10);
        return mode === "monthly" ? iso.slice(0, 7) : iso;
      }

      const created = new Date(inv.createdAt);
      if (inRange(created, rangeStart, rangeEndExclusive)) {
        const iso = created.toISOString().slice(0, 10);
        return mode === "monthly" ? iso.slice(0, 7) : iso;
      }

      return null;
    }

    // Breakdown accumulators
    const breakdownByBranch = new Map(); // branchId -> {id, label, incomeMnt, salesMnt}
    const breakdownByDoctor = new Map(); // doctorId -> {id, label, incomeMnt, salesMnt}
    const breakdownByCategory = new Map([
      ["IMAGING", 0],
      ["ORTHODONTIC_TREATMENT", 0],
      ["DEFECT_CORRECTION", 0],
      ["SURGERY", 0],
      ["GENERAL", 0],
      ["BARTER_EXCESS", 0],
    ]);
    const breakdownByCategorySales = new Map([
      ["IMAGING", 0],
      ["ORTHODONTIC_TREATMENT", 0],
      ["DEFECT_CORRECTION", 0],
      ["SURGERY", 0],
      ["GENERAL", 0],
      ["BARTER_EXCESS", 0],
    ]);

    let totalIncomeMnt = 0;
    let totalSalesMnt = 0;

    for (const inv of invoices) {
      const doctor = inv.encounter?.doctor;
      if (!doctor) continue;

      const { incomeMnt, byCategory } = computeIncomeFromInvoices(
        [inv],
        rangeStart,
        rangeEndExclusive,
        homeBleachingDeductAmountMnt
      );

      const { salesMnt, byCategory: byCategorySales } = computeSalesFromInvoices(
        [inv],
        rangeStart,
        rangeEndExclusive
      );

      if (incomeMnt <= 0 && salesMnt <= 0) continue;

      // series
      const key = getBucketKey(inv);
      if (key && bucketMap.has(key)) {
        bucketMap.set(key, (bucketMap.get(key) || 0) + incomeMnt);
        bucketSalesMap.set(key, (bucketSalesMap.get(key) || 0) + salesMnt);
      }

      totalIncomeMnt += incomeMnt;
      totalSalesMnt += salesMnt;

      // breakdown: branch-at-time from invoice
      const b = inv.branch;
      if (b) {
        if (!breakdownByBranch.has(b.id)) {
          breakdownByBranch.set(b.id, { id: b.id, label: b.name, incomeMnt: 0, salesMnt: 0 });
        }
        const bEntry = breakdownByBranch.get(b.id);
        bEntry.incomeMnt += incomeMnt;
        bEntry.salesMnt += salesMnt;
      }

      // breakdown: doctor
      const dLabel =
        ((doctor.ovog ? doctor.ovog.charAt(0) + ". " : "") + (doctor.name || ""))
          .trim() || `Doctor ${doctor.id}`;
      if (!breakdownByDoctor.has(doctor.id)) {
        breakdownByDoctor.set(doctor.id, { id: doctor.id, label: dLabel, incomeMnt: 0, salesMnt: 0 });
      }
      const dEntry = breakdownByDoctor.get(doctor.id);
      dEntry.incomeMnt += incomeMnt;
      dEntry.salesMnt += salesMnt;

      // breakdown: category (only used when doctor selected)
      for (const [cat, amt] of byCategory.entries()) {
        breakdownByCategory.set(cat, (breakdownByCategory.get(cat) || 0) + amt);
      }
      for (const [cat, amt] of byCategorySales.entries()) {
        breakdownByCategorySales.set(cat, (breakdownByCategorySales.get(cat) || 0) + amt);
      }
    }

    // Choose breakdown type (same for all 3 cards)
    let breakdownType;
    if (doctorId) {
      breakdownType = "categories";
    } else if (branchId) {
      breakdownType = "doctors";
    } else {
      breakdownType = "branches";
    }

    // ── Build per-card breakdown rows ─────────────────────────────────────────

    // Sales breakdown rows
    let salesBreakdownRows;
    // Income breakdown rows
    let incomeBreakdownRows;
    // Avg breakdown rows
    let avgBreakdownRows;

    if (doctorId) {
      salesBreakdownRows = Array.from(breakdownByCategorySales.keys())
        .map((key) => ({
          id: key,
          label: CATEGORY_LABELS[key] || key,
          valueMnt: Math.round(breakdownByCategorySales.get(key) || 0),
          pct: calcPct(breakdownByCategorySales.get(key) || 0, totalSalesMnt),
        }))
        .filter((r) => r.valueMnt > 0);

      incomeBreakdownRows = Array.from(breakdownByCategory.keys())
        .map((key) => ({
          id: key,
          label: CATEGORY_LABELS[key] || key,
          valueMnt: Math.round(breakdownByCategory.get(key) || 0),
          pct: calcPct(breakdownByCategory.get(key) || 0, totalIncomeMnt),
        }))
        .filter((r) => r.valueMnt > 0);

      // Avg: each category shares the doctor's total completed count.
      // Appointments are not split by service category (one appointment can
      // include services from multiple categories), so the denominator is the
      // doctor's total completed appointment count for the period — matching
      // the spec definition: categoryAvg = categorySales / completedCount(scope).
      avgBreakdownRows = Array.from(breakdownByCategorySales.keys())
        .map((key) => {
          const salesMntRaw = breakdownByCategorySales.get(key) || 0;
          const salesMntRounded = Math.round(salesMntRaw);
          const avgMnt = totalCompletedCount > 0
            ? Math.round(salesMntRaw / totalCompletedCount)
            : 0;
          return {
            id: key,
            label: CATEGORY_LABELS[key] || key,
            avgMnt,
            salesMnt: salesMntRounded,
            completedCount: totalCompletedCount,
            pctSales: calcPct(salesMntRaw, totalSalesMnt),
          };
        })
        .filter((r) => r.salesMnt > 0);

    } else if (branchId) {
      salesBreakdownRows = Array.from(breakdownByDoctor.values())
        .map((r) => ({
          id: r.id,
          label: r.label,
          valueMnt: Math.round(r.salesMnt),
          pct: calcPct(r.salesMnt, totalSalesMnt),
        }))
        .sort((a, b) => b.valueMnt - a.valueMnt);

      incomeBreakdownRows = Array.from(breakdownByDoctor.values())
        .map((r) => ({
          id: r.id,
          label: r.label,
          valueMnt: Math.round(r.incomeMnt),
          pct: calcPct(r.incomeMnt, totalIncomeMnt),
        }))
        .sort((a, b) => b.valueMnt - a.valueMnt);

      avgBreakdownRows = Array.from(breakdownByDoctor.values())
        .map((r) => {
          const cnt = apptByDoctor.get(r.id) || 0;
          return {
            id: r.id,
            label: r.label,
            avgMnt: cnt > 0 ? Math.round(r.salesMnt / cnt) : 0,
            salesMnt: Math.round(r.salesMnt),
            completedCount: cnt,
            pctSales: calcPct(r.salesMnt, totalSalesMnt),
          };
        })
        .sort((a, b) => b.salesMnt - a.salesMnt);

    } else {
      salesBreakdownRows = Array.from(breakdownByBranch.values())
        .map((r) => ({
          id: r.id,
          label: r.label,
          valueMnt: Math.round(r.salesMnt),
          pct: calcPct(r.salesMnt, totalSalesMnt),
        }))
        .sort((a, b) => b.valueMnt - a.valueMnt);

      incomeBreakdownRows = Array.from(breakdownByBranch.values())
        .map((r) => ({
          id: r.id,
          label: r.label,
          valueMnt: Math.round(r.incomeMnt),
          pct: calcPct(r.incomeMnt, totalIncomeMnt),
        }))
        .sort((a, b) => b.valueMnt - a.valueMnt);

      avgBreakdownRows = Array.from(breakdownByBranch.values())
        .map((r) => {
          const cnt = apptByBranch.get(r.id) || 0;
          return {
            id: r.id,
            label: r.label,
            avgMnt: cnt > 0 ? Math.round(r.salesMnt / cnt) : 0,
            salesMnt: Math.round(r.salesMnt),
            completedCount: cnt,
            pctSales: calcPct(r.salesMnt, totalSalesMnt),
          };
        })
        .sort((a, b) => b.salesMnt - a.salesMnt);
    }

    // ── Build per-card series ────────────────────────────────────────────────
    const sortedKeys = Array.from(bucketMap.keys()).sort((a, b) => a.localeCompare(b));

    const salesSeries = sortedKeys.map((key) => ({
      key,
      valueMnt: Math.round(bucketSalesMap.get(key) || 0),
    }));

    const incomeSeries = sortedKeys.map((key) => ({
      key,
      valueMnt: Math.round(bucketMap.get(key) || 0),
    }));

    const avgSeries = sortedKeys.map((key) => {
      const bucketSales = bucketSalesMap.get(key) || 0;
      const bucketCompleted = bucketCompletedMap.get(key) || 0;
      return {
        key,
        valueMnt: bucketCompleted > 0 ? Math.round(bucketSales / bucketCompleted) : 0,
      };
    });

    const avgTotalMnt = totalCompletedCount > 0
      ? Math.round(totalSalesMnt / totalCompletedCount)
      : 0;

    return res.json({
      mode,
      year,
      startDate: startDateStr,
      endDate: endDateStr,
      scope: { branchId: branchId || null, doctorId: doctorId || null },
      sales: {
        series: salesSeries,
        totalMnt: Math.round(totalSalesMnt),
        breakdown: { type: breakdownType, rows: salesBreakdownRows },
      },
      income: {
        series: incomeSeries,
        totalMnt: Math.round(totalIncomeMnt),
        breakdown: { type: breakdownType, rows: incomeBreakdownRows },
      },
      avgSalesPerCompletedAppt: {
        series: avgSeries,
        totalMnt: avgTotalMnt,
        completedCount: totalCompletedCount,
        breakdown: { type: breakdownType, rows: avgBreakdownRows },
      },
      filters: {
        branches,
        doctors: doctors.map((d) => ({
          id: d.id,
          name: d.name,
          ovog: d.ovog,
          branchId: d.branchId,
        })),
      },
    });
  } catch (err) {
    console.error("GET /api/admin/reports/appointments/doctors-income error:", err);
    return res.status(500).json({ error: "Failed to fetch doctor income report." });
  }
});

export default router;
