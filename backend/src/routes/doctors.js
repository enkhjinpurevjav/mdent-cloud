import express from "express";
import prisma from "../db.js";

const router = express.Router();

function toISODateOnly(d) {
  if (!d) return null;
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function parseYmd(ymd) {
  const [y, m, d] = String(ymd || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function ymdToClinicStartEnd(ymd) {
  // Mongolia time UTC+8 boundaries (consistent with existing behavior)
  const start = new Date(`${ymd}T00:00:00.000+08:00`);
  const end = new Date(`${ymd}T23:59:59.999+08:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

function diffDaysInclusive(fromYmd, toYmd) {
  const a = parseYmd(fromYmd);
  const b = parseYmd(toYmd);
  if (!a || !b) return null;
  const start = new Date(a.y, a.m - 1, a.d, 0, 0, 0, 0);
  const end = new Date(b.y, b.m - 1, b.d, 0, 0, 0, 0);
  const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  return days;
}

/**
 * GET /api/doctors/scheduled
 *
 * Query parameters:
 *  - date=YYYY-MM-DD                (single day, legacy)
 *  - dateFrom=YYYY-MM-DD&dateTo=... (range)
 *  - branchId=number                (optional)
 *  - doctorId=number                (optional; if provided, return doctor even if schedules empty)
 *
 * Returns: list of doctors (User) who have a DoctorSchedule entry on the date/range,
 * plus their schedules. If doctorId is provided and schedules are empty, returns that doctor
 * with schedules: [].
 */
router.get("/scheduled", async (req, res) => {
  try {
    const { date, dateFrom, dateTo, branchId, doctorId } = req.query;

    const hasRange = Boolean(dateFrom || dateTo);
    if (!hasRange && !date) {
      return res.status(400).json({
        error: "date is required (YYYY-MM-DD) or dateFrom/dateTo for range",
      });
    }

    if (hasRange && (!dateFrom || !dateTo)) {
      return res
        .status(400)
        .json({ error: "dateFrom and dateTo are both required for range" });
    }

    // Max range guard (prevents heavy queries)
    if (hasRange) {
      const days = diffDaysInclusive(dateFrom, dateTo);
      if (days == null) {
        return res.status(400).json({ error: "Invalid dateFrom/dateTo format" });
      }
      if (days > 31) {
        return res.status(400).json({ error: "Range too large (max 31 days)" });
      }
      if (days < 1) {
        return res.status(400).json({ error: "dateTo must be >= dateFrom" });
      }
    }

    // Build date range
    let start;
    let end;

    if (hasRange) {
      const r1 = ymdToClinicStartEnd(dateFrom);
      const r2 = ymdToClinicStartEnd(dateTo);
      if (!r1 || !r2) return res.status(400).json({ error: "Invalid date range format" });
      start = r1.start;
      end = r2.end;
    } else {
      const r = ymdToClinicStartEnd(date);
      if (!r) return res.status(400).json({ error: "Invalid date format" });
      start = r.start;
      end = r.end;
    }

    const where = {
      date: {
        gte: start,
        lte: end,
      },
    };

    let parsedBranchId = null;
    if (branchId) {
      const n = Number(branchId);
      if (!Number.isNaN(n)) {
        parsedBranchId = n;
        where.branchId = n;
      }
    }

    let parsedDoctorId = null;
    if (doctorId !== undefined && doctorId !== null && doctorId !== "") {
      const n = Number(doctorId);
      if (Number.isNaN(n)) {
        return res.status(400).json({ error: "doctorId must be a number" });
      }
      parsedDoctorId = n;
      where.doctorId = n;
    }

    const schedules = await prisma.doctorSchedule.findMany({
      where,
      include: {
        doctor: true,
      },
      orderBy: [
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
          calendarOrder: s.doctor.calendarOrder ?? 0,
          schedules: [],
        };

      existing.schedules.push({
        id: s.id,
        doctorId: s.doctorId, // ✅ include doctorId
        branchId: s.branchId,
        date: toISODateOnly(s.date), // ✅ YYYY-MM-DD
        startTime: s.startTime,
        endTime: s.endTime,
        note: s.note,
      });

      byDoctor.set(s.doctorId, existing);
    }

    // If doctorId is provided, return that doctor even if schedules empty
    if (parsedDoctorId != null && !byDoctor.has(parsedDoctorId)) {
      const doc = await prisma.user.findUnique({
        where: { id: parsedDoctorId },
        select: { id: true, name: true, ovog: true, calendarOrder: true, role: true },
      });

      if (!doc || doc.role !== "doctor") {
        return res.status(404).json({ error: "Doctor not found" });
      }

      return res.json([
        {
          id: doc.id,
          name: doc.name,
          ovog: doc.ovog,
          calendarOrder: doc.calendarOrder ?? 0,
          schedules: [],
        },
      ]);
    }

    const doctors = Array.from(byDoctor.values());
    return res.json(doctors);
  } catch (err) {
    console.error("Error fetching scheduled doctors:", err);
    return res.status(500).json({ error: "failed to fetch scheduled doctors" });
  }
});

router.get("/", async (_req, res) => {
  const doctors = await prisma.user.findMany({
    where: { role: "doctor" },
    orderBy: [{ calendarOrder: "asc" }, { id: "asc" }],
  });
  res.json(doctors);
});

export default router;
