import { Router } from "express";
import prisma from "../db.js";
import { ADMIN_HOME_INCOME_METHODS } from "../constants/dashboard.js";
import {
  computeFilledSlotsByBranch,
  computeSalesTodayByBranch,
  computeScheduleStatsByBranch,
} from "../utils/adminHomeDashboard.js";

const router = Router();

router.get("/admin-home", async (_req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

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
          date: { gte: todayStart, lte: todayEnd },
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
          scheduledAt: { gte: todayStart, lte: todayEnd },
        },
        select: {
          branchId: true,
          doctorId: true,
          scheduledAt: true,
          status: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          timestamp: { gte: todayStart, lte: todayEnd },
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
