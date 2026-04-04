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
import { DOCTOR_KIOSK_COOKIE_NAME } from "../middleware/auth.js";
import { ensureEncounterForAppointment } from "./appointments.js";

const router = Router();

// ─── Constants ───────────────────────────────────────────────────────────────

const COOKIE_NAME = "access_token";
const DOCTOR_KIOSK_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const BCRYPT_ROUNDS = 10;

function getJwtSecret() {
  return process.env.JWT_SECRET || "";
}

function isProd() {
  return process.env.NODE_ENV === "production";
}

function kioskCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    domain: process.env.COOKIE_DOMAIN || (isProd() ? ".mdent.cloud" : undefined),
    path: "/",
    maxAge: DOCTOR_KIOSK_TTL_MS,
  };
}

/** Mongolia timezone (UTC+8): return today as YYYY-MM-DD */
function mongoliaLocalDateString() {
  const now = new Date();
  const mongoliaOffset = 8 * 60;
  const localTime = new Date(now.getTime() + mongoliaOffset * 60_000);
  return localTime.toISOString().slice(0, 10);
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
      if (doctor.branchId !== kioskBranchId) {
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
      const token = jwt.sign(payload, secret, { expiresIn: "8h" });

      res.cookie(DOCTOR_KIOSK_COOKIE_NAME, token, kioskCookieOptions());

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
 * POST /api/branch/doctor/logout
 * Clears the doctor_kiosk_token cookie to end the doctor kiosk session.
 * No strict auth required — just clearing the cookie is safe.
 */
router.post("/doctor/logout", (req, res) => {
  res.clearCookie(DOCTOR_KIOSK_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    domain: process.env.COOKIE_DOMAIN || (isProd() ? ".mdent.cloud" : undefined),
    path: "/",
  });
  return res.json({ ok: true });
});

/**
 * GET /api/branch/doctor/me
 * Validates the doctor_kiosk_token cookie and returns the doctor's identity.
 * Returns 401 if no valid kiosk session is active.
 */
router.get("/doctor/me", requireDoctorKiosk, (req, res) => {
  const u = req.doctorKioskUser;
  return res.json({
    doctorId: u.id,
    name: u.name,
    ovog: u.ovog,
    branchId: u.branchId,
  });
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
