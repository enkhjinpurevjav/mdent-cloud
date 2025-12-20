import express from "express";
import prisma from "../db.js";

const router = express.Router();

/**
 * Allowed appointment statuses (must match frontend options)
 */
const ALLOWED_STATUSES = [
  "booked",
  "confirmed",
  "ongoing",
  "ready_to_pay", // Төлбөр төлөх
  "completed",
  "cancelled",
];

/**
 * GET /api/appointments
 *
 * Optional query parameters:
 *  - date=YYYY-MM-DD       → filter by calendar date (server timezone, using 00:00–23:59)
 *  - branchId=number       → filter by branch
 *  - doctorId=number       → filter by doctor
 *  - patientId=number      → filter by patient
 */
router.get("/", async (req, res) => {
  try {
    const { date, branchId, doctorId, patientId } = req.query;

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

    if (date) {
  // Expecting YYYY-MM-DD; interpret this as a LOCAL clinic date (Asia/Ulaanbaatar)
  const [y, m, d] = String(date).split("-").map(Number);
  if (!y || !m || !d) {
    return res.status(400).json({ error: "Invalid date format" });
  }

  // Build local start/end of day (server's local timezone)
  const localStart = new Date(y, m - 1, d, 0, 0, 0, 0);
  const localEnd   = new Date(y, m - 1, d, 23, 59, 59, 999);

  // These Date objects already represent exact instants in time (UTC internally),
  // so we can use them directly in the Prisma range.
  where.scheduledAt = { gte: localStart, lte: localEnd };
}

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { scheduledAt: "asc" },
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

    res.json(appointments);
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
      endAt, // NEW
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

    // NEW: optional endAt
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
    const normalizedStatus =
      typeof status === "string" && status.trim()
        ? status.trim()
        : "booked";

    if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({ error: "invalid status" });
    }

    const appt = await prisma.appointment.create({
      data: {
        patientId: parsedPatientId,
        doctorId: parsedDoctorId,
        branchId: parsedBranchId,
        scheduledAt: scheduledDate,
        endAt: endDate, // can be null
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
 *  - status (string, required; one of ALLOWED_STATUSES)
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

    const normalizedStatus = status.trim();
    if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
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
      // If you want strict behavior, you could return 400 instead of auto-creating.
      // For now we auto-create an empty bookNumber; you can later implement a generator.
      book = await prisma.patientBook.create({
        data: {
          patientId: patient.id,
          bookNumber: String(patient.id), // TODO: replace with proper generator
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
export default router;
