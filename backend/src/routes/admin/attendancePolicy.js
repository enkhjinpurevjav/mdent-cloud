import { Router } from "express";
import prisma from "../../db.js";

const router = Router();

function parseNullableInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
}

function parseNullableRole(value) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

router.get("/attendance/policies", async (_req, res) => {
  try {
    const items = await prisma.attendancePolicy.findMany({
      orderBy: [{ priority: "desc" }, { id: "desc" }],
    });
    return res.json({ items });
  } catch (err) {
    console.error("GET /api/admin/attendance/policies error:", err);
    return res.status(500).json({ error: "Серверийн алдаа гарлаа." });
  }
});

router.post("/attendance/policies", async (req, res) => {
  try {
    const body = req.body || {};
    const created = await prisma.attendancePolicy.create({
      data: {
        branchId: parseNullableInt(body.branchId),
        role: parseNullableRole(body.role),
        priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0,
        isActive: body.isActive !== false,
        earlyCheckInMinutes: Number.isFinite(Number(body.earlyCheckInMinutes))
          ? Number(body.earlyCheckInMinutes)
          : 120,
        lateGraceMinutes: Number.isFinite(Number(body.lateGraceMinutes))
          ? Number(body.lateGraceMinutes)
          : 0,
        earlyLeaveGraceMinutes: Number.isFinite(Number(body.earlyLeaveGraceMinutes))
          ? Number(body.earlyLeaveGraceMinutes)
          : 0,
        autoCloseAfterMinutes: Number.isFinite(Number(body.autoCloseAfterMinutes))
          ? Number(body.autoCloseAfterMinutes)
          : 720,
        minAccuracyM: Number.isFinite(Number(body.minAccuracyM))
          ? Number(body.minAccuracyM)
          : 100,
        enforceGeofence: body.enforceGeofence !== false,
      },
    });
    return res.status(201).json({ policy: created });
  } catch (err) {
    console.error("POST /api/admin/attendance/policies error:", err);
    return res.status(500).json({ error: "Серверийн алдаа гарлаа." });
  }
});

router.patch("/attendance/policies/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "policy id буруу байна." });
    }

    const body = req.body || {};
    const data = {};
    if ("branchId" in body) data.branchId = parseNullableInt(body.branchId);
    if ("role" in body) data.role = parseNullableRole(body.role);
    if ("priority" in body) {
      data.priority = Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0;
    }
    if ("isActive" in body) data.isActive = !!body.isActive;
    if ("earlyCheckInMinutes" in body) {
      data.earlyCheckInMinutes = Number.isFinite(Number(body.earlyCheckInMinutes))
        ? Number(body.earlyCheckInMinutes)
        : 120;
    }
    if ("lateGraceMinutes" in body) {
      data.lateGraceMinutes = Number.isFinite(Number(body.lateGraceMinutes))
        ? Number(body.lateGraceMinutes)
        : 0;
    }
    if ("earlyLeaveGraceMinutes" in body) {
      data.earlyLeaveGraceMinutes = Number.isFinite(Number(body.earlyLeaveGraceMinutes))
        ? Number(body.earlyLeaveGraceMinutes)
        : 0;
    }
    if ("autoCloseAfterMinutes" in body) {
      data.autoCloseAfterMinutes = Number.isFinite(Number(body.autoCloseAfterMinutes))
        ? Number(body.autoCloseAfterMinutes)
        : 720;
    }
    if ("minAccuracyM" in body) {
      data.minAccuracyM = Number.isFinite(Number(body.minAccuracyM))
        ? Number(body.minAccuracyM)
        : 100;
    }
    if ("enforceGeofence" in body) data.enforceGeofence = !!body.enforceGeofence;

    const updated = await prisma.attendancePolicy.update({
      where: { id },
      data,
    });
    return res.json({ policy: updated });
  } catch (err) {
    console.error("PATCH /api/admin/attendance/policies/:id error:", err);
    return res.status(500).json({ error: "Серверийн алдаа гарлаа." });
  }
});

export default router;
