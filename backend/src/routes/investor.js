import { Router } from "express";
import prisma from "../db.js";
import {
  ADMIN_HOME_BOOKED_APPOINTMENT_STATUSES,
  ADMIN_HOME_INCOME_METHODS,
} from "../constants/dashboard.js";
import {
  computeFilledSlotsByBranch,
  computeRecognizedSalesFromPayments,
  computeScheduleStatsByBranch,
  getLocalDayRange,
} from "../utils/adminHomeDashboard.js";
import { formatApptForResponse } from "../utils/formatAppointment.js";
import { requireRole } from "../middleware/auth.js";

const router = Router();
const BOOKED_STATUS_SET = new Set(ADMIN_HOME_BOOKED_APPOINTMENT_STATUSES);
const TODAY_SALES_METHODS = [...ADMIN_HOME_INCOME_METHODS, "WALLET"];

router.use(requireRole("manager"));

function getTodayYmd() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
}

function toISODateOnly(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function getInvestorBranchId(req, res) {
  const branchId = Number(req.user?.branchId);
  if (!Number.isFinite(branchId) || branchId <= 0) {
    res.status(400).json({ error: "Investor account is not assigned to a branch." });
    return null;
  }
  return branchId;
}

function computeBranchAppointmentCounters(appointments) {
  const counters = { completedCount: 0, bookedCount: 0, noShowCount: 0 };
  for (const appt of appointments) {
    const status = String(appt.status || "").toLowerCase();
    if (status === "completed") counters.completedCount += 1;
    if (status === "no_show") counters.noShowCount += 1;
    if (BOOKED_STATUS_SET.has(status)) counters.bookedCount += 1;
  }
  return counters;
}

function buildScheduledDoctors(schedules) {
  const byDoctor = new Map();

  for (const schedule of schedules) {
    if (!schedule.doctor) continue;
    const existing =
      byDoctor.get(schedule.doctorId) || {
        id: schedule.doctor.id,
        name: schedule.doctor.name,
        ovog: schedule.doctor.ovog,
        regNo: schedule.doctor.regNo || null,
        phone: schedule.doctor.phone || null,
        calendarOrder: schedule.doctor.calendarOrder ?? 0,
        schedules: [],
      };

    existing.schedules.push({
      id: schedule.id,
      doctorId: schedule.doctorId,
      branchId: schedule.branchId,
      branch: schedule.branch,
      date: toISODateOnly(schedule.date),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      note: schedule.note,
    });

    byDoctor.set(schedule.doctorId, existing);
  }

  return Array.from(byDoctor.values());
}

router.get("/dashboard", async (req, res) => {
  try {
    const branchId = getInvestorBranchId(req, res);
    if (branchId == null) return;

    const defaultDay = getTodayYmd();
    const day = typeof req.query.day === "string" && req.query.day ? req.query.day : defaultDay;
    const range = getLocalDayRange(day);
    if (!range) {
      return res.status(400).json({ error: "day query param must be YYYY-MM-DD" });
    }

    const { start, endExclusive } = range;
    const isCurrentDay = day === defaultDay;
    const todaySalesWindowEnd = isCurrentDay ? new Date() : endExclusive;

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true },
    });
    if (!branch) return res.status(404).json({ error: "Branch not found." });

    const [schedules, appointments, salesPayments] = await Promise.all([
      prisma.doctorSchedule.findMany({
        where: {
          branchId,
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
          branchId,
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
          method: { in: TODAY_SALES_METHODS },
          amount: { gt: 0 },
          invoice: { branchId },
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
    ]);

    const scheduleStatsByBranch = computeScheduleStatsByBranch(schedules);
    const filledSlotsByBranch = computeFilledSlotsByBranch(appointments);
    const appointmentCounters = computeBranchAppointmentCounters(appointments);
    const salesToday = computeRecognizedSalesFromPayments(salesPayments, {
      windowStart: start,
      windowEnd: todaySalesWindowEnd,
      includedMethods: TODAY_SALES_METHODS,
    });

    const scheduleStats = scheduleStatsByBranch.get(branchId);
    const possibleSlots = scheduleStats?.possibleSlots || 0;
    const filledSlots = filledSlotsByBranch.get(branchId) || 0;
    const fillingRate =
      possibleSlots > 0 ? Math.round((filledSlots / possibleSlots) * 100) : null;

    return res.json({
      day,
      branch: { id: branch.id, name: branch.name },
      performance: {
        branchId: branch.id,
        branchName: branch.name,
        doctorCount: scheduleStats?.doctorIds?.size || 0,
        possibleSlots,
        filledSlots,
        fillingRate,
        salesToday: Math.round(salesToday.byBranch.get(branchId) || 0),
        ...appointmentCounters,
      },
    });
  } catch (err) {
    console.error("GET /api/investor/dashboard error:", err);
    return res.status(500).json({ error: "Failed to fetch investor dashboard data." });
  }
});

router.get("/appointments", async (req, res) => {
  try {
    const branchId = getInvestorBranchId(req, res);
    if (branchId == null) return;

    const date =
      typeof req.query.date === "string" && req.query.date ? req.query.date : getTodayYmd();
    const range = getLocalDayRange(date);
    if (!range) {
      return res.status(400).json({ error: "date query param must be YYYY-MM-DD" });
    }
    const { start, endExclusive } = range;

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true },
    });
    if (!branch) return res.status(404).json({ error: "Branch not found." });

    const [schedules, appointments] = await Promise.all([
      prisma.doctorSchedule.findMany({
        where: {
          branchId,
          date: { gte: start, lt: endExclusive },
        },
        include: {
          doctor: true,
          branch: { select: { id: true, name: true } },
        },
        orderBy: [
          { doctor: { calendarOrder: "asc" } },
          { doctorId: "asc" },
          { startTime: "asc" },
        ],
      }),
      prisma.appointment.findMany({
        where: {
          branchId,
          status: { not: "cancelled" },
          scheduledAt: { gte: start, lt: endExclusive },
        },
        orderBy: { scheduledAt: "asc" },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              ovog: true,
              regNo: true,
              phone: true,
              notes: true,
              patientBook: true,
            },
          },
          doctor: true,
          branch: true,
          createdBy: { select: { id: true, name: true, ovog: true } },
          updatedBy: { select: { id: true, name: true, ovog: true } },
          encounters: {
            orderBy: { id: "desc" },
            take: 1,
            select: { id: true },
          },
        },
      }),
    ]);

    return res.json({
      date,
      branch,
      scheduledDoctors: buildScheduledDoctors(schedules),
      appointments: appointments.map(formatApptForResponse),
    });
  } catch (err) {
    console.error("GET /api/investor/appointments error:", err);
    return res.status(500).json({ error: "Failed to fetch investor appointments." });
  }
});

export default router;
