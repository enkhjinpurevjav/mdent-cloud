// backend/src/routes/public.js
// Public endpoints – no authentication required.
// Mounted at /api/public
import { Router } from "express";
import { PrismaClient, BookingStatus } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

/**
 * Convert "YYYY-MM-DD" → Date at 00:00 UTC-local.
 */
function parseDateOrNull(str) {
  if (!str) return null;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Generate HH:MM time slots between startTime and endTime with given step in minutes.
 * Inclusive of start, exclusive of end.
 */
function generateTimeSlots(startTime, endTime, stepMinutes) {
  const slots = [];
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let current = sh * 60 + sm;
  const end = eh * 60 + em;
  while (current < end) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    current += stepMinutes;
  }
  return slots;
}

/**
 * GET /api/public/branches
 * List all active branches.
 */
router.get("/branches", async (_req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true, address: true },
    });
    return res.json(branches);
  } catch (err) {
    console.error("GET /api/public/branches error:", err);
    return res.status(500).json({ error: "Failed to list branches" });
  }
});

/**
 * GET /api/public/service-categories?branchId=:id
 * List distinct service categories available at the branch (via ServiceBranch + Service.isActive),
 * and include durationMinutes from ServiceCategoryConfig.
 */
router.get("/service-categories", async (req, res) => {
  try {
    const { branchId } = req.query;
    if (!branchId) {
      return res.status(400).json({ error: "branchId is required" });
    }
    const bid = Number(branchId);
    if (Number.isNaN(bid)) {
      return res.status(400).json({ error: "Invalid branchId" });
    }

    // Find distinct active service categories available at the branch
    const serviceBranches = await prisma.serviceBranch.findMany({
      where: {
        branchId: bid,
        service: { isActive: true },
      },
      select: {
        service: { select: { category: true } },
      },
    });

    const categories = [...new Set(serviceBranches.map((sb) => sb.service.category))];

    // Fetch duration configs for these categories
    const configs = await prisma.serviceCategoryConfig.findMany({
      where: { category: { in: categories } },
      select: { category: true, durationMinutes: true, isActive: true },
    });
    const configMap = Object.fromEntries(configs.map((c) => [c.category, c]));

    const categoryLabels = {
      ORTHODONTIC_TREATMENT: "Гажиг заслын эмчилгээ",
      IMAGING: "Зураг авах",
      DEFECT_CORRECTION: "Согог засал",
      ADULT_TREATMENT: "Том хүний эмчилгээ",
      WHITENING: "Цайруулалт",
      CHILD_TREATMENT: "Хүүхдийн эмчилгээ",
      SURGERY: "Мэс засал",
      PREVIOUS: "Бусад",
    };

    const result = categories
      .filter((cat) => cat !== "PREVIOUS") // exclude marker category
      .map((cat) => ({
        category: cat,
        label: categoryLabels[cat] || cat,
        durationMinutes: configMap[cat]?.durationMinutes ?? 30,
      }));

    return res.json(result);
  } catch (err) {
    console.error("GET /api/public/service-categories error:", err);
    return res.status(500).json({ error: "Failed to list service categories" });
  }
});

/**
 * GET /api/public/booking-grid?branchId=:id&category=:cat&date=YYYY-MM-DD
 * Return data needed to render the online booking grid:
 *   - doctors: eligible doctors (have schedule at this branch+date)
 *   - slots: time slots based on each doctor's schedule (30 min granularity)
 *   - busy: set of "doctorId:startTime" that are occupied (0 capacity for online)
 *
 * A slot is busy for online booking if ANY active booking exists at that
 * doctor+date+startTime (statuses other than ONLINE_EXPIRED).
 * No patient data is included.
 */
router.get("/booking-grid", async (req, res) => {
  try {
    const { branchId, category, date } = req.query;

    if (!branchId || !category || !date) {
      return res.status(400).json({ error: "branchId, category, and date are required" });
    }

    const bid = Number(branchId);
    if (Number.isNaN(bid)) {
      return res.status(400).json({ error: "Invalid branchId" });
    }

    const day = parseDateOrNull(date);
    if (!day) {
      return res.status(400).json({ error: "Invalid date (use YYYY-MM-DD)" });
    }

    // Fetch durationMinutes for category
    const categoryConfig = await prisma.serviceCategoryConfig.findUnique({
      where: { category },
      select: { durationMinutes: true },
    });
    const durationMinutes = categoryConfig?.durationMinutes ?? 30;

    // Get eligible doctors: doctors with a schedule at this branch+date
    const schedules = await prisma.doctorSchedule.findMany({
      where: { branchId: bid, date: day },
      select: {
        startTime: true,
        endTime: true,
        doctor: { select: { id: true, name: true } },
      },
    });

    if (schedules.length === 0) {
      return res.json({ doctors: [], slots: [], busy: [], durationMinutes });
    }

    // Build doctor list and compute time slots per doctor
    const doctorMap = new Map();
    for (const sch of schedules) {
      doctorMap.set(sch.doctor.id, {
        id: sch.doctor.id,
        name: sch.doctor.name || `Эмч #${sch.doctor.id}`,
        scheduleStart: sch.startTime,
        scheduleEnd: sch.endTime,
      });
    }
    const doctors = Array.from(doctorMap.values());
    const doctorIds = doctors.map((d) => d.id);

    // Collect all unique time slots across all doctors
    const allSlotSet = new Set();
    for (const doctor of doctors) {
      const slots = generateTimeSlots(doctor.scheduleStart, doctor.scheduleEnd, durationMinutes);
      for (const s of slots) allSlotSet.add(s);
    }
    const slots = Array.from(allSlotSet).sort();

    // Fetch all active bookings for these doctors on this date (exclude ONLINE_EXPIRED)
    const bookings = await prisma.booking.findMany({
      where: {
        branchId: bid,
        date: day,
        doctorId: { in: doctorIds },
        status: { not: BookingStatus.ONLINE_EXPIRED },
      },
      select: { doctorId: true, startTime: true },
    });

    // Build busy set: "doctorId:startTime"
    const busy = bookings.map((b) => `${b.doctorId}:${b.startTime}`);

    return res.json({ doctors, slots, busy, durationMinutes });
  } catch (err) {
    console.error("GET /api/public/booking-grid error:", err);
    return res.status(500).json({ error: "Failed to load booking grid" });
  }
});

export default router;
