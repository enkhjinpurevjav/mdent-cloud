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
  "completed",
  "cancelled",
];

/**
 * GET /api/appointments
 *
 * Optional query parameters:
 *  - date=YYYY-MM-DD       → filter by calendar date (LOCAL string range)
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
  const dateStr = String(date); // expected "YYYY-MM-DD"
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return res.status(400).json({ error: "Invalid date format" });
  }

  where.scheduledAt = { startsWith: dateStr };
}

      const dayStart = `${dateStr} 00:00:00`;
      const dayEnd = `${dateStr} 23:59:59`;

      // scheduledAt is String("YYYY-MM-DD HH:MM:SS"), so lexicographic range works
      where.scheduledAt = { gte: dayStart, lte: dayEnd };
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
 *  - scheduledAt (string "YYYY-MM-DD HH:MM[:SS]" in LOCAL time, required)
 *  - endAt (same format, optional; must be > scheduledAt)
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

    // ---- LOCAL TIME VALIDATION (no UTC conversion) ----

    if (typeof scheduledAt !== "string" || !scheduledAt.trim()) {
      return res.status(400).json({ error: "scheduledAt must be a string" });
    }

    const scheduledStr = scheduledAt.trim(); // e.g. "2025-12-18 15:30:00"

    // Accept "YYYY-MM-DD HH:MM" or "YYYY-MM-DD HH:MM:SS" (space or "T")
    const dateTimeRegex =
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

    const m1 = scheduledStr.match(dateTimeRegex);
    if (!m1) {
      return res.status(400).json({
        error:
          "scheduledAt must be in 'YYYY-MM-DD HH:MM[:SS]' format (local time)",
      });
    }

    const sYear = Number(m1[1]);
    const sMonth = Number(m1[2]);
    const sDay = Number(m1[3]);
    const sHour = Number(m1[4]);
    const sMin = Number(m1[5]);
    const sSec = m1[6] ? Number(m1[6]) : 0;

    const start = new Date(sYear, sMonth - 1, sDay, sHour, sMin, sSec, 0);
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ error: "scheduledAt is invalid date" });
    }

    let endStr = null;
    let end = null;

    if (endAt !== undefined && endAt !== null && endAt !== "") {
      if (typeof endAt !== "string") {
        return res.status(400).json({ error: "endAt must be a string" });
      }
      endStr = endAt.trim();
      const m2 = endStr.match(dateTimeRegex);
      if (!m2) {
        return res.status(400).json({
          error:
            "endAt must be in 'YYYY-MM-DD HH:MM[:SS]' format (local time)",
        });
      }

      const eYear = Number(m2[1]);
      const eMonth = Number(m2[2]);
      const eDay = Number(m2[3]);
      const eHour = Number(m2[4]);
      const eMin = Number(m2[5]);
      const eSec = m2[6] ? Number(m2[6]) : 0;

      end = new Date(eYear, eMonth - 1, eDay, eHour, eMin, eSec, 0);
      if (Number.isNaN(end.getTime())) {
        return res.status(400).json({ error: "endAt is invalid date" });
      }
      if (end <= start) {
        return res
          .status(400)
          .json({ error: "endAt must be later than scheduledAt" });
      }
    }

    // Normalize status
    const normalizedStatus =
      typeof status === "string" && status.trim()
        ? status.trim()
        : "booked";

    if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({ error: "invalid status" });
    }

    // Save the LOCAL datetime strings directly (no toISOString)
    const appt = await prisma.appointment.create({
      data: {
        patientId: parsedPatientId,
        doctorId: parsedDoctorId,
        branchId: parsedBranchId,
        scheduledAt: scheduledStr, // local string
        endAt: endStr || null,
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
 * Currently used to update status only.
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
      return res.status(404).json({ error: "appointment not found" });
    }
    res.status(500).json({ error: "failed to update appointment" });
  }
});

export default router;
