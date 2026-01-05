import express from "express";
import prisma from "../db.js";

const router = express.Router();

/**
 * Allowed appointment statuses (must match frontend + DB values)
 *
 * NOTE:
 * - These are the actual lowercase strings stored in Appointment.status.
 * - Frontend uses uppercase enums (BOOKED, ONGOING, etc.) which are normalized
 *   to these values via normalizeStatusForDb().
 */
const ALLOWED_STATUSES = [
  "booked",
  "confirmed",
  "ongoing",
  "ready_to_pay", // Төлбөр төлөхөд бэлэн
  "completed",
  "cancelled",
];

/**
 * Normalize frontend status (e.g. "BOOKED", "READY_TO_PAY") to DB value
 * (e.g. "booked", "ready_to_pay").
 */
function normalizeStatusForDb(raw) {
  if (!raw) return undefined;
  const v = String(raw).trim().toLowerCase();

  switch (v) {
    case "booked":
    case "pending":
      return "booked";
    case "confirmed":
      return "confirmed";
    case "ongoing":
      return "ongoing";
    case "ready_to_pay":
    case "readytopay":
    case "ready-to-pay":
      return "ready_to_pay";
    case "completed":
      return "completed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return undefined;
  }
}

/**
 * Parse a clinic-local date string (YYYY-MM-DD) into [startOfDay, endOfDay].
 * NOTE: This is used by GET /api/appointments (calendar & lists).
 * It relies on server local timezone.
 */
function parseClinicDay(value) {
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return null;
  const localStart = new Date(y, m - 1, d, 0, 0, 0, 0);
  const localEnd = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { localStart, localEnd };
}


// ADD THESE HELPERS (place them near your other helper functions,
// e.g., right after parseClinicDayEnd or near formatTime/ymdFromClinicDate)

function clinicDateFromYmd(ymd) {
  // clinic midnight (UTC+8)
  return new Date(`${ymd}T00:00:00.000+08:00`);
}

function addDaysYmd(ymd, days) {
  const d = clinicDateFromYmd(ymd);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function weekdayMnFromClinicYmd(ymd) {
  const dayNames = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
  const d = clinicDateFromYmd(ymd);
  return dayNames[d.getDay()];
}


/**
 * For availability grid we want clinic day boundaries in UTC+8 explicitly,
 * so Docker/server timezone won't shift day matching.
 */
function parseClinicDayStart(value) {
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T00:00:00.000+08:00`);
}

function parseClinicDayEnd(value) {
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T23:59:59.999+08:00`);
}

// Helper: format date as YYYY-MM-DD using server local date parts
function formatDateYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Helper: format time as HH:MM (local)
function formatTime(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Convert a Date into a Mongolia clinic day key (YYYY-MM-DD) by applying +8h.
 * This avoids server TZ problems when comparing day keys.
 */
function ymdFromClinicDate(d) {
  const ms = d.getTime() + 8 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Build a Date at clinic midnight for a given day key.
 */
function clinicDateFromYmd(ymd) {
  return new Date(`${ymd}T00:00:00.000+08:00`);
}

/**
 * Add days in clinic timezone and return YMD string.
 */
function addDaysYmd(ymd, days) {
  const d = clinicDateFromYmd(ymd);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * GET /api/appointments
 *
 * Used by:
 *  - Appointment calendar
 *  - Үзлэг pages (Цаг захиалсан, Үзлэг хийж буй, Дууссан)
 *
 * Query parameters:
 *  - status=BOOKED|ONGOING|COMPLETED|CANCELLED|READY_TO_PAY|CONFIRMED|ALL
 *  - date=YYYY-MM-DD           (legacy: single day)
 *  - dateFrom=YYYY-MM-DD       (start of range)
 *  - dateTo=YYYY-MM-DD         (end of range)
 *  - includeCancelled=true     (for booked list: booked + cancelled)
 *  - branchId=number
 *  - doctorId=number
 *  - patientId=number
 *  - search=string             (patient name / regNo / phone)
 */
router.get("/", async (req, res) => {
  try {
    const {
      date,
      dateFrom,
      dateTo,
      branchId,
      doctorId,
      patientId,
      status,
      includeCancelled,
      search,
    } = req.query || {};

    const where = {};

    // ----------------- Branch / doctor / patient filters -----------------
    if (branchId) {
      const parsed = Number(branchId);
      if (!Number.isNaN(parsed)) where.branchId = parsed;
    }

    if (doctorId) {
      const parsed = Number(doctorId);
      if (!Number.isNaN(parsed)) where.doctorId = parsed;
    }

    if (patientId) {
      const parsed = Number(patientId);
      if (!Number.isNaN(parsed)) where.patientId = parsed;
    }

    // ----------------- Date / date range filter -----------------
    if (dateFrom || dateTo) {
      const range = {};

      if (dateFrom) {
        const parsed = parseClinicDay(dateFrom);
        if (!parsed) return res.status(400).json({ error: "Invalid dateFrom format" });
        range.gte = parsed.localStart;
      }

      if (dateTo) {
        const parsed = parseClinicDay(dateTo);
        if (!parsed) return res.status(400).json({ error: "Invalid dateTo format" });
        range.lte = parsed.localEnd;
      }

      where.scheduledAt = range;
    } else if (date) {
      const parsed = parseClinicDay(date);
      if (!parsed) return res.status(400).json({ error: "Invalid date format" });
      where.scheduledAt = { gte: parsed.localStart, lte: parsed.localEnd };
    }

    // ----------------- Status + includeCancelled logic -----------------
    const normalized = normalizeStatusForDb(status);

    if (status && String(status).toUpperCase() !== "ALL") {
      if (normalized === "booked" && includeCancelled === "true") {
        where.status = { in: ["booked", "cancelled"] };
      } else if (normalized && ALLOWED_STATUSES.includes(normalized)) {
        where.status = normalized;
      } else {
        return res.status(400).json({ error: "Invalid status value" });
      }
    }

    // ----------------- Text search on patient -----------------
    if (search && search.trim() !== "") {
      const s = search.trim();
      where.patient = {
        OR: [
          { name: { contains: s, mode: "insensitive" } },
          { regNo: { contains: s, mode: "insensitive" } },
          { phone: { contains: s, mode: "insensitive" } },
        ],
      };
    }

    // ----------------- Query DB -----------------
    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { scheduledAt: "asc" },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            ovog: true,
            regNo: true,
            phone: true,
            patientBook: true,
          },
        },
        doctor: true,
        branch: true,
      },
    });

    // ----------------- Shape for frontend Appointment type -----------------
    const rows = appointments.map((a) => {
      const patient = a.patient;
      const doctor = a.doctor;
      const branch = a.branch;

      const doctorName =
        doctor && (doctor.name || doctor.ovog)
          ? [doctor.ovog, doctor.name].filter(Boolean).join(" ")
          : null;

      return {
        id: a.id,
        branchId: a.branchId,
        doctorId: a.doctorId,
        patientId: a.patientId,

        patientName: patient ? patient.name : null,
        patientOvog: patient ? patient.ovog || null : null,
        patientRegNo: patient ? patient.regNo || null : null,
        patientPhone: patient ? patient.phone || null : null,

        doctorName,
        doctorOvog: doctor ? doctor.ovog || null : null,

        scheduledAt: a.scheduledAt.toISOString(),
        endAt: a.endAt ? a.endAt.toISOString() : null,
        status: a.status,
        notes: a.notes || null,

        patient: patient
          ? {
              id: patient.id,
              name: patient.name,
              ovog: patient.ovog || null,
              regNo: patient.regNo || null,
              phone: patient.phone || null,
              patientBook: patient.patientBook || null,
            }
          : null,
        branch: branch ? { id: branch.id, name: branch.name } : null,
      };
    });

    return res.json(rows);
  } catch (err) {
    console.error("Error fetching appointments:", err);
    return res.status(500).json({ error: "failed to fetch appointments" });
  }
});

/**
 * POST /api/appointments
 */
router.post("/", async (req, res) => {
  try {
    const { patientId, doctorId, branchId, scheduledAt, endAt, status, notes } =
      req.body || {};

    if (!patientId || !branchId || !scheduledAt) {
      return res.status(400).json({
        error: "patientId, branchId, scheduledAt are required",
      });
    }

    const parsedPatientId = Number(patientId);
    const parsedBranchId = Number(branchId);
    const parsedDoctorId =
      doctorId !== undefined && doctorId !== null && doctorId !== ""
        ? Number(doctorId)
        : null;

    if (Number.isNaN(parsedPatientId) || Number.isNaN(parsedBranchId)) {
      return res
        .status(400)
        .json({ error: "patientId and branchId must be numbers" });
    }
    if (parsedDoctorId !== null && Number.isNaN(parsedDoctorId)) {
      return res.status(400).json({ error: "doctorId must be a number" });
    }

    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ error: "scheduledAt is invalid date" });
    }

    let endDate = null;
    if (endAt !== undefined && endAt !== null && endAt !== "") {
      const tmp = new Date(endAt);
      if (Number.isNaN(tmp.getTime())) {
        return res.status(400).json({ error: "endAt is invalid date" });
      }
      if (tmp <= scheduledDate) {
        return res
          .status(400)
          .json({ error: "endAt must be later than scheduledAt" });
      }
      endDate = tmp;
    }

    let normalizedStatus = "booked";
    if (typeof status === "string" && status.trim()) {
      const maybe = normalizeStatusForDb(status);
      if (!maybe) return res.status(400).json({ error: "invalid status" });
      normalizedStatus = maybe;
    }

    const appt = await prisma.appointment.create({
      data: {
        patientId: parsedPatientId,
        doctorId: parsedDoctorId,
        branchId: parsedBranchId,
        scheduledAt: scheduledDate,
        endAt: endDate,
        status: normalizedStatus,
        notes: notes || null,
      },
      include: {
        patient: { include: { patientBook: true } },
        doctor: true,
        branch: true,
      },
    });

    return res.status(201).json(appt);
  } catch (err) {
    console.error("Error creating appointment:", err);
    return res.status(500).json({ error: "failed to create appointment" });
  }
});

/**
 * PATCH /api/appointments/:id
 * Update status only.
 */
router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid appointment id" });
    }

    const { status } = req.body || {};
    if (typeof status !== "string" || !status.trim()) {
      return res.status(400).json({ error: "status is required" });
    }

    const normalizedStatus = normalizeStatusForDb(status);
    if (!normalizedStatus) {
      return res.status(400).json({ error: "invalid status" });
    }

    const appt = await prisma.appointment.update({
      where: { id },
      data: { status: normalizedStatus },
      include: {
        patient: { include: { patientBook: true } },
        doctor: true,
        branch: true,
      },
    });

    return res.json(appt);
  } catch (err) {
    console.error("Error updating appointment:", err);
    if (err.code === "P2025") {
      return res.status(404).json({ error: "appointment not found" });
    }
    return res.status(500).json({ error: "failed to update appointment" });
  }
});

/**
 * POST /api/appointments/:id/start-encounter
 */
router.post("/:id/start-encounter", async (req, res) => {
  try {
    const apptId = Number(req.params.id);
    if (!apptId || Number.isNaN(apptId)) {
      return res.status(400).json({ error: "Invalid appointment id" });
    }

    const appt = await prisma.appointment.findUnique({
      where: { id: apptId },
      include: {
        patient: { include: { patientBook: true } },
        branch: true,
        doctor: true,
      },
    });

    if (!appt) return res.status(404).json({ error: "Appointment not found" });

    if (appt.status !== "ongoing") {
      return res.status(400).json({
        error:
          'Зөвхөн "Явагдаж байна" (ongoing) төлөвтэй цаг дээр үзлэг эхлүүлэх боломжтой.',
      });
    }

    if (!appt.patient) {
      return res
        .status(400)
        .json({ error: "Appointment has no patient linked" });
    }

    if (!appt.doctorId) {
      return res.status(400).json({
        error: "Энэ цаг дээр эмч сонгоогүй тул үзлэг эхлүүлэх боломжгүй.",
      });
    }

    const patient = appt.patient;

    let book = patient.patientBook;
    if (!book) {
      book = await prisma.patientBook.create({
        data: {
          patientId: patient.id,
          bookNumber: String(patient.id),
        },
      });
    }

    let encounter = await prisma.encounter.findFirst({
      where: { appointmentId: appt.id },
      orderBy: { id: "desc" },
    });

    if (!encounter) {
      encounter = await prisma.encounter.create({
        data: {
          patientBookId: book.id,
          doctorId: appt.doctorId,
          visitDate: appt.scheduledAt,
          notes: null,
          appointmentId: appt.id,
        },
      });
    }

    return res.json({ encounterId: encounter.id });
  } catch (err) {
    console.error("Error in POST /api/appointments/:id/start-encounter:", err);
    return res
      .status(500)
      .json({ error: "Failed to start or open encounter for appointment" });
  }
});

/**
 * GET /api/appointments/:id/encounter
 */
router.get("/:id/encounter", async (req, res) => {
  try {
    const apptId = Number(req.params.id);
    if (!apptId || Number.isNaN(apptId)) {
      return res.status(400).json({ error: "Invalid appointment id" });
    }

    const encounter = await prisma.encounter.findFirst({
      where: { appointmentId: apptId },
      orderBy: { id: "desc" },
      select: { id: true },
    });

    if (!encounter) {
      return res.status(404).json({
        error: "Үзлэг олдсонгүй. Эмч үзлэг эхлүүлээгүй байна.",
      });
    }

    return res.json({ encounterId: encounter.id });
  } catch (err) {
    console.error("GET /api/appointments/:id/encounter error:", err);
    return res
      .status(500)
      .json({ error: "Үзлэгийн мэдээлэл авах үед алдаа гарлаа." });
  }
});

/**
 * GET /api/appointments/availability
 *
 * NOTE:
 * - Uses a YMD-string loop to avoid Date drift.
 * - Matches DoctorSchedule.date (timestamp without time zone) by local date parts.
 */
router.get("/availability", async (req, res) => {
  try {
    const { doctorId, from, to, slotMinutes, branchId } = req.query || {};

    if (!doctorId || !from || !to) {
      return res.status(400).json({ error: "doctorId, from, and to are required" });
    }

    const parsedDoctorId = Number(doctorId);
    if (Number.isNaN(parsedDoctorId)) {
      return res.status(400).json({ error: "doctorId must be a number" });
    }

    const parsedBranchId = branchId ? Number(branchId) : null;
    if (branchId && Number.isNaN(parsedBranchId)) {
      return res.status(400).json({ error: "branchId must be a number" });
    }

    const slotDuration = slotMinutes ? Number(slotMinutes) : 30;
    if (Number.isNaN(slotDuration) || slotDuration < 5 || slotDuration > 120) {
      return res.status(400).json({ error: "slotMinutes must be between 5 and 120" });
    }

    const fromDate = parseClinicDayStart(from);
    const toDate = parseClinicDayEnd(to);
    if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
      return res.status(400).json({ error: "Invalid date range" });
    }

    const schedules = await prisma.doctorSchedule.findMany({
      where: {
        doctorId: parsedDoctorId,
        ...(parsedBranchId && { branchId: parsedBranchId }),
        date: { gte: fromDate, lte: toDate },
      },
      orderBy: { date: "asc" },
    });

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: parsedDoctorId,
        ...(parsedBranchId && { branchId: parsedBranchId }),
        scheduledAt: { gte: fromDate, lte: toDate },
        status: { notIn: ["cancelled", "completed"] },
      },
      select: { id: true, scheduledAt: true, endAt: true },
      orderBy: { scheduledAt: "asc" },
    });

    // Index schedules by stored day (timestamp without tz => use date parts)
    const scheduleByYmd = new Map();
    for (const s of schedules) {
      const y = s.date.getFullYear();
      const m = String(s.date.getMonth() + 1).padStart(2, "0");
      const d = String(s.date.getDate()).padStart(2, "0");
      scheduleByYmd.set(`${y}-${m}-${d}`, s);
    }

    const days = [];
    const allTimeLabels = new Set();

    let ymd = String(from);
    const endYmd = String(to);

    while (ymd <= endYmd) {
      const schedule = scheduleByYmd.get(ymd);
      const slots = [];

      if (schedule) {
        const [startHour, startMin] = schedule.startTime.split(":").map(Number);
        const [endHour, endMin] = schedule.endTime.split(":").map(Number);

        const dayStart = clinicDateFromYmd(ymd);
        dayStart.setHours(startHour, startMin, 0, 0);

        const dayEnd = clinicDateFromYmd(ymd);
        dayEnd.setHours(endHour, endMin, 0, 0);

        let slotStart = new Date(dayStart);
        while (slotStart < dayEnd) {
          const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);

          const conflictingAppt = appointments.find((appt) => {
            const apptStart = new Date(appt.scheduledAt);
            const apptEnd = appt.endAt
              ? new Date(appt.endAt)
              : new Date(apptStart.getTime() + 30 * 60000);
            return slotStart < apptEnd && slotEnd > apptStart;
          });

          const label = formatTime(slotStart);
          allTimeLabels.add(label);

          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            status: conflictingAppt ? "booked" : "available",
            ...(conflictingAppt && { appointmentId: conflictingAppt.id }),
          });

          slotStart = slotEnd;
        }
      }

      days.push({
        date: ymd,
        dayLabel: weekdayMnFromClinicYmd(ymd),
        slots,
      });

      ymd = addDaysYmd(ymd, 1);
    }

    const timeLabels = Array.from(allTimeLabels).sort();
    return res.json({ days, timeLabels });
  } catch (err) {
    console.error("Error fetching appointment availability:", err);
    return res.status(500).json({ error: "failed to fetch availability" });
  }
});

export default router;
