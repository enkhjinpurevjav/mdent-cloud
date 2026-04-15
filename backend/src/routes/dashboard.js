import { Router } from "express";
import prisma from "../db.js";
import { ADMIN_HOME_INCOME_METHODS } from "../constants/dashboard.js";
import {
  computeFilledSlotsByBranch,
  computeSalesTodayByBranch,
  computeScheduleStatsByBranch,
  getLocalDayRange,
} from "../utils/adminHomeDashboard.js";

const router = Router();

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

    const branches = await prisma.branch.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    if (branches.length === 0) {
      return res.json({ branches: [] });
    }

    const branchIds = branches.map((b) => b.id);

    const [schedules, appointments, payments] = await Promise.all([
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
          doctorId: { not: null },
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
          timestamp: { gte: start, lt: endExclusive },
          method: { in: ADMIN_HOME_INCOME_METHODS },
          amount: { gt: 0 },
          invoice: {
            branchId: { in: branchIds },
          },
        },
        select: {
          amount: true,
          invoice: { select: { branchId: true } },
        },
      }),
    ]);

    const scheduleStatsByBranch = computeScheduleStatsByBranch(schedules);
    const filledSlotsByBranch = computeFilledSlotsByBranch(appointments);
    const salesTodayByBranch = computeSalesTodayByBranch(payments);

    const response = branches.map((branch) => {
      const scheduleStats = scheduleStatsByBranch.get(branch.id);
      const possibleSlots = scheduleStats?.possibleSlots || 0;
      const filledSlots = filledSlotsByBranch.get(branch.id) || 0;
      const doctorCount = scheduleStats?.doctorIds?.size || 0;
      const fillingRate =
        possibleSlots > 0 ? Math.round((filledSlots / possibleSlots) * 100) : null;

      return {
        branchId: branch.id,
        branchName: branch.name,
        doctorCount,
        possibleSlots,
        filledSlots,
        fillingRate,
        salesToday: Math.round(salesTodayByBranch.get(branch.id) || 0),
      };
    });

    return res.json({ branches: response });
  } catch (err) {
    console.error("GET /api/dashboard/admin-home error:", err);
    return res.status(500).json({ error: "Failed to fetch admin home dashboard data." });
  }
});

export default router;
