import { Router } from "express";
import prisma from "../db.js";
import { computeDoctorsIncomeData } from "./admin/income.js";
import {
  discountPercentEnumToNumber,
  computeServiceNetProportionalDiscount,
  allocatePaymentProportionalByRemaining,
  computeOverrideSalesFromAllocations,
} from "../utils/incomeHelpers.js";

const router = Router();

// Payment methods counted as income for the top-card calculations (Cards 1 and 3)
const INCOME_PAYMENT_METHODS = ["CASH", "POS", "TRANSFER", "INSURANCE", "APPLICATION", "QPAY"];
const MAIN_REPORT_VOIDED_STATUSES = ["voided", "void", "canceled", "cancelled"];
const ULAANBAATAR_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ulaanbaatar",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const MAIN_REPORT_PAYMENT_METHODS = [
  { key: "CASH", label: "Бэлэн мөнгө" },
  { key: "POS", label: "Карт (POS)" },
  { key: "TRANSFER", label: "Дансны шилжүүлэг" },
  { key: "INSURANCE", label: "Даатгал" },
  { key: "APPLICATION", label: "Аппликэйшнээр төлбөр" },
  { key: "VOUCHER", label: "Купон / Ваучер" },
  { key: "EMPLOYEE_BENEFIT", label: "Ажилтны хөнгөлөлт" },
  { key: "WALLET", label: "Хэтэвч (урьдчилгаа / илүү төлөлтөөс)" },
  { key: "BARTER", label: "Бартер" },
  { key: "QPAY", label: "QPAY" },
];
const DOCTOR_TAB_CATEGORY_LABELS = {
  ADULT_TREATMENT: "Насанд хүрэгчдийн эмчилгээ",
  CHILD_TREATMENT: "Хүүхдийн эмчилгээ",
  ORTHODONTIC_TREATMENT: "Гажиг заслын эмчилгээ",
  DEFECT_CORRECTION: "Согог заслын эмчилгээ",
  WHITENING: "Цайруулалт",
  SURGERY: "Мэс ажилбар",
};
const DOCTOR_TAB_INCLUDED_METHODS = new Set([
  "CASH",
  "POS",
  "TRANSFER",
  "QPAY",
  "WALLET",
  "VOUCHER",
  "OTHER",
]);
const DOCTOR_TAB_EXCLUDED_METHODS = new Set(["EMPLOYEE_BENEFIT"]);
const DOCTOR_TAB_OVERRIDE_METHODS = new Set(["INSURANCE", "APPLICATION", "WALLET"]);
const DOCTOR_TAB_BARTER_THRESHOLD_MNT = 800000;
const TREATMENT_CATEGORY_LABELS = {
  ORTHODONTIC_TREATMENT: "Гажиг Засал",
  SURGERY: "Мэс Засал",
  IMAGING: "Зураг",
  CHILD_TREATMENT: "Хүүхдийн эмчилгээ",
  ADULT_TREATMENT: "Том хүнийн эмчилгээ",
  WHITENING: "Цайруулалт",
};
const TREATMENT_CATEGORY_KEYS = Object.keys(TREATMENT_CATEGORY_LABELS);
const TREATMENT_INCLUDED_METHODS = new Set([
  "CASH",
  "POS",
  "TRANSFER",
  "QPAY",
  "WALLET",
  "VOUCHER",
  "INSURANCE",
  "APPLICATION",
  "BARTER",
  "OTHER",
]);
const TREATMENT_EXCLUDED_METHODS = new Set(["EMPLOYEE_BENEFIT"]);

function parseDateOnlyStart(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const dt = new Date(`${value}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseDateOnlyEndExclusive(value) {
  const start = parseDateOnlyStart(value);
  if (!start) return null;
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function monthKey(date) {
  return dayKey(date).slice(0, 7);
}

function dayKey(date) {
  const dt = date instanceof Date ? date : new Date(date);
  return ULAANBAATAR_DAY_FORMATTER.format(dt);
}

function asMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function toShortDoctorName({ ovog, name, id }) {
  const first = String(ovog || "").trim();
  const last = String(name || "").trim();
  if (first && last) return `${first.charAt(0)}.${last}`;
  if (last) return last;
  if (first) return first;
  return `Эмч #${id}`;
}

function inRange(ts, start, endExclusive) {
  return ts >= start && ts < endExclusive;
}

function computeDoctorTabInvoiceSales(inv, rangeStart, rangeEndExclusive) {
  const serviceItems = (inv.items || []).filter(
    (it) => it.itemType === "SERVICE" && it.service?.category !== "PREVIOUS"
  );
  if (!serviceItems.length) return 0;

  const discountPct = discountPercentEnumToNumber(inv.discountPercent);
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

  const payments = [...(inv.payments || [])].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  let barterSum = 0;
  let hasOverride = false;

  for (const p of payments) {
    const method = String(p.method || "").toUpperCase();
    const ts = new Date(p.timestamp);
    if (!inRange(ts, rangeStart, rangeEndExclusive)) continue;
    if (DOCTOR_TAB_EXCLUDED_METHODS.has(method)) continue;

    if (DOCTOR_TAB_OVERRIDE_METHODS.has(method)) {
      hasOverride = true;
    }

    if (method === "BARTER") {
      barterSum += Number(p.amount || 0);
      continue;
    }

    if (
      !DOCTOR_TAB_INCLUDED_METHODS.has(method) &&
      !DOCTOR_TAB_OVERRIDE_METHODS.has(method)
    ) {
      continue;
    }

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

  if (hasOverride) {
    return computeOverrideSalesFromAllocations(
      nonImagingServiceItems,
      itemAllocationBase,
      0.9
    );
  }

  let sales = 0;
  for (const it of nonImagingServiceItems) {
    sales += itemAllocationBase.get(it.id) || 0;
  }
  const barterExcess = Math.max(0, barterSum - DOCTOR_TAB_BARTER_THRESHOLD_MNT);
  sales += barterExcess * nonImagingRatio;
  return sales;
}

router.get("/main-overview", async (req, res) => {
  try {
    const now = new Date();
    const defaultFrom = `${now.getFullYear()}-01-01`;
    const defaultTo = `${now.getFullYear()}-12-31`;

    const from = typeof req.query.from === "string" && req.query.from ? req.query.from : defaultFrom;
    const to = typeof req.query.to === "string" && req.query.to ? req.query.to : defaultTo;

    const fromDate = parseDateOnlyStart(from);
    const toDateExclusive = parseDateOnlyEndExclusive(to);
    if (!fromDate || !toDateExclusive) {
      return res.status(400).json({
        error: "from, to query parameters are required in YYYY-MM-DD format.",
      });
    }

    const branchId =
      req.query.branchId == null || req.query.branchId === ""
        ? null
        : Number(req.query.branchId);
    const doctorId =
      req.query.doctorId == null || req.query.doctorId === ""
        ? null
        : Number(req.query.doctorId);

    if ((branchId != null && Number.isNaN(branchId)) || (doctorId != null && Number.isNaN(doctorId))) {
      return res.status(400).json({ error: "Invalid branchId or doctorId." });
    }

    const [branches, doctors, invoices, completedAppointments] = await Promise.all([
      prisma.branch.findMany({
        select: { id: true, name: true },
        orderBy: { id: "asc" },
      }),
      prisma.user.findMany({
        where: {
          role: "doctor",
          ...(branchId ? { branchId } : {}),
        },
        select: { id: true, name: true, ovog: true, branchId: true },
        orderBy: { name: "asc" },
      }),
      prisma.invoice.findMany({
        where: {
          createdAt: { gte: fromDate, lt: toDateExclusive },
          statusLegacy: { notIn: MAIN_REPORT_VOIDED_STATUSES },
          ...(branchId ? { branchId } : {}),
          ...(doctorId ? { encounter: { is: { doctorId } } } : {}),
        },
        include: {
          branch: { select: { id: true, name: true } },
          encounter: {
            include: {
              doctor: { select: { id: true, name: true, ovog: true } },
            },
          },
          payments: { select: { amount: true, method: true, timestamp: true } },
        },
      }),
      prisma.appointment.findMany({
        where: {
          status: "completed",
          scheduledAt: { gte: fromDate, lt: toDateExclusive },
          ...(branchId ? { branchId } : {}),
          ...(doctorId ? { doctorId } : {}),
        },
        select: { id: true, branchId: true, doctorId: true },
      }),
    ]);

    const activeBranches = branchId ? branches.filter((b) => b.id === branchId) : branches;
    const yearMatch = /^(\d{4})-01-01$/.exec(from);
    const isMonthlyView = Boolean(yearMatch && to === `${yearMatch[1]}-12-31`);
    const trendKeys = [];
    const monthCursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1, 0, 0, 0, 0);
    const toDateInclusive = new Date(toDateExclusive.getTime() - 1);
    const endMonth = new Date(
      toDateInclusive.getFullYear(),
      toDateInclusive.getMonth(),
      1,
      0,
      0,
      0,
      0
    );
    if (isMonthlyView) {
      while (monthCursor <= endMonth) {
        trendKeys.push(monthKey(monthCursor));
        monthCursor.setMonth(monthCursor.getMonth() + 1);
      }
    } else {
      const dayCursor = new Date(fromDate);
      while (dayCursor < toDateExclusive) {
        trendKeys.push(dayKey(dayCursor));
        dayCursor.setDate(dayCursor.getDate() + 1);
      }
    }

    const trendSales = new Map(trendKeys.map((k) => [k, 0]));
    const trendCollected = new Map(trendKeys.map((k) => [k, 0]));
    const methodTotals = new Map(MAIN_REPORT_PAYMENT_METHODS.map((m) => [m.key, 0]));

    const doctorSales = new Map();
    const doctorIncome = new Map();
    const branchSales = new Map(activeBranches.map((b) => [b.id, 0]));
    const branchCollected = new Map(activeBranches.map((b) => [b.id, 0]));
    const branchCompleted = new Map(activeBranches.map((b) => [b.id, 0]));

    let totalSales = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let nonCash = 0;

    for (const inv of invoices) {
      const billed = asMoney(inv.finalAmount != null ? inv.finalAmount : inv.totalAmount);
      const collected = asMoney((inv.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0));
      const outstanding = asMoney(billed - collected);

      totalSales = asMoney(totalSales + billed);
      totalCollected = asMoney(totalCollected + collected);
      if (outstanding > 0) totalOutstanding = asMoney(totalOutstanding + outstanding);

      const trendKey = isMonthlyView ? monthKey(inv.createdAt) : dayKey(inv.createdAt);
      if (trendSales.has(trendKey)) {
        trendSales.set(trendKey, asMoney((trendSales.get(trendKey) || 0) + billed));
      }
      if (trendCollected.has(trendKey)) {
        trendCollected.set(trendKey, asMoney((trendCollected.get(trendKey) || 0) + collected));
      }

      if (inv.branchId && branchSales.has(inv.branchId)) {
        branchSales.set(inv.branchId, asMoney((branchSales.get(inv.branchId) || 0) + billed));
        branchCollected.set(inv.branchId, asMoney((branchCollected.get(inv.branchId) || 0) + collected));
      }

      const d = inv.encounter?.doctor;
      if (d?.id) {
        doctorSales.set(d.id, asMoney((doctorSales.get(d.id) || 0) + billed));
        doctorIncome.set(d.id, asMoney((doctorIncome.get(d.id) || 0) + collected));
      }

      for (const p of inv.payments || []) {
        const key = String(p.method || "").toUpperCase();
        if (!methodTotals.has(key)) continue;
        const amount = asMoney(p.amount);
        methodTotals.set(key, asMoney((methodTotals.get(key) || 0) + amount));
        if (key === "EMPLOYEE_BENEFIT" || key === "BARTER") {
          nonCash = asMoney(nonCash + amount);
        }
      }
    }

    for (const appt of completedAppointments) {
      if (!appt.branchId || !branchCompleted.has(appt.branchId)) continue;
      branchCompleted.set(appt.branchId, (branchCompleted.get(appt.branchId) || 0) + 1);
    }

    const completedByDoctor = new Map();
    for (const appt of completedAppointments) {
      if (!appt.doctorId) continue;
      completedByDoctor.set(appt.doctorId, (completedByDoctor.get(appt.doctorId) || 0) + 1);
    }

    const doctorNameById = new Map(
      doctors.map((d) => [
        d.id,
        [d.ovog ? `${d.ovog} ` : "", d.name || ""].join("").trim() || `Эмч #${d.id}`,
      ])
    );
    for (const inv of invoices) {
      const d = inv.encounter?.doctor;
      if (!d?.id || doctorNameById.has(d.id)) continue;
      doctorNameById.set(
        d.id,
        [d.ovog ? `${d.ovog} ` : "", d.name || ""].join("").trim() || `Эмч #${d.id}`
      );
    }
    const invoiceDoctorIds = new Set([...doctorSales.keys(), ...doctorIncome.keys(), ...completedByDoctor.keys()]);
    const doctorRows = Array.from(invoiceDoctorIds).map((id) => {
      const sales = asMoney(doctorSales.get(id) || 0);
      const income = asMoney(doctorIncome.get(id) || 0);
      const completedCount = Number(completedByDoctor.get(id) || 0);
      return {
        doctorId: id,
        doctorName: doctorNameById.get(id) || `Эмч #${id}`,
        sales,
        income,
        completedCount,
        avgPerAppointment: completedCount > 0 ? Math.round(sales / completedCount) : 0,
      };
    });

    const branchRows = activeBranches
      .map((b) => ({
        branchId: b.id,
        branchName: b.name,
        sales: Math.round(branchSales.get(b.id) || 0),
        collected: Math.round(branchCollected.get(b.id) || 0),
        completedVisits: Number(branchCompleted.get(b.id) || 0),
      }))
      .sort((a, b) => b.sales - a.sales);

    return res.json({
      period: {
        from,
        to,
        view: isMonthlyView ? "monthly" : "daily",
      },
      scope: {
        branchId: branchId || null,
        doctorId: doctorId || null,
      },
      filters: {
        branches: branches.map((b) => ({ id: b.id, name: b.name })),
        doctors: doctors.map((d) => ({
          id: d.id,
          name: d.name,
          ovog: d.ovog,
          branchId: d.branchId,
        })),
      },
      kpis: {
        totalSales: Math.round(totalSales),
        collected: Math.round(totalCollected),
        outstanding: Math.round(totalOutstanding),
        nonCash: Math.round(nonCash),
        completedVisits: completedAppointments.length,
      },
      revenueTrend: trendKeys.map((key) => ({
        bucket: key,
        sales: Math.round(trendSales.get(key) || 0),
        collected: Math.round(trendCollected.get(key) || 0),
        income: Math.round(trendCollected.get(key) || 0),
      })),
      paymentMethods: MAIN_REPORT_PAYMENT_METHODS.map((method) => ({
        key: method.key,
        label: method.label,
        amount: Math.round(methodTotals.get(method.key) || 0),
      })),
      branchPerformance: branchRows,
      topDoctors: doctorRows.sort((a, b) => b.sales - a.sales),
    });
  } catch (err) {
    console.error("GET /api/reports/main-overview error:", err);
    return res.status(500).json({ error: "Failed to fetch main overview report." });
  }
});

router.get("/main-doctor", async (req, res) => {
  try {
    const now = new Date();
    const defaultFrom = `${now.getFullYear()}-01-01`;
    const defaultTo = `${now.getFullYear()}-12-31`;
    const from = typeof req.query.from === "string" && req.query.from ? req.query.from : defaultFrom;
    const to = typeof req.query.to === "string" && req.query.to ? req.query.to : defaultTo;

    const fromDate = parseDateOnlyStart(from);
    const toDateExclusive = parseDateOnlyEndExclusive(to);
    if (!fromDate || !toDateExclusive) {
      return res.status(400).json({
        error: "from, to query parameters are required in YYYY-MM-DD format.",
      });
    }

    const branchId =
      req.query.branchId == null || req.query.branchId === ""
        ? null
        : Number(req.query.branchId);
    const doctorId =
      req.query.doctorId == null || req.query.doctorId === ""
        ? null
        : Number(req.query.doctorId);
    const topN =
      req.query.topN == null || req.query.topN === ""
        ? 10
        : Number(req.query.topN);

    if (
      (branchId != null && Number.isNaN(branchId)) ||
      (doctorId != null && Number.isNaN(doctorId)) ||
      Number.isNaN(topN)
    ) {
      return res.status(400).json({ error: "Invalid branchId, doctorId or topN." });
    }

    const topNNormalized = [5, 10, 20].includes(topN) ? topN : 10;
    const yearMatch = /^(\d{4})-01-01$/.exec(from);
    const isMonthlyView = Boolean(yearMatch && to === `${yearMatch[1]}-12-31`);
    const view = isMonthlyView ? "monthly" : "daily";

    const [doctorRowsRaw, filtersData, invoices] = await Promise.all([
      computeDoctorsIncomeData({
        startDate: from,
        endDate: to,
        branchId,
      }),
      Promise.all([
        prisma.branch.findMany({
          select: { id: true, name: true },
          orderBy: { id: "asc" },
        }),
        prisma.user.findMany({
          where: { role: "doctor", ...(branchId ? { branchId } : {}) },
          select: { id: true, name: true, ovog: true, branchId: true },
          orderBy: { name: "asc" },
        }),
      ]),
      prisma.invoice.findMany({
        where: {
          OR: [
            { createdAt: { gte: fromDate, lt: toDateExclusive } },
            {
              payments: {
                some: { timestamp: { gte: fromDate, lt: toDateExclusive } },
              },
            },
          ],
          ...(branchId ? { branchId } : {}),
          ...(doctorId ? { encounter: { is: { doctorId } } } : {}),
        },
        include: {
          encounter: {
            include: {
              doctor: { select: { id: true, name: true, ovog: true } },
              appointment: {
                select: { id: true, status: true, scheduledAt: true },
              },
            },
          },
          items: {
            where: {
              itemType: "SERVICE",
              service: {
                category: {
                  in: Object.keys(DOCTOR_TAB_CATEGORY_LABELS),
                },
              },
            },
            include: { service: { select: { category: true } } },
          },
          payments: {
            select: {
              amount: true,
              method: true,
              timestamp: true,
              allocations: { select: { invoiceItemId: true, amount: true } },
            },
          },
        },
      }),
    ]);

    const [branches, doctors] = filtersData;

    const doctorRowsScoped = doctorRowsRaw
      .filter((row) => (doctorId ? row.doctorId === doctorId : true))
      .map((row) => ({
        doctorId: row.doctorId,
        doctorName: toShortDoctorName({
          id: row.doctorId,
          ovog: row.doctorOvog,
          name: row.doctorName,
        }),
        branchName: row.branchName || "—",
        sales: Math.round(row.revenue || 0),
        income: Math.round(row.commission || 0),
        completedAppointments: Number(row.appointmentCount || 0),
        completedServices: Number(row.serviceCount || 0),
        avgPerAppointment: Math.round(row.averageVisitRevenue || 0),
      }))
      .sort((a, b) => b.sales - a.sales);

    const doctorById = new Map(doctorRowsScoped.map((d) => [d.doctorId, d]));
    const doctorTrendMap = new Map();
    const avgPerPatientRows = [...doctorRowsScoped];

    const totalDoctorIncome = doctorRowsScoped.reduce((s, d) => s + d.income, 0);
    const totalSales = doctorRowsScoped.reduce((s, d) => s + d.sales, 0);
    const totalCompletedAppointments = doctorRowsScoped.reduce(
      (s, d) => s + d.completedAppointments,
      0
    );
    const totalAvgPerAppointment =
      totalCompletedAppointments > 0
        ? Math.round(totalSales / totalCompletedAppointments)
        : 0;

    const categoryBreakdownMap = new Map(
      Object.keys(DOCTOR_TAB_CATEGORY_LABELS).map((k) => [k, 0])
    );

    for (const inv of invoices) {
      const doc = inv.encounter?.doctor;
      if (!doc || !doctorById.has(doc.id)) continue;
      const docRow = doctorById.get(doc.id);

      const bucketTs = inv.createdAt;
      const bucket = view === "monthly" ? monthKey(bucketTs) : dayKey(bucketTs);
      if (!doctorTrendMap.has(doc.id)) {
        doctorTrendMap.set(doc.id, new Map());
      }
      const perDoctorSeries = doctorTrendMap.get(doc.id);
      const invoiceSales = computeDoctorTabInvoiceSales(
        inv,
        fromDate,
        toDateExclusive
      );
      if (invoiceSales > 0) {
        perDoctorSeries.set(
          bucket,
          (perDoctorSeries.get(bucket) || 0) + invoiceSales
        );
      }

      if (doctorId && doc.id === doctorId) {
        for (const it of inv.items || []) {
          const cat = it.service?.category;
          if (!cat || !categoryBreakdownMap.has(cat)) continue;
          categoryBreakdownMap.set(
            cat,
            (categoryBreakdownMap.get(cat) || 0) + Number(it.quantity || 0)
          );
        }
      }
    }

    const trendBuckets = [];
    if (view === "monthly") {
      const monthCursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1, 0, 0, 0, 0);
      const endMonth = new Date(
        new Date(toDateExclusive.getTime() - 1).getFullYear(),
        new Date(toDateExclusive.getTime() - 1).getMonth(),
        1,
        0,
        0,
        0,
        0
      );
      while (monthCursor <= endMonth) {
        trendBuckets.push(monthKey(monthCursor));
        monthCursor.setMonth(monthCursor.getMonth() + 1);
      }
    } else {
      const dayCursor = new Date(fromDate);
      while (dayCursor < toDateExclusive) {
        trendBuckets.push(dayKey(dayCursor));
        dayCursor.setDate(dayCursor.getDate() + 1);
      }
    }

    const rankingBase = doctorRowsScoped
      .slice(0, topNNormalized)
      .map((d) => ({
        doctorId: d.doctorId,
        doctorName: d.doctorName,
        sales: d.sales,
        income: d.income,
        avgPerAppointment: d.avgPerAppointment,
      }));

    const hasDoctorFilter = Boolean(doctorId);
    const trendDoctorBase = hasDoctorFilter
      ? doctorRowsScoped.slice(0, 1)
      : doctorRowsScoped.slice(0, topNNormalized);
    const trendDoctorIds = trendDoctorBase.map((d) => d.doctorId);
    const trendSeriesRows = trendBuckets.map((bucket) => {
      const row = { bucket };
      let others = 0;
      for (const d of doctorRowsScoped) {
        const v = doctorTrendMap.get(d.doctorId)?.get(bucket) || 0;
        if (trendDoctorIds.includes(d.doctorId)) {
          row[String(d.doctorId)] = Math.round(v);
        } else {
          others += v;
        }
      }
      if (!hasDoctorFilter && others > 0) {
        row.others = Math.round(others);
      }
      return row;
    });

    const trendDoctors = trendDoctorBase.map((d) => ({
      doctorId: d.doctorId,
      doctorName: d.doctorName,
    }));

    const categoryBreakdown = hasDoctorFilter
      ? Object.keys(DOCTOR_TAB_CATEGORY_LABELS)
          .map((key) => ({
            key,
            label: DOCTOR_TAB_CATEGORY_LABELS[key],
            count: Math.round(categoryBreakdownMap.get(key) || 0),
          }))
          .filter((r) => r.count > 0)
      : [];

    return res.json({
      period: { from, to, view },
      scope: { branchId: branchId || null, doctorId: doctorId || null },
      filters: {
        branches: branches.map((b) => ({ id: b.id, name: b.name })),
        doctors: doctors.map((d) => ({
          id: d.id,
          name: d.name,
          ovog: d.ovog,
          branchId: d.branchId,
        })),
      },
      topN: topNNormalized,
      kpis: {
        totalDoctorIncome: Math.round(totalDoctorIncome),
        totalSales: Math.round(totalSales),
        avgPerAppointment: totalAvgPerAppointment,
        completedAppointments: totalCompletedAppointments,
      },
      trend: {
        buckets: trendBuckets,
        doctors: trendDoctors,
        rows: trendSeriesRows,
        hasOther: !hasDoctorFilter && trendSeriesRows.some((r) => Number(r.others || 0) > 0),
      },
      ranking: rankingBase,
      avgPerPatient: avgPerPatientRows
        .map((r) => ({
          doctorId: r.doctorId,
          doctorName: r.doctorName,
          value: r.avgPerAppointment,
          sales: r.sales,
          completedAppointments: r.completedAppointments,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, topNNormalized),
      categoryBreakdown,
      table: [...doctorRowsScoped].sort((a, b) => b.sales - a.sales),
    });
  } catch (err) {
    console.error("GET /api/reports/main-doctor error:", err);
    return res.status(500).json({ error: "Failed to fetch main doctor report." });
  }
});

router.get("/main-treatment", async (req, res) => {
  try {
    const now = new Date();
    const defaultFrom = `${now.getFullYear()}-01-01`;
    const defaultTo = `${now.getFullYear()}-12-31`;
    const from = typeof req.query.from === "string" && req.query.from ? req.query.from : defaultFrom;
    const to = typeof req.query.to === "string" && req.query.to ? req.query.to : defaultTo;

    const fromDate = parseDateOnlyStart(from);
    const toDateExclusive = parseDateOnlyEndExclusive(to);
    if (!fromDate || !toDateExclusive) {
      return res.status(400).json({
        error: "from, to query parameters are required in YYYY-MM-DD format.",
      });
    }

    const branchId =
      req.query.branchId == null || req.query.branchId === ""
        ? null
        : Number(req.query.branchId);
    const doctorId =
      req.query.doctorId == null || req.query.doctorId === ""
        ? null
        : Number(req.query.doctorId);
    const topN =
      req.query.topN == null || req.query.topN === ""
        ? 20
        : Number(req.query.topN);

    if (
      (branchId != null && Number.isNaN(branchId)) ||
      (doctorId != null && Number.isNaN(doctorId)) ||
      Number.isNaN(topN)
    ) {
      return res.status(400).json({ error: "Invalid branchId, doctorId or topN." });
    }

    const topNNormalized = [5, 10, 20].includes(topN) ? topN : 20;
    const yearMatch = /^(\d{4})-01-01$/.exec(from);
    const isMonthlyView = Boolean(yearMatch && to === `${yearMatch[1]}-12-31`);
    const view = isMonthlyView ? "monthly" : "daily";

    const [filtersData, invoices] = await Promise.all([
      Promise.all([
        prisma.branch.findMany({
          select: { id: true, name: true },
          orderBy: { id: "asc" },
        }),
        prisma.user.findMany({
          where: { role: "doctor", ...(branchId ? { branchId } : {}) },
          select: { id: true, name: true, ovog: true, branchId: true },
          orderBy: { name: "asc" },
        }),
      ]),
      prisma.invoice.findMany({
        where: {
          statusLegacy: { notIn: MAIN_REPORT_VOIDED_STATUSES },
          OR: [
            { createdAt: { gte: fromDate, lt: toDateExclusive } },
            {
              payments: {
                some: { timestamp: { gte: fromDate, lt: toDateExclusive } },
              },
            },
          ],
          ...(branchId ? { branchId } : {}),
          ...(doctorId ? { encounter: { is: { doctorId } } } : {}),
        },
        include: {
          encounter: {
            include: {
              doctor: { select: { id: true, name: true, ovog: true } },
            },
          },
          items: {
            where: {
              itemType: "SERVICE",
              service: {
                category: { in: TREATMENT_CATEGORY_KEYS },
              },
            },
            include: {
              service: { select: { id: true, name: true, category: true } },
            },
          },
          payments: {
            select: {
              amount: true,
              method: true,
              timestamp: true,
              allocations: { select: { invoiceItemId: true, amount: true } },
            },
          },
        },
      }),
    ]);

    const [branches, doctors] = filtersData;
    const treatmentBuckets = [];
    if (view === "monthly") {
      const monthCursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1, 0, 0, 0, 0);
      const endMonth = new Date(
        new Date(toDateExclusive.getTime() - 1).getFullYear(),
        new Date(toDateExclusive.getTime() - 1).getMonth(),
        1,
        0,
        0,
        0,
        0
      );
      while (monthCursor <= endMonth) {
        treatmentBuckets.push(monthKey(monthCursor));
        monthCursor.setMonth(monthCursor.getMonth() + 1);
      }
    } else {
      const dayCursor = new Date(fromDate);
      while (dayCursor < toDateExclusive) {
        treatmentBuckets.push(dayKey(dayCursor));
        dayCursor.setDate(dayCursor.getDate() + 1);
      }
    }

    const categoryRevenueMap = new Map(TREATMENT_CATEGORY_KEYS.map((key) => [key, 0]));
    const categoryCountMap = new Map(TREATMENT_CATEGORY_KEYS.map((key) => [key, 0]));
    const trendCategoryMap = new Map(
      treatmentBuckets.map((bucket) => [
        bucket,
        new Map(TREATMENT_CATEGORY_KEYS.map((key) => [key, 0])),
      ])
    );
    const serviceMap = new Map();

    let totalServiceRevenue = 0;
    let totalTreatmentCount = 0;

    for (const inv of invoices) {
      const serviceItems = (inv.items || []).filter((it) => {
        const category = it.service?.category;
        return category && TREATMENT_CATEGORY_KEYS.includes(category);
      });
      if (!serviceItems.length) continue;

      const discountPct = discountPercentEnumToNumber(inv.discountPercent);
      const lineNets = computeServiceNetProportionalDiscount(serviceItems, discountPct);
      const itemById = new Map(serviceItems.map((it) => [it.id, it]));
      const serviceLineIds = serviceItems.map((it) => it.id);
      const remainingDue = new Map(
        serviceItems.map((it) => [it.id, lineNets.get(it.id) || 0])
      );
      const recognizedByItem = new Map(serviceItems.map((it) => [it.id, 0]));
      const payments = [...(inv.payments || [])].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      for (const p of payments) {
        const method = String(p.method || "").toUpperCase();
        const ts = new Date(p.timestamp);
        if (!inRange(ts, fromDate, toDateExclusive)) continue;
        if (TREATMENT_EXCLUDED_METHODS.has(method)) continue;
        if (!TREATMENT_INCLUDED_METHODS.has(method)) continue;

        const bucket = view === "monthly" ? monthKey(ts) : dayKey(ts);
        const bucketMap = trendCategoryMap.get(bucket);

        const payAllocs = p.allocations || [];
        let allocPairs = [];
        if (payAllocs.length > 0) {
          for (const alloc of payAllocs) {
            const item = itemById.get(alloc.invoiceItemId);
            if (!item) continue;
            const before = remainingDue.get(item.id) || 0;
            if (before <= 0) continue;
            const rawAlloc = Number(alloc.amount || 0);
            const appliedAlloc = Math.max(0, Math.min(rawAlloc, before));
            if (appliedAlloc <= 0) continue;
            remainingDue.set(item.id, Math.max(0, before - appliedAlloc));
            allocPairs.push([item.id, appliedAlloc]);
          }
        } else {
          const payAmt = Number(p.amount || 0);
          allocPairs = Array.from(
            allocatePaymentProportionalByRemaining(payAmt, serviceLineIds, remainingDue)
          );
        }

        for (const [itemId, amtRaw] of allocPairs) {
          const amt = Number(amtRaw || 0);
          if (amt <= 0) continue;
          const item = itemById.get(itemId);
          const category = item?.service?.category;
          if (!item || !category || !TREATMENT_CATEGORY_LABELS[category]) continue;

          recognizedByItem.set(itemId, (recognizedByItem.get(itemId) || 0) + amt);
          categoryRevenueMap.set(category, (categoryRevenueMap.get(category) || 0) + amt);
          if (bucketMap) {
            bucketMap.set(category, (bucketMap.get(category) || 0) + amt);
          }
          totalServiceRevenue += amt;

          const sid = item.service?.id || item.serviceId || item.id;
          if (!serviceMap.has(sid)) {
            serviceMap.set(sid, {
              serviceId: sid,
              serviceName: item.service?.name || `Үйлчилгээ #${sid}`,
              categoryKey: category,
              categoryLabel: TREATMENT_CATEGORY_LABELS[category],
              count: 0,
              totalSales: 0,
            });
          }
          const svc = serviceMap.get(sid);
          svc.totalSales += amt;
        }
      }

      for (const it of serviceItems) {
        const rec = Number(recognizedByItem.get(it.id) || 0);
        if (rec <= 0) continue;
        const qty = Number(it.quantity || 0);
        if (!(qty > 0)) continue;
        const category = it.service?.category;
        if (!category || !TREATMENT_CATEGORY_LABELS[category]) continue;
        categoryCountMap.set(category, (categoryCountMap.get(category) || 0) + qty);
        totalTreatmentCount += qty;
        const sid = it.service?.id || it.serviceId || it.id;
        if (serviceMap.has(sid)) {
          serviceMap.get(sid).count += qty;
        }
      }
    }

    const avgServiceValue =
      totalTreatmentCount > 0
        ? Math.round(totalServiceRevenue / totalTreatmentCount)
        : 0;

    const categoryDistribution = TREATMENT_CATEGORY_KEYS
      .map((key) => ({
        key,
        label: TREATMENT_CATEGORY_LABELS[key],
        revenue: Math.round(categoryRevenueMap.get(key) || 0),
        count: Math.round(categoryCountMap.get(key) || 0),
      }))
      .filter((row) => row.revenue > 0 || row.count > 0)
      .sort((a, b) => b.revenue - a.revenue);

    const serviceTable = Array.from(serviceMap.values())
      .map((row) => ({
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        categoryKey: row.categoryKey,
        categoryLabel: row.categoryLabel,
        count: Math.round(row.count),
        totalSales: Math.round(row.totalSales),
      }))
      .filter((row) => row.count > 0)
      .sort(
        (a, b) =>
          b.count - a.count ||
          b.serviceName.localeCompare(a.serviceName, "mn-MN")
      );

    const topServices = [...serviceTable]
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, topNNormalized);
    const categoryTrendRows = treatmentBuckets.map((bucket) => {
      const bucketCategory = trendCategoryMap.get(bucket) || new Map();
      const row = { bucket };
      for (const key of TREATMENT_CATEGORY_KEYS) {
        row[key] = Math.round(bucketCategory.get(key) || 0);
      }
      return row;
    });

    return res.json({
      period: { from, to, view },
      scope: { branchId: branchId || null, doctorId: doctorId || null },
      filters: {
        branches: branches.map((b) => ({ id: b.id, name: b.name })),
        doctors: doctors.map((d) => ({
          id: d.id,
          name: d.name,
          ovog: d.ovog,
          branchId: d.branchId,
        })),
      },
      topN: topNNormalized,
      kpis: {
        serviceRevenue: Math.round(totalServiceRevenue),
        treatmentCount: Math.round(totalTreatmentCount),
        avgServiceValue,
      },
      categoryDistribution,
      topServices,
      categoryTrend: {
        categories: TREATMENT_CATEGORY_KEYS.map((key) => ({
          key,
          label: TREATMENT_CATEGORY_LABELS[key],
        })),
        rows: categoryTrendRows,
      },
      serviceTable,
    });
  } catch (err) {
    console.error("GET /api/reports/main-treatment error:", err);
    return res.status(500).json({ error: "Failed to fetch main treatment report." });
  }
});

/**
 * GET /api/reports/summary
 * Query: from, to, branchId?, doctorId?, serviceId?, paymentMethod?
 */
router.get("/summary", async (req, res) => {
  try {
    const { from, to, branchId, doctorId, serviceId, paymentMethod } =
      req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ error: "from and to query parameters are required" });
    }

    const fromDate = new Date(String(from));
    const toDate = new Date(String(to));
    const toDateEnd = new Date(toDate);
    toDateEnd.setHours(23, 59, 59, 999);

    const branchFilter = branchId ? Number(branchId) : null;
    const doctorFilter = doctorId ? Number(doctorId) : null;
    const serviceFilter = serviceId ? Number(serviceId) : null;
    const paymentMethodFilter =
      typeof paymentMethod === "string" && paymentMethod.trim()
        ? paymentMethod.trim()
        : null;

    // 1) New patients
    const patientWhere = {
      createdAt: {
        gte: fromDate,
        lte: toDateEnd,
      },
    };
    if (branchFilter) {
      patientWhere.branchId = branchFilter;
    }

    const newPatientsCount = await prisma.patient.count({
      where: patientWhere,
    });

    // 2) Encounters
    const encounterWhere = {
      visitDate: {
        gte: fromDate,
        lte: toDateEnd,
      },
    };
    if (branchFilter) {
      encounterWhere.patientBook = {
        patient: {
          branchId: branchFilter,
        },
      };
    }
    if (doctorFilter) {
      encounterWhere.doctorId = doctorFilter;
    }
    if (serviceFilter) {
      encounterWhere.encounterServices = {
        some: { serviceId: serviceFilter },
      };
    }

    const encountersCount = await prisma.encounter.count({
      where: encounterWhere,
    });

    // 3) Invoices
    const invoiceWhere = {
      createdAt: {
        gte: fromDate,
        lte: toDateEnd,
      },
    };

    invoiceWhere.encounter = { AND: [] };

    if (branchFilter) {
      invoiceWhere.encounter.AND.push({
        patientBook: {
          patient: {
            branchId: branchFilter,
          },
        },
      });
    }
    if (doctorFilter) {
      invoiceWhere.encounter.AND.push({
        doctorId: doctorFilter,
      });
    }
    if (serviceFilter) {
      invoiceWhere.encounter.AND.push({
        encounterServices: {
          some: { serviceId: serviceFilter },
        },
      });
    }

    if (invoiceWhere.encounter.AND.length === 0) {
      delete invoiceWhere.encounter;
    }

    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        payments: true,
        encounter: {
          include: {
            patientBook: {
              include: { patient: true },
            },
            doctor: true,
          },
        },
      },
    });

    const filteredInvoices = paymentMethodFilter
      ? invoices.filter((inv) =>
          (inv.payments || []).some(
            (p) => p.method === paymentMethodFilter
          )
        )
      : invoices;

    const totalInvoicesCount = filteredInvoices.length;
    const totalInvoiceAmount = filteredInvoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount || 0),
      0
    );
    const totalPaidAmount = filteredInvoices.reduce((sum, inv) => {
      const invoicePaid = (inv.payments || []).reduce(
        (ps, p) => ps + Number(p.amount || 0),
        0
      );
      return sum + invoicePaid;
    }, 0);
    const totalUnpaidAmount = totalInvoiceAmount - totalPaidAmount;

    // 4) Top doctors
    const revenueByDoctor = {};
    for (const inv of filteredInvoices) {
      const docId = inv.encounter?.doctorId;
      if (!docId) continue;
      if (!revenueByDoctor[docId]) revenueByDoctor[docId] = 0;
      revenueByDoctor[docId] += Number(inv.totalAmount || 0);
    }

    const doctorIds = Object.keys(revenueByDoctor).map((id) => Number(id));
    let topDoctors = [];
    if (doctorIds.length > 0) {
      const doctors = await prisma.user.findMany({
        where: { id: { in: doctorIds } },
        select: { id: true, name: true, ovog: true, email: true },
      });

      topDoctors = doctors
        .map((doc) => ({
          id: doc.id,
          name: doc.name,
          ovog: doc.ovog,
          email: doc.email,
          revenue: revenueByDoctor[doc.id] || 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
    }

    // 5) Top services
    const encounterIds = filteredInvoices.map((inv) => inv.encounterId);
    let topServices = [];
    if (encounterIds.length > 0) {
      const encounterServices = await prisma.encounterService.findMany({
        where: {
          encounterId: { in: encounterIds },
          ...(serviceFilter ? { serviceId: serviceFilter } : {}),
        },
        include: { service: true },
      });

      const revenueByService = {};
      for (const es of encounterServices) {
        if (!es.service) continue;
        const sid = es.serviceId;
        const lineTotal =
          Number(es.price || 0) * Number(es.quantity || 1);
        if (!revenueByService[sid]) {
          revenueByService[sid] = {
            id: sid,
            name: es.service.name,
            code: es.service.code,
            revenue: 0,
          };
        }
        revenueByService[sid].revenue += lineTotal;
      }

      topServices = Object.values(revenueByService)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
    }

    return res.json({
      from: fromDate.toISOString(),
      to: toDateEnd.toISOString(),
      branchId: branchFilter,
      newPatientsCount,
      encountersCount,
      totalInvoicesCount,
      totalInvoiceAmount,
      totalPaidAmount,
      totalUnpaidAmount,
      topDoctors,
      topServices,
    });
  } catch (err) {
    console.error("GET /api/reports/summary error:", err);
    res.status(500).json({ error: "internal server error" });
  }
});

/**
 * GET /api/reports/invoices.csv
 * Query: from, to, branchId?, doctorId?, serviceId?, paymentMethod?
 */
router.get("/invoices.csv", async (req, res) => {
  try {
    const { from, to, branchId, doctorId, serviceId, paymentMethod } =
      req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ error: "from and to query parameters are required" });
    }

    const fromDate = new Date(String(from));
    const toDate = new Date(String(to));
    const toDateEnd = new Date(toDate);
    toDateEnd.setHours(23, 59, 59, 999);

    const branchFilter = branchId ? Number(branchId) : null;
    const doctorFilter = doctorId ? Number(doctorId) : null;
    const serviceFilter = serviceId ? Number(serviceId) : null;
    const paymentMethodFilter =
      typeof paymentMethod === "string" && paymentMethod.trim()
        ? paymentMethod.trim()
        : null;

    const invoiceWhere = {
      createdAt: {
        gte: fromDate,
        lte: toDateEnd,
      },
    };

    invoiceWhere.encounter = { AND: [] };

    if (branchFilter) {
      invoiceWhere.encounter.AND.push({
        patientBook: {
          patient: {
            branchId: branchFilter,
          },
        },
      });
    }
    if (doctorFilter) {
      invoiceWhere.encounter.AND.push({
        doctorId: doctorFilter,
      });
    }
    if (serviceFilter) {
      invoiceWhere.encounter.AND.push({
        encounterServices: {
          some: { serviceId: serviceFilter },
        },
      });
    }

    if (invoiceWhere.encounter.AND.length === 0) {
      delete invoiceWhere.encounter;
    }

    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        payments: true,
        eBarimtReceipt: true,
        encounter: {
          include: {
            patientBook: {
              include: { patient: true },
            },
            doctor: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const filteredInvoices = paymentMethodFilter
      ? invoices.filter((inv) =>
          (inv.payments || []).some(
            (p) => p.method === paymentMethodFilter
          )
        )
      : invoices;

    const headers = [
      "invoiceId",
      "invoiceDate",
      "branchId",
      "patientRegNo",
      "patientName",
      "doctorName",
      "totalAmount",
      "statusLegacy",
      "paidAmount",
      "paymentMethods",
      "latestPaymentTime",
      "eBarimtReceiptNumber",
      "eBarimtTime",
    ];

    const escapeCsv = (value) => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes('"') || str.includes(",") || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = [headers.join(",")];

    for (const inv of filteredInvoices) {
      const patient = inv.encounter?.patientBook?.patient;
      const doctor = inv.encounter?.doctor;

      const branchIdVal = patient?.branchId ?? "";
      const patientRegNo = patient?.regNo ?? "";
      const patientName = patient
        ? `${patient.ovog ? patient.ovog + " " : ""}${patient.name ?? ""}`
        : "";

      const doctorName = doctor
        ? `${doctor.ovog ? doctor.ovog + " " : ""}${doctor.name ?? ""}`
        : "";

      const paidAmount = (inv.payments || []).reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0
      );
      const paymentMethods = (inv.payments || [])
        .map((p) => p.method)
        .filter(Boolean)
        .join("|");

      const latestPayment = (inv.payments || []).reduce(
        (latest, p) => {
          if (!p.timestamp) return latest;
          const ts = p.timestamp;
          if (!latest || ts > latest) return ts;
          return latest;
        },
        null
      );
      const latestPaymentTime = latestPayment
        ? latestPayment.toISOString()
        : "";

      const eBarimtNumber = inv.eBarimtReceipt?.receiptNumber ?? "";
      const eBarimtTime = inv.eBarimtReceipt?.timestamp
        ? inv.eBarimtReceipt.timestamp.toISOString()
        : "";

      const row = [
        inv.id,
        inv.createdAt.toISOString(),
        branchIdVal,
        patientRegNo,
        patientName,
        doctorName,
        Number(inv.totalAmount || 0),
        inv.statusLegacy || "",
        paidAmount,
        paymentMethods,
        latestPaymentTime,
        eBarimtNumber,
        eBarimtTime,
      ].map(escapeCsv);

      rows.push(row.join(","));
    }

    const csvContent = rows.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="invoices_${from}_${to}${
        branchFilter ? "_b" + branchFilter : ""
      }${doctorFilter ? "_d" + doctorFilter : ""}${
        serviceFilter ? "_s" + serviceFilter : ""
      }.csv"`
    );

    return res.send(csvContent);
  } catch (err) {
    console.error("GET /api/reports/invoices.csv error:", err);
    res.status(500).json({ error: "internal server error" });
  }
});

/**
 * GET /api/reports/doctor
 * Query: from, to, doctorId (required), branchId?, serviceId?, paymentMethod?
 */
router.get("/doctor", async (req, res) => {
  try {
    const { from, to, doctorId, branchId, serviceId, paymentMethod } =
      req.query;

    if (!from || !to || !doctorId) {
      return res.status(400).json({
        error: "from, to and doctorId query parameters are required",
      });
    }

    const fromDate = new Date(String(from));
    const toDate = new Date(String(to));
    const toDateEnd = new Date(toDate);
    toDateEnd.setHours(23, 59, 59, 999);

    const doctorFilter = Number(doctorId);
    const branchFilter = branchId ? Number(branchId) : null;
    const serviceFilter = serviceId ? Number(serviceId) : null;
    const paymentMethodFilter =
      typeof paymentMethod === "string" && paymentMethod.trim()
        ? paymentMethod.trim()
        : null;

    const doctor = await prisma.user.findUnique({
      where: { id: doctorFilter },
      select: { id: true, name: true, ovog: true, email: true },
    });
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    const encounterWhere = {
      doctorId: doctorFilter,
      visitDate: {
        gte: fromDate,
        lte: toDateEnd,
      },
    };
    if (branchFilter) {
      encounterWhere.patientBook = {
        patient: {
          branchId: branchFilter,
        },
      };
    }
    if (serviceFilter) {
      encounterWhere.encounterServices = {
        some: { serviceId: serviceFilter },
      };
    }

    const encounters = await prisma.encounter.findMany({
      where: encounterWhere,
      include: {
        patientBook: {
          include: { patient: true },
        },
        invoice: {
          include: { payments: true },
        },
        encounterServices: {
          include: { service: true },
        },
      },
    });

    const encountersCount = encounters.length;

    const uniquePatientIds = new Set(
      encounters
        .map((e) => e.patientBook?.patient?.id)
        .filter((id) => id !== undefined && id !== null)
    );

    const newPatientsCount = await prisma.patient.count({
      where: {
        id: { in: Array.from(uniquePatientIds) },
        createdAt: { gte: fromDate, lte: toDateEnd },
        ...(branchFilter ? { branchId: branchFilter } : {}),
      },
    });

    const invoices = encounters
      .map((e) => e.invoice)
      .filter((inv) => !!inv);

    const filteredInvoices = paymentMethodFilter
      ? invoices.filter((inv) =>
          (inv.payments || []).some(
            (p) => p.method === paymentMethodFilter
          )
        )
      : invoices;

    const invoiceCount = filteredInvoices.length;
    const totalInvoiceAmount = filteredInvoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount || 0),
      0
    );
    const totalPaidAmount = filteredInvoices.reduce((sum, inv) => {
      const paid = (inv.payments || []).reduce(
        (ps, p) => ps + Number(p.amount || 0),
        0
      );
      return sum + paid;
    }, 0);
    const totalUnpaidAmount = totalInvoiceAmount - totalPaidAmount;

    const allEncounterServices = encounters.flatMap(
      (e) => e.encounterServices || []
    );
    const filteredEncounterServices = serviceFilter
      ? allEncounterServices.filter((es) => es.serviceId === serviceFilter)
      : allEncounterServices;

    const servicesMap = {};
    for (const es of filteredEncounterServices) {
      if (!es.service) continue;
      const sid = es.serviceId;
      if (!servicesMap[sid]) {
        servicesMap[sid] = {
          serviceId: sid,
          code: es.service.code,
          name: es.service.name,
          totalQuantity: 0,
          revenue: 0,
        };
      }
      const qty = Number(es.quantity || 1);
      const lineTotal = Number(es.price || 0) * qty;
      servicesMap[sid].totalQuantity += qty;
      servicesMap[sid].revenue += lineTotal;
    }

    const services = Object.values(servicesMap).sort(
      (a, b) => b.revenue - a.revenue
    );

    const dailyMap = {};
    for (const e of encounters) {
      const day = e.visitDate.toISOString().slice(0, 10);
      if (!dailyMap[day]) {
        dailyMap[day] = {
          date: day,
          encounters: 0,
          revenue: 0,
        };
      }
      dailyMap[day].encounters += 1;

      const inv = e.invoice;
      if (inv) {
        const hasMethod =
          !paymentMethodFilter ||
          (inv.payments || []).some(
            (p) => p.method === paymentMethodFilter
          );
        if (hasMethod) {
          dailyMap[day].revenue += Number(inv.totalAmount || 0);
        }
      }
    }

    const daily = Object.values(dailyMap).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    );

    return res.json({
      doctor,
      from: fromDate.toISOString(),
      to: toDateEnd.toISOString(),
      branchId: branchFilter,
      totals: {
        encountersCount,
        invoiceCount,
        totalInvoiceAmount,
        totalPaidAmount,
        totalUnpaidAmount,
        newPatientsCount,
      },
      services,
      daily,
    });
  } catch (err) {
    console.error("GET /api/reports/doctor error:", err);
    res.status(500).json({ error: "internal server error" });
  }
});

/**
 * GET /api/reports/branches
 * Query: from, to
 * Optional: doctorId?, serviceId?, paymentMethod?
 *
 * Returns per-branch metrics for the selected period.
 */
router.get("/branches", async (req, res) => {
  try {
    const { from, to, doctorId, serviceId, paymentMethod } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        error: "from and to query parameters are required",
      });
    }

    const fromDate = new Date(String(from));
    const toDate = new Date(String(to));
    const toDateEnd = new Date(toDate);
    toDateEnd.setHours(23, 59, 59, 999);

    const doctorFilter = doctorId ? Number(doctorId) : null;
    const serviceFilter = serviceId ? Number(serviceId) : null;
    const paymentMethodFilter =
      typeof paymentMethod === "string" && paymentMethod.trim()
        ? paymentMethod.trim()
        : null;

    const branches = await prisma.branch.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    const results = [];

    for (const branch of branches) {
      const branchIdVal = branch.id;

      // Patients for this branch
      const patientWhere = {
        createdAt: {
          gte: fromDate,
          lte: toDateEnd,
        },
        branchId: branchIdVal,
      };

      const newPatientsCount = await prisma.patient.count({
        where: patientWhere,
      });

      // Encounters for this branch
      const encounterWhere = {
        visitDate: {
          gte: fromDate,
          lte: toDateEnd,
        },
        patientBook: {
          patient: {
            branchId: branchIdVal,
          },
        },
      };

      if (doctorFilter) {
        encounterWhere.doctorId = doctorFilter;
      }
      if (serviceFilter) {
        encounterWhere.encounterServices = {
          some: { serviceId: serviceFilter },
        };
      }

      const encountersCount = await prisma.encounter.count({
        where: encounterWhere,
      });

      // Invoices via encounters for this branch
      const invoiceWhere = {
        createdAt: {
          gte: fromDate,
          lte: toDateEnd,
        },
        encounter: {
          patientBook: {
            patient: {
              branchId: branchIdVal,
            },
          },
        },
      };

      if (doctorFilter) {
        invoiceWhere.encounter.doctorId = doctorFilter;
      }
      if (serviceFilter) {
        invoiceWhere.encounter.encounterServices = {
          some: { serviceId: serviceFilter },
        };
      }

      const invoices = await prisma.invoice.findMany({
        where: invoiceWhere,
        include: {
          payments: true,
        },
      });

      const filteredInvoices = paymentMethodFilter
        ? invoices.filter((inv) =>
            (inv.payments || []).some(
              (p) => p.method === paymentMethodFilter
            )
          )
        : invoices;

      const invoiceCount = filteredInvoices.length;

      const totalInvoiceAmount = filteredInvoices.reduce(
        (sum, inv) => sum + Number(inv.totalAmount || 0),
        0
      );
      const totalPaidAmount = filteredInvoices.reduce((sum, inv) => {
        const paid = (inv.payments || []).reduce(
          (ps, p) => ps + Number(p.amount || 0),
          0
        );
        return sum + paid;
      }, 0);
      const totalUnpaidAmount = totalInvoiceAmount - totalPaidAmount;

      results.push({
        branchId: branchIdVal,
        branchName: branch.name,
        newPatientsCount,
        encountersCount,
        invoiceCount,
        totalInvoiceAmount,
        totalPaidAmount,
        totalUnpaidAmount,
      });
    }

    return res.json({
      from: fromDate.toISOString(),
      to: toDateEnd.toISOString(),
      branches: results,
    });
  } catch (err) {
    console.error("GET /api/reports/branches error:", err);
    res.status(500).json({ error: "internal server error" });
  }
});

// GET /api/reports/daily-revenue?date=YYYY-MM-DD&branchId=optional
router.get("/daily-revenue", async (req, res) => {
  try {
    const { date, branchId } = req.query;

    if (!date || typeof date !== "string") {
      return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
    }

    const [y, m, d] = date.split("-").map(Number);
    if (!y || !m || !d) {
      return res.status(400).json({ error: "invalid date format" });
    }

    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const end = new Date(y, m - 1, d, 23, 59, 59, 999);

    const whereInvoice = {
      createdAt: {
        gte: start,
        lte: end,
      },
      statusLegacy: "paid",
    };

    if (branchId) {
      const bid = Number(branchId);
      if (!Number.isNaN(bid)) {
        whereInvoice.encounter = {
          patientBook: {
            patient: {
              branchId: bid,
            },
          },
        };
      }
    }

    const result = await prisma.invoice.aggregate({
      _sum: {
        totalAmount: true,
      },
      where: whereInvoice,
    });

    const total = result._sum.totalAmount || 0;
    return res.json({ total });
  } catch (err) {
    console.error("GET /api/reports/daily-revenue error:", err);
    return res
      .status(500)
      .json({ error: "failed to compute daily revenue" });
  }
});

/**
 * GET /api/reports/clinic
 * Clinic-level report for the Эмнэлэг page.
 * Query: from (YYYY-MM-DD), to (YYYY-MM-DD), branchId? (number)
 *
 * Returns:
 *  - topCards: { todayRevenue, todayOccupancyPct, monthlyAvgRevenue }
 *  - dailyData: [{ date, revenue, occupancyPct, doctorCount, completedAppointments }]
 *  - branchBreakdown: {
 *      revenue: [{ branchId, branchName, value }],
 *      occupancy: [...],
 *      doctorCount: [...],
 *      completedAppointments: [...],
 *    }
 *  - doctorBreakdown: same shape but per-doctor (only when branchId filter is set)
 */
router.get("/clinic", async (req, res) => {
  try {
    const { from, to, branchId } = req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ error: "from and to query parameters are required" });
    }

    const [fy, fm, fd] = String(from).split("-").map(Number);
    const [ty, tm, td] = String(to).split("-").map(Number);

    const fromDate = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
    const toDate = new Date(ty, tm - 1, td, 23, 59, 59, 999);

    const branchFilter = branchId ? Number(branchId) : null;

    // ---------- helper: iterate dates ----------
    function eachDay(start, end) {
      const days = [];
      const cur = new Date(start);
      cur.setHours(0, 0, 0, 0);
      const last = new Date(end);
      last.setHours(0, 0, 0, 0);
      while (cur <= last) {
        days.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
      return days;
    }

    // ---------- helper: parse "HH:MM" to minutes since midnight ----------
    function hmToMin(hm) {
      if (!hm || typeof hm !== "string") return 0;
      const [h, m] = hm.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    }

    // ---------- fetch all branches ----------
    const allBranches = await prisma.branch.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    const targetBranches = branchFilter
      ? allBranches.filter((b) => b.id === branchFilter)
      : allBranches;

    const branchIds = targetBranches.map((b) => b.id);

    // ---------- fetch payments (revenue) – identical aggregation to Санхүү daily-income ----------
    const paymentWhere = {
      timestamp: { gte: fromDate, lte: toDate },
    };
    if (branchFilter) {
      paymentWhere.invoice = { branchId: branchFilter };
    }

    // Also fetch all active payment method configs for the response
    const paymentMethodConfigs = await prisma.paymentMethodConfig.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { key: true, label: true },
    });

    const payments = await prisma.payment.findMany({
      where: paymentWhere,
      select: {
        amount: true,
        method: true,
        timestamp: true,
        invoice: {
          select: {
            branchId: true,
            encounter: {
              select: { doctorId: true },
            },
          },
        },
      },
    });

    // ---------- fetch appointments (status, count, occupancy) ----------
    const appointments = await prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: fromDate, lte: toDate },
        branchId: { in: branchIds },
      },
      select: {
        id: true,
        branchId: true,
        doctorId: true,
        scheduledAt: true,
        endAt: true,
        status: true,
      },
    });

    // ---------- fetch doctor schedules (for occupancy & doctor count) ----------
    const schedules = await prisma.doctorSchedule.findMany({
      where: {
        date: { gte: fromDate, lte: toDate },
        branchId: { in: branchIds },
      },
      select: {
        doctorId: true,
        branchId: true,
        date: true,
        startTime: true,
        endTime: true,
      },
    });

    // ---------- pre-group revenue by date/branch/doctor/method ----------
    const revenueByDate = {};
    const revenueByBranch = {};
    const revenueByDoctor = {};
    // per-branch-per-date revenue for stacked bar charts
    const revenueByBranchDate = {}; // { [branchId]: { [date]: number } }
    // per-payment-method breakdowns
    const revenueByMethod = {}; // { [methodKey]: number }
    const revenueByMethodDate = {}; // { [methodKey]: { [date]: number } }
    const revenueByMethodBranchDate = {}; // { [methodKey]: { [branchId]: { [date]: number } } }

    for (const p of payments) {
      const date = p.timestamp.toISOString().slice(0, 10);
      const bId = p.invoice?.branchId;
      const dId = p.invoice?.encounter?.doctorId;
      const amt = Number(p.amount || 0);
      const mKey = p.method || "OTHER";

      revenueByDate[date] = (revenueByDate[date] || 0) + amt;
      if (bId) {
        revenueByBranch[bId] = (revenueByBranch[bId] || 0) + amt;
        if (!revenueByBranchDate[bId]) revenueByBranchDate[bId] = {};
        revenueByBranchDate[bId][date] = (revenueByBranchDate[bId][date] || 0) + amt;
      }
      if (dId) revenueByDoctor[dId] = (revenueByDoctor[dId] || 0) + amt;

      // Payment method breakdowns
      revenueByMethod[mKey] = (revenueByMethod[mKey] || 0) + amt;
      if (!revenueByMethodDate[mKey]) revenueByMethodDate[mKey] = {};
      revenueByMethodDate[mKey][date] = (revenueByMethodDate[mKey][date] || 0) + amt;
      if (bId) {
        if (!revenueByMethodBranchDate[mKey]) revenueByMethodBranchDate[mKey] = {};
        if (!revenueByMethodBranchDate[mKey][bId]) revenueByMethodBranchDate[mKey][bId] = {};
        revenueByMethodBranchDate[mKey][bId][date] =
          (revenueByMethodBranchDate[mKey][bId][date] || 0) + amt;
      }
    }

    // ---------- completed appointments by date/branch/doctor ----------
    const completedByDate = {};
    const completedByBranch = {};
    const completedByDoctor = {};
    // per-branch-per-date for stacked bar charts
    const completedByBranchDate = {}; // { [branchId]: { [date]: number } }

    for (const appt of appointments) {
      const s = appt.status?.toLowerCase();
      if (s !== "completed") continue;
      const date = appt.scheduledAt.toISOString().slice(0, 10);
      completedByDate[date] = (completedByDate[date] || 0) + 1;
      completedByBranch[appt.branchId] = (completedByBranch[appt.branchId] || 0) + 1;
      if (!completedByBranchDate[appt.branchId]) completedByBranchDate[appt.branchId] = {};
      completedByBranchDate[appt.branchId][date] =
        (completedByBranchDate[appt.branchId][date] || 0) + 1;
      if (appt.doctorId)
        completedByDoctor[appt.doctorId] = (completedByDoctor[appt.doctorId] || 0) + 1;
    }

    // ---------- schedules: available minutes and unique doctors per date/branch ----------
    const schedByDate = {}; // date -> { availMins, doctorSet }
    const schedByBranch = {}; // branchId -> { availMins, doctorSet }
    const schedByDoctor = {}; // doctorId -> { availMins, scheduledDays }
    // per-branch-per-date schedule data
    const schedByBranchDate = {}; // { [branchId]: { [date]: { availMins, doctorSet } } }

    for (const sch of schedules) {
      const date =
        sch.date instanceof Date
          ? sch.date.toISOString().slice(0, 10)
          : String(sch.date).slice(0, 10);
      const avail = hmToMin(sch.endTime) - hmToMin(sch.startTime);
      if (avail <= 0) continue;

      if (!schedByDate[date]) schedByDate[date] = { availMins: 0, doctorSet: new Set() };
      schedByDate[date].availMins += avail;
      schedByDate[date].doctorSet.add(sch.doctorId);

      if (!schedByBranch[sch.branchId])
        schedByBranch[sch.branchId] = { availMins: 0, doctorSet: new Set() };
      schedByBranch[sch.branchId].availMins += avail;
      schedByBranch[sch.branchId].doctorSet.add(sch.doctorId);

      if (!schedByDoctor[sch.doctorId])
        schedByDoctor[sch.doctorId] = { availMins: 0, scheduledDays: 0 };
      schedByDoctor[sch.doctorId].availMins += avail;
      schedByDoctor[sch.doctorId].scheduledDays += 1;

      if (!schedByBranchDate[sch.branchId]) schedByBranchDate[sch.branchId] = {};
      if (!schedByBranchDate[sch.branchId][date])
        schedByBranchDate[sch.branchId][date] = { availMins: 0, doctorSet: new Set() };
      schedByBranchDate[sch.branchId][date].availMins += avail;
      schedByBranchDate[sch.branchId][date].doctorSet.add(sch.doctorId);
    }

    // ---------- slot-based occupancy (completed filled 30-min slots) ----------
    // Rules:
    //  - Possible slots = floor(workMins / 30) per doctor per day (union of schedule windows)
    //  - Filled slot  = a slot that has ≥1 COMPLETED appointment whose start time falls in it
    //  - Double-bookings do NOT increase filled slots (max 1 filled per slot)
    //  - Branch occupancyPct = filledSlots / possibleSlots * 100
    //  - "Нийт" dailyPct = simple average of all active branch percentages for that day
    const SLOT_MINS = 30;

    // completedSlotsByDoctorDate[doctorId][date] = Set<slotKey>
    // slotKey = floor(appointmentHHMM_in_minutes / SLOT_MINS)
    const completedSlotsByDoctorDate = {};
    for (const appt of appointments) {
      if (appt.status?.toLowerCase() !== "completed") continue;
      if (!appt.doctorId) continue;
      const date = appt.scheduledAt.toISOString().slice(0, 10);
      const apptMins = appt.scheduledAt.getHours() * 60 + appt.scheduledAt.getMinutes();
      const slotKey = Math.floor(apptMins / SLOT_MINS);
      if (!completedSlotsByDoctorDate[appt.doctorId])
        completedSlotsByDoctorDate[appt.doctorId] = {};
      if (!completedSlotsByDoctorDate[appt.doctorId][date])
        completedSlotsByDoctorDate[appt.doctorId][date] = new Set();
      completedSlotsByDoctorDate[appt.doctorId][date].add(slotKey);
    }

    // Group schedules by (doctorId, date) to properly union multiple windows per day
    const schedGrouped = {};
    for (const sch of schedules) {
      const date =
        sch.date instanceof Date ? sch.date.toISOString().slice(0, 10) : String(sch.date).slice(0, 10);
      const startMins = hmToMin(sch.startTime);
      const endMins = hmToMin(sch.endTime);
      if (endMins <= startMins) continue;
      if (!schedGrouped[sch.doctorId]) schedGrouped[sch.doctorId] = {};
      if (!schedGrouped[sch.doctorId][date])
        schedGrouped[sch.doctorId][date] = { branchId: sch.branchId, windows: [] };
      schedGrouped[sch.doctorId][date].windows.push({ startMins, endMins });
    }

    // slotsByBranchDate[branchId][date] = { possible, filled }
    // slotsByDoctor[doctorId] = { possible, filled } (aggregated across all dates)
    const slotsByBranchDate = {};
    const slotsByDoctor = {};
    for (const [doctorIdStr, dateMap] of Object.entries(schedGrouped)) {
      const doctorId = Number(doctorIdStr);
      for (const [date, { branchId, windows }] of Object.entries(dateMap)) {
        // Build possible slot set as union of all schedule windows for this doctor+day
        const possibleSlotSet = new Set();
        for (const { startMins, endMins } of windows) {
          const firstSlot = Math.ceil(startMins / SLOT_MINS);
          const lastSlot = Math.floor(endMins / SLOT_MINS) - 1;
          for (let s = firstSlot; s <= lastSlot; s++) possibleSlotSet.add(s);
        }
        const possible = possibleSlotSet.size;
        if (possible === 0) continue;

        // Count filled slots: completed-appointment slots that fall within schedule window
        const completedSlots = completedSlotsByDoctorDate[doctorId]?.[date] || new Set();
        let filled = 0;
        for (const slotKey of completedSlots) {
          if (possibleSlotSet.has(slotKey)) filled++;
        }

        if (!slotsByBranchDate[branchId]) slotsByBranchDate[branchId] = {};
        if (!slotsByBranchDate[branchId][date])
          slotsByBranchDate[branchId][date] = { possible: 0, filled: 0 };
        slotsByBranchDate[branchId][date].possible += possible;
        slotsByBranchDate[branchId][date].filled += filled;

        if (!slotsByDoctor[doctorId]) slotsByDoctor[doctorId] = { possible: 0, filled: 0 };
        slotsByDoctor[doctorId].possible += possible;
        slotsByDoctor[doctorId].filled += filled;
      }
    }

    // ---------- daily data array (totals) ----------
    const days = eachDay(fromDate, toDate);
    const dailyData = days.map((date) => {
      const revenue = revenueByDate[date] || 0;
      // "Нийт" occupancyPct = simple average of active-branch percentages for this day
      const branchPcts = targetBranches
        .map((b) => slotsByBranchDate[b.id]?.[date])
        .filter((s) => s?.possible > 0)
        .map((s) => Math.round((s.filled / s.possible) * 100));
      const occupancyPct =
        branchPcts.length > 0
          ? Math.round(branchPcts.reduce((a, v) => a + v, 0) / branchPcts.length)
          : 0;
      const doctorCount = schedByDate[date]?.doctorSet?.size || 0;
      const completedAppointments = completedByDate[date] || 0;
      // Per-method revenue for this date
      const revenueByMethodForDate = {};
      for (const mKey of Object.keys(revenueByMethodDate)) {
        revenueByMethodForDate[mKey] = revenueByMethodDate[mKey][date] || 0;
      }
      return { date, revenue, occupancyPct, doctorCount, completedAppointments, revenueByMethod: revenueByMethodForDate };
    });

    // ---------- per-branch daily data (for stacked bar charts) ----------
    const branchDailyData = targetBranches.map((b) => ({
      branchId: b.id,
      branchName: b.name,
      daily: days.map((date) => {
        const revenue = revenueByBranchDate[b.id]?.[date] || 0;
        const bSlots = slotsByBranchDate[b.id]?.[date];
        const occupancyPct =
          bSlots?.possible > 0 ? Math.round((bSlots.filled / bSlots.possible) * 100) : 0;
        const doctorCount = schedByBranchDate[b.id]?.[date]?.doctorSet?.size || 0;
        const completedAppointments = completedByBranchDate[b.id]?.[date] || 0;
        // Per-method revenue for this branch+date
        const revenueByMethodForDate = {};
        for (const mKey of Object.keys(revenueByMethodBranchDate)) {
          revenueByMethodForDate[mKey] = revenueByMethodBranchDate[mKey][b.id]?.[date] || 0;
        }
        return { date, revenue, occupancyPct, doctorCount, completedAppointments, revenueByMethod: revenueByMethodForDate };
      }),
    }));

    // ---------- branch breakdowns (pie chart totals) ----------
    const branchBreakdown = {
      revenue: targetBranches.map((b) => ({
        branchId: b.id,
        branchName: b.name,
        value: revenueByBranch[b.id] || 0,
      })),
      occupancy: targetBranches.map((b) => {
        // Average daily occupancy percentage for this branch (only days with schedule data)
        const activeDays = days.filter((d) => slotsByBranchDate[b.id]?.[d]?.possible > 0);
        if (activeDays.length === 0) return { branchId: b.id, branchName: b.name, value: 0 };
        const avgPct = Math.round(
          activeDays.reduce((s, d) => {
            const sl = slotsByBranchDate[b.id][d];
            return s + Math.round((sl.filled / sl.possible) * 100);
          }, 0) / activeDays.length
        );
        return { branchId: b.id, branchName: b.name, value: avgPct };
      }),
      doctorCount: targetBranches.map((b) => ({
        branchId: b.id,
        branchName: b.name,
        value: schedByBranch[b.id]?.doctorSet?.size || 0,
      })),
      completedAppointments: targetBranches.map((b) => ({
        branchId: b.id,
        branchName: b.name,
        value: completedByBranch[b.id] || 0,
      })),
    };

    // ---------- doctor breakdowns (only if branch is filtered) ----------
    let doctorBreakdown = null;
    if (branchFilter) {
      const doctorIds = [
        ...new Set([
          ...Object.keys(revenueByDoctor).map(Number),
          ...Object.keys(completedByDoctor).map(Number),
          ...Object.keys(schedByDoctor).map(Number),
        ]),
      ];
      const doctorRecords =
        doctorIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: doctorIds } },
              select: { id: true, name: true, ovog: true },
            })
          : [];
      const docMap = {};
      for (const d of doctorRecords) docMap[d.id] = d;

      doctorBreakdown = {
        revenue: doctorIds.map((dId) => ({
          doctorId: dId,
          doctorName: docMap[dId]
            ? [docMap[dId].ovog, docMap[dId].name].filter(Boolean).join(" ")
            : `Эмч #${dId}`,
          value: revenueByDoctor[dId] || 0,
        })),
        occupancy: doctorIds.map((dId) => {
          const slots = slotsByDoctor[dId];
          return {
            doctorId: dId,
            doctorName: docMap[dId]
              ? [docMap[dId].ovog, docMap[dId].name].filter(Boolean).join(" ")
              : `Эмч #${dId}`,
            value: slots?.possible > 0 ? Math.round((slots.filled / slots.possible) * 100) : 0,
          };
        }),
        doctorCount: doctorIds.map((dId) => ({
          doctorId: dId,
          doctorName: docMap[dId]
            ? [docMap[dId].ovog, docMap[dId].name].filter(Boolean).join(" ")
            : `Эмч #${dId}`,
          value: schedByDoctor[dId]?.scheduledDays || 0,
        })),
        completedAppointments: doctorIds.map((dId) => ({
          doctorId: dId,
          doctorName: docMap[dId]
            ? [docMap[dId].ovog, docMap[dId].name].filter(Boolean).join(" ")
            : `Эмч #${dId}`,
          value: completedByDoctor[dId] || 0,
        })),
      };
    }

    // ---------- top cards (always use today's data, independent of date range) ----------
    const today = new Date();

    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const todayEndOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    // Card 1: today's revenue from specific payment methods only (independent of date range)
    const todayPaymentWhere = {
      timestamp: { gte: todayStart, lte: todayEndOfDay },
      method: { in: INCOME_PAYMENT_METHODS },
    };
    if (branchFilter) todayPaymentWhere.invoice = { branchId: branchFilter };
    const todayPaymentsResult = await prisma.payment.findMany({
      where: todayPaymentWhere,
      select: { amount: true },
    });
    const todayRevenue = todayPaymentsResult.reduce((s, p) => s + Number(p.amount || 0), 0);

    // Card 2: today's occupancy (any appointment, not just completed, independent of date range)
    let todayOccupancyPct = 0;
    {
      const todayAppts = await prisma.appointment.findMany({
        where: {
          scheduledAt: { gte: todayStart, lte: todayEndOfDay },
          branchId: { in: branchIds },
        },
        select: { branchId: true, doctorId: true, scheduledAt: true },
      });
      const todayScheds = await prisma.doctorSchedule.findMany({
        where: {
          date: { gte: todayStart, lte: todayEndOfDay },
          branchId: { in: branchIds },
        },
        select: { doctorId: true, branchId: true, date: true, startTime: true, endTime: true },
      });

      // Group schedules by (doctorId, date)
      const todaySchedGrouped = {};
      for (const sch of todayScheds) {
        const date =
          sch.date instanceof Date
            ? sch.date.toISOString().slice(0, 10)
            : String(sch.date).slice(0, 10);
        const startMins = hmToMin(sch.startTime);
        const endMins = hmToMin(sch.endTime);
        if (endMins <= startMins) continue;
        if (!todaySchedGrouped[sch.doctorId]) todaySchedGrouped[sch.doctorId] = {};
        if (!todaySchedGrouped[sch.doctorId][date])
          todaySchedGrouped[sch.doctorId][date] = { branchId: sch.branchId, windows: [] };
        todaySchedGrouped[sch.doctorId][date].windows.push({ startMins, endMins });
      }

      // Any appointment (regardless of status) fills a slot
      const todayApptSlots = {};
      for (const appt of todayAppts) {
        if (!appt.doctorId) continue;
        const date = appt.scheduledAt.toISOString().slice(0, 10);
        const apptMins = appt.scheduledAt.getHours() * 60 + appt.scheduledAt.getMinutes();
        const slotKey = Math.floor(apptMins / SLOT_MINS);
        if (!todayApptSlots[appt.doctorId]) todayApptSlots[appt.doctorId] = {};
        if (!todayApptSlots[appt.doctorId][date])
          todayApptSlots[appt.doctorId][date] = new Set();
        todayApptSlots[appt.doctorId][date].add(slotKey);
      }

      // Compute per-branch slot counts for today
      const todaySlotsByBranch = {};
      for (const [doctorIdStr, dateMap] of Object.entries(todaySchedGrouped)) {
        const doctorId = Number(doctorIdStr);
        for (const [date, { branchId: bId, windows }] of Object.entries(dateMap)) {
          const possibleSlotSet = new Set();
          for (const { startMins, endMins } of windows) {
            const firstSlot = Math.ceil(startMins / SLOT_MINS);
            const lastSlot = Math.floor(endMins / SLOT_MINS) - 1;
            for (let s = firstSlot; s <= lastSlot; s++) possibleSlotSet.add(s);
          }
          const possible = possibleSlotSet.size;
          if (possible === 0) continue;
          const apptSlots = todayApptSlots[doctorId]?.[date] || new Set();
          let filled = 0;
          for (const slotKey of apptSlots) {
            if (possibleSlotSet.has(slotKey)) filled++;
          }
          if (!todaySlotsByBranch[bId]) todaySlotsByBranch[bId] = { possible: 0, filled: 0 };
          todaySlotsByBranch[bId].possible += possible;
          todaySlotsByBranch[bId].filled += filled;
        }
      }

      const todayBranchPcts = targetBranches
        .map((b) => todaySlotsByBranch[b.id])
        .filter((s) => s?.possible > 0)
        .map((s) => Math.round((s.filled / s.possible) * 100));
      todayOccupancyPct =
        todayBranchPcts.length > 0
          ? Math.round(todayBranchPcts.reduce((a, v) => a + v, 0) / todayBranchPcts.length)
          : 0;
    }

    // Card 3: current month daily average revenue (same payment methods, 1st→today, independent of date range)
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
    const monthPaymentWhere = {
      timestamp: { gte: firstOfMonth, lte: todayEndOfDay },
      method: { in: INCOME_PAYMENT_METHODS },
    };
    if (branchFilter) monthPaymentWhere.invoice = { branchId: branchFilter };
    const monthPaymentsResult = await prisma.payment.findMany({
      where: monthPaymentWhere,
      select: { amount: true, timestamp: true },
    });
    const monthRevenueByDate = {};
    for (const p of monthPaymentsResult) {
      const d = p.timestamp.toISOString().slice(0, 10);
      monthRevenueByDate[d] = (monthRevenueByDate[d] || 0) + Number(p.amount || 0);
    }
    const monthDays = eachDay(firstOfMonth, today);
    const monthTotal = monthDays.reduce((s, d) => s + (monthRevenueByDate[d] || 0), 0);
    const monthlyAvgRevenue = monthDays.length > 0 ? Math.round(monthTotal / monthDays.length) : 0;

    return res.json({
      topCards: {
        todayRevenue,
        todayOccupancyPct,
        monthlyAvgRevenue,
      },
      branches: targetBranches,
      dailyData,
      branchDailyData,
      branchBreakdown,
      doctorBreakdown,
      paymentTypes: paymentMethodConfigs,
      revenueByMethod,
    });
  } catch (err) {
    console.error("GET /api/reports/clinic error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * GET /api/reports/appointments-report
 * Appointment booking page report.
 * Query: from (YYYY-MM-DD), to (YYYY-MM-DD), branchId? (number)
 *
 * Returns:
 *  - branches: [{ id, name }]
 *  - patientDailyData: [{ date, total, newCount, returningCount }]
 *  - branchPatientDailyData: [{ branchId, branchName, daily: [{ date, total, newCount, returningCount }] }]
 *  - ratesDailyData: [{ date, total, fillRate, noShowRate, cancelRate }]
 *  - branchRatesDailyData: [{ branchId, branchName, daily: [{ date, total, fillRate, noShowRate, cancelRate }] }]
 */
router.get("/appointments-report", async (req, res) => {
  try {
    const { from, to, branchId } = req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ error: "from and to query parameters are required" });
    }

    const [fy, fm, fd] = String(from).split("-").map(Number);
    const [ty, tm, td] = String(to).split("-").map(Number);
    const fromDate = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
    const toDate = new Date(ty, tm - 1, td, 23, 59, 59, 999);

    const branchFilter = branchId ? Number(branchId) : null;

    // ---------- helper: iterate dates ----------
    function eachDay(start, end) {
      const days = [];
      const cur = new Date(start);
      cur.setHours(0, 0, 0, 0);
      const last = new Date(end);
      last.setHours(0, 0, 0, 0);
      while (cur <= last) {
        days.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
      return days;
    }

    // ---------- helper: parse "HH:MM" to minutes since midnight ----------
    function hmToMin(hm) {
      if (!hm || typeof hm !== "string") return 0;
      const [h, m] = hm.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    }

    // ---------- fetch all branches ----------
    const allBranches = await prisma.branch.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    const targetBranches = branchFilter
      ? allBranches.filter((b) => b.id === branchFilter)
      : allBranches;

    const branchIds = targetBranches.map((b) => b.id);

    // ---------- fetch all appointments (any status) ----------
    const appointments = await prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: fromDate, lte: toDate },
        branchId: { in: branchIds },
      },
      select: {
        id: true,
        branchId: true,
        doctorId: true,
        patientId: true,
        scheduledAt: true,
        status: true,
      },
      orderBy: { scheduledAt: "asc" },
    });

    // ---------- fetch doctor schedules (for fill rate) ----------
    const schedules = await prisma.doctorSchedule.findMany({
      where: {
        date: { gte: fromDate, lte: toDate },
        branchId: { in: branchIds },
      },
      select: {
        doctorId: true,
        branchId: true,
        date: true,
        startTime: true,
        endTime: true,
      },
    });

    const days = eachDay(fromDate, toDate);

    // ──────────────────────────────────────────────────────────────
    // SECTION 1: Patient counting (new vs returning)
    // ──────────────────────────────────────────────────────────────
    // Sort appointments by patientId then scheduledAt (already ordered by scheduledAt)
    // For each patient, the chronologically FIRST appointment in the period is "new",
    // all subsequent appointments (same or different day) are "returning".
    // If 2 appointments same day: count = 2.
    // Per branch: patient's first appointment IN THAT BRANCH is "new" for that branch.

    // Track first appearance per patient (globally across branches)
    const patientFirstApptId = new Map(); // patientId -> first appt id globally

    // Sort by scheduledAt to correctly assign "new"
    const sortedAppts = [...appointments].sort(
      (a, b) => a.scheduledAt - b.scheduledAt
    );

    for (const appt of sortedAppts) {
      if (!appt.patientId) continue;
      if (!patientFirstApptId.has(appt.patientId)) {
        patientFirstApptId.set(appt.patientId, appt.id);
      }
    }

    // patientByDate[date] = { total, newCount, returningCount }
    const patientByDate = {};
    // patientByBranchDate[branchId][date] = { total, newCount, returningCount }
    const patientByBranchDate = {};

    // Per-branch: track first appointment of each patient in that branch
    // Branch-level "new" = first appearance of patient in that branch
    const patientFirstInBranch = new Map(); // `${patientId}-${branchId}` -> first appt id in branch

    for (const appt of sortedAppts) {
      const date = appt.scheduledAt.toISOString().slice(0, 10);
      const bId = appt.branchId;

      // Global new/returning
      const isGlobalNew = appt.patientId
        ? patientFirstApptId.get(appt.patientId) === appt.id
        : false;

      if (!patientByDate[date])
        patientByDate[date] = { total: 0, newCount: 0, returningCount: 0 };
      patientByDate[date].total += 1;
      if (isGlobalNew) patientByDate[date].newCount += 1;
      else patientByDate[date].returningCount += 1;

      // Branch-level new/returning
      if (!patientByBranchDate[bId]) patientByBranchDate[bId] = {};
      if (!patientByBranchDate[bId][date])
        patientByBranchDate[bId][date] = { total: 0, newCount: 0, returningCount: 0 };
      patientByBranchDate[bId][date].total += 1;

      const branchKey = `${appt.patientId}-${bId}`;
      const isBranchNew = appt.patientId
        ? !patientFirstInBranch.has(branchKey)
        : false;
      if (appt.patientId && isBranchNew) {
        patientFirstInBranch.set(branchKey, appt.id);
      }
      if (isBranchNew) patientByBranchDate[bId][date].newCount += 1;
      else patientByBranchDate[bId][date].returningCount += 1;
    }

    // Build patientDailyData array
    const patientDailyData = days.map((date) => ({
      date,
      total: patientByDate[date]?.total || 0,
      newCount: patientByDate[date]?.newCount || 0,
      returningCount: patientByDate[date]?.returningCount || 0,
    }));

    // Build branchPatientDailyData
    const branchPatientDailyData = targetBranches.map((b) => ({
      branchId: b.id,
      branchName: b.name,
      daily: days.map((date) => ({
        date,
        total: patientByBranchDate[b.id]?.[date]?.total || 0,
        newCount: patientByBranchDate[b.id]?.[date]?.newCount || 0,
        returningCount: patientByBranchDate[b.id]?.[date]?.returningCount || 0,
      })),
    }));

    // ──────────────────────────────────────────────────────────────
    // SECTION 2: Rates (fill rate, no-show rate, cancellation rate)
    // ──────────────────────────────────────────────────────────────
    // Rates per day and per branch

    // Count by status per date and per branch+date
    const countByDate = {}; // { [date]: { total, noShow, cancelled } }
    const countByBranchDate = {}; // { [branchId]: { [date]: { total, noShow, cancelled } } }

    for (const appt of appointments) {
      const date = appt.scheduledAt.toISOString().slice(0, 10);
      const bId = appt.branchId;
      const s = appt.status?.toLowerCase();

      if (!countByDate[date])
        countByDate[date] = { total: 0, noShow: 0, cancelled: 0 };
      countByDate[date].total += 1;
      if (s === "no_show") countByDate[date].noShow += 1;
      if (s === "cancelled") countByDate[date].cancelled += 1;

      if (!countByBranchDate[bId]) countByBranchDate[bId] = {};
      if (!countByBranchDate[bId][date])
        countByBranchDate[bId][date] = { total: 0, noShow: 0, cancelled: 0 };
      countByBranchDate[bId][date].total += 1;
      if (s === "no_show") countByBranchDate[bId][date].noShow += 1;
      if (s === "cancelled") countByBranchDate[bId][date].cancelled += 1;
    }

    // Slot-based fill rate (same logic as clinic endpoint)
    const SLOT_MINS = 30;

    // completedSlotsByDoctorDate[doctorId][date] = Set<slotKey>
    const completedSlotsByDoctorDate = {};
    for (const appt of appointments) {
      if (appt.status?.toLowerCase() !== "completed") continue;
      if (!appt.doctorId) continue;
      const date = appt.scheduledAt.toISOString().slice(0, 10);
      const apptMins =
        appt.scheduledAt.getHours() * 60 + appt.scheduledAt.getMinutes();
      const slotKey = Math.floor(apptMins / SLOT_MINS);
      if (!completedSlotsByDoctorDate[appt.doctorId])
        completedSlotsByDoctorDate[appt.doctorId] = {};
      if (!completedSlotsByDoctorDate[appt.doctorId][date])
        completedSlotsByDoctorDate[appt.doctorId][date] = new Set();
      completedSlotsByDoctorDate[appt.doctorId][date].add(slotKey);
    }

    // Group schedules by (doctorId, date)
    const schedGrouped = {};
    for (const sch of schedules) {
      const date =
        sch.date instanceof Date
          ? sch.date.toISOString().slice(0, 10)
          : String(sch.date).slice(0, 10);
      const startMins = hmToMin(sch.startTime);
      const endMins = hmToMin(sch.endTime);
      if (endMins <= startMins) continue;
      if (!schedGrouped[sch.doctorId]) schedGrouped[sch.doctorId] = {};
      if (!schedGrouped[sch.doctorId][date])
        schedGrouped[sch.doctorId][date] = { branchId: sch.branchId, windows: [] };
      schedGrouped[sch.doctorId][date].windows.push({ startMins, endMins });
    }

    // slotsByBranchDate[branchId][date] = { possible, filled }
    const slotsByBranchDate = {};
    for (const [doctorIdStr, dateMap] of Object.entries(schedGrouped)) {
      const doctorId = Number(doctorIdStr);
      for (const [date, { branchId: bId, windows }] of Object.entries(dateMap)) {
        const possibleSlotSet = new Set();
        for (const { startMins, endMins } of windows) {
          const firstSlot = Math.ceil(startMins / SLOT_MINS);
          const lastSlot = Math.floor(endMins / SLOT_MINS) - 1;
          for (let s = firstSlot; s <= lastSlot; s++) possibleSlotSet.add(s);
        }
        const possible = possibleSlotSet.size;
        if (possible === 0) continue;

        const completedSlots =
          completedSlotsByDoctorDate[doctorId]?.[date] || new Set();
        let filled = 0;
        for (const slotKey of completedSlots) {
          if (possibleSlotSet.has(slotKey)) filled++;
        }

        if (!slotsByBranchDate[bId]) slotsByBranchDate[bId] = {};
        if (!slotsByBranchDate[bId][date])
          slotsByBranchDate[bId][date] = { possible: 0, filled: 0 };
        slotsByBranchDate[bId][date].possible += possible;
        slotsByBranchDate[bId][date].filled += filled;
      }
    }

    // Helper: compute fill rate for a day (average across branches with data)
    function computeFillRate(date) {
      const branchPcts = targetBranches
        .map((b) => slotsByBranchDate[b.id]?.[date])
        .filter((s) => s?.possible > 0)
        .map((s) => Math.round((s.filled / s.possible) * 100));
      return branchPcts.length > 0
        ? Math.round(branchPcts.reduce((a, v) => a + v, 0) / branchPcts.length)
        : 0;
    }

    function computeBranchFillRate(branchId, date) {
      const sl = slotsByBranchDate[branchId]?.[date];
      return sl?.possible > 0 ? Math.round((sl.filled / sl.possible) * 100) : 0;
    }

    // Build ratesDailyData
    const ratesDailyData = days.map((date) => {
      const cnt = countByDate[date] || { total: 0, noShow: 0, cancelled: 0 };
      const total = cnt.total;
      const fillRate = computeFillRate(date);
      const noShowRate =
        total > 0 ? Math.round((cnt.noShow / total) * 100 * 10) / 10 : 0;
      const cancelRate =
        total > 0 ? Math.round((cnt.cancelled / total) * 100 * 10) / 10 : 0;
      return { date, total, fillRate, noShowRate, cancelRate };
    });

    // Build branchRatesDailyData
    const branchRatesDailyData = targetBranches.map((b) => ({
      branchId: b.id,
      branchName: b.name,
      daily: days.map((date) => {
        const cnt = countByBranchDate[b.id]?.[date] || {
          total: 0,
          noShow: 0,
          cancelled: 0,
        };
        const total = cnt.total;
        const fillRate = computeBranchFillRate(b.id, date);
        const noShowRate =
          total > 0 ? Math.round((cnt.noShow / total) * 100 * 10) / 10 : 0;
        const cancelRate =
          total > 0 ? Math.round((cnt.cancelled / total) * 100 * 10) / 10 : 0;
        return { date, total, fillRate, noShowRate, cancelRate };
      }),
    }));

    // ──────────────────────────────────────────────────────────────
    // SECTION 3: Hour-level load data for the Ачаалал table
    // ──────────────────────────────────────────────────────────────
    // For each 1-hour bucket per day:
    //   possible = total 30-min sub-slots from doctor schedules in that hour (across all doctors)
    //   filled   = 30-min sub-slots with ≥1 appointment (any status, max 1 per slot)

    // Track which 30-min slots have ≥1 appointment per doctor per date
    // apptSlotsByDoctorDate[doctorId][date] = Set<slotKey>
    const apptSlotsByDoctorDate = {};
    for (const appt of appointments) {
      if (!appt.doctorId) continue;
      const date = appt.scheduledAt.toISOString().slice(0, 10);
      const mins =
        appt.scheduledAt.getHours() * 60 + appt.scheduledAt.getMinutes();
      const slotKey = Math.floor(mins / SLOT_MINS);
      if (!apptSlotsByDoctorDate[appt.doctorId])
        apptSlotsByDoctorDate[appt.doctorId] = {};
      if (!apptSlotsByDoctorDate[appt.doctorId][date])
        apptSlotsByDoctorDate[appt.doctorId][date] = new Set();
      apptSlotsByDoctorDate[appt.doctorId][date].add(slotKey);
    }

    // branchHourData[branchId][date][hourKey] = { possible, filled }
    const branchHourData = {};
    for (const b of targetBranches) branchHourData[b.id] = {};

    for (const [doctorIdStr, dateMap] of Object.entries(schedGrouped)) {
      const doctorId = Number(doctorIdStr);
      for (const [date, { branchId: bId, windows }] of Object.entries(
        dateMap
      )) {
        if (!branchHourData[bId]) branchHourData[bId] = {};
        if (!branchHourData[bId][date]) branchHourData[bId][date] = {};

        // Collect all possible 30-min slots for this doctor on this date
        const possibleSlotSet = new Set();
        for (const { startMins, endMins } of windows) {
          const firstSlot = Math.ceil(startMins / SLOT_MINS);
          const lastSlot = Math.floor(endMins / SLOT_MINS) - 1;
          for (let s = firstSlot; s <= lastSlot; s++) possibleSlotSet.add(s);
        }

        const apptSlots =
          apptSlotsByDoctorDate[doctorId]?.[date] || new Set();

        // Group by 1-hour bucket: hourKey = floor(slotKey / 2) = hour of day
        for (const slotKey of possibleSlotSet) {
          const hourKey = Math.floor(slotKey / 2);
          if (!branchHourData[bId][date][hourKey])
            branchHourData[bId][date][hourKey] = { possible: 0, filled: 0 };
          branchHourData[bId][date][hourKey].possible += 1;
          if (apptSlots.has(slotKey))
            branchHourData[bId][date][hourKey].filled += 1;
        }
      }
    }

    // Build hourLoadDailyData – totals across all targeted branches
    const hourLoadDailyData = days.map((date) => {
      const d = new Date(date + "T00:00:00");
      const weekday = d.getDay();
      const isWeekend = weekday === 0 || weekday === 6;
      const startHour = isWeekend ? 10 : 9;
      const endHour = isWeekend ? 19 : 21;

      // Aggregate across all targeted branches
      const hourTotals = {};
      for (const b of targetBranches) {
        const bHours = branchHourData[b.id]?.[date] || {};
        for (const [hStr, { possible, filled }] of Object.entries(bHours)) {
          const h = Number(hStr);
          if (h < startHour || h >= endHour) continue;
          if (!hourTotals[h]) hourTotals[h] = { possible: 0, filled: 0 };
          hourTotals[h].possible += possible;
          hourTotals[h].filled += filled;
        }
      }

      const hours = [];
      for (let h = startHour; h < endHour; h++) {
        const data = hourTotals[h];
        if (data && data.possible > 0)
          hours.push({ hour: h, filled: data.filled, possible: data.possible });
      }
      return { date, isWeekend, hours };
    });

    // Build branchHourLoadDailyData – per branch
    const branchHourLoadDailyData = targetBranches.map((b) => ({
      branchId: b.id,
      branchName: b.name,
      daily: days.map((date) => {
        const d = new Date(date + "T00:00:00");
        const weekday = d.getDay();
        const isWeekend = weekday === 0 || weekday === 6;
        const startHour = isWeekend ? 10 : 9;
        const endHour = isWeekend ? 19 : 21;

        const hours = [];
        for (let h = startHour; h < endHour; h++) {
          const data = branchHourData[b.id]?.[date]?.[h];
          if (data && data.possible > 0)
            hours.push({
              hour: h,
              filled: data.filled,
              possible: data.possible,
            });
        }
        return { date, isWeekend, hours };
      }),
    }));

    return res.json({
      branches: targetBranches,
      patientDailyData,
      branchPatientDailyData,
      ratesDailyData,
      branchRatesDailyData,
      hourLoadDailyData,
      branchHourLoadDailyData,
    });
  } catch (err) {
    console.error("GET /api/reports/appointments-report error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
});

export default router;
