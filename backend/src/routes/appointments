import express from "express";
import prisma from "../db.js";

const router = express.Router();

// GET /api/appointments?date=YYYY-MM-DD&branchId=1
router.get("/", async (req, res) => {
  try {
    const { date, branchId } = req.query;
    const where = {};

    if (branchId) where.branchId = Number(branchId);
    if (date) {
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(`${date}T23:59:59.999Z`);
      where.scheduledAt = { gte: start, lte: end };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { scheduledAt: "asc" },
      include: {
        patient: true,
        // doctor: true,  // uncomment after you have a Doctor model
        // branch: true,  // uncomment if you have a Branch relation
      },
    });

    res.json(appointments);
  } catch (err) {
    console.error("GET /api/appointments error:", err);
    res.status(500).json({ error: "failed to fetch appointments" });
  }
});

// POST /api/appointments
router.post("/", async (req, res) => {
  try {
    const { patientId, doctorId, branchId, scheduledAt, status, notes } = req.body;

    if (!patientId || !branchId || !scheduledAt) {
      return res.status(400).json({ error: "patientId, branchId, scheduledAt are required" });
    }

    const appt = await prisma.appointment.create({
      data: {
        patientId: Number(patientId),
        doctorId: doctorId ? Number(doctorId) : null,
        branchId: Number(branchId),
        scheduledAt: new Date(scheduledAt), // expect ISO string
        status: status || "booked",
        notes: notes || null,
      },
      include: {
        patient: true,
      },
    });

    res.status(201).json(appt);
  } catch (err) {
    console.error("POST /api/appointments error:", err);
    res.status(500).json({ error: "failed to create appointment" });
  }
});

export default router;
