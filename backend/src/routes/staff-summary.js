import express from "express";
import prisma from "../db.js";

const router = express.Router();

/**
 * GET /api/staff/summary
 *
 * Query params:
 *  - role? = "doctor" | "receptionist" | (omit for all roles)
 *
 * Returns:
 * {
 *   total: number,            // total users for this role/all
 *   workingToday: number      // distinct users who have schedule today (for doctor now)
 * }
 */
router.get("/", async (req, res) => {
  try {
    const { role } = req.query;

    const whereUser = {};
    if (role) {
      whereUser.role = role;
    }

    // 1) Total employees (by role if provided)
    const total = await prisma.user.count({
      where: whereUser,
    });

    // 2) Working today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    let workingToday = 0;

    // For now: only doctors have schedules (DoctorSchedule)
    if (!role || role === "doctor") {
      const doctorWhere = {
        date: {
          gte: today,
          lt: tomorrow,
        },
      };

      const schedules = await prisma.doctorSchedule.findMany({
        where: doctorWhere,
        select: { doctorId: true },
      });

      const doctorIds = new Set(schedules.map((s) => s.doctorId));

      if (!role) {
        // all employees view: only doctors contribute to "workingToday" currently
        workingToday = doctorIds.size;
      } else if (role === "doctor") {
        workingToday = doctorIds.size;
      }
    }

    // TODO LATER: once ReceptionSchedule is ready, add similar logic for role === "receptionist"

    return res.json({
      total,
      workingToday,
    });
  } catch (err) {
    console.error("GET /api/staff/summary error:", err);
    return res.status(500).json({ error: "Failed to load staff summary" });
  }
});

export default router;
