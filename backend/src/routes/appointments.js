import express from "express";
import prisma from "../db.js";

const router = express.Router();

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
      // Expecting YYYY-MM-DD; build a UTC range for that calendar day
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(`${date}T23:59:59.999Z`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      where.scheduledAt = { gte: start, lte: end };
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
  endAt,     // NEW
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

    const appt = await prisma.appointment.create({
  data: {
    patientId: parsedPatientId,
    doctorId: parsedDoctorId,
    branchId: parsedBranchId,
    scheduledAt: scheduledDate,
    endAt: endDate, // NEW (can be null)
    status:
      typeof status === "string" && status.trim()
        ? status.trim()
        : "booked",
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

export default router;
