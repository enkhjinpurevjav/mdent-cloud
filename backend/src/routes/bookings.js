// backend/src/routes/bookings.js
import { Router } from "express";
import { PrismaClient, BookingStatus, UserRole } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

/**
 * Validate HH:MM 24h time.
 */
function isValidTime(str) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(str);
}

/**
 * Convert "YYYY-MM-DD" → Date at 00:00.
 */
function parseDateOrNull(str) {
  if (!str) return null;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * GET /api/bookings
 * Query params:
 *   date=YYYY-MM-DD (required for now)
 *   branchId=number (optional)
 *   doctorId=number (optional)
 *
 * Used by calendar view.
 */
router.get("/", async (req, res) => {
  const { date, branchId, doctorId } = req.query;

  const day = parseDateOrNull(date);
  if (!day) {
    return res.status(400).json({ error: "date (YYYY-MM-DD) is required" });
  }

  const where = {
    date: day,
  };

  if (branchId) {
    const bid = Number(branchId);
    if (Number.isNaN(bid)) {
      return res.status(400).json({ error: "Invalid branchId" });
    }
    where.branchId = bid;
  }

  if (doctorId) {
    const did = Number(doctorId);
    if (Number.isNaN(did)) {
      return res.status(400).json({ error: "Invalid doctorId" });
    }
    where.doctorId = did;
  }

  try {
    const bookings = await prisma.booking.findMany({
      where,
      orderBy: [{ startTime: "asc" }, { endTime: "asc" }],
      include: {
        patient: {
          select: { id: true, name: true, regNo: true, phone: true },
        },
        doctor: {
          select: { id: true, name: true, email: true },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
    });

    return res.json(
      bookings.map((b) => ({
        id: b.id,
        date: b.date.toISOString().slice(0, 10),
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        note: b.note,
        doctor: b.doctor,
        branch: b.branch,
        patient: b.patient,
      }))
    );
  } catch (err) {
    console.error("GET /api/bookings error:", err);
    return res.status(500).json({ error: "Failed to list bookings" });
  }
});

/**
 * POST /api/bookings
 * Body:
 * {
 *   patientId: number,
 *   doctorId: number,
 *   branchId: number,
 *   date: "YYYY-MM-DD",
 *   startTime: "HH:MM",
 *   endTime: "HH:MM",
 *   status?: BookingStatus,
 *   note?: string
 * }
 */
router.post("/", async (req, res) => {
  try {
    const {
      patientId,
      doctorId,
      branchId,
      date,
      startTime,
      endTime,
      status,
      note,
    } = req.body || {};

    if (!patientId || !doctorId || !branchId || !date || !startTime || !endTime) {
      return res.status(400).json({
        error:
          "patientId, doctorId, branchId, date, startTime, endTime are required",
      });
    }

    const pid = Number(patientId);
    const did = Number(doctorId);
    const bid = Number(branchId);
    if ([pid, did, bid].some((n) => Number.isNaN(n))) {
      return res.status(400).json({ error: "Invalid patientId/doctorId/branchId" });
    }

    const day = parseDateOrNull(date);
    if (!day) {
      return res.status(400).json({ error: "Invalid date" });
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return res
        .status(400)
        .json({ error: "startTime and endTime must be HH:MM (24h)" });
    }

    if (startTime >= endTime) {
      return res
        .status(400)
        .json({ error: "startTime must be before endTime" });
    }

    // 1) Ensure doctor exists and is a doctor
    const doctor = await prisma.user.findUnique({
      where: { id: did },
      select: { id: true, role: true },
    });

    if (!doctor || doctor.role !== UserRole.doctor) {
      return res.status(400).json({ error: "Invalid doctor" });
    }

    // 2) Ensure branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: bid },
      select: { id: true },
    });
    if (!branch) {
      return res.status(400).json({ error: "Branch not found" });
    }

    // 3) Ensure patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: pid },
      select: { id: true },
    });
    if (!patient) {
      return res.status(400).json({ error: "Patient not found" });
    }

    // 4) Optional: validate against doctorSchedule for that day+branch
    const schedule = await prisma.doctorSchedule.findFirst({
      where: {
        doctorId: did,
        branchId: bid,
        date: day,
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    if (!schedule) {
      return res.status(400).json({
        error: "Doctor has no schedule for this date/branch",
      });
    }

    if (startTime < schedule.startTime || endTime > schedule.endTime) {
      return res.status(400).json({
        error: "Booking outside doctor's working hours",
        scheduleStart: schedule.startTime,
        scheduleEnd: schedule.endTime,
      });
    }

    // 5) Create booking
    const booking = await prisma.booking.create({
      data: {
        patientId: pid,
        doctorId: did,
        branchId: bid,
        date: day,
        startTime,
        endTime,
        status: status && Object.values(BookingStatus).includes(status)
          ? status
          : BookingStatus.PENDING,
        note: note || null,
      },
    });

    return res.status(201).json({
      id: booking.id,
      date: booking.date.toISOString().slice(0, 10),
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      note: booking.note,
      doctorId: booking.doctorId,
      branchId: booking.branchId,
      patientId: booking.patientId,
    });
  } catch (err) {
    console.error("POST /api/bookings error:", err);
    return res.status(500).json({ error: "Failed to create booking" });
  }
});

/**
 * PATCH /api/bookings/:id
 * Allows updating status, time, note.
 */
router.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid booking id" });
  }

  const { startTime, endTime, status, note } = req.body || {};
  const data = {};

  if (startTime !== undefined) {
    if (!isValidTime(startTime)) {
      return res.status(400).json({ error: "Invalid startTime" });
    }
    data.startTime = startTime;
  }

  if (endTime !== undefined) {
    if (!isValidTime(endTime)) {
      return res.status(400).json({ error: "Invalid endTime" });
    }
    data.endTime = endTime;
  }

  if (startTime !== undefined && endTime !== undefined && startTime >= endTime) {
    return res
      .status(400)
      .json({ error: "startTime must be before endTime" });
  }

  if (status !== undefined) {
    if (!Object.values(BookingStatus).includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    data.status = status;
  }

  if (note !== undefined) {
    data.note = note || null;
  }

  try {
    const updated = await prisma.booking.update({
      where: { id },
      data,
    });

    return res.json({
      id: updated.id,
      date: updated.date.toISOString().slice(0, 10),
      startTime: updated.startTime,
      endTime: updated.endTime,
      status: updated.status,
      note: updated.note,
      doctorId: updated.doctorId,
      branchId: updated.branchId,
      patientId: updated.patientId,
    });
  } catch (err) {
    console.error("PATCH /api/bookings/:id error:", err);
    return res.status(500).json({ error: "Failed to update booking" });
  }
});

/**
 * DELETE /api/bookings/:id
 */
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid booking id" });
  }

  try {
    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Booking not found" });
    }

    await prisma.booking.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/bookings/:id error:", err);
    return res.status(500).json({ error: "Failed to delete booking" });
  }
});

export default router;
