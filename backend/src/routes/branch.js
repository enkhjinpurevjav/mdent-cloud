/**
 * Branch Kiosk Router – /api/branch
 *
 * Provides lightweight endpoints for branch tablets running the kiosk flow.
 * This router is excluded from the global authenticateJWT middleware and
 * handles its own authentication per-route.
 *
 * Route roles:
 *   branch_kiosk  – the shared tablet session (access_token cookie, role=branch_kiosk)
 *   doctor_kiosk  – a per-doctor unlocked session (doctor_kiosk_token cookie)
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import prisma from "../db.js";
import { DOCTOR_KIOSK_COOKIE_NAME, NURSE_KIOSK_COOKIE_NAME } from "../middleware/auth.js";
import { ensureEncounterForAppointment } from "./appointments.js";
import { buildSessionCookieOptions } from "../utils/authCookieOptions.js";

const router = Router();

// ─── Constants ───────────────────────────────────────────────────────────────

const COOKIE_NAME = "access_token";
const DOCTOR_KIOSK_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
// Derive the JWT expiresIn string directly from the TTL constant to prevent desynchronization.
const DOCTOR_KIOSK_TTL_JWT = `${DOCTOR_KIOSK_TTL_MS / 3_600_000}h`;
const NURSE_KIOSK_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const NURSE_KIOSK_TTL_JWT = `${NURSE_KIOSK_TTL_MS / 3_600_000}h`;
const BCRYPT_ROUNDS = 10;
const MS_PER_MINUTE = 60_000;
const MONGOLIA_UTC_OFFSET_MS = 8 * 60 * MS_PER_MINUTE; // UTC+8

function getJwtSecret() {
  return process.env.JWT_SECRET || "";
}

function kioskCookieOptions(req, maxAge) {
  return buildSessionCookieOptions({
    maxAge,
    requestHost: req?.hostname,
  });
}

/** Mongolia timezone (UTC+8): return today as YYYY-MM-DD */
function mongoliaLocalDateString() {
  const now = new Date();
  const localTime = new Date(now.getTime() + MONGOLIA_UTC_OFFSET_MS);
  return localTime.toISOString().slice(0, 10);
}

function userBelongsToBranch(user, branchId, relationKey) {
  if (!user || !branchId) return false;
  if (user.branchId === branchId) return true;
  const links = Array.isArray(user?.[relationKey]) ? user[relationKey] : [];
  return links.some((link) => link?.branchId === branchId);
}

function parseYmdToLocalMidnight(ymd) {
  const [y, m, d] = String(ymd || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function isValidHHmm(s) {
  return /^\d{2}:\d{2}$/.test(String(s || ""));
}

function formatUserSnapshotLabel(user) {
  const ovog = String(user?.ovog || "").trim();
  const name = String(user?.name || "").trim();
  if (ovog && name) return `${ovog.charAt(0)}.${name}`;
  if (name) return name;
  if (user?.email) return String(user.email);
  return `User #${user?.id || ""}`.trim();
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/**
 * Authenticate a branch_kiosk request by verifying the access_token cookie.
 * Populates req.branchKioskUser = { id, role, branchId, ... } on success.
 * Returns 401/403 if token is missing, invalid, or not branch_kiosk role.
 */
async function requireBranchKiosk(req, res, next) {
  if (process.env.DISABLE_AUTH === "true") {
    req.branchKioskUser = { id: 0, role: "branch_kiosk", branchId: 1 };
    return next();
  }

  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Authentication required." });

  const secret = getJwtSecret();
  if (!secret) return res.status(500).json({ error: "Internal server error." });

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired." });
    }
    return res.status(401).json({ error: "Invalid token." });
  }

  if (decoded.role !== "branch_kiosk") {
    return res.status(403).json({ error: "Forbidden. Branch kiosk role required." });
  }

  // Verify user is still active
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { isActive: true },
    });
    if (!dbUser || !dbUser.isActive) {
      return res.status(401).json({ error: "Энэ бүртгэл идэвхгүй байна." });
    }
  } catch {
    return res.status(500).json({ error: "Internal server error." });
  }

  req.branchKioskUser = decoded;
  return next();
}

/**
 * Authenticate a doctor_kiosk request by verifying the doctor_kiosk_token cookie.
 * Populates req.doctorKioskUser = { id (doctorId), role, branchId, ... } on success.
 * Returns 401/403 if token is missing, invalid, or not doctor_kiosk role.
 */
async function requireDoctorKiosk(req, res, next) {
  if (process.env.DISABLE_AUTH === "true") {
    req.doctorKioskUser = { id: 0, role: "doctor_kiosk", branchId: 1 };
    return next();
  }

  const token = req.cookies?.[DOCTOR_KIOSK_COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Authentication required." });

  const secret = getJwtSecret();
  if (!secret) return res.status(500).json({ error: "Internal server error." });

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Doctor kiosk session expired." });
    }
    return res.status(401).json({ error: "Invalid doctor kiosk token." });
  }

  if (decoded.role !== "doctor_kiosk") {
    return res.status(403).json({ error: "Forbidden. Doctor kiosk role required." });
  }

  // Verify doctor is still active
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { isActive: true },
    });
    if (!dbUser || !dbUser.isActive) {
      return res.status(401).json({ error: "Энэ бүртгэл идэвхгүй байна." });
    }
  } catch {
    return res.status(500).json({ error: "Internal server error." });
  }

  req.doctorKioskUser = decoded;
  return next();
}

/**
 * Authenticate a nurse_kiosk request by verifying the nurse_kiosk_token cookie.
 * Populates req.nurseKioskUser = { id (nurseId), role, branchId, ... } on success.
 */
async function requireNurseKiosk(req, res, next) {
  if (process.env.DISABLE_AUTH === "true") {
    req.nurseKioskUser = { id: 0, role: "nurse_kiosk", branchId: 1 };
    return next();
  }

  const token = req.cookies?.[NURSE_KIOSK_COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Authentication required." });

  const secret = getJwtSecret();
  if (!secret) return res.status(500).json({ error: "Internal server error." });

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Nurse kiosk session expired." });
    }
    return res.status(401).json({ error: "Invalid nurse kiosk token." });
  }

  if (decoded.role !== "nurse_kiosk") {
    return res.status(403).json({ error: "Forbidden. Nurse kiosk role required." });
  }

  try {
    const nurse = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        isActive: true,
        role: true,
        branchId: true,
        nurseBranches: { select: { branchId: true } },
      },
    });
    if (!nurse || !nurse.isActive || nurse.role !== "nurse") {
      return res.status(401).json({ error: "Энэ бүртгэл идэвхгүй байна." });
    }
    if (!userBelongsToBranch(nurse, decoded.branchId, "nurseBranches")) {
      return res.status(403).json({ error: "Nurse does not belong to this branch." });
    }
  } catch {
    return res.status(500).json({ error: "Internal server error." });
  }

  req.nurseKioskUser = decoded;
  return next();
}

// ─── Rate limiters ────────────────────────────────────────────────────────────

// Per (IP + doctorId): 10 unlock attempts per 15 minutes
const unlockRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many unlock attempts. Please try again later." },
  keyGenerator: (req) => `${ipKeyGenerator(req)}||${req.params.doctorId || ""}`,
});

// Per (IP + nurseId): 10 unlock attempts per 15 minutes
const nurseUnlockRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many unlock attempts. Please try again later." },
  keyGenerator: (req) => `${ipKeyGenerator(req)}||${req.params.nurseId || ""}`,
});

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/branch/doctors/today
 * Auth: branch_kiosk
 *
 * Returns today's scheduled doctors for the kiosk's branch.
 * Minimal payload: id, name, ovog, idPhotoPath, hasPin.
 */
router.get("/doctors/today", requireBranchKiosk, async (req, res) => {
  try {
    const branchId = req.branchKioskUser.branchId;
    if (!branchId) {
      return res.status(400).json({ error: "Kiosk user has no branchId." });
    }

    const today = mongoliaLocalDateString();
    const dayStart = new Date(`${today}T00:00:00.000Z`);
    const dayEnd = new Date(`${today}T23:59:59.999Z`);

    // Find doctor schedules for today at this branch
    const schedules = await prisma.doctorSchedule.findMany({
      where: {
        branchId,
        date: { gte: dayStart, lte: dayEnd },
      },
      select: {
        doctor: {
          select: {
            id: true,
            name: true,
            ovog: true,
            idPhotoPath: true,
            pinHash: true,
            isActive: true,
          },
        },
      },
    });

    // De-duplicate by doctorId (a doctor might have multiple schedule rows)
    const seen = new Set();
    const doctors = [];
    for (const s of schedules) {
      const d = s.doctor;
      if (!d.isActive) continue;
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      doctors.push({
        id: d.id,
        name: d.name,
        ovog: d.ovog,
        idPhotoPath: d.idPhotoPath,
        hasPin: !!d.pinHash,
      });
    }

    return res.json({ doctors });
  } catch (err) {
    console.error("GET /api/branch/doctors/today error:", err);
    return res.status(500).json({ error: "Failed to fetch today's doctors." });
  }
});

/**
 * GET /api/branch/nurses/all
 * Auth: branch_kiosk
 *
 * Returns all active nurses for kiosk branch (not schedule-based).
 */
router.get("/nurses/all", requireBranchKiosk, async (req, res) => {
  try {
    const branchId = req.branchKioskUser.branchId;
    if (!branchId) {
      return res.status(400).json({ error: "Kiosk user has no branchId." });
    }

    const nurses = await prisma.user.findMany({
      where: {
        role: "nurse",
        isActive: true,
        OR: [
          { branchId },
          { nurseBranches: { some: { branchId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        ovog: true,
        idPhotoPath: true,
        pinHash: true,
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });

    return res.json({
      nurses: nurses.map((n) => ({
        id: n.id,
        name: n.name,
        ovog: n.ovog,
        idPhotoPath: n.idPhotoPath,
        hasPin: !!n.pinHash,
      })),
    });
  } catch (err) {
    console.error("GET /api/branch/nurses/all error:", err);
    return res.status(500).json({ error: "Failed to fetch nurses." });
  }
});

/**
 * POST /api/branch/doctors/:doctorId/unlock
 * Auth: branch_kiosk
 * Body: { pin: "1234" }
 *
 * Verifies the doctor's 4-digit PIN and issues a short-lived doctor_kiosk_token.
 * Rate-limited: 10 attempts per (IP + doctorId) per 15 minutes.
 */
router.post(
  "/doctors/:doctorId/unlock",
  requireBranchKiosk,
  unlockRateLimit,
  async (req, res) => {
    try {
      const doctorId = Number(req.params.doctorId);
      if (!Number.isFinite(doctorId) || doctorId <= 0) {
        return res.status(400).json({ error: "Invalid doctor ID." });
      }

      const { pin } = req.body || {};
      if (!pin || typeof pin !== "string") {
        return res.status(400).json({ error: "PIN is required." });
      }
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: "PIN must be exactly 4 digits." });
      }

      const kioskBranchId = req.branchKioskUser.branchId;

      // Load doctor: must be active, role=doctor, belong to this branch
      const doctor = await prisma.user.findUnique({
        where: { id: doctorId },
        select: {
          id: true,
          name: true,
          ovog: true,
          email: true,
          role: true,
          branchId: true,
          doctorBranches: { select: { branchId: true } },
          isActive: true,
          pinHash: true,
        },
      });

      if (!doctor || !doctor.isActive) {
        return res.status(404).json({ error: "Doctor not found." });
      }
      if (doctor.role !== "doctor") {
        return res.status(403).json({ error: "Target user is not a doctor." });
      }
      if (!userBelongsToBranch(doctor, kioskBranchId, "doctorBranches")) {
        return res.status(403).json({ error: "Doctor does not belong to this branch." });
      }
      if (!doctor.pinHash) {
        return res.status(403).json({ error: "Doctor has not set a PIN." });
      }

      // Verify PIN
      const valid = await bcrypt.compare(pin, doctor.pinHash);
      if (!valid) {
        return res.status(401).json({ error: "Incorrect PIN." });
      }

      // Issue doctor_kiosk_token
      const secret = getJwtSecret();
      const payload = {
        id: doctor.id,
        role: "doctor_kiosk",
        branchId: kioskBranchId,
        name: doctor.name,
        ovog: doctor.ovog,
        email: doctor.email,
      };
      const token = jwt.sign(payload, secret, { expiresIn: DOCTOR_KIOSK_TTL_JWT });

      res.cookie(DOCTOR_KIOSK_COOKIE_NAME, token, kioskCookieOptions(req, DOCTOR_KIOSK_TTL_MS));

      return res.json({
        doctorId: doctor.id,
        name: doctor.name,
        ovog: doctor.ovog,
      });
    } catch (err) {
      console.error("POST /api/branch/doctors/:doctorId/unlock error:", err);
      return res.status(500).json({ error: "Failed to unlock doctor session." });
    }
  }
);

/**
 * POST /api/branch/nurses/:nurseId/unlock
 * Auth: branch_kiosk
 * Body: { pin: "1234" }
 *
 * Verifies a nurse 4-digit PIN and issues nurse_kiosk_token.
 */
router.post(
  "/nurses/:nurseId/unlock",
  requireBranchKiosk,
  nurseUnlockRateLimit,
  async (req, res) => {
    try {
      const nurseId = Number(req.params.nurseId);
      if (!Number.isFinite(nurseId) || nurseId <= 0) {
        return res.status(400).json({ error: "Invalid nurse ID." });
      }

      const { pin } = req.body || {};
      if (!pin || typeof pin !== "string") {
        return res.status(400).json({ error: "PIN is required." });
      }
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: "PIN must be exactly 4 digits." });
      }

      const kioskBranchId = req.branchKioskUser.branchId;

      const nurse = await prisma.user.findUnique({
        where: { id: nurseId },
        select: {
          id: true,
          name: true,
          ovog: true,
          email: true,
          role: true,
          branchId: true,
          nurseBranches: { select: { branchId: true } },
          isActive: true,
          pinHash: true,
        },
      });

      if (!nurse || !nurse.isActive) {
        return res.status(404).json({ error: "Nurse not found." });
      }
      if (nurse.role !== "nurse") {
        return res.status(403).json({ error: "Target user is not a nurse." });
      }
      if (!userBelongsToBranch(nurse, kioskBranchId, "nurseBranches")) {
        return res.status(403).json({ error: "Nurse does not belong to this branch." });
      }
      if (!nurse.pinHash) {
        return res.status(403).json({ error: "Nurse has not set a PIN." });
      }

      const valid = await bcrypt.compare(pin, nurse.pinHash);
      if (!valid) {
        return res.status(401).json({ error: "Incorrect PIN." });
      }

      const secret = getJwtSecret();
      const payload = {
        id: nurse.id,
        role: "nurse_kiosk",
        branchId: kioskBranchId,
        name: nurse.name,
        ovog: nurse.ovog,
        email: nurse.email,
      };
      const token = jwt.sign(payload, secret, { expiresIn: NURSE_KIOSK_TTL_JWT });
      res.cookie(NURSE_KIOSK_COOKIE_NAME, token, kioskCookieOptions(req, NURSE_KIOSK_TTL_MS));

      return res.json({
        nurseId: nurse.id,
        name: nurse.name,
        ovog: nurse.ovog,
      });
    } catch (err) {
      console.error("POST /api/branch/nurses/:nurseId/unlock error:", err);
      return res.status(500).json({ error: "Failed to unlock nurse session." });
    }
  }
);

/**
 * POST /api/branch/doctor/logout
 * Clears the doctor_kiosk_token cookie to end the doctor kiosk session.
 * No strict auth required — just clearing the cookie is safe.
 */
router.post("/doctor/logout", (req, res) => {
  res.clearCookie(DOCTOR_KIOSK_COOKIE_NAME, {
    ...buildSessionCookieOptions({ requestHost: req?.hostname }),
  });
  return res.json({ ok: true });
});

/**
 * GET /api/branch/doctor/me
 * Validates the doctor_kiosk_token cookie and returns the doctor's identity,
 * including canCloseEncounterWithoutPayment (looked up from the database).
 * Returns 401 if no valid kiosk session is active.
 */
router.get("/doctor/me", requireDoctorKiosk, async (req, res) => {
  const u = req.doctorKioskUser;
  try {
    const doctor = await prisma.user.findUnique({
      where: { id: u.id },
      select: { canCloseEncounterWithoutPayment: true },
    });
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found." });
    }
    return res.json({
      doctorId: u.id,
      name: u.name,
      ovog: u.ovog,
      branchId: u.branchId,
      canCloseEncounterWithoutPayment: doctor.canCloseEncounterWithoutPayment ?? false,
    });
  } catch (err) {
    console.error("GET /api/branch/doctor/me error:", err);
    return res.status(500).json({ error: "Failed to fetch doctor info." });
  }
});

/**
 * POST /api/branch/nurse/logout
 * Clears nurse_kiosk_token.
 */
router.post("/nurse/logout", (req, res) => {
  res.clearCookie(NURSE_KIOSK_COOKIE_NAME, {
    ...buildSessionCookieOptions({ requestHost: req?.hostname }),
  });
  return res.json({ ok: true });
});

/**
 * GET /api/branch/nurse/me
 * Validates nurse_kiosk_token and returns nurse identity.
 */
router.get("/nurse/me", requireNurseKiosk, async (req, res) => {
  const u = req.nurseKioskUser;
  try {
    const nurse = await prisma.user.findUnique({
      where: { id: u.id },
      select: { id: true, email: true, name: true, ovog: true },
    });
    if (!nurse) {
      return res.status(404).json({ error: "Nurse not found." });
    }
    return res.json({
      nurseId: nurse.id,
      email: nurse.email,
      name: nurse.name,
      ovog: nurse.ovog,
      branchId: u.branchId,
    });
  } catch (err) {
    console.error("GET /api/branch/nurse/me error:", err);
    return res.status(500).json({ error: "Failed to fetch nurse info." });
  }
});

/**
 * GET /api/branch/nurse/doctors
 * Auth: nurse_kiosk
 *
 * Returns active doctors in the nurse kiosk branch.
 */
router.get("/nurse/doctors", requireNurseKiosk, async (req, res) => {
  try {
    const branchId = req.nurseKioskUser.branchId;
    const doctors = await prisma.user.findMany({
      where: {
        role: "doctor",
        isActive: true,
        OR: [
          { branchId },
          { doctorBranches: { some: { branchId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        ovog: true,
        email: true,
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return res.json({ doctors });
  } catch (err) {
    console.error("GET /api/branch/nurse/doctors error:", err);
    return res.status(500).json({ error: "Failed to fetch doctors." });
  }
});

/**
 * POST /api/branch/nurse/returns
 * Auth: nurse_kiosk
 *
 * Creates a sterilization return record bound to the unlocked nurse/branch.
 */
router.post("/nurse/returns", requireNurseKiosk, async (req, res) => {
  try {
    const branchId = Number(req.nurseKioskUser.branchId);
    const nurseUserId = Number(req.nurseKioskUser.id);
    const dateStr = String(req.body?.date || "").trim();
    const time = String(req.body?.time || "").trim();
    const doctorId = Number(req.body?.doctorId);
    const notes = req.body?.notes ? String(req.body.notes).trim() : null;
    const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];

    if (!branchId) return res.status(400).json({ error: "branchId is missing from kiosk session" });
    if (!doctorId) return res.status(400).json({ error: "doctorId is required" });
    const date = parseYmdToLocalMidnight(dateStr);
    if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
    if (!isValidHHmm(time)) return res.status(400).json({ error: "time is required (HH:mm)" });
    if (lines.length === 0) return res.status(400).json({ error: "lines are required" });

    const [doctor, nurse] = await Promise.all([
      prisma.user.findUnique({
        where: { id: doctorId },
        select: {
          id: true,
          role: true,
          branchId: true,
          doctorBranches: { select: { branchId: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: nurseUserId },
        select: {
          id: true,
          role: true,
          branchId: true,
          name: true,
          ovog: true,
          email: true,
          nurseBranches: { select: { branchId: true } },
        },
      }),
    ]);

    if (!doctor || doctor.role !== "doctor") {
      return res.status(400).json({ error: "Invalid doctorId" });
    }
    if (!userBelongsToBranch(doctor, branchId, "doctorBranches")) {
      return res.status(400).json({ error: "Doctor does not belong to the selected branch" });
    }
    if (!nurse || nurse.role !== "nurse") {
      return res.status(400).json({ error: "Invalid nurse session" });
    }
    if (!userBelongsToBranch(nurse, branchId, "nurseBranches")) {
      return res.status(403).json({ error: "Nurse does not belong to the selected branch" });
    }

    const seenToolIds = new Set();
    const normalized = [];
    for (const ln of lines) {
      const toolId = Number(ln?.toolId);
      const returnedQty = Number(ln?.returnedQty);
      if (!toolId || !Number.isInteger(returnedQty) || returnedQty <= 0) {
        return res.status(400).json({ error: "Each line must have valid toolId and returnedQty > 0 integer" });
      }
      if (seenToolIds.has(toolId)) {
        return res.status(400).json({ error: "Duplicate toolId in lines is not allowed" });
      }
      seenToolIds.add(toolId);
      normalized.push({ toolId, returnedQty });
    }

    const toolIds = [...new Set(normalized.map((x) => x.toolId))];
    const tools = await prisma.sterilizationItem.findMany({
      where: { id: { in: toolIds } },
      select: { id: true, branchId: true },
    });
    if (tools.length !== toolIds.length) {
      return res.status(400).json({ error: "One or more toolId is invalid" });
    }
    if (tools.some((t) => t.branchId !== branchId)) {
      return res.status(400).json({ error: "All tools must belong to the selected branch" });
    }

    const nurseNameSnapshot = formatUserSnapshotLabel(nurse);
    const created = await prisma.sterilizationReturn.create({
      data: {
        branchId,
        date,
        time,
        doctorId,
        nurseUserId,
        nurseNameSnapshot,
        nurseName: nurseNameSnapshot,
        notes,
        lines: {
          create: normalized.map((x) => ({
            toolId: x.toolId,
            returnedQty: x.returnedQty,
          })),
        },
      },
      include: {
        branch: { select: { id: true, name: true } },
        doctor: { select: { id: true, name: true, ovog: true, email: true } },
        nurse: { select: { id: true, name: true, ovog: true, email: true } },
        lines: { include: { tool: { select: { id: true, name: true } } } },
      },
    });

    return res.json(created);
  } catch (err) {
    console.error("POST /api/branch/nurse/returns error:", err);
    return res.status(500).json({ error: "Failed to create return record" });
  }
});

/**
 * GET /api/branch/doctor/appointments/ongoing
 * Auth: doctor_kiosk
 * Query: ?date=YYYY-MM-DD (optional, defaults to today)
 *
 * Returns today's ongoing appointments for the unlocked doctor.
 */
router.get(
  "/doctor/appointments/ongoing",
  requireDoctorKiosk,
  async (req, res) => {
    try {
      const { id: doctorId, branchId } = req.doctorKioskUser;
      const dateStr = (req.query.date && typeof req.query.date === "string")
        ? req.query.date
        : mongoliaLocalDateString();

      const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
      const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

      const appointments = await prisma.appointment.findMany({
        where: {
          doctorId,
          branchId,
          status: "ongoing",
          scheduledAt: { gte: dayStart, lte: dayEnd },
        },
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          patient: {
            select: {
              id: true,
              name: true,
              ovog: true,
              regNo: true,
            },
          },
        },
        orderBy: { scheduledAt: "asc" },
      });

      return res.json({ appointments });
    } catch (err) {
      console.error("GET /api/branch/doctor/appointments/ongoing error:", err);
      return res.status(500).json({ error: "Failed to fetch ongoing appointments." });
    }
  }
);

/**
 * POST /api/branch/appointments/:appointmentId/encounter
 * Auth: doctor_kiosk
 *
 * Creates or returns the existing encounter for an ongoing appointment.
 * Constraints:
 *   - appointment.status must be 'ongoing'
 *   - appointment.doctorId must match kiosk doctorId
 *   - appointment.branchId must match kiosk branchId
 *
 * Returns { encounterId }.
 */
router.post(
  "/appointments/:appointmentId/encounter",
  requireDoctorKiosk,
  async (req, res) => {
    try {
      const appointmentId = Number(req.params.appointmentId);
      if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
        return res.status(400).json({ error: "Invalid appointment ID." });
      }

      const { id: kioskDoctorId, branchId: kioskBranchId } = req.doctorKioskUser;

      // Validate appointment
      const appt = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { id: true, doctorId: true, branchId: true, status: true },
      });

      if (!appt) {
        return res.status(404).json({ error: "Appointment not found." });
      }
      if (appt.status !== "ongoing") {
        return res.status(403).json({
          error: `Appointment must be 'ongoing' to start encounter. Current status: '${appt.status}'.`,
        });
      }
      if (appt.doctorId !== kioskDoctorId) {
        return res.status(403).json({ error: "Appointment does not belong to you." });
      }
      if (appt.branchId !== kioskBranchId) {
        return res.status(403).json({ error: "Appointment belongs to a different branch." });
      }

      // Create or return existing encounter
      const encounter = await ensureEncounterForAppointment(appointmentId);

      return res.json({ encounterId: encounter.id });
    } catch (err) {
      console.error("POST /api/branch/appointments/:appointmentId/encounter error:", err);
      return res.status(500).json({ error: "Failed to create encounter." });
    }
  }
);

export default router;
