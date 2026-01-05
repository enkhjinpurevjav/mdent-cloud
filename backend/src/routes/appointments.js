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
 * We rely on server local timezone (Ubuntu VPS, Asia/Ulaanbaatar).
 */
function parseClinicDay(value) {
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return null;
  const localStart = new Date(y, m - 1, d, 0, 0, 0, 0);
  const localEnd = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { localStart, localEnd };
}

function parseClinicDayStart(value) {
  // value: YYYY-MM-DD, treat as Asia/Ulaanbaatar (UTC+8)
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T00:00:00.000+08:00`);
}

function parseClinicDayEnd(value) {
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T23:59:59.999+08:00`);
}

function clinicYmdFromDate(d) {
  // Interpret a JS Date as clinic time UTC+8 regardless of server TZ
  const ms = d.getTime() + 8 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
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
 *
 * Response:
 *  Array of rows shaped for frontend AppointmentRow:
 *  - id, patientName, regNo, branchName, doctorName, status, startTime, endTime
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
        if (!parsed) {
          return res.status(400).json({ error: "Invalid dateFrom format" });
        }
        range.gte = parsed.localStart;
      }

      if (dateTo) {
        const parsed = parseClinicDay(dateTo);
        if (!parsed) {
          return res.status(400).json({ error: "Invalid dateTo format" });
        }
        range.lte = parsed.localEnd;
      }

      where.scheduledAt = range;
    } else if (date) {
      // Legacy single-day mode
      const parsed = parseClinicDay(date);
      if (!parsed) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      where.scheduledAt = {
        gte: parsed.localStart,
        lte: parsed.localEnd,
      };
    }

    // ----------------- Status + includeCancelled logic -----------------
    const normalized = normalizeStatusForDb(status);

    if (status && String(status).toUpperCase() !== "ALL") {
      if (normalized === "booked" && includeCancelled === "true") {
        // Цаг захиалсан list: booked + cancelled
        where.status = { in: ["booked", "cancelled"] };
      } else if (normalized && ALLOWED_STATUSES.includes(normalized)) {
        where.status = normalized;
      } else {
        return res.status(400).json({ error: "Invalid status value" });
      }
    }
    // If status missing or "ALL", we don't filter by status.

    // ----------------- Text search on patient -----------------
    if (search && search.trim() !== "") {
      const s = search.trim();
      // Prisma relation filter: appointment where patient matches OR conditions
      where.patient = {
        OR: [
          {
            name: {
              contains: s,
              mode: "insensitive",
            },
          },
          {
            regNo: {
              contains: s,
              mode: "insensitive",
            },
          },
          {
            phone: {
              contains: s,
              mode: "insensitive",
            },
          },
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
        ovog: true,      // ← ADD THIS
        regNo: true,
        phone: true,
        patientBook: true,
      },
    },
    doctor: true,
    branch: true,
  },
});

    // ----------------- Shape for new frontend Appointment type -----------------
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

    // flat fields for quick labels
    patientName: patient ? patient.name : null,
    patientOvog: patient ? patient.ovog || null : null,     // ← ADD
    patientRegNo: patient ? patient.regNo || null : null,
    patientPhone: patient ? patient.phone || null : null,

    doctorName,
    doctorOvog: doctor ? doctor.ovog || null : null,

    scheduledAt: a.scheduledAt.toISOString(),
    endAt: a.endAt ? a.endAt.toISOString() : null,
    status: a.status,
    notes: a.notes || null,

    // nested objects used by the details modal & labels
    patient: patient
      ? {
          id: patient.id,
          name: patient.name,
          ovog: patient.ovog || null,                       // ← ADD
          regNo: patient.regNo || null,
          phone: patient.phone || null,
          patientBook: patient.patientBook || null,
        }
      : null,
    branch: branch
      ? {
          id: branch.id,
          name: branch.name,
        }
      : null,
  };
});

    res.json(rows);
  } catch (err) {
    console.error("Error fetching appointments:", err);
    res.status(500).json({ error: "failed to fetch appointments" });
  }
});

/**
 * POST /api/appointments
 *
 * Body:
 *  - patientId (number, required)
 *  - doctorId (number, optional)
 *  - branchId (number, required)
 *  - scheduledAt (ISO string or YYYY-MM-DDTHH:mm, required)
 *  - endAt (ISO string or YYYY-MM-DDTHH:mm, optional; must be > scheduledAt)
 *  - status (string, optional, defaults to "booked")
 *  - notes (string, optional)
 */
router.post("/", async (req, res) => {
  try {
    const {
      patientId,
      doctorId,
      branchId,
      scheduledAt,
      endAt,
      status,
      notes,
    } = req.body || {};

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

    // Optional endAt
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

    // Normalize and validate status
    let normalizedStatus = "booked";
    if (typeof status === "string" && status.trim()) {
      const maybe = normalizeStatusForDb(status);
      if (!maybe) {
        return res.status(400).json({ error: "invalid status" });
      }
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
        patient: {
          include: {
            patientBook: true,
          },
        },
        doctor: true,
        branch: true,
      },
    });

    res.status(201).json(appt);
  } catch (err) {
    console.error("Error creating appointment:", err);
    res.status(500).json({ error: "failed to create appointment" });
  }
});

/**
 * PATCH /api/appointments/:id
 *
 * Currently used to update status only (from Цагийн дэлгэрэнгүй modal).
 *
 * Body:
 *  - status (string, required; one of ALLOWED_STATUSES or uppercase equivalent)
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
      data: {
        status: normalizedStatus,
      },
      include: {
        patient: {
          include: {
            patientBook: true,
          },
        },
        doctor: true,
        branch: true,
      },
    });

    res.json(appt);
  } catch (err) {
    console.error("Error updating appointment:", err);
    if (err.code === "P2025") {
      // Prisma: record not found
      return res.status(404).json({ error: "appointment not found" });
    }
    res.status(500).json({ error: "failed to update appointment" });
  }
});

/**
 * POST /api/appointments/:id/start-encounter
 *
 * Starts (or re-opens) an Encounter for this appointment.
 * Only allowed when appointment.status === "ongoing".
 */
router.post("/:id/start-encounter", async (req, res) => {
  try {
    const apptId = Number(req.params.id);
    if (!apptId || Number.isNaN(apptId)) {
      return res.status(400).json({ error: "Invalid appointment id" });
    }

    // 1) Load appointment with patient + patientBook
    const appt = await prisma.appointment.findUnique({
      where: { id: apptId },
      include: {
        patient: {
          include: {
            patientBook: true,
          },
        },
        branch: true,
        doctor: true,
      },
    });

    if (!appt) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // 2) Only allow when status is "ongoing" (Явагдаж байна)
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

    // 3) Ensure patient has a PatientBook
    let book = patient.patientBook;
    if (!book) {
      // TODO: replace bookNumber logic with proper generator if needed
      book = await prisma.patientBook.create({
        data: {
          patientId: patient.id,
          bookNumber: String(patient.id),
        },
      });
    }

    // 4) Find latest Encounter for this appointment, if any
    let encounter = await prisma.encounter.findFirst({
      where: { appointmentId: appt.id },
      orderBy: { id: "desc" },
    });

    // 5) If none, create new Encounter
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
 *
 * Returns the latest Encounter ID linked to this appointment, if any.
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
      return res
        .status(404)
        .json({ error: "Үзлэг олдсонгүй. Эмч үзлэг эхлүүлээгүй байна." });
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
 * Query parameters:
 *  - doctorId (number, required)
 *  - from (YYYY-MM-DD, required)
 *  - to (YYYY-MM-DD, required)
 *  - slotMinutes (number, optional, default 30)
 *  - branchId (number, optional)
 *
 * Response:
 *  {
 *    days: [
 *      {
 *        date: 'YYYY-MM-DD',
 *        dayLabel: 'Даваа' | 'Мягмар' | ...,
 *        slots: [
 *          {
 *            start: ISO datetime,
 *            end: ISO datetime,
 *            status: 'available' | 'booked' | 'off',
 *            appointmentId?: number  (if booked)
 *          }
 *        ]
 *      }
 *    ],
 *    timeLabels: ['09:00', '09:30', ...]
 *  }
 */
router.get("/availability", async (req, res) => {
  try {
    const { doctorId, from, to, slotMinutes, branchId } = req.query || {};

    // Validate required params
    if (!doctorId || !from || !to) {
      return res.status(400).json({
        error: "doctorId, from, and to are required",
      });
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
      return res.status(400).json({
        error: "slotMinutes must be between 5 and 120",
      });
    }

    // Parse date range
    const fromParts = String(from).split("-").map(Number);
    const toParts = String(to).split("-").map(Number);

    if (
      fromParts.length !== 3 ||
      toParts.length !== 3 ||
      fromParts.some((n) => Number.isNaN(n)) ||
      toParts.some((n) => Number.isNaN(n))
    ) {
      return res.status(400).json({
        error: "from and to must be in YYYY-MM-DD format",
      });
    }

    const fromDate = parseClinicDayStart(from);
const toDate = parseClinicDayEnd(to);

if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
  return res.status(400).json({ error: "Invalid date range" });
}

    // Fetch doctor schedules for this range
    const schedules = await prisma.doctorSchedule.findMany({
      where: {
        doctorId: parsedDoctorId,
        ...(parsedBranchId && { branchId: parsedBranchId }),
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { date: "asc" },
    });

    // Fetch existing appointments in this range for this doctor
    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: parsedDoctorId,
        ...(parsedBranchId && { branchId: parsedBranchId }),
        scheduledAt: {
          gte: fromDate,
          lte: toDate,
        },
        status: {
          notIn: ["cancelled", "completed"],
        },
      },
      select: {
        id: true,
        scheduledAt: true,
        endAt: true,
      },
      orderBy: { scheduledAt: "asc" },
    });

    // Build availability grid
    const days = [];
    const dayNames = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
    const allTimeLabels = new Set();

    // Iterate through each day in the range
    // Build a map for schedules by clinic day key (YYYY-MM-DD)
const scheduleByYmd = new Map();
for (const s of schedules) {
  // since DoctorSchedule.date is stored as "YYYY-MM-DD 00:00:00" (no tz),
  // we treat it as that same day key by reading it in server local date parts.
  // This is stable for "timestamp without time zone".
  const y = s.date.getFullYear();
  const m = String(s.date.getMonth() + 1).padStart(2, "0");
  const d = String(s.date.getDate()).padStart(2, "0");
  const ymd = `${y}-${m}-${d}`;
  scheduleByYmd.set(ymd, s);
}

const days = [];
const allTimeLabels = new Set();

// Iterate YYYY-MM-DD strings (NO drifting Date mutation)
let ymd = String(from);
while (ymd <= String(to)) {
  const dayLabel = weekdayMnFromClinicYmd(ymd);

  const schedule = scheduleByYmd.get(ymd);

  let daySlots = [];

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

      const timeLabel = formatTime(slotStart);
      allTimeLabels.add(timeLabel);

      daySlots.push({
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
    dayLabel,
    slots: daySlots,
  });

  ymd = addDaysYmd(ymd, 1);
}

const timeLabels = Array.from(allTimeLabels).sort();

return res.json({ days, timeLabels });

    // Convert time labels set to sorted array
    const timeLabels = Array.from(allTimeLabels).sort();

    res.json({
      days,
      timeLabels,
    });
  } catch (err) {
    console.error("Error fetching appointment availability:", err);
    res.status(500).json({ error: "failed to fetch availability" });
  }
});

// Helper function to format date as YYYY-MM-DD
function formatDateYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Helper function to format time as HH:MM
function formatTime(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
function addDaysYmd(ymd, days) {
  const base = new Date(`${ymd}T00:00:00.000+08:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10); // NOTE: still UTC string, but date part works for +08 midnight
}

function ymdFromClinicDate(d) {
  // Convert a Date (stored in DB) into Mongolia day key
  // Use +08:00 by shifting milliseconds
  const ms = d.getTime() + 8 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function clinicDateFromYmd(ymd) {
  // clinic midnight in UTC+8
  return new Date(`${ymd}T00:00:00.000+08:00`);
}

function addDaysYmd(ymd, days) {
  const d = clinicDateFromYmd(ymd);
  d.setDate(d.getDate() + days); // safe because d is in a single timezone basis
  // convert back to YYYY-MM-DD in clinic time:
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

export default router;
