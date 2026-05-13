import express from "express";
import prisma from "../../db.js";
import {
  discountPercentEnumToNumber,
  computeServiceNetProportionalDiscount,
  allocatePaymentProportionalByRemaining,
  computeOverrideSalesFromAllocations,
} from "../../utils/incomeHelpers.js";
import {
  buildDoctorScheduleSlotIndex,
  countBookedAppointmentsInScheduleSlots,
} from "../../utils/doctorScheduleSlotCounts.js";
import { getAdjustmentTotalsByPatient } from "../reports-patient-balances.js";

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

const METHOD_LABELS = {
  CASH: "Бэлэн",
  POS: "POS",
  TRANSFER: "Шилжүүлэг",
  QPAY: "QPay",
  WALLET: "Хэтэвч",
  VOUCHER: "Купон",
  OTHER: "Бусад",
  BARTER: "Бартер",
  INSURANCE: "Даатгал",
  APPLICATION: "Апп",
};

const EXCLUDED_METHODS = new Set(["EMPLOYEE_BENEFIT"]);

const OVERRIDE_METHODS = new Set(["INSURANCE", "APPLICATION", "WALLET"]);

// Home bleaching: Service.code === 151
const HOME_BLEACHING_SERVICE_CODE = 151;
// Always include these rows in detailed income "Нэгтгэл", even when totals are zero,
// so the table layout remains consistent for finance reconciliation.
const REQUIRED_PAYMENT_METHODS = [
  "CASH",
  "POS",
  "TRANSFER",
  "QPAY",
  "APPLICATION",
  "INSURANCE",
  "VOUCHER",
];

function inRange(ts, start, end) {
  return ts >= start && ts < end;
}

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

function formatInitialName(ovog, name) {
  const n = String(name || "").trim();
  const o = String(ovog || "").trim();
  if (o && n) return `${o[0]}. ${n}`;
  return n || o || "-";
}

/**
 * Build normalized payment-summary rows for the detailed income report.
 * @param {Array<{method?: string, _sum?: {amount?: number}, _count?: {_all?: number}}>} paymentGroups
 * @param {Array<{key?: string, label?: string}>} methodConfigs
 * @returns {Array<{method: string, label: string, totalAmount: number, count: number}>}
 */
export function buildDetailedPaymentSummaryRows(paymentGroups, methodConfigs = []) {
  const methodLabelMap = new Map(
    (methodConfigs || []).map((m) => [String(m.key || "").toUpperCase(), m.label || m.key])
  );
  const paymentSummaryMap = new Map(
    (paymentGroups || []).map((g) => [
      String(g.method || "").toUpperCase(),
      {
        totalAmount: Number(g?._sum?.amount || 0),
        count: Number(g?._count?._all || 0),
      },
    ])
  );

  const extraMethods = Array.from(paymentSummaryMap.keys())
    .filter((k) => !REQUIRED_PAYMENT_METHODS.includes(k))
    .sort((a, b) => a.localeCompare(b));
  const orderedMethods = [...REQUIRED_PAYMENT_METHODS, ...extraMethods];

  return orderedMethods.map((method) => {
    const row = paymentSummaryMap.get(method) || { totalAmount: 0, count: 0 };
    return {
      method,
      label: methodLabelMap.get(method) || METHOD_LABELS[method] || method,
      totalAmount: Number(row.totalAmount || 0),
      count: Number(row.count || 0),
    };
  });
}

/**
 * Build payment-summary rows specifically for the income-detailed page.
 * Ensures imaging sales is displayed between wallet and product sales.
 * @param {Array<{method:string,label:string,totalAmount:number,count:number}>} paymentSummaryRows
 * @param {{imagingProductionTotal?:number, imagingCount?:number, productSalesTotal?:number, productCount?:number, overpaymentInRangeAmount?:number, overpaymentInRangeCount?:number}} totals
 * @returns {Array<{method:string,label:string,totalAmount:number,count:number}>}
 */
export function buildIncomeDetailedPageSummaryRows(paymentSummaryRows, totals = {}) {
  const baseRows = (paymentSummaryRows || [])
    .filter((row) =>
      row?.method !== "IMAGING_SALES" &&
      row?.method !== "PRODUCT_SALES" &&
      row?.method !== "OVERPAYMENT_AS_OF"
    )
    .map((row) => ({
      method: String(row.method || ""),
      label: String(row.label || row.method || ""),
      totalAmount: Number(row.totalAmount || 0),
      count: Number(row.count || 0),
    }));

  let walletIndex = baseRows.findIndex((row) => row.method === "WALLET");
  if (walletIndex === -1) {
    baseRows.push({
      method: "WALLET",
      label: METHOD_LABELS.WALLET,
      totalAmount: 0,
      count: 0,
    });
    walletIndex = baseRows.length - 1;
  }

  const summaryRows = [...baseRows];
  summaryRows.splice(walletIndex + 1, 0, {
    method: "IMAGING_SALES",
    label: "Зургийн орлого",
    totalAmount: Math.round(Number(totals.imagingProductionTotal || 0)),
    count: Number(totals.imagingCount || 0),
  });
  summaryRows.push({
    method: "PRODUCT_SALES",
    label: "Барааны борлуулалт",
    totalAmount: Math.round(Number(totals.productSalesTotal || 0)),
    count: Number(totals.productCount || 0),
  });
  summaryRows.push({
    method: "OVERPAYMENT_AS_OF",
    label: "Илүү төлөлт",
    totalAmount: Math.round(Number(totals.overpaymentInRangeAmount || 0)),
    count: Number(totals.overpaymentInRangeCount || 0),
  });

  return summaryRows;
}

/**
 * Compute current (as-of now) debt and overpayment snapshot totals for active patients.
 * This is intentionally independent from report date range and matches patient-balances pages.
 */
async function computeBalanceSnapshotTotals(branchId = null) {
  const patientWhere = {
    isActive: true,
    ...(branchId ? { branchId: Number(branchId) } : {}),
  };

  const patients = await prisma.patient.findMany({
    where: patientWhere,
    select: { id: true },
  });
  if (!patients.length) return { debtAmount: 0, overpaymentAmount: 0 };

  const patientIds = patients.map((p) => p.id);
  const invoices = await prisma.invoice.findMany({
    where: { patientId: { in: patientIds } },
    select: { id: true, patientId: true, finalAmount: true, totalAmount: true },
  });

  const invoiceIds = invoices.map((i) => i.id);
  const payments = invoiceIds.length
    ? await prisma.payment.groupBy({
      by: ["invoiceId"],
      where: { invoiceId: { in: invoiceIds } },
      _sum: { amount: true },
    })
    : [];

  const paidByInvoice = new Map(
    payments.map((p) => [p.invoiceId, Number(p._sum.amount || 0)])
  );
  const billedByPatient = new Map();
  const paidByPatient = new Map();

  for (const inv of invoices) {
    const billed = inv.finalAmount != null
      ? Number(inv.finalAmount)
      : Number(inv.totalAmount || 0);
    billedByPatient.set(inv.patientId, (billedByPatient.get(inv.patientId) || 0) + billed);
    paidByPatient.set(inv.patientId, (paidByPatient.get(inv.patientId) || 0) + (paidByInvoice.get(inv.id) || 0));
  }

  const adjustmentByPatient = await getAdjustmentTotalsByPatient(branchId);
  let debtAmount = 0;
  let overpaymentAmount = 0;

  for (const p of patients) {
    const totalBilled = Number((billedByPatient.get(p.id) || 0).toFixed(2));
    const totalPaid = Number((paidByPatient.get(p.id) || 0).toFixed(2));
    const totalAdjusted = Number((adjustmentByPatient.get(p.id) || 0).toFixed(2));
    const balance = Number((totalBilled - totalPaid - totalAdjusted).toFixed(2));
    if (balance > 0) debtAmount += balance;
    if (balance < 0) overpaymentAmount += Math.abs(balance);
  }

  return {
    debtAmount: Number(debtAmount.toFixed(2)),
    overpaymentAmount: Number(overpaymentAmount.toFixed(2)),
  };
}

/**
 * Compute debt/overpayment snapshot totals as of selected report end date.
 * Used only by income-detailed-page endpoint to keep date semantics consistent.
 * @param {{asOfEndExclusive: Date, branchId?: number|null}} params
 */
async function computeBalanceSnapshotTotalsAsOfDate({ asOfEndExclusive, branchId = null }) {
  const patientWhere = {
    isActive: true,
    ...(branchId ? { branchId: Number(branchId) } : {}),
  };

  const patients = await prisma.patient.findMany({
    where: patientWhere,
    select: { id: true },
  });
  if (!patients.length) return { debtAmount: 0, overpaymentAmount: 0 };

  const patientIds = patients.map((p) => p.id);
  const invoices = await prisma.invoice.findMany({
    where: {
      patientId: { in: patientIds },
      createdAt: { lt: asOfEndExclusive },
    },
    select: { id: true, patientId: true, finalAmount: true, totalAmount: true },
  });

  const invoiceIds = invoices.map((i) => i.id);
  const payments = invoiceIds.length
    ? await prisma.payment.groupBy({
      by: ["invoiceId"],
      where: {
        invoiceId: { in: invoiceIds },
        timestamp: { lt: asOfEndExclusive },
      },
      _sum: { amount: true },
    })
    : [];

  let adjustmentAgg = [];
  if (patientIds.length) {
    try {
      adjustmentAgg = await prisma.balanceAdjustmentLog.groupBy({
        by: ["patientId"],
        where: {
          patientId: { in: patientIds },
          createdAt: { lt: asOfEndExclusive },
        },
        _sum: { amount: true },
      });
    } catch (error) {
      console.error(
        "As-of adjustment aggregation failed, falling back to all-time adjustments:",
        error
      );
      const fallbackAdjustmentMap = await getAdjustmentTotalsByPatient(branchId);
      adjustmentAgg = Array.from(fallbackAdjustmentMap.entries()).map(([patientId, sum]) => ({
        patientId,
        _sum: { amount: Number(sum || 0) },
      }));
    }
  }

  const paidByInvoice = new Map(
    payments.map((p) => [p.invoiceId, Number(p._sum.amount || 0)])
  );
  const adjustmentByPatient = new Map(
    adjustmentAgg.map((a) => [a.patientId, Number(a._sum.amount || 0)])
  );
  const billedByPatient = new Map();
  const paidByPatient = new Map();

  for (const inv of invoices) {
    const billed = inv.finalAmount != null
      ? Number(inv.finalAmount)
      : Number(inv.totalAmount || 0);
    billedByPatient.set(inv.patientId, (billedByPatient.get(inv.patientId) || 0) + billed);
    paidByPatient.set(inv.patientId, (paidByPatient.get(inv.patientId) || 0) + (paidByInvoice.get(inv.id) || 0));
  }

  let debtAmount = 0;
  let overpaymentAmount = 0;
  for (const p of patients) {
    const totalBilled = Number((billedByPatient.get(p.id) || 0).toFixed(2));
    const totalPaid = Number((paidByPatient.get(p.id) || 0).toFixed(2));
    const totalAdjusted = Number((adjustmentByPatient.get(p.id) || 0).toFixed(2));
    const balance = Number((totalBilled - totalPaid - totalAdjusted).toFixed(2));
    if (balance > 0) debtAmount += balance;
    if (balance < 0) overpaymentAmount += Math.abs(balance);
  }

  return {
    debtAmount: Number(debtAmount.toFixed(2)),
    overpaymentAmount: Number(overpaymentAmount.toFixed(2)),
  };
}

/**
 * Reusable doctors-income aggregator that matches /api/admin/doctors-income revenue logic.
 * @param {{startDate: string, endDate: string, branchId: number|null|string|undefined}} params
 * @returns {Promise<Array<{doctorId:number,doctorName:string,doctorOvog:string|null,branchName:string|null,startDate:string,endDate:string,appointmentCount:number,serviceCount:number,averageVisitRevenue:number,revenue:number,commission:number,monthlyGoal:number,progressPercent:number}>>}
 */
export async function computeDoctorsIncomeData({
  startDate,
  endDate,
  branchId,
  appointmentCountMode = "legacy_completed_sales",
}) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  let appointmentSlotCounts = null;
  if (appointmentCountMode === "slot_in_schedule") {
    // Canonical appointment-slot count:
    // completed + partial_paid + ready_to_pay, and only when appointment start
    // falls inside that doctor's scheduled 30-minute slots in the range.
    const [schedules, appointmentsForSlotCount] = await Promise.all([
      prisma.doctorSchedule.findMany({
        where: {
          date: { gte: start, lt: endExclusive },
          ...(branchId ? { branchId: Number(branchId) } : {}),
        },
        select: {
          doctorId: true,
          date: true,
          startTime: true,
          endTime: true,
        },
      }),
      prisma.appointment.findMany({
        where: {
          scheduledAt: { gte: start, lt: endExclusive },
          ...(branchId ? { branchId: Number(branchId) } : {}),
        },
        select: {
          id: true,
          doctorId: true,
          scheduledAt: true,
          status: true,
        },
      }),
    ]);
    const scheduleSlotIndex = buildDoctorScheduleSlotIndex(schedules);
    appointmentSlotCounts = countBookedAppointmentsInScheduleSlots({
      appointments: appointmentsForSlotCount,
      scheduleSlotIndex,
    });
  }

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
          appointment: {
            select: { id: true, status: true, scheduledAt: true },
          },
          doctor: {
            include: {
              branch: true,
              commissionConfig: true,
            },
          },
        },
      },
      items: {
        include: {
          service: true,
        },
      },
      payments: {
        include: {
          allocations: { select: { invoiceItemId: true, amount: true } },
        },
      },
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
        doctorOvog: doctor.ovog ?? null,
        branchName: doctor.branch?.name,

        // ✅ date-only strings (no time)
        startDate: String(startDate),
        endDate: String(endDate),

        doctorSalesMnt: 0,
        doctorIncomeMnt: 0,
        monthlyGoalAmountMnt: Number(cfg?.monthlyGoalAmountMnt || 0),
        appointmentIds: new Set(),
        serviceCount: 0,
      });
    }

    const acc = byDoctor.get(doctorId);

    const payments = inv.payments || [];
    const hasOverride = payments.some((p) => OVERRIDE_METHODS.has(String(p.method).toUpperCase()));

    // ---------- per-line nets via proportional discount per service line ----------
    const discountPct = discountPercentEnumToNumber(inv.discountPercent);
    const serviceItems = (inv.items || []).filter(
      (it) => it.itemType === "SERVICE" && it.service?.category !== "PREVIOUS"
    );
    const lineNets = computeServiceNetProportionalDiscount(serviceItems, discountPct);

    // Non-IMAGING items used for sales (IMAGING is excluded from doctorSalesMnt)
    const nonImagingServiceItems = serviceItems.filter(
      (it) => it.service?.category !== "IMAGING"
    );

    const totalNonImagingNet = nonImagingServiceItems.reduce(
      (sum, it) => sum + (lineNets.get(it.id) || 0),
      0
    );
    const totalAllServiceNet = serviceItems.reduce(
      (sum, it) => sum + (lineNets.get(it.id) || 0),
      0
    );
    // Ratio used to allocate BARTER excess proportionally across non-IMAGING lines
    const nonImagingRatio = totalAllServiceNet > 0 ? totalNonImagingNet / totalAllServiceNet : 0;

    // ---------- Single payment pass: proportional allocation by remaining due ----------
    // itemById and serviceLineIds used in both SALES and INCOME sections below
    const itemById = new Map(serviceItems.map((it) => [it.id, it]));
    const serviceLineIds = serviceItems.map((it) => it.id);

    // remainingDue tracks outstanding amount per line (initialised to net after discount).
    // It is mutated by allocatePaymentProportionalByRemaining so later payments only
    // allocate to still-unpaid portions.
    const remainingDue = new Map(serviceItems.map((it) => [it.id, lineNets.get(it.id) || 0]));

    // itemAllocationBase accumulates the pre-feeMultiplier payment allocation per line.
    const itemAllocationBase = new Map(serviceItems.map((it) => [it.id, 0]));

    let barterSum = 0;

    // Process payments in timestamp order for deterministic remaining-due tracking.
    const sortedPayments = [...payments].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    for (const p of sortedPayments) {
      const method = String(p.method || "").toUpperCase();
      const ts = new Date(p.timestamp);
      if (!inRange(ts, start, endExclusive)) continue;
      if (EXCLUDED_METHODS.has(method)) continue;

      if (method === "BARTER") {
        barterSum += Number(p.amount || 0);
        continue;
      }

      if (!INCLUDED_METHODS.has(method) && !OVERRIDE_METHODS.has(method)) continue;

      const payAmt = Number(p.amount || 0);
      const payAllocs = p.allocations || [];

      if (payAllocs.length > 0) {
        // Use explicit allocations; update remainingDue for subsequent payments.
        for (const alloc of payAllocs) {
          const item = itemById.get(alloc.invoiceItemId);
          if (!item) continue;
          const allocAmt = Number(alloc.amount || 0);
          itemAllocationBase.set(item.id, (itemAllocationBase.get(item.id) || 0) + allocAmt);
          remainingDue.set(item.id, Math.max(0, (remainingDue.get(item.id) || 0) - allocAmt));
        }
      } else {
        // Proportional allocation by remaining due across all service lines (mutates remainingDue).
        const allocs = allocatePaymentProportionalByRemaining(payAmt, serviceLineIds, remainingDue);
        for (const [id, amt] of allocs) {
          itemAllocationBase.set(id, (itemAllocationBase.get(id) || 0) + amt);
        }
      }
    }

    // ---------- SALES (exclude IMAGING) ----------
    let countableSalesMnt = 0;
    if (hasOverride) {
      const salesAmt = computeOverrideSalesFromAllocations(
        nonImagingServiceItems,
        itemAllocationBase
      );
      acc.doctorSalesMnt += salesAmt;
      countableSalesMnt += salesAmt;
      if (salesAmt > 0) {
        acc.serviceCount += nonImagingServiceItems.reduce(
          (sum, it) => sum + Number(it.quantity || 0),
          0
        );
      }
    } else {
      // Sum proportional allocations for non-IMAGING lines.
      let salesFromIncluded = 0;
      for (const it of nonImagingServiceItems) {
        const itemSales = itemAllocationBase.get(it.id) || 0;
        salesFromIncluded += itemSales;
        if (itemSales > 0) {
          acc.serviceCount += Number(it.quantity || 0);
        }
      }
      countableSalesMnt += salesFromIncluded;

      // BARTER excess contributes to sales (proportional to non-imaging share of lineNets).
      const barterExcess = Math.max(0, barterSum - 800000);
      const barterIncluded = barterExcess * nonImagingRatio;
      acc.doctorSalesMnt += salesFromIncluded + barterIncluded;

      // Barter excess also contributes to income via generalPct.
      const generalPct = Number(cfg?.generalPct || 0);
      acc.doctorIncomeMnt += barterIncluded * (generalPct / 100);
    }

    const appointment = inv.encounter?.appointment;
    const appointmentScheduledAt = appointment?.scheduledAt ? new Date(appointment.scheduledAt) : null;
    if (
      appointmentCountMode !== "slot_in_schedule" &&
      countableSalesMnt > 0 &&
      appointment?.id &&
      String(appointment.status || "").toLowerCase() === "completed" &&
      appointmentScheduledAt &&
      inRange(appointmentScheduledAt, start, endExclusive)
    ) {
      acc.appointmentIds.add(appointment.id);
    }

    // ---------- INCOME ----------
    {
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
          // Only credit doctor when explicitly assignedTo=DOCTOR.
          if (it.meta?.assignedTo === "DOCTOR") {
            acc.doctorIncomeMnt += lineNet * (imagingPct / 100);
          }
          continue;
        }

        if (Number(it.service?.code) === HOME_BLEACHING_SERVICE_CODE) {
          // Deduct material cost before applying generalPct.
          const base = Math.max(0, lineNet - homeBleachingDeductAmountMnt);
          acc.doctorIncomeMnt += base * (generalPct / 100);
          continue;
        }

        let pct = generalPct;
        if (service?.category === "ORTHODONTIC_TREATMENT") pct = orthoPct;
        else if (service?.category === "DEFECT_CORRECTION") pct = defectPct;
        else if (service?.category === "SURGERY") pct = surgeryPct;

        acc.doctorIncomeMnt += lineNet * (pct / 100);
      }
    }
  }

  return Array.from(byDoctor.values()).map((d) => {
    const goal = Number(d.monthlyGoalAmountMnt || 0);
    const sales = Number(d.doctorSalesMnt || 0);
    const appointmentCount = appointmentCountMode === "slot_in_schedule"
      ? Number(appointmentSlotCounts?.get(d.doctorId) || 0)
      : d.appointmentIds.size;

    return {
      doctorId: d.doctorId,
      doctorName: d.doctorName,
      doctorOvog: d.doctorOvog,
      branchName: d.branchName,
      startDate: d.startDate,
      endDate: d.endDate,
      appointmentCount,
      serviceCount: d.serviceCount,
      averageVisitRevenue: appointmentCount > 0 ? Math.round(sales / appointmentCount) : 0,
      revenue: Math.round(sales),
      commission: Math.round(d.doctorIncomeMnt),
      monthlyGoal: Math.round(goal),
      progressPercent: goal > 0 ? Math.round((sales / goal) * 10000) / 100 : 0,
    };
  }).sort((a, b) => b.progressPercent - a.progressPercent || b.revenue - a.revenue);
}

function bucketKeyForService(service) {
  if (!service) return "GENERAL";
  if (service.category === "IMAGING") return "IMAGING";
  if (service.category === "ORTHODONTIC_TREATMENT") return "ORTHODONTIC_TREATMENT";
  if (service.category === "DEFECT_CORRECTION") return "DEFECT_CORRECTION";
  if (service.category === "SURGERY") return "SURGERY";
  return "GENERAL";
}

/**
 * Dedicated sales calculation for the income-detailed page.
 * This keeps the page isolated from doctor-income report logic and shows
 * generated sales without the 10% override-method deduction.
 */
async function computeDoctorsGeneratedSalesForIncomeDetailed({ start, endExclusive, branchId }) {
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
        select: {
          doctor: { select: { id: true, name: true, ovog: true } },
        },
      },
      items: { include: { service: true } },
      payments: {
        include: {
          allocations: { select: { invoiceItemId: true, amount: true } },
        },
      },
    },
  });

  const byDoctor = new Map();

  for (const inv of invoices) {
    const doctor = inv.encounter?.doctor;
    if (!doctor?.id) continue;

    if (!byDoctor.has(doctor.id)) {
      byDoctor.set(doctor.id, {
        doctorId: doctor.id,
        doctorName: doctor.name || "",
        doctorOvog: doctor.ovog || null,
        amount: 0,
      });
    }
    const acc = byDoctor.get(doctor.id);

    const serviceItems = (inv.items || []).filter(
      (it) => it.itemType === "SERVICE" && it.service?.category !== "PREVIOUS"
    );
    if (!serviceItems.length) continue;

    const nonImagingServiceItems = serviceItems.filter(
      (it) => it.service?.category !== "IMAGING"
    );
    const lineNets = computeServiceNetProportionalDiscount(
      serviceItems,
      discountPercentEnumToNumber(inv.discountPercent)
    );
    const totalAllServiceNet = serviceItems.reduce(
      (sum, it) => sum + (lineNets.get(it.id) || 0),
      0
    );
    const totalNonImagingNet = nonImagingServiceItems.reduce(
      (sum, it) => sum + (lineNets.get(it.id) || 0),
      0
    );
    const nonImagingRatio = totalAllServiceNet > 0 ? totalNonImagingNet / totalAllServiceNet : 0;

    const itemById = new Map(serviceItems.map((it) => [it.id, it]));
    const serviceLineIds = serviceItems.map((it) => it.id);
    const remainingDue = new Map(serviceItems.map((it) => [it.id, lineNets.get(it.id) || 0]));
    const itemAllocationBase = new Map(serviceItems.map((it) => [it.id, 0]));
    let barterSum = 0;

    const sortedPayments = [...(inv.payments || [])].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
    for (const p of sortedPayments) {
      const method = String(p.method || "").toUpperCase();
      const ts = new Date(p.timestamp);
      if (!inRange(ts, start, endExclusive)) continue;
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
        const allocs = allocatePaymentProportionalByRemaining(payAmt, serviceLineIds, remainingDue);
        for (const [id, amt] of allocs) {
          itemAllocationBase.set(id, (itemAllocationBase.get(id) || 0) + amt);
        }
      }
    }

    const salesFromPaid = nonImagingServiceItems.reduce(
      (sum, it) => sum + (itemAllocationBase.get(it.id) || 0),
      0
    );
    const barterExcess = Math.max(0, barterSum - 800000);
    acc.amount += salesFromPaid + barterExcess * nonImagingRatio;
  }

  return Array.from(byDoctor.values()).map((row) => ({
    ...row,
    amount: Math.round(Number(row.amount || 0)),
  }));
}

/**
 * Dedicated imaging production aggregation for income-detailed-page.
 * Uses payment allocations and payment timestamp window, mirroring doctor sales timing.
 */
async function computeImagingProductionByPaymentForIncomeDetailed({ start, endExclusive, branchId }) {
  const invoices = await prisma.invoice.findMany({
    where: {
      ...(branchId ? { branchId: Number(branchId) } : {}),
      payments: { some: { timestamp: { gte: start, lt: endExclusive } } },
    },
    include: {
      encounter: {
        select: {
          doctor: { select: { id: true, name: true, ovog: true } },
        },
      },
      items: { include: { service: true } },
      payments: {
        include: {
          allocations: { select: { invoiceItemId: true, amount: true } },
        },
      },
    },
  });

  const imagingItemsForNurseLookup = [];
  for (const inv of invoices) {
    const imagingItems = (inv.items || []).filter(
      (it) => it.itemType === "SERVICE" && it.service?.category === "IMAGING"
    );
    imagingItemsForNurseLookup.push(...imagingItems);
  }

  const nurseIds = Array.from(new Set(
    imagingItemsForNurseLookup
      .map((it) => {
        if (!it.meta || typeof it.meta !== "object") return null;
        const nurseId = Number(it.meta?.nurseId);
        return Number.isInteger(nurseId) && nurseId > 0 ? nurseId : null;
      })
      .filter(Boolean)
  ));
  const nurses = nurseIds.length
    ? await prisma.user.findMany({
      where: { id: { in: nurseIds } },
      select: { id: true, name: true, ovog: true },
    })
    : [];
  const nurseById = new Map(nurses.map((n) => [n.id, n]));

  const imagingByPerformer = new Map();
  const paidImagingItemIds = new Set();

  for (const inv of invoices) {
    const serviceItems = (inv.items || []).filter(
      (it) => it.itemType === "SERVICE" && it.service?.category !== "PREVIOUS"
    );
    if (!serviceItems.length) continue;

    const lineNets = computeServiceNetProportionalDiscount(
      serviceItems,
      discountPercentEnumToNumber(inv.discountPercent)
    );
    const itemById = new Map(serviceItems.map((it) => [it.id, it]));
    const serviceLineIds = serviceItems.map((it) => it.id);
    const remainingDue = new Map(serviceItems.map((it) => [it.id, lineNets.get(it.id) || 0]));
    const itemAllocationBase = new Map(serviceItems.map((it) => [it.id, 0]));

    const sortedPayments = [...(inv.payments || [])].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
    for (const p of sortedPayments) {
      const method = String(p.method || "").toUpperCase();
      const ts = new Date(p.timestamp);
      if (!inRange(ts, start, endExclusive)) continue;
      if (EXCLUDED_METHODS.has(method)) continue;
      if (method === "BARTER") continue;
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
        const allocs = allocatePaymentProportionalByRemaining(payAmt, serviceLineIds, remainingDue);
        for (const [id, amt] of allocs) {
          itemAllocationBase.set(id, (itemAllocationBase.get(id) || 0) + amt);
        }
      }
    }

    const imagingItems = serviceItems.filter((it) => it.service?.category === "IMAGING");
    for (const item of imagingItems) {
      const allocated = Number(itemAllocationBase.get(item.id) || 0);
      if (allocated <= 0) continue;

      paidImagingItemIds.add(item.id);

      const meta = item.meta && typeof item.meta === "object" ? item.meta : {};
      const assignedTo = String(meta?.assignedTo || "").toUpperCase();
      const nurseId = Number(meta?.nurseId);

      let performerKey = "UNASSIGNED";
      let performerName = "Тодорхойгүй";

      if (assignedTo === "NURSE" && Number.isInteger(nurseId) && nurseId > 0) {
        const nurse = nurseById.get(nurseId);
        performerKey = `NURSE:${nurseId}`;
        performerName = nurse ? formatInitialName(nurse.ovog, nurse.name) : `Сувилагч #${nurseId}`;
      } else {
        const doctor = inv.encounter?.doctor;
        if (doctor?.id) {
          performerKey = `DOCTOR:${doctor.id}`;
          performerName = formatInitialName(doctor.ovog, doctor.name);
        }
      }

      if (!imagingByPerformer.has(performerKey)) {
        imagingByPerformer.set(performerKey, { performerName, amount: 0 });
      }
      imagingByPerformer.get(performerKey).amount += allocated;
    }
  }

  const imagingRows = Array.from(imagingByPerformer.entries())
    .map((entry) => ({
      performerKey: entry[0],
      performerName: entry[1].performerName,
      amount: Math.round(Number(entry[1].amount || 0)),
    }))
    .sort((a, b) => a.performerName.localeCompare(b.performerName, "mn"));
  const imagingProductionTotal = imagingRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return {
    imagingRows,
    imagingProductionTotal,
    imagingCount: paidImagingItemIds.size,
  };
}

/**
 * Compute invoice overpayment totals within selected date-range filters.
 * Mirrors finance invoices-page semantics: invoice createdAt in range, then
 * overpayment = abs(total - paid) when paid exceeds billed.
 */
async function computeInvoiceOverpaymentSummaryInRangeForIncomeDetailed({ start, endExclusive, branchId }) {
  const invoices = await prisma.invoice.findMany({
    where: {
      createdAt: { gte: start, lt: endExclusive },
      ...(branchId ? { branchId: Number(branchId) } : {}),
      statusLegacy: { not: "voided" },
    },
    select: {
      finalAmount: true,
      totalAmount: true,
      payments: { select: { amount: true } },
    },
  });

  let overpaymentInRangeAmount = 0;
  let overpaymentInRangeCount = 0;

  for (const inv of invoices) {
    const billed = Number(inv.finalAmount != null ? inv.finalAmount : (inv.totalAmount || 0));
    const paid = (inv.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const remaining = Number((billed - paid).toFixed(2));
    if (remaining < 0) {
      overpaymentInRangeAmount += Math.abs(remaining);
      overpaymentInRangeCount += 1;
    }
  }

  return {
    overpaymentInRangeAmount: Number(overpaymentInRangeAmount.toFixed(2)),
    overpaymentInRangeCount,
  };
}

router.get("/doctors-income", async (req, res) => {
  const { startDate, endDate, branchId } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate and endDate are required parameters." });
  }

  try {
    const doctors = await computeDoctorsIncomeData({
      startDate: String(startDate),
      endDate: String(endDate),
      branchId,
      appointmentCountMode: "slot_in_schedule",
    });
    if (!doctors.length) return res.status(404).json({ error: "No income data found." });
    return res.json(doctors);
  } catch (error) {
    console.error("Error in fetching doctor incomes:", error);
    return res.status(500).json({ error: "Failed to fetch doctor incomes." });
  }
});

/**
 * GET /api/admin/income-detailed
 * Combined detailed income report for date range + optional branch.
 */
router.get("/income-detailed", async (req, res) => {
  const { startDate, endDate, branchId: branchIdParam } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate and endDate are required parameters." });
  }

  const start = parseDateOnlyStart(startDate);
  const endExclusive = parseDateOnlyEndExclusive(endDate);
  if (!start || !endExclusive) {
    return res.status(400).json({ error: "Invalid date format. Expected YYYY-MM-DD." });
  }

  const branchId = branchIdParam != null && branchIdParam !== ""
    ? Number(branchIdParam)
    : null;
  if (branchIdParam != null && branchIdParam !== "" && (!Number.isInteger(branchId) || branchId <= 0)) {
    return res.status(400).json({ error: "branchId must be a positive integer." });
  }

  try {
    const paymentWhere = {
      timestamp: { gte: start, lt: endExclusive },
      ...(branchId ? { invoice: { branchId } } : {}),
    };

    const [
      doctors,
      methodConfigs,
      paymentGroups,
      collectorRows,
      branch,
      imagingItems,
      productItems,
      overrideFeeInvoices,
      balanceSnapshot,
    ] = await Promise.all([
      computeDoctorsIncomeData({
        startDate: String(startDate),
        endDate: String(endDate),
        branchId,
      }),
      prisma.paymentMethodConfig.findMany({
        select: { key: true, label: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.payment.groupBy({
        by: ["method"],
        where: paymentWhere,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.payment.findMany({
        where: paymentWhere,
        select: {
          createdByUserId: true,
          createdBy: { select: { id: true, name: true, ovog: true } },
        },
        distinct: ["createdByUserId"],
      }),
      branchId
        ? prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, name: true } })
        : Promise.resolve(null),
      prisma.invoiceItem.findMany({
        where: {
          itemType: "SERVICE",
          service: { category: "IMAGING" },
          invoice: {
            createdAt: { gte: start, lt: endExclusive },
            ...(branchId ? { branchId } : {}),
          },
        },
        select: {
          id: true,
          unitPrice: true,
          quantity: true,
          lineTotal: true,
          meta: true,
          invoice: {
            select: {
              discountPercent: true,
              encounter: {
                select: {
                  doctor: { select: { id: true, name: true, ovog: true } },
                },
              },
            },
          },
        },
      }),
      prisma.invoiceItem.findMany({
        where: {
          itemType: "PRODUCT",
          invoice: {
            createdAt: { gte: start, lt: endExclusive },
            ...(branchId ? { branchId } : {}),
          },
        },
        select: {
          id: true,
          lineTotal: true,
          unitPrice: true,
          quantity: true,
        },
      }),
      prisma.invoice.findMany({
        where: {
          ...(branchId ? { branchId } : {}),
          OR: [
            { createdAt: { gte: start, lt: endExclusive } },
            { payments: { some: { timestamp: { gte: start, lt: endExclusive } } } },
          ],
          payments: { some: { method: { in: Array.from(OVERRIDE_METHODS) } } },
        },
        include: {
          items: { include: { service: true } },
          payments: true,
        },
      }),
      computeBalanceSnapshotTotals(branchId),
    ]);

    const doctorRows = doctors
      .map((d) => ({
        doctorId: d.doctorId,
        doctorName: formatInitialName(d.doctorOvog, d.doctorName),
        amount: Number(d.revenue || 0),
      }))
      .sort((a, b) => b.amount - a.amount || a.doctorName.localeCompare(b.doctorName, "mn"));
    const doctorRevenueTotal = doctorRows.reduce((sum, d) => sum + d.amount, 0);

    const nurseIds = Array.from(new Set(
      imagingItems
        .map((it) => {
          if (!it.meta || typeof it.meta !== "object") return null;
          const nurseId = Number(it.meta?.nurseId);
          return Number.isInteger(nurseId) && nurseId > 0 ? nurseId : null;
        })
        .filter(Boolean)
    ));

    const nurses = nurseIds.length
      ? await prisma.user.findMany({
        where: { id: { in: nurseIds } },
        select: { id: true, name: true, ovog: true },
      })
      : [];
    const nurseById = new Map(nurses.map((n) => [n.id, n]));

    const imagingByPerformer = new Map();
    for (const item of imagingItems) {
      const discountPct = discountPercentEnumToNumber(item.invoice?.discountPercent);
      const gross = Number(item.lineTotal || (item.unitPrice || 0) * (item.quantity || 0) || 0);
      const net = Math.max(0, Math.round(gross * (1 - discountPct / 100)));
      if (net <= 0) continue;

      const meta = item.meta && typeof item.meta === "object" ? item.meta : {};
      const assignedTo = String(meta?.assignedTo || "").toUpperCase();
      const nurseId = Number(meta?.nurseId);

      let performerKey = "UNASSIGNED";
      let performerName = "Тодорхойгүй";

      if (assignedTo === "NURSE" && Number.isInteger(nurseId) && nurseId > 0) {
        const nurse = nurseById.get(nurseId);
        performerKey = `NURSE:${nurseId}`;
        performerName = nurse ? formatInitialName(nurse.ovog, nurse.name) : `Сувилагч #${nurseId}`;
      } else {
        const doctor = item.invoice?.encounter?.doctor;
        if (doctor?.id) {
          performerKey = `DOCTOR:${doctor.id}`;
          performerName = formatInitialName(doctor.ovog, doctor.name);
        }
      }

      if (!imagingByPerformer.has(performerKey)) {
        imagingByPerformer.set(performerKey, { performerName, amount: 0 });
      }
      imagingByPerformer.get(performerKey).amount += net;
    }

    const imagingRows = Array.from(imagingByPerformer.entries())
      .map((r) => ({
        performerKey: r[0],
        performerName: r[1].performerName,
        amount: Number(r[1].amount || 0),
      }))
      .sort((a, b) => a.performerName.localeCompare(b.performerName, "mn"));
    const imagingProductionTotal = imagingRows.reduce((sum, r) => sum + r.amount, 0);

    const productSalesTotal = productItems.reduce((sum, item) => {
      const gross = Number(item.lineTotal || (item.unitPrice || 0) * (item.quantity || 0) || 0);
      return sum + gross;
    }, 0);

    const overrideFeeTotal = overrideFeeInvoices.reduce((sum, inv) => {
      const status = String(inv.statusLegacy || "").toLowerCase();
      if (status !== "paid") return sum;

      const hasOverridePayment = (inv.payments || []).some((p) =>
        OVERRIDE_METHODS.has(String(p.method || "").toUpperCase())
      );
      if (!hasOverridePayment) return sum;

      const discountPct = discountPercentEnumToNumber(inv.discountPercent);
      const nonImagingServiceItems = (inv.items || []).filter(
        (it) => it.itemType === "SERVICE" && it.service?.category !== "PREVIOUS" && it.service?.category !== "IMAGING"
      );
      const lineNets = computeServiceNetProportionalDiscount(nonImagingServiceItems, discountPct);
      const totalNonImagingNet = nonImagingServiceItems.reduce(
        (itemSum, it) => itemSum + (lineNets.get(it.id) || 0),
        0
      );

      return sum + totalNonImagingNet * 0.1;
    }, 0);

    const paymentSummary = buildDetailedPaymentSummaryRows(paymentGroups, methodConfigs);
    const summaryRows = [
      ...paymentSummary,
      {
        method: "PRODUCT_SALES",
        label: "Барааны борлуулалт",
        totalAmount: Math.round(productSalesTotal),
        count: productItems.length,
      },
    ];

    const collectors = collectorRows
      .map((row) => row.createdBy ? formatInitialName(row.createdBy.ovog, row.createdBy.name) : null)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "mn"));

    return res.json({
      startDate: String(startDate),
      endDate: String(endDate),
      branchId: branch?.id ?? null,
      branchName: branch?.name ?? null,
      collectors,
      doctors: doctorRows,
      doctorRevenueTotal: Number(doctorRevenueTotal || 0),
      imaging: imagingRows,
      imagingProductionTotal: Number(imagingProductionTotal || 0),
      overrideFeeTotal: Math.round(overrideFeeTotal),
      productSalesTotal: Math.round(productSalesTotal),
      grandTotal: Number(doctorRevenueTotal + imagingProductionTotal + Math.round(overrideFeeTotal)),
      paymentSummary: summaryRows,
      debtSnapshotAmount: Number(balanceSnapshot.debtAmount || 0),
      overpaymentSnapshotAmount: Number(balanceSnapshot.overpaymentAmount || 0),
    });
  } catch (error) {
    console.error("Error in fetching detailed income report:", error);
    return res.status(500).json({ error: "Failed to fetch detailed income report." });
  }
});

/**
 * GET /api/admin/income-detailed-page
 * Dedicated backend for finance income-detailed page so it can evolve
 * independently from other admin income reports.
 */
router.get("/income-detailed-page", async (req, res) => {
  const { startDate, endDate, branchId: branchIdParam } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate and endDate are required parameters." });
  }

  const start = parseDateOnlyStart(startDate);
  const endExclusive = parseDateOnlyEndExclusive(endDate);
  if (!start || !endExclusive) {
    return res.status(400).json({ error: "Invalid date format. Expected YYYY-MM-DD." });
  }

  const branchId = branchIdParam != null && branchIdParam !== ""
    ? Number(branchIdParam)
    : null;
  if (branchIdParam != null && branchIdParam !== "" && (!Number.isInteger(branchId) || branchId <= 0)) {
    return res.status(400).json({ error: "branchId must be a positive integer." });
  }

  try {
    const paymentWhere = {
      timestamp: { gte: start, lt: endExclusive },
      ...(branchId ? { invoice: { branchId } } : {}),
    };

    const imagingProductionPromise = computeImagingProductionByPaymentForIncomeDetailed({
      start,
      endExclusive,
      branchId,
    }).catch((error) => {
      console.error("Income detailed imaging aggregation failed:", error);
      return {
        imagingRows: [],
        imagingProductionTotal: 0,
        imagingCount: 0,
      };
    });

    const balanceSnapshotPromise = computeBalanceSnapshotTotalsAsOfDate({
      asOfEndExclusive: endExclusive,
      branchId,
    }).catch(async (error) => {
      console.error("Income detailed as-of snapshot failed, falling back to current snapshot:", error);
      return computeBalanceSnapshotTotals(branchId);
    });

    const [
      generatedDoctors,
      imagingProduction,
      overpaymentInRange,
      methodConfigs,
      paymentGroups,
      collectorRows,
      branch,
      productItems,
      balanceSnapshot,
    ] = await Promise.all([
      computeDoctorsGeneratedSalesForIncomeDetailed({ start, endExclusive, branchId }),
      imagingProductionPromise,
      computeInvoiceOverpaymentSummaryInRangeForIncomeDetailed({ start, endExclusive, branchId }),
      prisma.paymentMethodConfig.findMany({
        select: { key: true, label: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.payment.groupBy({
        by: ["method"],
        where: paymentWhere,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.payment.findMany({
        where: paymentWhere,
        select: {
          createdByUserId: true,
          createdBy: { select: { id: true, name: true, ovog: true } },
        },
        distinct: ["createdByUserId"],
      }),
      branchId
        ? prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, name: true } })
        : Promise.resolve(null),
      prisma.invoiceItem.findMany({
        where: {
          itemType: "PRODUCT",
          invoice: {
            createdAt: { gte: start, lt: endExclusive },
            ...(branchId ? { branchId } : {}),
          },
        },
        select: {
          id: true,
          lineTotal: true,
          unitPrice: true,
          quantity: true,
        },
      }),
      balanceSnapshotPromise,
    ]);

    const doctorRows = generatedDoctors
      .map((d) => ({
        doctorId: d.doctorId,
        doctorName: formatInitialName(d.doctorOvog, d.doctorName),
        amount: Number(d.amount || 0),
      }))
      .sort((a, b) => b.amount - a.amount || a.doctorName.localeCompare(b.doctorName, "mn"));
    const doctorRevenueTotal = doctorRows.reduce((sum, d) => sum + d.amount, 0);

    const imagingRows = imagingProduction.imagingRows;
    const imagingProductionTotal = Number(imagingProduction.imagingProductionTotal || 0);

    const productSalesTotal = productItems.reduce((sum, item) => {
      const gross = Number(item.lineTotal || (item.unitPrice || 0) * (item.quantity || 0) || 0);
      return sum + gross;
    }, 0);

    const paymentSummary = buildDetailedPaymentSummaryRows(paymentGroups, methodConfigs);
    const summaryRows = buildIncomeDetailedPageSummaryRows(paymentSummary, {
      imagingProductionTotal,
      imagingCount: Number(imagingProduction.imagingCount || 0),
      productSalesTotal,
      productCount: productItems.length,
      overpaymentInRangeAmount: Number(overpaymentInRange.overpaymentInRangeAmount || 0),
      overpaymentInRangeCount: Number(overpaymentInRange.overpaymentInRangeCount || 0),
    });

    const collectors = collectorRows
      .map((row) => row.createdBy ? formatInitialName(row.createdBy.ovog, row.createdBy.name) : null)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "mn"));

    return res.json({
      startDate: String(startDate),
      endDate: String(endDate),
      branchId: branch?.id ?? null,
      branchName: branch?.name ?? null,
      collectors,
      doctors: doctorRows,
      doctorRevenueTotal: Number(doctorRevenueTotal || 0),
      imaging: imagingRows,
      imagingProductionTotal: Number(imagingProductionTotal || 0),
      productSalesTotal: Math.round(productSalesTotal),
      grandTotal: Number(doctorRevenueTotal + imagingProductionTotal),
      paymentSummary: summaryRows,
      debtSnapshotAmount: Number(balanceSnapshot.debtAmount || 0),
      overpaymentSnapshotAmount: Number(balanceSnapshot.overpaymentAmount || 0),
    });
  } catch (error) {
    console.error("Error in fetching detailed income page report:", error);
    return res.status(500).json({ error: "Failed to fetch detailed income page report." });
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
      // IMAGING: uses imagingPct when assignedTo=DOCTOR
      IMAGING: { key: "IMAGING", label: LABELS.IMAGING, salesMnt: 0, incomeMnt: 0, pctUsed: Number(cfg?.imagingPct || 0) },
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
    // Fetch doctor info for response header
    const doctorUser = await prisma.user.findUnique({
      where: { id: DOCTOR_ID },
      select: { id: true, name: true, ovog: true },
    });

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
        items: {
          include: {
            service: true,
          },
        },
        payments: {
          include: {
            allocations: { select: { invoiceItemId: true, amount: true } },
          },
        },
      },
    });

    const cfg = invoices?.[0]?.encounter?.doctor?.commissionConfig || null;
    const buckets = initBuckets(cfg);

    let totalSalesMnt = 0;
    let totalIncomeMnt = 0;

    for (const inv of invoices) {
      const payments = inv.payments || [];
      const hasOverride = payments.some((p) => OVERRIDE_METHODS.has(String(p.method).toUpperCase()));

      // ---------- per-line nets via proportional discount per service line ----------
      const discountPct = discountPercentEnumToNumber(inv.discountPercent);
      const serviceItems = (inv.items || []).filter(
        (it) => it.itemType === "SERVICE" && it.service?.category !== "PREVIOUS"
      );
      if (!serviceItems.length) continue;

      const lineNets = computeServiceNetProportionalDiscount(serviceItems, discountPct);

      // Non-IMAGING items used for sales (IMAGING excluded from doctorSalesMnt)
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
      // Ratio used to allocate BARTER excess proportionally across non-IMAGING lines
      const nonImagingRatio = totalAllServiceNet > 0 ? totalNonImagingNet / totalAllServiceNet : 0;

      // ---------- Single payment pass: proportional allocation by remaining due ----------
      const itemById = new Map(serviceItems.map((it) => [it.id, it]));
      const serviceLineIds = serviceItems.map((it) => it.id);

      const remainingDue = new Map(serviceItems.map((it) => [it.id, lineNets.get(it.id) || 0]));
      const itemAllocationBase = new Map(serviceItems.map((it) => [it.id, 0]));

      let barterSum = 0;

      const sortedPayments = [...payments].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      for (const p of sortedPayments) {
        const method = String(p.method || "").toUpperCase();
        const ts = new Date(p.timestamp);
        if (!inRange(ts, start, endExclusive)) continue;
        if (EXCLUDED_METHODS.has(method)) continue;

        if (method === "BARTER") {
          barterSum += Number(p.amount || 0);
          continue;
        }

        if (!INCLUDED_METHODS.has(method) && !OVERRIDE_METHODS.has(method)) continue;

        const payAmt = Number(p.amount || 0);
        const payAllocs = p.allocations || [];

        if (payAllocs.length > 0) {
          // Use explicit allocations; update remainingDue for subsequent payments.
          for (const alloc of payAllocs) {
            const item = itemById.get(alloc.invoiceItemId);
            if (!item) continue;
            const allocAmt = Number(alloc.amount || 0);
            itemAllocationBase.set(item.id, (itemAllocationBase.get(item.id) || 0) + allocAmt);
            remainingDue.set(item.id, Math.max(0, (remainingDue.get(item.id) || 0) - allocAmt));
          }
        } else {
          // Proportional allocation by remaining due across all service lines (mutates remainingDue).
          const allocs = allocatePaymentProportionalByRemaining(payAmt, serviceLineIds, remainingDue);
          for (const [id, amt] of allocs) {
            itemAllocationBase.set(id, (itemAllocationBase.get(id) || 0) + amt);
          }
        }
      }

      // ---------- SALES (exclude IMAGING) ----------
      if (hasOverride) {
        for (const it of nonImagingServiceItems) {
          const amt = (itemAllocationBase.get(it.id) || 0) * 0.9;
          if (amt <= 0) continue;
          const k = bucketKeyForService(it.service);
          buckets[k].salesMnt += amt;
          totalSalesMnt += amt;
        }
      } else {
        // Sum equal-split allocations for non-IMAGING lines into their category buckets.
        for (const it of nonImagingServiceItems) {
          const amt = itemAllocationBase.get(it.id) || 0;
          if (amt <= 0) continue;
          const k = bucketKeyForService(it.service);
          buckets[k].salesMnt += amt;
          totalSalesMnt += amt;
        }

        // BARTER excess → BARTER_EXCESS bucket (proportional to non-imaging share).
        const barterExcess = Math.max(0, barterSum - 800000);
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

      // ---------- INCOME ----------
      {
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
            // Credit doctor only when explicitly assignedTo=DOCTOR.
            if (it.meta?.assignedTo === "DOCTOR") {
              const income = lineNet * (imagingPct / 100);
              buckets.IMAGING.incomeMnt += income;
              totalIncomeMnt += income;
            }
            continue;
          }

          if (Number(it.service?.code) === HOME_BLEACHING_SERVICE_CODE) {
            // Deduct material cost before applying generalPct.
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
      doctorName: doctorUser?.name ?? null,
      doctorOvog: doctorUser?.ovog ?? null,
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

// ==========================================================
// DOCTOR INCOME LINE-ITEMS DRILL-DOWN
// ==========================================================

/**
 * GET /api/admin/doctors-income/:doctorId/details/lines
 * Drill-down line items for a specific category of a doctor's income.
 *
 * Query params:
 *   startDate=YYYY-MM-DD, endDate=YYYY-MM-DD
 *   category=IMAGING|ORTHODONTIC_TREATMENT|DEFECT_CORRECTION|SURGERY|GENERAL|BARTER_EXCESS
 *
 * Returns each invoice line item (or pseudo-row for BARTER_EXCESS) that contributed
 * to the doctor's income in the given category, using the same allocation logic as the
 * details endpoint. Rows sorted by date descending (appointment.scheduledAt > visitDate).
 */
router.get("/doctors-income/:doctorId/details/lines", async (req, res) => {
  const { doctorId } = req.params;
  const { startDate, endDate, category } = req.query;

  if (!doctorId || !startDate || !endDate || !category) {
    return res.status(400).json({
      error: "doctorId, startDate, endDate, and category are required.",
    });
  }

  const DOCTOR_ID = Number(doctorId);
  const start = new Date(`${String(startDate)}T00:00:00.000Z`);
  const endExclusive = new Date(`${String(endDate)}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const categoryKey = String(category).toUpperCase();
  const VALID_CATEGORIES = [
    "IMAGING",
    "ORTHODONTIC_TREATMENT",
    "DEFECT_CORRECTION",
    "SURGERY",
    "GENERAL",
    "BARTER_EXCESS",
  ];
  if (!VALID_CATEGORIES.includes(categoryKey)) {
    return res.status(400).json({ error: "Invalid category." });
  }

  try {
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
            doctor: { include: { commissionConfig: true } },
            appointment: { select: { id: true, scheduledAt: true } },
            patientBook: {
              include: {
                patient: { select: { id: true, ovog: true, name: true, phone: true } },
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
    });

    const lines = [];

    for (const inv of invoices) {
      const encounter = inv.encounter;
      const payments = inv.payments || [];
      const hasOverride = payments.some((p) =>
        OVERRIDE_METHODS.has(String(p.method).toUpperCase())
      );
      const feeMultiplier = hasOverride ? 0.9 : 1;

      const discountPct = discountPercentEnumToNumber(inv.discountPercent);
      const serviceItems = (inv.items || []).filter(
        (it) => it.itemType === "SERVICE" && it.service?.category !== "PREVIOUS"
      );
      if (!serviceItems.length) continue;

      const lineNets = computeServiceNetProportionalDiscount(serviceItems, discountPct);
      const serviceLineIds = serviceItems.map((it) => it.id);
      const itemById = new Map(serviceItems.map((it) => [it.id, it]));

      const remainingDue = new Map(serviceItems.map((it) => [it.id, lineNets.get(it.id) || 0]));
      const itemAllocationBase = new Map(serviceItems.map((it) => [it.id, 0]));

      let barterSum = 0;
      const methodsInRange = new Set();

      const sortedPayments = [...payments].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      for (const p of sortedPayments) {
        const method = String(p.method || "").toUpperCase();
        const ts = new Date(p.timestamp);
        if (!inRange(ts, start, endExclusive)) continue;
        if (EXCLUDED_METHODS.has(method)) continue;

        if (method === "BARTER") {
          barterSum += Number(p.amount || 0);
          continue;
        }

        if (!INCLUDED_METHODS.has(method) && !OVERRIDE_METHODS.has(method)) continue;

        methodsInRange.add(method);

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
          const allocs = allocatePaymentProportionalByRemaining(payAmt, serviceLineIds, remainingDue);
          for (const [id, amt] of allocs) {
            itemAllocationBase.set(id, (itemAllocationBase.get(id) || 0) + amt);
          }
        }
      }

      // Determine paymentMethodLabel for non-BARTER_EXCESS categories
      const methodArr = [...methodsInRange];
      let paymentMethodLabel;
      if (methodArr.length === 0) paymentMethodLabel = null;
      else if (methodArr.length === 1) paymentMethodLabel = METHOD_LABELS[methodArr[0]] || methodArr[0];
      else paymentMethodLabel = "Mixed";

      const appointment = encounter?.appointment;
      const patient = encounter?.patientBook?.patient;
      const encounterId = inv.encounterId ?? null;
      const appointmentId = encounter?.appointmentId ?? null;
      const visitDateStr = encounter?.visitDate ? encounter.visitDate.toISOString() : null;
      const appointmentScheduledAtStr = appointment?.scheduledAt
        ? appointment.scheduledAt.toISOString()
        : null;

      const rowBase = {
        invoiceId: inv.id,
        encounterId,
        appointmentId,
        appointmentScheduledAt: appointmentScheduledAtStr,
        visitDate: visitDateStr,
        patientId: patient?.id ?? null,
        patientOvog: patient?.ovog ?? null,
        patientName: patient?.name ?? null,
        patientPhone: patient?.phone ?? null,
      };

      // ---- BARTER_EXCESS: one row per invoice with barter excess ----
      if (categoryKey === "BARTER_EXCESS") {
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
        const barterExcess = Math.max(0, barterSum - 800000);
        if (barterExcess <= 0) continue;

        const allocatedBarterExcess = barterExcess * nonImagingRatio;
        lines.push({
          ...rowBase,
          serviceName: "Бартер илүүдэл",
          serviceCategory: "BARTER_EXCESS",
          priceMnt: Math.round(barterSum),
          discountMnt: 0,
          netAfterDiscountMnt: Math.round(allocatedBarterExcess),
          allocatedPaidMnt: Math.round(allocatedBarterExcess),
          paymentMethodLabel: "Бартер",
        });
        continue;
      }

      // ---- Per-item lines for non-BARTER_EXCESS categories ----
      for (const it of serviceItems) {
        // Determine which bucket this item belongs to
        let itemBucketKey;
        if (it.service?.category === "IMAGING") {
          if (categoryKey !== "IMAGING") continue;
          if (it.meta?.assignedTo !== "DOCTOR") continue;
          itemBucketKey = "IMAGING";
        } else {
          itemBucketKey = bucketKeyForService(it.service);
          if (itemBucketKey !== categoryKey) continue;
        }

        const allocBase = itemAllocationBase.get(it.id) || 0;
        const allocatedPaid = Math.round(allocBase * feeMultiplier);

        // Skip lines that have no allocation (not paid in range)
        if (allocatedPaid <= 0) continue;

        const grossAmount = Number(it.lineTotal || 0);
        const netAfterDiscount = lineNets.get(it.id) || 0;
        const discountAmount = Math.max(0, grossAmount - netAfterDiscount);

        lines.push({
          ...rowBase,
          serviceName: it.service?.name || it.name,
          serviceCategory: it.service?.category || "GENERAL",
          priceMnt: Math.round(grossAmount),
          discountMnt: Math.round(discountAmount),
          netAfterDiscountMnt: Math.round(netAfterDiscount),
          allocatedPaidMnt: allocatedPaid,
          paymentMethodLabel,
        });
      }
    }

    // Sort by date descending: appointmentScheduledAt > visitDate
    lines.sort((a, b) => {
      const dateA = a.appointmentScheduledAt || a.visitDate;
      const dateB = b.appointmentScheduledAt || b.visitDate;
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return res.json(lines);
  } catch (error) {
    console.error("Error fetching doctor income lines:", error);
    return res.status(500).json({ error: "Failed to fetch doctor income lines." });
  }
});

// ==========================================================
// NURSES INCOME
// ==========================================================

/**
 * GET /api/admin/nurses-income
 * Summary of nurse income (imaging commission + assist income) per nurse for date range.
 *
 * NurseIncome = ImagingIncomeMnt + AssistIncomeMnt
 *
 * ImagingIncomeMnt: IMAGING service lines with meta.assignedTo==="NURSE" for this nurse,
 *   allocated using the same proportional-by-remaining-due helpers as doctor income,
 *   multiplied by global nurseImagingPct (Settings key "finance.nurseImagingPct").
 *
 * AssistIncomeMnt: For each invoice where encounter.nurseId === nurse,
 *   compute doctorSalesMnt (non-IMAGING paid allocations in range, same rules as doctors),
 *   then assistIncome = doctorSalesMnt × 1%.
 */
router.get("/nurses-income", async (req, res) => {
  const { startDate, endDate, branchId } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate and endDate are required parameters." });
  }

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  try {
    // Load global nurse imaging percent from settings
    const nurseImagingPctSetting = await prisma.settings.findFirst({
      where: { key: "finance.nurseImagingPct" },
    });
    const nurseImagingPct = Number(nurseImagingPctSetting?.value ?? 0) || 0;

    // Load all nurses for name lookup (only revenue-sharing enabled nurses by default)
    const nurses = await prisma.user.findMany({
      where: { role: "nurse", nurseRevenueSharingEnabled: true },
      select: { id: true, name: true, ovog: true },
    });
    const nurseById = new Map(nurses.map((n) => [n.id, n]));
    // Only aggregate income for nurses that have revenue sharing enabled
    const revenueNurseIds = new Set(nurses.map((n) => n.id));

    // Query invoices with payments in date range; include encounter for nurseId
    const invoices = await prisma.invoice.findMany({
      where: {
        ...(branchId ? { branchId: Number(branchId) } : {}),
        payments: { some: { timestamp: { gte: start, lt: endExclusive } } },
      },
      include: {
        encounter: {
          select: { nurseId: true },
        },
        items: { include: { service: true } },
        payments: {
          include: {
            allocations: { select: { invoiceItemId: true, amount: true } },
          },
        },
      },
    });

    const byNurse = new Map();

    function ensureNurse(nurseId) {
      if (!byNurse.has(nurseId)) {
        const nurse = nurseById.get(nurseId);
        byNurse.set(nurseId, {
          nurseId,
          nurseName: nurse?.name ?? null,
          nurseOvog: nurse?.ovog ?? null,
          startDate: String(startDate),
          endDate: String(endDate),
          imagingIncomeMnt: 0,
          assistIncomeMnt: 0,
        });
      }
      return byNurse.get(nurseId);
    }

    for (const inv of invoices) {
      const payments = inv.payments || [];
      const hasOverride = payments.some((p) =>
        OVERRIDE_METHODS.has(String(p.method).toUpperCase())
      );
      const feeMultiplier = hasOverride ? 0.9 : 1;

      const discountPct = discountPercentEnumToNumber(inv.discountPercent);
      const serviceItems = (inv.items || []).filter(
        (it) => it.itemType === "SERVICE" && it.service?.category !== "PREVIOUS"
      );

      if (!serviceItems.length) continue;

      const lineNets = computeServiceNetProportionalDiscount(serviceItems, discountPct);
      const serviceLineIds = serviceItems.map((it) => it.id);
      const itemById = new Map(serviceItems.map((it) => [it.id, it]));

      // remainingDue is mutated by allocatePaymentProportionalByRemaining
      const remainingDue = new Map(serviceItems.map((it) => [it.id, lineNets.get(it.id) || 0]));
      const itemAllocationBase = new Map(serviceItems.map((it) => [it.id, 0]));

      let barterSum = 0;

      // Process payments in timestamp order for deterministic remaining-due tracking
      const sortedPayments = [...payments].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      for (const p of sortedPayments) {
        const method = String(p.method || "").toUpperCase();
        const ts = new Date(p.timestamp);
        if (!inRange(ts, start, endExclusive)) continue;
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
          const allocs = allocatePaymentProportionalByRemaining(payAmt, serviceLineIds, remainingDue);
          for (const [id, amt] of allocs) {
            itemAllocationBase.set(id, (itemAllocationBase.get(id) || 0) + amt);
          }
        }
      }

      // --- IMAGING income for nurses ---
      const nurseImagingItems = serviceItems.filter(
        (it) =>
          it.service?.category === "IMAGING" &&
          it.meta?.assignedTo === "NURSE" &&
          it.meta?.nurseId != null
      );

      for (const it of nurseImagingItems) {
        const nurseId = Number(it.meta.nurseId);
        if (!revenueNurseIds.has(nurseId)) continue; // skip salary-only nurses
        const lineBase = (itemAllocationBase.get(it.id) || 0) * feeMultiplier;
        if (lineBase <= 0) continue;
        const income = lineBase * (nurseImagingPct / 100);
        ensureNurse(nurseId).imagingIncomeMnt += income;
      }

      // --- ASSIST income for nurse assigned to encounter ---
      const assistNurseId = inv.encounter?.nurseId;
      if (assistNurseId && revenueNurseIds.has(assistNurseId)) {
        const nonImagingItems = serviceItems.filter(
          (it) => it.service?.category !== "IMAGING"
        );

        let invDoctorSalesMnt = 0;

        if (hasOverride) {
          // Override invoices: only count when fully paid
          const status = String(inv.statusLegacy || "").toLowerCase();
          if (status === "paid") {
            const totalNonImagingNet = nonImagingItems.reduce(
              (sum, it) => sum + (lineNets.get(it.id) || 0),
              0
            );
            invDoctorSalesMnt = totalNonImagingNet * 0.9;
          }
        } else {
          // Sum paid allocations for non-IMAGING lines
          let salesFromPaid = 0;
          for (const it of nonImagingItems) {
            salesFromPaid += itemAllocationBase.get(it.id) || 0;
          }
          // BARTER excess (same rule as doctor income)
          const totalAllServiceNet = serviceItems.reduce(
            (sum, it) => sum + (lineNets.get(it.id) || 0),
            0
          );
          const totalNonImagingNet = nonImagingItems.reduce(
            (sum, it) => sum + (lineNets.get(it.id) || 0),
            0
          );
          const nonImagingRatio =
            totalAllServiceNet > 0 ? totalNonImagingNet / totalAllServiceNet : 0;
          const barterExcess = Math.max(0, barterSum - 800000);
          invDoctorSalesMnt = salesFromPaid + barterExcess * nonImagingRatio;
        }

        if (invDoctorSalesMnt > 0) {
          ensureNurse(assistNurseId).assistIncomeMnt += invDoctorSalesMnt * 0.01;
        }
      }
    }

    const result = Array.from(byNurse.values()).map((n) => ({
      ...n,
      imagingIncomeMnt: Math.round(n.imagingIncomeMnt),
      assistIncomeMnt: Math.round(n.assistIncomeMnt),
      totalIncomeMnt: Math.round(n.imagingIncomeMnt + n.assistIncomeMnt),
      nurseImagingPct,
    }));

    return res.json(result);
  } catch (error) {
    console.error("Error in fetching nurses income:", error);
    return res.status(500).json({ error: "Failed to fetch nurses income." });
  }
});

/**
 * GET /api/admin/nurses-income/:nurseId/details
 * Detailed breakdown for a specific nurse: imaging lines + assist lines.
 */
router.get("/nurses-income/:nurseId/details", async (req, res) => {
  const { nurseId } = req.params;
  const { startDate, endDate } = req.query;

  if (!nurseId || !startDate || !endDate) {
    return res.status(400).json({
      error: "nurseId, startDate, and endDate are required parameters.",
    });
  }

  const NURSE_ID = Number(nurseId);
  const start = new Date(`${String(startDate)}T00:00:00.000Z`);
  const endExclusive = new Date(`${String(endDate)}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  try {
    // Check if this nurse has revenue sharing enabled
    const nurseUser = await prisma.user.findUnique({
      where: { id: NURSE_ID },
      select: { nurseRevenueSharingEnabled: true },
    });

    if (!nurseUser?.nurseRevenueSharingEnabled) {
      return res.json({
        nurseId: NURSE_ID,
        startDate: String(startDate),
        endDate: String(endDate),
        revenueSharingEnabled: false,
        nurseImagingPct: 0,
        imagingLines: [],
        assistLines: [],
        totals: {
          imagingIncomeMnt: 0,
          assistIncomeMnt: 0,
          totalIncomeMnt: 0,
        },
      });
    }

    // Load global nurse imaging percent from settings
    const nurseImagingPctSetting = await prisma.settings.findFirst({
      where: { key: "finance.nurseImagingPct" },
    });
    const nurseImagingPct = Number(nurseImagingPctSetting?.value ?? 0) || 0;

    // Query invoices that either have imaging items OR belong to this nurse's encounters
    const invoices = await prisma.invoice.findMany({
      where: {
        payments: { some: { timestamp: { gte: start, lt: endExclusive } } },
        OR: [
          {
            items: {
              some: {
                itemType: "SERVICE",
                service: { category: "IMAGING" },
              },
            },
          },
          {
            encounter: { nurseId: NURSE_ID },
          },
        ],
      },
      include: {
        encounter: {
          include: {
            doctor: { select: { id: true, name: true, ovog: true } },
          },
        },
        items: { include: { service: true } },
        payments: {
          include: {
            allocations: { select: { invoiceItemId: true, amount: true } },
          },
        },
      },
    });

    let totalImagingIncomeMnt = 0;
    let totalAssistIncomeMnt = 0;
    const imagingLines = [];
    const assistLines = [];

    for (const inv of invoices) {
      const payments = inv.payments || [];
      const hasOverride = payments.some((p) =>
        OVERRIDE_METHODS.has(String(p.method).toUpperCase())
      );
      const feeMultiplier = hasOverride ? 0.9 : 1;

      const discountPct = discountPercentEnumToNumber(inv.discountPercent);
      const serviceItems = (inv.items || []).filter(
        (it) => it.itemType === "SERVICE" && it.service?.category !== "PREVIOUS"
      );

      if (!serviceItems.length) continue;

      const lineNets = computeServiceNetProportionalDiscount(serviceItems, discountPct);
      const serviceLineIds = serviceItems.map((it) => it.id);
      const itemById = new Map(serviceItems.map((it) => [it.id, it]));

      const remainingDue = new Map(serviceItems.map((it) => [it.id, lineNets.get(it.id) || 0]));
      const itemAllocationBase = new Map(serviceItems.map((it) => [it.id, 0]));

      let barterSum = 0;

      const sortedPayments = [...payments].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      for (const p of sortedPayments) {
        const method = String(p.method || "").toUpperCase();
        const ts = new Date(p.timestamp);
        if (!inRange(ts, start, endExclusive)) continue;
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
          const allocs = allocatePaymentProportionalByRemaining(payAmt, serviceLineIds, remainingDue);
          for (const [id, amt] of allocs) {
            itemAllocationBase.set(id, (itemAllocationBase.get(id) || 0) + amt);
          }
        }
      }

      // --- IMAGING lines for this nurse ---
      const myImagingItems = serviceItems.filter(
        (it) =>
          it.service?.category === "IMAGING" &&
          it.meta?.assignedTo === "NURSE" &&
          Number(it.meta?.nurseId) === NURSE_ID
      );

      for (const it of myImagingItems) {
        const lineBase = (itemAllocationBase.get(it.id) || 0) * feeMultiplier;
        if (lineBase <= 0) continue;
        const income = lineBase * (nurseImagingPct / 100);
        totalImagingIncomeMnt += income;
        imagingLines.push({
          invoiceId: inv.id,
          invoiceItemId: it.id,
          serviceName: it.service?.name || it.name,
          lineNet: Math.round(lineBase),
          imagingPct: nurseImagingPct,
          incomeMnt: Math.round(income),
        });
      }

      // --- ASSIST line for this nurse (if encounter.nurseId === NURSE_ID) ---
      if (inv.encounter?.nurseId === NURSE_ID) {
        const nonImagingItems = serviceItems.filter(
          (it) => it.service?.category !== "IMAGING"
        );

        let invDoctorSalesMnt = 0;

        if (hasOverride) {
          const status = String(inv.statusLegacy || "").toLowerCase();
          if (status === "paid") {
            const totalNonImagingNet = nonImagingItems.reduce(
              (sum, it) => sum + (lineNets.get(it.id) || 0),
              0
            );
            invDoctorSalesMnt = totalNonImagingNet * 0.9;
          }
        } else {
          let salesFromPaid = 0;
          for (const it of nonImagingItems) {
            salesFromPaid += itemAllocationBase.get(it.id) || 0;
          }
          const totalAllServiceNet = serviceItems.reduce(
            (sum, it) => sum + (lineNets.get(it.id) || 0),
            0
          );
          const totalNonImagingNet = nonImagingItems.reduce(
            (sum, it) => sum + (lineNets.get(it.id) || 0),
            0
          );
          const nonImagingRatio =
            totalAllServiceNet > 0 ? totalNonImagingNet / totalAllServiceNet : 0;
          const barterExcess = Math.max(0, barterSum - 800000);
          invDoctorSalesMnt = salesFromPaid + barterExcess * nonImagingRatio;
        }

        if (invDoctorSalesMnt > 0) {
          const assistIncome = invDoctorSalesMnt * 0.01;
          totalAssistIncomeMnt += assistIncome;

          const doctor = inv.encounter?.doctor;
          const doctorName = doctor
            ? (
                (doctor.ovog ? doctor.ovog.charAt(0) + ". " : "") +
                (doctor.name || "")
              ).trim() || null
            : null;

          assistLines.push({
            encounterId: inv.encounterId,
            invoiceId: inv.id,
            doctorId: doctor?.id ?? null,
            doctorName,
            salesBaseMnt: Math.round(invDoctorSalesMnt),
            pct: 1,
            incomeMnt: Math.round(assistIncome),
          });
        }
      }
    }

    return res.json({
      nurseId: NURSE_ID,
      startDate: String(startDate),
      endDate: String(endDate),
      nurseImagingPct,
      imagingLines,
      assistLines,
      totals: {
        imagingIncomeMnt: Math.round(totalImagingIncomeMnt),
        assistIncomeMnt: Math.round(totalAssistIncomeMnt),
        totalIncomeMnt: Math.round(totalImagingIncomeMnt + totalAssistIncomeMnt),
      },
    });
  } catch (error) {
    console.error("Error in fetching nurse income details:", error);
    return res.status(500).json({ error: "Failed to fetch nurse income details." });
  }
});

export default router;
