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
 * (existing endpoint)
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
        doctorId: s.doctorId,
        branchId: s.branchId,
        date: toISODateOnly(s.date),
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

/**
 * NEW: GET /api/doctors/scheduled-with-appointments
 *
 * Same query params as /scheduled, but returns:
 * [
 *   {
 *     id, name, ovog, calendarOrder,
 *     schedules: [...],
 *     appointments: [...]
 *   }
 * ]
 */
router.get("/scheduled-with-appointments", async (req, res) => {
  try {
    const { date, dateFrom, dateTo, branchId, doctorId } = req.query;

    const hasRange = Boolean(dateFrom || dateTo);
    if (!hasRange && !date) {
      return res.status(400).json({
        error: "date is required (YYYY-MM-DD) or dateFrom/dateTo for range",
      });
    }

    if (hasRange && (!dateFrom || !dateTo)) {
      return res.status(400).json({ error: "dateFrom and dateTo are both required for range" });
    }

    // Max range guard
    if (hasRange) {
      const days = diffDaysInclusive(dateFrom, dateTo);
      if (days == null) return res.status(400).json({ error: "Invalid dateFrom/dateTo format" });
      if (days > 31) return res.status(400).json({ error: "Range too large (max 31 days)" });
      if (days < 1) return res.status(400).json({ error: "dateTo must be >= dateFrom" });
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

    // 1) Fetch schedules (same as /scheduled)
    const scheduleWhere = {
      date: { gte: start, lte: end },
    };

    let parsedBranchId = null;
    if (branchId) {
      const n = Number(branchId);
      if (!Number.isNaN(n)) {
        parsedBranchId = n;
        scheduleWhere.branchId = n;
      }
    }

    let parsedDoctorId = null;
    if (doctorId !== undefined && doctorId !== null && doctorId !== "") {
      const n = Number(doctorId);
      if (Number.isNaN(n)) return res.status(400).json({ error: "doctorId must be a number" });
      parsedDoctorId = n;
      scheduleWhere.doctorId = n;
    }

    const schedules = await prisma.doctorSchedule.findMany({
      where: scheduleWhere,
      include: { doctor: true },
      orderBy: [
        { doctor: { calendarOrder: "asc" } },
        { doctorId: "asc" },
        { startTime: "asc" },
      ],
    });

    // Group schedules by doctor
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
          appointments: [],
        };

      existing.schedules.push({
        id: s.id,
        doctorId: s.doctorId,
        branchId: s.branchId,
        date: toISODateOnly(s.date),
        startTime: s.startTime,
        endTime: s.endTime,
        note: s.note,
      });

      byDoctor.set(s.doctorId, existing);
    }

    // If doctorId is provided, ensure doctor appears even if no schedule rows
    if (parsedDoctorId != null && !byDoctor.has(parsedDoctorId)) {
      const doc = await prisma.user.findUnique({
        where: { id: parsedDoctorId },
        select: { id: true, name: true, ovog: true, calendarOrder: true, role: true },
      });

      if (!doc || doc.role !== "doctor") {
        return res.status(404).json({ error: "Doctor not found" });
      }

      byDoctor.set(parsedDoctorId, {
        id: doc.id,
        name: doc.name,
        ovog: doc.ovog,
        calendarOrder: doc.calendarOrder ?? 0,
        schedules: [],
        appointments: [],
      });
    }

    const doctorIds = Array.from(byDoctor.keys());
    if (doctorIds.length === 0) {
      // No doctors to return
      return res.json([]);
    }

    // 2) Fetch appointments for these doctors in the same range
    // IMPORTANT: front desk creates status "booked" by default.
    // Only show "active" statuses on schedule:
    const visibleStatuses = ["booked", "confirmed", "online", "ongoing", "ready_to_pay"];

    const apptWhere = {
      doctorId: { in: doctorIds },
      scheduledAt: { gte: start, lte: end },
      status: { in: visibleStatuses },
    };

    if (parsedBranchId != null) {
      apptWhere.branchId = parsedBranchId;
    }

    const appts = await prisma.appointment.findMany({
      where: apptWhere,
      orderBy: { scheduledAt: "asc" },
      include: {
        patient: { select: { id: true, name: true, ovog: true } },
      },
    });

    for (const a of appts) {
      const entry = byDoctor.get(a.doctorId);
      if (!entry) continue;
      entry.appointments.push({
        id: a.id,
        doctorId: a.doctorId,
        branchId: a.branchId,
        patientId: a.patientId,
        patientName: a.patient?.name ?? null,
        patientOvog: a.patient?.ovog ?? null,
        scheduledAt: a.scheduledAt.toISOString(),
        endAt: a.endAt ? a.endAt.toISOString() : null,
        status: a.status,
      });
    }

    const doctors = Array.from(byDoctor.values()).sort((a, b) => {
      const ao = a.calendarOrder ?? 0;
      const bo = b.calendarOrder ?? 0;
      if (ao !== bo) return ao - bo;
      return a.id - b.id;
    });

    return res.json(doctors);
  } catch (err) {
    console.error("Error fetching scheduled doctors with appointments:", err);
    return res.status(500).json({ error: "failed to fetch scheduled doctors with appointments" });
  }
});

router.get("/scheduled-with-appointments", async (req, res) => {
  try {
    const { date, dateFrom, dateTo, branchId, doctorId } = req.query;

    const hasRange = Boolean(dateFrom || dateTo);
    if (!hasRange && !date) {
      return res.status(400).json({
        error: "date is required (YYYY-MM-DD) or dateFrom/dateTo for range",
      });
    }

    if (hasRange && (!dateFrom || !dateTo)) {
      return res.status(400).json({ error: "dateFrom and dateTo are both required for range" });
    }

    if (hasRange) {
      const days = diffDaysInclusive(dateFrom, dateTo);
      if (days == null) return res.status(400).json({ error: "Invalid dateFrom/dateTo format" });
      if (days > 31) return res.status(400).json({ error: "Range too large (max 31 days)" });
      if (days < 1) return res.status(400).json({ error: "dateTo must be >= dateFrom" });
    }

    // Build range
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

    // Filters
    const scheduleWhere = {
      date: { gte: start, lte: end },
    };

    let parsedBranchId = null;
    if (branchId) {
      const n = Number(branchId);
      if (!Number.isNaN(n)) {
        parsedBranchId = n;
        scheduleWhere.branchId = n;
      }
    }

    let parsedDoctorId = null;
    if (doctorId !== undefined && doctorId !== null && doctorId !== "") {
      const n = Number(doctorId);
      if (Number.isNaN(n)) return res.status(400).json({ error: "doctorId must be a number" });
      parsedDoctorId = n;
      scheduleWhere.doctorId = n;
    }

    // 1) Load schedules + doctor
    const schedules = await prisma.doctorSchedule.findMany({
      where: scheduleWhere,
      include: { doctor: true },
      orderBy: [
        { doctor: { calendarOrder: "asc" } },
        { doctorId: "asc" },
        { startTime: "asc" },
      ],
    });

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
          appointments: [],
        };

      existing.schedules.push({
        id: s.id,
        doctorId: s.doctorId,
        branchId: s.branchId,
        date: toISODateOnly(s.date),
        startTime: s.startTime,
        endTime: s.endTime,
        note: s.note,
      });

      byDoctor.set(s.doctorId, existing);
    }

    // If doctorId is provided, include doctor even with no schedules
    if (parsedDoctorId != null && !byDoctor.has(parsedDoctorId)) {
      const doc = await prisma.user.findUnique({
        where: { id: parsedDoctorId },
        select: { id: true, name: true, ovog: true, calendarOrder: true, role: true },
      });

      if (!doc || doc.role !== "doctor") {
        return res.status(404).json({ error: "Doctor not found" });
      }

      byDoctor.set(parsedDoctorId, {
        id: doc.id,
        name: doc.name,
        ovog: doc.ovog,
        calendarOrder: doc.calendarOrder ?? 0,
        schedules: [],
        appointments: [],
      });
    }

    const doctorIds = Array.from(byDoctor.keys());
    if (doctorIds.length === 0) return res.json([]);

    // 2) Load appointments in the same range for these doctors
    // (front desk creates "booked" by default)
    const visibleStatuses = ["booked", "confirmed", "online", "ongoing", "ready_to_pay"];

    const apptWhere = {
      doctorId: { in: doctorIds },
      scheduledAt: { gte: start, lte: end },
      status: { in: visibleStatuses },
    };

    if (parsedBranchId != null) apptWhere.branchId = parsedBranchId;

    const appts = await prisma.appointment.findMany({
      where: apptWhere,
      orderBy: { scheduledAt: "asc" },
      include: {
        patient: { select: { id: true, name: true, ovog: true } },
      },
    });

    for (const a of appts) {
      const entry = byDoctor.get(a.doctorId);
      if (!entry) continue;
      entry.appointments.push({
        id: a.id,
        doctorId: a.doctorId,
        branchId: a.branchId,
        patientId: a.patientId,
        patientName: a.patient?.name ?? null,
        patientOvog: a.patient?.ovog ?? null,
        scheduledAt: a.scheduledAt.toISOString(),
        endAt: a.endAt ? a.endAt.toISOString() : null,
        status: a.status,
      });
    }

    const doctors = Array.from(byDoctor.values()).sort((a, b) => {
      const ao = a.calendarOrder ?? 0;
      const bo = b.calendarOrder ?? 0;
      if (ao !== bo) return ao - bo;
      return a.id - b.id;
    });

    return res.json(doctors);
  } catch (err) {
    console.error("Error fetching scheduled doctors with appointments:", err);
    return res.status(500).json({ error: "failed to fetch scheduled doctors with appointments" });
  }
});

export default router;
