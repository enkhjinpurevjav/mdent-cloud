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
  "online",
  "ongoing",
  "ready_to_pay", // Төлбөр төлөхөд бэлэн
  "completed",
  "cancelled",
  "no_show",
  "other",
];

// AFTER (add online + no_show + other)
function normalizeStatusForDb(raw) {
  if (!raw) return undefined;
  const v = String(raw).trim().toLowerCase();

  switch (v) {
    case "booked":
    case "pending":
      return "booked";

    case "confirmed":
      return "confirmed";

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

    case "no_show":
    case "noshow":
    case "no-show":
    case "no show":
      return "no_show";

    case "other":
    case "others":
      return "other";

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

// PATCH /api/appointments/:id  (status/notes + optional time/doctor edits)
router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid appointment id" });
    }

    const {
      status,
      notes,
      scheduledAt,
      endAt,
      doctorId,

      // explicitly forbid these in this endpoint for safety
      patientId,
      branchId,
    } = req.body || {};

    // ✅ hard block changes you don't want reception to do via "Засварлах"
    if (patientId !== undefined) {
      return res.status(400).json({
        error:
          "patientId cannot be updated here. Create a new appointment if patient must change.",
      });
    }
    if (branchId !== undefined) {
      return res.status(400).json({
        error:
          "branchId cannot be updated here. Create a new appointment if branch must change.",
      });
    }

    const data = {};

    // ---------------- status (optional) ----------------
    if (status !== undefined) {
      if (typeof status !== "string" || !status.trim()) {
        return res.status(400).json({ error: "status must be a non-empty string" });
      }
      const normalizedStatus = normalizeStatusForDb(status);
      if (!normalizedStatus) {
        return res.status(400).json({ error: "invalid status" });
      }
      data.status = normalizedStatus;
    }

    // ---------------- notes (optional) ----------------
    if (notes !== undefined) {
      if (notes === null) data.notes = null;
      else if (typeof notes === "string") data.notes = notes.trim() || null;
      else {
        return res
          .status(400)
          .json({ error: "notes must be a string or null" });
      }
    }

    // ---------------- doctorId (optional) ----------------
    if (doctorId !== undefined) {
      if (doctorId === null || doctorId === "") {
        data.doctorId = null;
      } else {
        const parsed = Number(doctorId);
        if (Number.isNaN(parsed)) {
          return res.status(400).json({ error: "doctorId must be a number or null" });
        }
        data.doctorId = parsed;
      }
    }

    // ---------------- scheduledAt / endAt (optional) ----------------
    // Allow updating time range. If one provided, validate with the other (existing or provided).
    let nextScheduledAt;
    let nextEndAt;

    if (scheduledAt !== undefined) {
      const d = new Date(scheduledAt);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ error: "scheduledAt is invalid date" });
      }
      nextScheduledAt = d;
      data.scheduledAt = d;
    }

    if (endAt !== undefined) {
      if (endAt === null || endAt === "") {
        nextEndAt = null;
        data.endAt = null;
      } else {
        const d = new Date(endAt);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ error: "endAt is invalid date" });
        }
        nextEndAt = d;
        data.endAt = d;
      }
    }

    // If either time value changed, validate end > start (when end exists)
    if (scheduledAt !== undefined || endAt !== undefined) {
      const current = await prisma.appointment.findUnique({
        where: { id },
        select: { scheduledAt: true, endAt: true },
      });
      if (!current) return res.status(404).json({ error: "appointment not found" });

      const start = nextScheduledAt ?? current.scheduledAt;
      const end = endAt !== undefined ? nextEndAt : current.endAt;

      if (end && end <= start) {
        return res
          .status(400)
          .json({ error: "endAt must be later than scheduledAt" });
      }
    }

    // Nothing to update
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No fields provided to update" });
    }

    const appt = await prisma.appointment.update({
      where: { id },
      data,
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

// ... keep existing code above

/**
 * GET /api/appointments/:id/encounter
 *
 * Used by reception when appointment.status === "ready_to_pay"
 * Returns the encounterId linked to this appointment.
 */
router.get("/:id/encounter", async (req, res) => {
  try {
    const apptId = Number(req.params.id);
    if (!apptId || Number.isNaN(apptId)) {
      return res.status(400).json({ error: "Invalid appointment id" });
    }

    // Find latest encounter for this appointment (in case of multiple)
    const encounter = await prisma.encounter.findFirst({
      where: { appointmentId: apptId },
      orderBy: { id: "desc" },
      select: { id: true },
    });

    if (!encounter) {
      return res
        .status(404)
        .json({ error: "Encounter not found for this appointment" });
    }

    return res.json({ encounterId: encounter.id });
  } catch (err) {
    console.error("GET /api/appointments/:id/encounter error:", err);
    return res
      .status(500)
      .json({ error: "Failed to load encounter for appointment" });
  }
});

// ...inside router.get("/", ...) where rows are shaped:

// ----------------- Shape for frontend AppointmentRow + extra fields -----------------
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

      const startIso = a.scheduledAt ? a.scheduledAt.toISOString() : null;
      const endIso = a.endAt ? a.endAt.toISOString() : null;

      const patientName = patient ? patient.name : null;
      const patientOvog = patient ? patient.ovog || null : null;
      const patientRegNo = patient ? patient.regNo || null : null;
      const patientPhone = patient ? patient.phone || null : null;

      const branchName = branch ? branch.name : null;

      return {
        id: a.id,
        branchId: a.branchId,
        doctorId: a.doctorId,
        patientId: a.patientId,

        patientName,
        patientOvog,
        patientRegNo,
        patientPhone,

        doctorName,
        doctorOvog: doctor ? doctor.ovog || null : null,

        scheduledAt: startIso,
        endAt: endIso,

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

        // legacy aliases for visits pages
        startTime: startIso,
        endTime: endIso,
        regNo: patientRegNo,
        branchName,
      };
    });

    return res.json(rows);
  } catch (err) {
    console.error("Error fetching appointments:", err);
    return res.status(500).json({ error: "failed to fetch appointments" });
  }
});


export default router;
