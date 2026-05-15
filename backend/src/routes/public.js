// backend/src/routes/public.js
// Public endpoints – no authentication required.
// Mounted at /api/public
import { Router } from "express";
import { PrismaClient, BookingStatus, UserRole } from "@prisma/client";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { normalizeRegNo, parseRegNo } from "../utils/regno.js";
import * as qpayService from "../services/qpayService.js";
import { getOnlineBookingDepositAmount } from "../utils/onlineBookingConfig.js";

const prisma = new PrismaClient();
const router = Router();
const ONLINE_BOOKING_DRAFT_HOLD_MINUTES = 10;
const ONLINE_BOOKING_DEPOSIT_AMOUNT = getOnlineBookingDepositAmount();
const BOOKABLE_SERVICE_CATEGORIES = [
  "ORTHODONTIC_TREATMENT",
  "IMAGING",
  "DEFECT_CORRECTION",
  "ADULT_TREATMENT",
  "WHITENING",
  "CHILD_TREATMENT",
  "SURGERY",
];
const ONLINE_BOOKING_SERVICE_TYPES = ["CONSULTATION", "TREATMENT"];
const ONLINE_BOOKING_TREATMENT_CATEGORIES = BOOKABLE_SERVICE_CATEGORIES.filter((cat) => cat !== "IMAGING");
const ONLINE_BOOKING_CONSULTATION_CATEGORIES = [
  "ORTHODONTIC_TREATMENT",
  "ADULT_TREATMENT",
  "SURGERY",
  "DEFECT_CORRECTION",
  "CHILD_TREATMENT",
];

const onlineBookingStartLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many online booking attempts. Please try again later." },
});

function isValidTime(str) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(str);
}

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function isValidOnlineBookingServiceType(value) {
  return ONLINE_BOOKING_SERVICE_TYPES.includes(String(value));
}

function normalizeOnlineBookingServiceType(value, defaultValue = "TREATMENT") {
  if (value === undefined || value === null || value === "") return defaultValue;
  return String(value).toUpperCase();
}

function getAllowedCategoriesForServiceType(serviceType) {
  return serviceType === "CONSULTATION"
    ? ONLINE_BOOKING_CONSULTATION_CATEGORIES
    : ONLINE_BOOKING_TREATMENT_CATEGORIES;
}

async function getOrCreatePlaceholderPatient(branchId) {
  const existing = await prisma.patient.findFirst({
    where: {
      branchId,
      name: "ONLINE",
      ovog: "BOOKING",
    },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.patient.create({
    data: {
      branchId,
      name: "ONLINE",
      ovog: "BOOKING",
    },
    select: { id: true },
  });
}

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
 * Lists treatment categories available for online booking.
 * - If branchId is provided: categories are filtered by that branch's active services.
 * - If branchId is omitted: returns all active configured treatment categories.
 */
router.get("/service-categories", async (req, res) => {
  try {
    const { branchId } = req.query;
    let categories = [];
    if (branchId !== undefined) {
      const bid = Number(branchId);
      if (Number.isNaN(bid)) {
        return res.status(400).json({ error: "Invalid branchId" });
      }

      const serviceBranches = await prisma.serviceBranch.findMany({
        where: {
          branchId: bid,
          service: { isActive: true },
        },
        select: {
          service: { select: { category: true } },
        },
      });

      categories = [...new Set(serviceBranches.map((sb) => sb.service.category))];
    } else {
      const allConfigs = await prisma.serviceCategoryConfig.findMany({
        where: {
          isActive: true,
          category: { in: ONLINE_BOOKING_TREATMENT_CATEGORIES },
        },
        select: { category: true },
      });
      categories = allConfigs.map((cfg) => cfg.category);
    }

    // Fetch duration configs for computed categories
    const configs = await prisma.serviceCategoryConfig.findMany({
      where: { category: { in: categories } },
      select: { category: true, durationMinutes: true },
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
      .filter((cat) => cat !== "PREVIOUS" && ONLINE_BOOKING_TREATMENT_CATEGORIES.includes(cat))
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
 * Return lightweight doctor list data for selected branch/category/date.
 * Slot-level availability is fetched per doctor via /doctor-available-slots.
 */
router.get("/booking-grid", async (req, res) => {
  try {
    const { branchId, category, date, serviceType: serviceTypeRaw } = req.query;

    if (!branchId || !category || !date) {
      return res.status(400).json({ error: "branchId, category, and date are required" });
    }

    const bid = Number(branchId);
    if (Number.isNaN(bid)) {
      return res.status(400).json({ error: "Invalid branchId" });
    }
    const serviceType = normalizeOnlineBookingServiceType(serviceTypeRaw, "TREATMENT");
    if (!isValidOnlineBookingServiceType(serviceType)) {
      return res.status(400).json({ error: "Invalid serviceType" });
    }
    const allowedCategories = getAllowedCategoriesForServiceType(serviceType);
    if (!allowedCategories.includes(String(category))) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const day = parseDateOrNull(date);
    if (!day) {
      return res.status(400).json({ error: "Invalid date (use YYYY-MM-DD)" });
    }

    const durationMinutes = serviceType === "CONSULTATION"
      ? 30
      : (await prisma.serviceCategoryConfig.findUnique({
          where: { category },
          select: { durationMinutes: true },
        }))?.durationMinutes ?? 30;

    const capableRows = await prisma.doctorServiceCategory.findMany({
      where: {
        category: String(category),
        isActive: true,
      },
      select: { doctorId: true },
    });
    const capableDoctorIds = capableRows.map((r) => r.doctorId);
    if (capableDoctorIds.length === 0) {
      return res.json({ doctors: [], durationMinutes, serviceType });
    }

    // Get eligible doctors: doctors with both capability and schedule at this branch+date
    const schedules = await prisma.doctorSchedule.findMany({
      where: { branchId: bid, date: day, doctorId: { in: capableDoctorIds } },
      select: {
        startTime: true,
        endTime: true,
        doctor: { select: { id: true, name: true } },
      },
    });

    if (schedules.length === 0) {
      return res.json({ doctors: [], durationMinutes, serviceType });
    }

    // Build doctor list only (do not expose slot occupancy in this endpoint)
    const doctorMap = new Map();
    for (const sch of schedules) {
      doctorMap.set(sch.doctor.id, {
        id: sch.doctor.id,
        name: sch.doctor.name || `Эмч #${sch.doctor.id}`,
        scheduleStart: sch.startTime,
        scheduleEnd: sch.endTime,
      });
    }
    const doctors = Array.from(doctorMap.values()).sort((a, b) => a.name.localeCompare(b.name, "mn"));
    return res.json({ doctors, durationMinutes, serviceType });
  } catch (err) {
    console.error("GET /api/public/booking-grid error:", err);
    return res.status(500).json({ error: "Failed to load booking grid" });
  }
});

/**
 * GET /api/public/doctor-available-slots?branchId=:id&category=:cat&date=YYYY-MM-DD&doctorId=:id
 * Returns only available slots for one doctor (no busy-slot exposure).
 */
router.get("/doctor-available-slots", async (req, res) => {
  try {
    const {
      branchId,
      category,
      date,
      doctorId,
      serviceType: serviceTypeRaw,
    } = req.query;

    if (!branchId || !category || !date || !doctorId) {
      return res.status(400).json({
        error: "branchId, category, date, and doctorId are required",
      });
    }

    const bid = Number(branchId);
    const did = Number(doctorId);
    if (Number.isNaN(bid) || Number.isNaN(did)) {
      return res.status(400).json({ error: "Invalid branchId or doctorId" });
    }

    const serviceType = normalizeOnlineBookingServiceType(serviceTypeRaw, "TREATMENT");
    if (!isValidOnlineBookingServiceType(serviceType)) {
      return res.status(400).json({ error: "Invalid serviceType" });
    }
    const allowedCategories = getAllowedCategoriesForServiceType(serviceType);
    if (!allowedCategories.includes(String(category))) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const day = parseDateOrNull(date);
    if (!day) {
      return res.status(400).json({ error: "Invalid date (use YYYY-MM-DD)" });
    }

    const durationMinutes = serviceType === "CONSULTATION"
      ? 30
      : (await prisma.serviceCategoryConfig.findUnique({
          where: { category },
          select: { durationMinutes: true },
        }))?.durationMinutes ?? 30;

    const canPerformCategory = await prisma.doctorServiceCategory.findFirst({
      where: {
        doctorId: did,
        category: String(category),
        isActive: true,
      },
      select: { id: true },
    });
    if (!canPerformCategory) {
      return res.status(400).json({ error: "Doctor cannot perform selected service category" });
    }

    const schedule = await prisma.doctorSchedule.findFirst({
      where: { doctorId: did, branchId: bid, date: day },
      select: {
        startTime: true,
        endTime: true,
        doctor: { select: { id: true, name: true } },
      },
    });
    if (!schedule) {
      return res.json({
        doctor: null,
        availableSlots: [],
        durationMinutes,
        serviceType,
      });
    }

    const allSlots = generateTimeSlots(
      schedule.startTime,
      schedule.endTime,
      durationMinutes,
    );
    const bookings = await prisma.booking.findMany({
      where: {
        branchId: bid,
        date: day,
        doctorId: did,
        status: { not: BookingStatus.ONLINE_EXPIRED },
      },
      select: { startTime: true },
    });
    const busyStartTimes = new Set(bookings.map((b) => b.startTime));
    const availableSlots = allSlots.filter((slot) => !busyStartTimes.has(slot));

    return res.json({
      doctor: {
        id: schedule.doctor.id,
        name: schedule.doctor.name || `Эмч #${did}`,
        scheduleStart: schedule.startTime,
        scheduleEnd: schedule.endTime,
      },
      availableSlots,
      durationMinutes,
      serviceType,
    });
  } catch (err) {
    console.error("GET /api/public/doctor-available-slots error:", err);
    return res.status(500).json({ error: "Failed to load doctor slots" });
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

async function getDraftOrError(draftIdRaw, res) {
  const draftId = Number(draftIdRaw);
  if (!draftId || Number.isNaN(draftId)) {
    res.status(400).json({ error: "Invalid draftId" });
    return { draft: null, draftId: null };
  }

  const draft = await prisma.onlineBookingDraft.findUnique({
    where: { id: draftId },
  });
  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return { draft: null, draftId };
  }

  return { draft, draftId };
}

/**
 * POST /api/public/online-booking/start
 * Initializes online booking Step 1 draft without creating/updating Patient.
 * Body: { ovog, name, phone, regNo }
 */
router.post("/online-booking/start", onlineBookingStartLimiter, async (req, res) => {
  try {
    const {
      ovog,
      name,
      phone,
      regNo,
    } = req.body || {};

    if (!ovog || !name || !phone || !regNo) {
      return res.status(400).json({
        error: "ovog, name, phone, regNo are required",
      });
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

/**
 * PATCH /api/public/online-booking/drafts/:draftId
 * Updates draft data after Step 1 (service/date/time metadata).
 */
router.patch("/online-booking/drafts/:draftId", async (req, res) => {
  try {
    const { draft } = await getDraftOrError(req.params.draftId, res);
    if (!draft) return;

    if (draft.status === "PAID") {
      return res.status(400).json({ error: "Draft is already paid" });
    }
    if (draft.status === "CANCELLED" || draft.status === "EXPIRED") {
      return res.status(400).json({ error: "Draft is no longer active" });
    }
    if (new Date() > draft.expiresAt) {
      await prisma.onlineBookingDraft.update({
        where: { id: draft.id },
        data: { status: "EXPIRED" },
      });
      return res.status(410).json({ error: "Draft expired" });
    }

    const {
      serviceType: serviceTypeRaw,
      serviceCategory,
      selectedDate,
      selectedStartTime,
      selectedEndTime,
      branchId,
    } = req.body || {};

    const data = {};
    const requestedServiceType = serviceTypeRaw === undefined
      ? undefined
      : normalizeOnlineBookingServiceType(serviceTypeRaw, "TREATMENT");

    if (requestedServiceType !== undefined) {
      if (!isValidOnlineBookingServiceType(requestedServiceType)) {
        return res.status(400).json({ error: "Invalid serviceType" });
      }
      data.serviceType = requestedServiceType;
    }

    if (branchId !== undefined) {
      if (branchId === null || branchId === "") {
        data.branchId = null;
      } else {
        const bid = Number(branchId);
        if (Number.isNaN(bid)) {
          return res.status(400).json({ error: "Invalid branchId" });
        }
        const branch = await prisma.branch.findUnique({
          where: { id: bid },
          select: { id: true },
        });
        if (!branch) {
          return res.status(400).json({ error: "Branch not found" });
        }
        data.branchId = bid;
      }
    }

    if (serviceCategory !== undefined) {
      const effectiveServiceType = requestedServiceType || draft.serviceType || "TREATMENT";
      const allowedCategories = getAllowedCategoriesForServiceType(effectiveServiceType);
      if (!allowedCategories.includes(String(serviceCategory))) {
        return res.status(400).json({ error: "Invalid serviceCategory" });
      }
      if (effectiveServiceType === "TREATMENT") {
        const categoryConfig = await prisma.serviceCategoryConfig.findUnique({
          where: { category: serviceCategory },
          select: { category: true },
        });
        if (!categoryConfig) {
          return res.status(400).json({ error: "Invalid serviceCategory" });
        }
      }
      data.serviceCategory = serviceCategory;
      if (!requestedServiceType && !draft.serviceType) {
        data.serviceType = "TREATMENT";
      }
    } else if (requestedServiceType && draft.serviceCategory) {
      const allowedCategories = getAllowedCategoriesForServiceType(requestedServiceType);
      if (!allowedCategories.includes(draft.serviceCategory)) {
        return res.status(400).json({
          error: "Selected serviceCategory is incompatible with serviceType",
        });
      }
    }

    if (selectedDate !== undefined) {
      const day = parseDateOrNull(selectedDate);
      if (!day) {
        return res.status(400).json({ error: "Invalid selectedDate (use YYYY-MM-DD)" });
      }
      data.selectedDate = day;
    }

    if (selectedStartTime !== undefined) {
      if (selectedStartTime && !isValidTime(selectedStartTime)) {
        return res.status(400).json({ error: "Invalid selectedStartTime" });
      }
      data.selectedStartTime = selectedStartTime || null;
    }

    if (selectedEndTime !== undefined) {
      if (selectedEndTime && !isValidTime(selectedEndTime)) {
        return res.status(400).json({ error: "Invalid selectedEndTime" });
      }
      data.selectedEndTime = selectedEndTime || null;
    }

    const updated = await prisma.onlineBookingDraft.update({
      where: { id: draft.id },
      data,
      select: {
        id: true,
        status: true,
        matchStatus: true,
        branchId: true,
        serviceType: true,
        serviceCategory: true,
        selectedDate: true,
        selectedStartTime: true,
        selectedEndTime: true,
        expiresAt: true,
      },
    });

    return res.json({
      draftId: updated.id,
      status: updated.status,
      matchStatus: updated.matchStatus,
      branchId: updated.branchId,
      serviceType: updated.serviceType,
      serviceCategory: updated.serviceCategory,
      selectedDate: updated.selectedDate ? updated.selectedDate.toISOString().slice(0, 10) : null,
      selectedStartTime: updated.selectedStartTime,
      selectedEndTime: updated.selectedEndTime,
      expiresAt: updated.expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("PATCH /api/public/online-booking/drafts/:draftId error:", err);
    return res.status(500).json({ error: "Failed to update draft" });
  }
});

/**
 * POST /api/public/online-booking/drafts/:draftId/init-payment
 * Initializes booking hold + QPay invoice from a validated draft.
 */
router.post("/online-booking/drafts/:draftId/init-payment", async (req, res) => {
  try {
    const { draft } = await getDraftOrError(req.params.draftId, res);
    if (!draft) return;

    if (draft.status === "PAID") {
      return res.status(400).json({ error: "Draft is already paid" });
    }
    if (draft.status === "CANCELLED" || draft.status === "EXPIRED") {
      return res.status(400).json({ error: "Draft is no longer active" });
    }
    if (draft.bookingId) {
      return res.status(409).json({ error: "Payment already initialized for this draft" });
    }
    if (new Date() > draft.expiresAt) {
      await prisma.onlineBookingDraft.update({
        where: { id: draft.id },
        data: { status: "EXPIRED" },
      });
      return res.status(410).json({ error: "Draft expired" });
    }

    const { doctorId, startTime } = req.body || {};
    const did = Number(doctorId);
    if (Number.isNaN(did)) {
      return res.status(400).json({ error: "Invalid doctorId" });
    }
    if (!isValidTime(startTime)) {
      return res.status(400).json({ error: "startTime must be HH:MM (24h)" });
    }
    if (!draft.selectedDate || !draft.serviceCategory || !draft.branchId) {
      return res.status(400).json({
        error: "Draft is missing selectedDate, serviceCategory, or branchId",
      });
    }
    const serviceType = normalizeOnlineBookingServiceType(draft.serviceType, "TREATMENT");
    if (!isValidOnlineBookingServiceType(serviceType)) {
      return res.status(400).json({ error: "Invalid draft serviceType" });
    }
    const allowedCategories = getAllowedCategoriesForServiceType(serviceType);
    if (!allowedCategories.includes(draft.serviceCategory)) {
      return res.status(400).json({ error: "Invalid draft serviceCategory for selected serviceType" });
    }

    const durationMinutes = serviceType === "CONSULTATION"
      ? 30
      : (await prisma.serviceCategoryConfig.findUnique({
          where: { category: draft.serviceCategory },
          select: { durationMinutes: true },
        }))?.durationMinutes ?? 30;
    const endTime = addMinutes(startTime, durationMinutes);

    const doctor = await prisma.user.findUnique({
      where: { id: did },
      select: { id: true, role: true },
    });
    if (!doctor || doctor.role !== UserRole.doctor) {
      return res.status(400).json({ error: "Invalid doctor" });
    }
    const canPerformCategory = await prisma.doctorServiceCategory.findFirst({
      where: {
        doctorId: did,
        category: draft.serviceCategory,
        isActive: true,
      },
      select: { id: true },
    });
    if (!canPerformCategory) {
      return res.status(400).json({ error: "Doctor cannot perform selected service category" });
    }

    const branchId = draft.branchId;
    const schedule = await prisma.doctorSchedule.findFirst({
      where: { doctorId: did, branchId, date: draft.selectedDate },
      select: { startTime: true, endTime: true },
    });
    if (!schedule) {
      return res.status(400).json({ error: "Doctor has no schedule for this date/branch" });
    }
    if (startTime < schedule.startTime || endTime > schedule.endTime) {
      return res.status(400).json({
        error: "Booking outside doctor's working hours",
        scheduleStart: schedule.startTime,
        scheduleEnd: schedule.endTime,
      });
    }

    const activeStatuses = [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.IN_PROGRESS,
      BookingStatus.ONLINE_HELD,
      BookingStatus.ONLINE_CONFIRMED,
    ];
    const collision = await prisma.booking.findFirst({
      where: {
        doctorId: did,
        date: draft.selectedDate,
        status: { in: activeStatuses },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    if (collision) {
      return res.status(409).json({ error: "Time slot is already taken" });
    }
    const exactStartConflict = await prisma.booking.findFirst({
      where: {
        doctorId: did,
        date: draft.selectedDate,
        startTime,
        status: { not: BookingStatus.ONLINE_EXPIRED },
      },
    });
    if (exactStartConflict) {
      return res.status(409).json({ error: "Time slot is already taken" });
    }

    const placeholder = await getOrCreatePlaceholderPatient(branchId);
    const booking = await prisma.booking.create({
      data: {
        patientId: placeholder.id,
        doctorId: did,
        branchId,
        date: draft.selectedDate,
        startTime,
        endTime,
        status: BookingStatus.ONLINE_HELD,
        note: draft.note || null,
      },
    });

    const callbackToken = crypto.randomBytes(24).toString("hex");
    const baseUrl = process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || "";
    const callbackUrl = `${baseUrl}/api/qpay/booking/callback?bookingId=${booking.id}&token=${callbackToken}`;
    const senderInvoiceNo = `BOOK-${booking.id}-${Date.now()}`;
    const dateStr = draft.selectedDate.toISOString().slice(0, 10);
    const description = `Онлайн цаг захиалга #${booking.id} (${dateStr} ${startTime}-${endTime})`;

    let qpayResponse;
    try {
      qpayResponse = await qpayService.createInvoice({
        sender_invoice_no: senderInvoiceNo,
        amount: ONLINE_BOOKING_DEPOSIT_AMOUNT,
        description,
        callback_url: callbackUrl,
        branchId,
      });
    } catch (qpayErr) {
      await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {});
      console.error("QPay invoice creation failed:", qpayErr);
      return res.status(502).json({ error: "Failed to create QPay invoice: " + qpayErr.message });
    }

    const holdExpiresAt = new Date(Date.now() + ONLINE_BOOKING_DRAFT_HOLD_MINUTES * 60 * 1000);
    await prisma.$transaction([
      prisma.bookingDeposit.create({
        data: {
          bookingId: booking.id,
          branchId,
          amount: ONLINE_BOOKING_DEPOSIT_AMOUNT,
          status: "NEW",
          holdExpiresAt,
          qpayInvoiceId: qpayResponse.invoice_id,
          senderInvoiceNo,
          callbackToken,
        },
      }),
      prisma.onlineBookingDraft.update({
        where: { id: draft.id },
        data: {
          bookingId: booking.id,
          status: "VERIFIED",
          selectedStartTime: startTime,
          selectedEndTime: endTime,
          expiresAt: holdExpiresAt,
        },
      }),
    ]);

    return res.status(201).json({
      bookingId: booking.id,
      draftId: draft.id,
      depositAmount: ONLINE_BOOKING_DEPOSIT_AMOUNT,
      expiresAt: holdExpiresAt.toISOString(),
      qpayInvoiceId: qpayResponse.invoice_id,
      qrText: qpayResponse.qr_text,
      qrImage: qpayResponse.qr_image,
      urls: qpayResponse.urls,
    });
  } catch (err) {
    console.error("POST /api/public/online-booking/drafts/:draftId/init-payment error:", err);
    return res.status(500).json({ error: "Failed to initialize draft payment" });
  }
});

/**
 * GET /api/public/online-booking/drafts/:draftId/payment-status
 * Poll payment status using draftId.
 */
router.get("/online-booking/drafts/:draftId/payment-status", async (req, res) => {
  try {
    const { draft } = await getDraftOrError(req.params.draftId, res);
    if (!draft) return;

    if (!draft.bookingId) {
      return res.status(400).json({ error: "Payment not initialized for this draft" });
    }

    const bookingId = draft.bookingId;
    const deposit = await prisma.bookingDeposit.findUnique({
      where: { bookingId },
    });
    if (!deposit) {
      return res.status(404).json({ error: "Deposit not found" });
    }

    if (deposit.status === "PAID") {
      if (draft.status !== "PAID") {
        await prisma.onlineBookingDraft.update({
          where: { id: draft.id },
          data: { status: "PAID" },
        }).catch(() => {});
      }
      return res.json({ status: "PAID", bookingStatus: BookingStatus.ONLINE_CONFIRMED });
    }
    if (deposit.status === "EXPIRED" || deposit.status === "CANCELLED") {
      if (draft.status !== "EXPIRED") {
        await prisma.onlineBookingDraft.update({
          where: { id: draft.id },
          data: { status: "EXPIRED" },
        }).catch(() => {});
      }
      return res.json({ status: deposit.status, bookingStatus: BookingStatus.ONLINE_EXPIRED });
    }

    const now = new Date();
    const isExpired = now > deposit.holdExpiresAt;

    let checkResult;
    try {
      checkResult = await qpayService.checkInvoicePaid(deposit.qpayInvoiceId, deposit.branchId);
    } catch (checkErr) {
      console.error("Draft payment check failed:", checkErr);
      return res.status(502).json({ error: "Payment check failed: " + checkErr.message });
    }

    if (checkResult.paid && checkResult.paidAmount >= ONLINE_BOOKING_DEPOSIT_AMOUNT) {
      await prisma.$transaction([
        prisma.bookingDeposit.update({
          where: { bookingId },
          data: {
            status: "PAID",
            paidAmount: checkResult.paidAmount,
            qpayPaymentId: checkResult.paymentId,
            paidAt: checkResult.paidAt ? new Date(checkResult.paidAt) : new Date(),
            raw: checkResult.raw,
          },
        }),
        prisma.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.ONLINE_CONFIRMED },
        }),
        prisma.onlineBookingDraft.update({
          where: { id: draft.id },
          data: { status: "PAID" },
        }),
      ]);
      return res.json({ status: "PAID", bookingStatus: BookingStatus.ONLINE_CONFIRMED });
    }

    if (isExpired) {
      try {
        await qpayService.cancelInvoice(deposit.qpayInvoiceId, deposit.branchId);
      } catch (cancelErr) {
        console.error("QPay invoice cancel failed (will still expire):", cancelErr);
      }
      await prisma.$transaction([
        prisma.bookingDeposit.update({
          where: { bookingId },
          data: { status: "EXPIRED" },
        }),
        prisma.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.ONLINE_EXPIRED },
        }),
        prisma.onlineBookingDraft.update({
          where: { id: draft.id },
          data: { status: "EXPIRED" },
        }),
      ]);
      return res.json({ status: "EXPIRED", bookingStatus: BookingStatus.ONLINE_EXPIRED });
    }

    return res.json({
      status: "PENDING",
      bookingStatus: BookingStatus.ONLINE_HELD,
      expiresAt: deposit.holdExpiresAt.toISOString(),
    });
  } catch (err) {
    console.error("GET /api/public/online-booking/drafts/:draftId/payment-status error:", err);
    return res.status(500).json({ error: "Failed to check draft payment status" });
  }
});

export default router;
