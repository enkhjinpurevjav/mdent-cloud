import express from "express";
import prisma from "../db.js";

const router = express.Router();

/**
 * GET /api/doctors/scheduled
 *
 * Query parameters:
 *  - date=YYYY-MM-DD      (required) → which calendar day
 *  - branchId=number      (optional) → limit to one branch
 *
 * Returns: list of doctors (User) who have a DoctorSchedule entry on that date
 * plus their schedules for that day.
 */
router.get("/scheduled", async (req, res) => {
  try {
    const { date, branchId } = req.query;

    if (!date) {
      return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
    }

    // Build the calendar day range in UTC for DoctorSchedule.date
  // AFTER (Mongolia time UTC+8)
const start = new Date(`${date}T00:00:00.000+08:00`);
const end = new Date(`${date}T23:59:59.999+08:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const where = {
      date: {
        gte: start,
        lte: end,
      },
    };

    if (branchId) {
      const parsedBranchId = Number(branchId);
      if (!Number.isNaN(parsedBranchId)) {
        where.branchId = parsedBranchId;
      }
    }

    const schedules = await prisma.doctorSchedule.findMany({
      where,
      include: {
        doctor: true,
      },
      orderBy: [
        // sort doctors by calendarOrder then id to give stable grouping
        { doctor: { calendarOrder: "asc" } },
        { doctorId: "asc" },
        { startTime: "asc" },
      ],
    });

    // Group by doctor
    const byDoctor = new Map();

    for (const s of schedules) {
      if (!s.doctor) continue;
      const existing =
        byDoctor.get(s.doctorId) || {
          id: s.doctor.id,
          name: s.doctor.name,
          ovog: s.doctor.ovog,
          calendarOrder: s.doctor.calendarOrder ?? 0, // expose
          schedules: [],
        };
      existing.schedules.push({
        id: s.id,
        branchId: s.branchId,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        note: s.note,
      });
      byDoctor.set(s.doctorId, existing);
    }

    const doctors = Array.from(byDoctor.values());

    res.json(doctors);
  } catch (err) {
    console.error("Error fetching scheduled doctors:", err);
    res.status(500).json({ error: "failed to fetch scheduled doctors" });
  }
});
router.get("/", async (_req, res) => {
  const doctors = await prisma.user.findMany({
    where: { role: "doctor" }, // adjust if your schema differs
    orderBy: [{ calendarOrder: "asc" }, { id: "asc" }],
  });
  res.json(doctors);
});

export default router;
