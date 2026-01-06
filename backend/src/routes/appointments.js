import express from "express";
import prisma from "../db.js";

const router = express.Router();

/**
 * Allowed appointment statuses (must match frontend + DB values)
 */
const ALLOWED_STATUSES = [
  "booked",
  "confirmed",
  "online", // NEW (Онлайн)
  "ongoing",
  "ready_to_pay",
  "completed",
  "cancelled",
  "no_show", // NEW (Ирээгүй)
  "other", // NEW (Бусад)
];

/**
 * Normalize frontend status (e.g. "BOOKED", "READY_TO_PAY") to DB value.
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

    // NEW
    case "online":
      return "online";

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

    // NEW (accept common spellings)
    case "no_show":
    case "noshow":
    case "no-show":
    case "no show":
    case "no show up":
    case "no-show-up":
      return "no_show";

    // NEW (accept plural too)
    case "other":
    case "others":
      return "other";

    default:
      return undefined;
  }
}

/**
 * Clinic timezone standard for this project:
 * - DB columns are `timestamp without time zone`
 * - We store and interpret them as Mongolia clinic wall-clock time (UTC+08)
 *
 * Therefore:
 * - NEVER use toISOString() when returning these timestamps (it converts to UTC and shifts time)
 * - Parse YYYY-MM-DD filters as clinic days in +08:00
 */

/** YYYY-MM-DD -> Date at clinic midnight (+08:00) */
function parseClinicDayStart(value) {
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T00:00:00.000+08:00`);
}

/** YYYY-MM-DD -> Date at clinic end-of-day (+08:00) */
function parseClinicDayEnd(value) {
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T23:59:59.999+08:00`);
}

/**
 * Convert a DB "timestamp without time zone" Date into a clinic ISO string
 * that preserves wall-clock time: YYYY-MM-DDTHH:mm:ss+08:00
 */
function formatClinicIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}+08:00`;
}

/**
 * Parse input datetime into a clinic wall-clock Date to store in
 * `timestamp without time zone`.
 *
 * Accepts:
 * - YYYY-MM-DDTHH:mm
 * - YYYY-MM-DDTHH:mm:ss
 * - with optional suffix like Z or +08:00 (ignored for storage)
 */
function parseClinicWallClockDateTime(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  // match YYYY-MM-DDTHH:mm[:ss]
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
  );
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  const ss = m[6] != null ? Number(m[6]) : 0;

  if ([y, mo, d, hh, mm, ss].some((n) => Number.isNaN(n))) return null;

  // Construct a Date using numeric components (local wall-clock)
  // Prisma will persist these components into timestamp without time zone
  return new Date(y, mo - 1, d, hh, mm, ss, 0);
}

/**
 * GET /api/appointments
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

    if (dateFrom || dateTo) {
      const range = {};

      if (dateFrom) {
        const start = parseClinicDayStart(dateFrom);
        if (!start || Number.isNaN(start.getTime())) {
          return res.status(400).json({ error: "Invalid dateFrom format" });
        }
        range.gte = start;
      }

      if (dateTo) {
        const end = parseClinicDayEnd(dateTo);
        if (!end || Number.isNaN(end.getTime())) {
          return res.status(400).json({ error: "Invalid dateTo format" });
        }
        range.lte = end;
      }

      where.scheduledAt = range;
    } else if (date) {
      const start = parseClinicDayStart(date);
      const end = parseClinicDayEnd(date);
      if (!start || !end) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      where.scheduledAt = { gte: start, lte: end };
    }

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

        scheduledAt: formatClinicIso(a.scheduledAt),
        endAt: a.endAt ? formatClinicIso(a.endAt) : null,

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

    const scheduledDate = parseClinicWallClockDateTime(scheduledAt);
    if (!scheduledDate || Number.isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ error: "scheduledAt is invalid date" });
    }

    let endDate = null;
    if (endAt !== undefined && endAt !== null && endAt !== "") {
      const tmp = parseClinicWallClockDateTime(endAt);
      if (!tmp || Number.isNaN(tmp.getTime())) {
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
      if (!maybe || !ALLOWED_STATUSES.includes(maybe)) {
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

    return res.status(201).json(appt);
  } catch (err) {
    console.error("Error creating appointment:", err);
    return res.status(500).json({ error: "failed to create appointment" });
  }
});

/**
 * PATCH /api/appointments/:id
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
    if (!normalizedStatus || !ALLOWED_STATUSES.includes(normalizedStatus)) {
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

    if (!appt) {
      return res.status(404).json({ error: "Appointment not found" });
    }

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
 * NOTE: left unchanged here (you can later align it to the same wall-clock rules)
 */
router.get("/availability", async (req, res) => {
  try {
    const { doctorId, from, to, slotMinutes, branchId } = req.query || {};

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

    const fromDate = parseClinicDayStart(from);
    const toDate = parseClinicDayEnd(to);

    if (
      !fromDate ||
      !toDate ||
      Number.isNaN(fromDate.getTime()) ||
      Number.isNaN(toDate.getTime()) ||
      fromDate > toDate
    ) {
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

    const days = [];
    const dayNames = [
      "Ням",
      "Даваа",
      "Мягмар",
      "Лхагва",
      "Пүрэв",
      "Баасан",
      "Бямба",
    ];
    const allTimeLabels = new Set();

    function clinicYmdFromDate(d) {
      const ms = d.getTime() + 8 * 60 * 60 * 1000;
      return new Date(ms).toISOString().slice(0, 10);
    }

    let currentDate = new Date(fromDate);
    while (currentDate <= toDate) {
      const dateStr = clinicYmdFromDate(currentDate);
      const dayOfWeek = currentDate.getDay();
      const dayLabel = dayNames[dayOfWeek];

      const schedule = schedules.find(
        (s) => clinicYmdFromDate(s.date) === dateStr
      );

      let daySlots = [];

      if (schedule) {
        const [startHour, startMin] = schedule.startTime.split(":").map(Number);
        const [endHour, endMin] = schedule.endTime.split(":").map(Number);

        const dayStart = new Date(currentDate);
        dayStart.setHours(startHour, startMin, 0, 0);

        const dayEnd = new Date(currentDate);
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
      } else {
        const defaultStart = new Date(currentDate);
        defaultStart.setHours(9, 0, 0, 0);

        const defaultEnd = new Date(currentDate);
        defaultEnd.setHours(17, 0, 0, 0);

        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          let slotStart = new Date(defaultStart);
          while (slotStart < defaultEnd) {
            const slotEnd = new Date(
              slotStart.getTime() + slotDuration * 60000
            );

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
      }

      days.push({ date: dateStr, dayLabel, slots: daySlots });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const timeLabels = Array.from(allTimeLabels).sort();
    return res.json({ days, timeLabels });
  } catch (err) {
    console.error("Error fetching appointment availability:", err);
    return res.status(500).json({ error: "failed to fetch availability" });
  }
});

// Helper function to format time as HH:MM
function formatTime(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export default router;
