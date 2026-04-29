import { Router } from "express";
import prisma from "../db.js";
import {
  ADMIN_HOME_BOOKED_APPOINTMENT_STATUSES,
  ADMIN_HOME_INCOME_METHODS,
} from "../constants/dashboard.js";
import {
  computeImagingServiceCount,
  computeImagingServiceSalesFromItems,
  computeFilledSlotsByBranch,
  computeRecognizedSalesFromPayments,
  computeScheduleStatsByBranch,
  getLocalDayRange,
} from "../utils/adminHomeDashboard.js";
import { computeDoctorsIncomeData } from "./admin/income.js";
import { getAdjustmentTotalsByPatient } from "./reports-patient-balances.js";

const router = Router();
const BOOKED_STATUS_SET = new Set(ADMIN_HOME_BOOKED_APPOINTMENT_STATUSES);
const MONTHLY_NET_SALES_METHODS = [
  ...ADMIN_HOME_INCOME_METHODS,
  "WALLET",
  "VOUCHER",
];
const MONTHLY_NET_ALLOWED_INVOICE_STATUSES = ["paid", "partial"];

function computeBranchAppointmentCounters(appointments) {
  const byBranch = new Map();
  for (const appt of appointments) {
    const branchId = appt.branchId;
    if (!branchId) continue;
    if (!byBranch.has(branchId)) {
      byBranch.set(branchId, { completedCount: 0, bookedCount: 0, noShowCount: 0 });
    }
    const counters = byBranch.get(branchId);
    const status = String(appt.status || "").toLowerCase();
    if (status === "completed") counters.completedCount += 1;
    if (status === "no_show") counters.noShowCount += 1;
    if (BOOKED_STATUS_SET.has(status)) counters.bookedCount += 1;
  }
  return byBranch;
}

function computeNoShowLostValue(noShowAppointments, avgRevenueByDoctor) {
  let total = 0;
  for (const appt of noShowAppointments) {
    if (!appt.doctorId || !(appt.scheduledAt instanceof Date)) continue;
    const avgRevenue = Number(avgRevenueByDoctor.get(appt.doctorId) || 0);
    if (!Number.isFinite(avgRevenue) || avgRevenue <= 0) continue;
    const endAt =
      appt.endAt instanceof Date && !Number.isNaN(appt.endAt.getTime()) ? appt.endAt : null;
    const durationMinutes = endAt ? (endAt.getTime() - appt.scheduledAt.getTime()) / 60000 : 0;
    const slotSpan = Math.max(1, Math.ceil(durationMinutes / 30));
    total += slotSpan * (avgRevenue / 2);
  }
  return total;
}

async function computeUnpaidInvoicesTotal() {
  const patients = await prisma.patient.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  if (!patients.length) return 0;

  const patientIds = patients.map((p) => p.id);
  const invoices = await prisma.invoice.findMany({
    where: { patientId: { in: patientIds } },
    select: {
      id: true,
      patientId: true,
      finalAmount: true,
      totalAmount: true,
    },
  });

  const invoiceIds = invoices.map((inv) => inv.id);
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
    const billed = inv.finalAmount != null ? Number(inv.finalAmount) : Number(inv.totalAmount || 0);
    billedByPatient.set(inv.patientId, (billedByPatient.get(inv.patientId) || 0) + billed);
    paidByPatient.set(inv.patientId, (paidByPatient.get(inv.patientId) || 0) + (paidByInvoice.get(inv.id) || 0));
  }

  const adjustmentByPatient = await getAdjustmentTotalsByPatient(null);
  let debtAmount = 0;
  for (const patient of patients) {
    const totalBilled = Number((billedByPatient.get(patient.id) || 0).toFixed(2));
    const totalPaid = Number((paidByPatient.get(patient.id) || 0).toFixed(2));
    const totalAdjusted = Number((adjustmentByPatient.get(patient.id) || 0).toFixed(2));
    const balance = Number((totalBilled - totalPaid - totalAdjusted).toFixed(2));
    if (balance > 0) debtAmount += balance;
  }
  return Number(debtAmount.toFixed(2));
}

router.get("/admin-home", async (req, res) => {
  try {
    if (!req.user || !["admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden. Insufficient role." });
    }

    const today = new Date();
    const defaultDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;
    const day = typeof req.query.day === "string" && req.query.day ? req.query.day : defaultDay;
    const range = getLocalDayRange(day);
    if (!range) {
      return res.status(400).json({ error: "day query param must be YYYY-MM-DD" });
    }
    const { start, endExclusive } = range;
    const monthStartDay = `${day.slice(0, 7)}-01`;
    const monthRange = getLocalDayRange(monthStartDay);
    if (!monthRange) {
      return res.status(400).json({ error: "Invalid month range for dashboard day." });
    }
    const { start: monthStart } = monthRange;
    const yesterdayStart = new Date(start.getTime() - 86400000);
    const isCurrentDay = day === defaultDay;
    const todaySalesWindowEnd = isCurrentDay ? new Date() : endExclusive;
    const passedDays = Math.max(0, Math.floor((start.getTime() - monthStart.getTime()) / 86400000));

    const branches = await prisma.branch.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    if (branches.length === 0) {
      return res.json({
        kpis: {
          day,
          monthStart: monthStartDay,
          monthlyNetSales: 0,
          dailyAverageSales: 0,
          todayTotalSales: 0,
          passedDays,
        },
        branches: [],
        alerts: {
          noShowLostValue: 0,
          unpaidInvoicesTotal: 0,
          readyToPayCount: 0,
        },
        imagingService: {
          monthlyServiceSales: 0,
          monthlyServiceCount: 0,
          yesterdayServiceCount: 0,
        },
        sterilization: {
          dirtyPackageLabel: "Бохир үзлэгийн багцын тоо",
          completedTodayLabel: "Өнөөдөр дууссан үзлэгийн тоо",
        },
      });
    }

    const branchIds = branches.map((b) => b.id);

    const [
      schedules,
      appointments,
      salesPayments,
      monthlyNetSalesPayments,
      noShowAppointments,
      doctorsIncome,
      readyToPayCount,
      unpaidInvoicesTotal,
      imagingMonthlySalesItems,
      imagingMonthlyCountItems,
      imagingYesterdayCountItems,
    ] = await Promise.all([
      prisma.doctorSchedule.findMany({
        where: {
          branchId: { in: branchIds },
          date: { gte: start, lt: endExclusive },
        },
        select: {
          branchId: true,
          doctorId: true,
          startTime: true,
          endTime: true,
        },
      }),
      prisma.appointment.findMany({
        where: {
          branchId: { in: branchIds },
          scheduledAt: { gte: start, lt: endExclusive },
        },
        select: {
          branchId: true,
          doctorId: true,
          scheduledAt: true,
          endAt: true,
          status: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          timestamp: { lt: todaySalesWindowEnd },
          method: { in: ADMIN_HOME_INCOME_METHODS },
          amount: { gt: 0 },
          invoice: {
            branchId: { in: branchIds },
          },
        },
        select: {
          id: true,
          amount: true,
          timestamp: true,
          invoiceId: true,
          invoice: {
            select: {
              id: true,
              branchId: true,
              finalAmount: true,
              totalAmount: true,
              statusLegacy: true,
            },
          },
        },
      }),
      prisma.payment.findMany({
        where: {
          timestamp: { gte: monthStart, lt: start },
          method: { in: MONTHLY_NET_SALES_METHODS },
          amount: { gt: 0 },
          invoice: {
            branchId: { in: branchIds },
            statusLegacy: { in: MONTHLY_NET_ALLOWED_INVOICE_STATUSES },
          },
        },
        select: {
          id: true,
          amount: true,
          method: true,
          timestamp: true,
          invoiceId: true,
          invoice: {
            select: {
              id: true,
              branchId: true,
              finalAmount: true,
              totalAmount: true,
              statusLegacy: true,
            },
          },
        },
      }),
      prisma.appointment.findMany({
        where: {
          branchId: { in: branchIds },
          doctorId: { not: null },
          status: "no_show",
          scheduledAt: { gte: monthStart, lt: endExclusive },
        },
        select: {
          doctorId: true,
          scheduledAt: true,
          endAt: true,
        },
      }),
      computeDoctorsIncomeData({
        startDate: monthStartDay,
        endDate: day,
        branchId: null,
      }),
      prisma.appointment.count({
        where: {
          branchId: { in: branchIds },
          status: "ready_to_pay",
          scheduledAt: { gte: monthStart, lt: endExclusive },
        },
      }),
      computeUnpaidInvoicesTotal(),
      prisma.invoiceItem.findMany({
        where: {
          itemType: "SERVICE",
          service: { category: "IMAGING" },
          invoice: {
            branchId: { in: branchIds },
            createdAt: { gte: monthStart, lt: endExclusive },
          },
        },
        select: {
          lineTotal: true,
          unitPrice: true,
          quantity: true,
          invoice: { select: { discountPercent: true } },
        },
      }),
      prisma.invoiceItem.findMany({
        where: {
          itemType: "SERVICE",
          service: { category: "IMAGING" },
          invoice: {
            branchId: { in: branchIds },
            createdAt: { gte: monthStart, lt: start },
          },
        },
        select: { quantity: true },
      }),
      prisma.invoiceItem.findMany({
        where: {
          itemType: "SERVICE",
          service: { category: "IMAGING" },
          invoice: {
            branchId: { in: branchIds },
            createdAt: { gte: yesterdayStart, lt: start },
          },
        },
        select: { quantity: true },
      }),
    ]);

    const scheduleStatsByBranch = computeScheduleStatsByBranch(schedules);
    const filledSlotsByBranch = computeFilledSlotsByBranch(appointments);
    const appointmentCountersByBranch = computeBranchAppointmentCounters(appointments);

    const monthlyNetSalesResult = computeRecognizedSalesFromPayments(monthlyNetSalesPayments, {
      windowStart: monthStart,
      windowEnd: start,
      includedMethods: MONTHLY_NET_SALES_METHODS,
    });
    const salesToday = computeRecognizedSalesFromPayments(salesPayments, {
      windowStart: start,
      windowEnd: todaySalesWindowEnd,
    });

    const monthlyNetSales = monthlyNetSalesResult.total;
    const dailyAverageSales = passedDays > 0 ? monthlyNetSales / passedDays : 0;
    const todayTotalSales = salesToday.total;

    const avgRevenueByDoctor = new Map(
      doctorsIncome.map((row) => [row.doctorId, Number(row.averageVisitRevenue || 0)])
    );
    const noShowLostValue = computeNoShowLostValue(noShowAppointments, avgRevenueByDoctor);
    const monthlyServiceSales = computeImagingServiceSalesFromItems(imagingMonthlySalesItems);
    const monthlyServiceCount = computeImagingServiceCount(imagingMonthlyCountItems);
    const yesterdayServiceCount = computeImagingServiceCount(imagingYesterdayCountItems);

    const response = branches.map((branch) => {
      const scheduleStats = scheduleStatsByBranch.get(branch.id);
      const possibleSlots = scheduleStats?.possibleSlots || 0;
      const filledSlots = filledSlotsByBranch.get(branch.id) || 0;
      const doctorCount = scheduleStats?.doctorIds?.size || 0;
      const counters = appointmentCountersByBranch.get(branch.id) || {
        completedCount: 0,
        bookedCount: 0,
        noShowCount: 0,
      };
      const fillingRate =
        possibleSlots > 0 ? Math.round((filledSlots / possibleSlots) * 100) : null;

      return {
        branchId: branch.id,
        branchName: branch.name,
        doctorCount,
        possibleSlots,
        filledSlots,
        fillingRate,
        salesToday: Math.round(salesToday.byBranch.get(branch.id) || 0),
        completedCount: counters.completedCount,
        bookedCount: counters.bookedCount,
        noShowCount: counters.noShowCount,
      };
    });

    return res.json({
      kpis: {
        day,
        monthStart: monthStartDay,
        monthlyNetSales: Math.round(monthlyNetSales),
        dailyAverageSales: Math.round(dailyAverageSales),
        todayTotalSales: Math.round(todayTotalSales),
        passedDays,
      },
      branches: response,
      alerts: {
        noShowLostValue: Math.round(noShowLostValue),
        unpaidInvoicesTotal: Math.round(unpaidInvoicesTotal),
        readyToPayCount,
      },
      imagingService: {
        monthlyServiceSales: Math.round(monthlyServiceSales),
        monthlyServiceCount,
        yesterdayServiceCount,
      },
      sterilization: {
        dirtyPackageLabel: "Бохир үзлэгийн багцын тоо",
        completedTodayLabel: "Өнөөдөр дууссан үзлэгийн тоо",
      },
    });
  } catch (err) {
    console.error("GET /api/dashboard/admin-home error:", err);
    return res.status(500).json({ error: "Failed to fetch admin home dashboard data." });
  }
});

export default router;
