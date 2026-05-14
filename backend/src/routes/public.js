// backend/src/routes/public.js
// Public endpoints – no authentication required.
// Mounted at /api/public
import { Router } from "express";
import { PrismaClient, BookingStatus } from "@prisma/client";
import rateLimit from "express-rate-limit";
import { normalizeRegNo, parseRegNo } from "../utils/regno.js";

const prisma = new PrismaClient();
const router = Router();
const ONLINE_BOOKING_DRAFT_HOLD_MINUTES = 10;

const onlineBookingStartLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many online booking attempts. Please try again later." },
});

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

function buildOnlineInfoNote({ ovog, name, phone, regNo, matchStatus }) {
  const lines = [
    "Онлайн захиалгаар оруулсан мэдээлэл:",
    `Овог: ${ovog}`,
    `Нэр: ${name}`,
    `Утас: ${phone}`,
    `РД: ${regNo}`,
  ];
  if (matchStatus === "EXISTING") {
    lines.push("", "⚠️ РД системд бүртгэлтэй байсан тул одоо байгаа үйлчлүүлэгчтэй холбов.");
  }
  if (matchStatus === "DUPLICATE_NEEDS_REVIEW") {
    lines.push("", "⚠️ Ижил РД-тэй олон бүртгэл илэрсэн тул reception шалгалт шаардлагатай.");
  }
  return lines.join("\n");
}

/**
 * POST /api/public/online-booking/start
 * Initializes online booking Step 1 draft without creating/updating Patient.
 * Body: { branchId, ovog, name, phone, regNo }
 */
router.post("/online-booking/start", onlineBookingStartLimiter, async (req, res) => {
  try {
    const {
      branchId,
      ovog,
      name,
      phone,
      regNo,
    } = req.body || {};

    if (!branchId || !ovog || !name || !phone || !regNo) {
      return res.status(400).json({
        error: "branchId, ovog, name, phone, regNo are required",
      });
    }

    const bid = Number(branchId);
    if (Number.isNaN(bid)) {
      return res.status(400).json({ error: "Invalid branchId" });
    }

    const normalizedRegNo = normalizeRegNo(regNo);
    if (!normalizedRegNo) {
      return res.status(400).json({ error: "regNo is required" });
    }

    const parsedRegNo = parseRegNo(normalizedRegNo);
    if (!parsedRegNo.isValid) {
      return res.status(400).json({
        error: parsedRegNo.reason || "Invalid regNo format",
      });
    }

    const branch = await prisma.branch.findUnique({
      where: { id: bid },
      select: { id: true },
    });
    if (!branch) {
      return res.status(400).json({ error: "Branch not found" });
    }

    const regNoMatches = await prisma.$queryRaw`
      SELECT p.id
      FROM "Patient" p
      WHERE p."regNo" IS NOT NULL
        AND UPPER(REGEXP_REPLACE(TRIM(p."regNo"), E'\\\\s+', '', 'g')) = ${normalizedRegNo}
      ORDER BY p.id ASC
    `;

    let matchStatus = "NEW";
    let matchedPatientId = null;
    if (Array.isArray(regNoMatches) && regNoMatches.length === 1) {
      matchStatus = "EXISTING";
      matchedPatientId = regNoMatches[0].id;
    } else if (Array.isArray(regNoMatches) && regNoMatches.length > 1) {
      matchStatus = "DUPLICATE_NEEDS_REVIEW";
    }

    const note = buildOnlineInfoNote({
      ovog: String(ovog).trim(),
      name: String(name).trim(),
      phone: String(phone).trim(),
      regNo: normalizedRegNo,
      matchStatus,
    });

    const expiresAt = new Date(Date.now() + ONLINE_BOOKING_DRAFT_HOLD_MINUTES * 60 * 1000);
    const draft = await prisma.onlineBookingDraft.create({
      data: {
        branchId: bid,
        matchedPatientId,
        matchStatus,
        ovog: String(ovog).trim(),
        name: String(name).trim(),
        phone: String(phone).trim(),
        regNoRaw: String(regNo).trim(),
        regNoNormalized: normalizedRegNo,
        note,
        expiresAt,
        ipAddress: req.ip || null,
        userAgent: req.get("user-agent") || null,
      },
      select: {
        id: true,
        status: true,
        matchStatus: true,
        expiresAt: true,
        matchedPatientId: true,
      },
    });

    return res.status(201).json({
      draftId: draft.id,
      status: draft.status,
      matchStatus: draft.matchStatus,
      matchedPatientId: draft.matchedPatientId,
      expiresAt: draft.expiresAt.toISOString(),
      normalizedRegNo,
      duplicateCount: Array.isArray(regNoMatches) && regNoMatches.length > 1 ? regNoMatches.length : 0,
    });
  } catch (err) {
    console.error("POST /api/public/online-booking/start error:", err);
    return res.status(500).json({ error: "Failed to initialize online booking draft" });
  }
});

export default router;
