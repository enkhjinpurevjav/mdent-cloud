import express from "express";
import prisma from "../db.js";

const router = express.Router();

/**
 * GET /api/reception/scheduled
 *
 * Query parameters:
 *  - date=YYYY-MM-DD      (required)
 *  - branchId=number      (optional)
 *
 * Returns: list of receptionists (User with role=receptionist)
 * who have a ReceptionSchedule entry on that date + their schedules.
 */
router.get("/scheduled", async (req, res) => {
  try {
    const { date, branchId } = req.query;

    if (!date) {
      return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
    }

  // AFTER (UTC+8)
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

    const schedules = await prisma.receptionSchedule.findMany({
      where,
      include: {
        reception: true,
      },
      orderBy: [
        { receptionId: "asc" },
        { startTime: "asc" },
      ],
    });

    const byReception = new Map();

    for (const s of schedules) {
      if (!s.reception) continue;
      const existing =
        byReception.get(s.receptionId) || {
          id: s.reception.id,
          name: s.reception.name,
          ovog: s.reception.ovog,
          role: s.reception.role,
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
      byReception.set(s.receptionId, existing);
    }

    const receptionists = Array.from(byReception.values());

    res.json(receptionists);
  } catch (err) {
    console.error("Error fetching scheduled reception:", err);
    res.status(500).json({ error: "failed to fetch scheduled reception" });
  }
});

export default router;
