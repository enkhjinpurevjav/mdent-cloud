import { Router } from "express";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const router = Router();

/**
 * Helper: ensure a user exists and is a doctor, or send 404.
 */
async function ensureDoctorOr404(id, res) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!user || user.role !== UserRole.doctor) {
    res.status(404).json({ error: "Doctor not found" });
    return null;
  }
  return user;
}

/**
 * GET /api/users?role=doctor&branchId=1
 * Supports:
 * - optional role filter
 * - optional branchId filter (legacy, on user.branchId)
 * - returns branches[] (many-to-many DoctorBranch) for all users
 */
router.get("/", async (req, res) => {
  const { role, branchId } = req.query;
  console.log("GET /api/users query:", req.query);

  try {
    const where = {};

    if (role) {
  // role is string at runtime, must match UserRole enum value
  if (!Object.values(UserRole).includes(role)) {
    return res.status(400).json({ error: "Invalid role filter" });
  }
  where.role = role;
}

    if (branchId) {
      const bidNum = Number(branchId);
      if (Number.isNaN(bidNum)) {
        return res.status(400).json({ error: "Invalid branchId filter" });
      }
      where.branchId = bidNum;
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        branch: true,
        doctorBranches: {
          include: { branch: true },
        },
      },
      orderBy: { id: "asc" },
    });

    const result = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      ovog: u.ovog,
      role: u.role,
      branchId: u.branchId,
      branch: u.branch ? { id: u.branch.id, name: u.branch.name } : null,
      branches:
        u.doctorBranches?.map((db) => ({
          id: db.branch.id,
          name: db.branch.name,
        })) ?? [],
      regNo: u.regNo,
      phone: u.phone || null,
      licenseNumber: u.licenseNumber,
      licenseExpiryDate: u.licenseExpiryDate
        ? u.licenseExpiryDate.toISOString()
        : null,
      createdAt: u.createdAt.toISOString(),
    }));

    return res.status(200).json(result);
  } catch (err) {
    console.error("GET /api/users error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/users
 * Creates any type of user; still uses legacy single branchId.
 * For doctors, you can later call PUT /api/users/:id/branches
 * to assign multiple branches.
 */
router.post("/", async (req, res) => {
  try {
    const { email, password, name, ovog, role, branchId, regNo } =
      req.body || {};

    if (!email || !password || !role) {
      return res
        .status(400)
        .json({ error: "email, password, role are required" });
    }

    if (!Object.values(UserRole).includes(role as UserRole)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const created = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: name || null,
        ovog: ovog || null,
        role,
        branchId: branchId ? Number(branchId) : null,
        regNo: regNo || null,
      },
      include: {
        branch: true,
        doctorBranches: {
          include: { branch: true },
        },
      },
    });

    return res.status(201).json({
      id: created.id,
      email: created.email,
      name: created.name,
      ovog: created.ovog,
      role: created.role,
      branchId: created.branchId,
      branch: created.branch
        ? { id: created.branch.id, name: created.branch.name }
        : null,
      regNo: created.regNo,
      createdAt: created.createdAt.toISOString(),
      branches:
        created.doctorBranches?.map((db) => ({
          id: db.branch.id,
          name: db.branch.name,
        })) ?? [],
    });
  } catch (err) {
    console.error("POST /api/users error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/users/:id
 * Returns a single user with:
 * - legacy branch
 * - branches[] via DoctorBranch
 */
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        branch: true,
        doctorBranches: {
          include: { branch: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      id: user.id,
      email: user.email,
      name: user.name,
      ovog: user.ovog,
      role: user.role,
      branchId: user.branchId,
      branch: user.branch
        ? { id: user.branch.id, name: user.branch.name }
        : null,
      regNo: user.regNo,
      licenseNumber: user.licenseNumber,
      licenseExpiryDate: user.licenseExpiryDate
        ? user.licenseExpiryDate.toISOString()
        : null,
      signatureImagePath: user.signatureImagePath,
      stampImagePath: user.stampImagePath,
      idPhotoPath: user.idPhotoPath,
      createdAt: user.createdAt.toISOString(),
      branches:
        user.doctorBranches?.map((db) => ({
          id: db.branch.id,
          name: db.branch.name,
        })) ?? [],
    });
  } catch (err) {
    console.error("GET /api/users/:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/users/:id
 * Updates basic fields, still including legacy branchId.
 */
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const {
      name,
      ovog,
      email,
      branchId,
      regNo,
      licenseNumber,
      licenseExpiryDate,
    } = req.body || {};

    const data: any = {};

    if (name !== undefined) data.name = name || null;
    if (ovog !== undefined) data.ovog = ovog || null;
    if (email !== undefined) data.email = email || null;
    if (branchId !== undefined)
      data.branchId = branchId ? Number(branchId) : null;
    if (regNo !== undefined) data.regNo = regNo || null;
    if (licenseNumber !== undefined) data.licenseNumber = licenseNumber || null;
    if (licenseExpiryDate !== undefined) {
      data.licenseExpiryDate = licenseExpiryDate
        ? new Date(licenseExpiryDate)
        : null;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      include: {
        branch: true,
        doctorBranches: {
          include: { branch: true },
        },
      },
    });

    return res.status(200).json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      ovog: updated.ovog,
      role: updated.role,
      branchId: updated.branchId,
      branch: updated.branch
        ? { id: updated.branch.id, name: updated.branch.name }
        : null,
      regNo: updated.regNo,
      licenseNumber: updated.licenseNumber,
      licenseExpiryDate: updated.licenseExpiryDate
        ? updated.licenseExpiryDate.toISOString()
        : null,
      signatureImagePath: updated.signatureImagePath,
      stampImagePath: updated.stampImagePath,
      idPhotoPath: updated.idPhotoPath,
      createdAt: updated.createdAt.toISOString(),
      branches:
        updated.doctorBranches?.map((db) => ({
          id: db.branch.id,
          name: db.branch.name,
        })) ?? [],
    });
  } catch (err) {
    console.error("PUT /api/users/:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/users/:id
 * Deletes a user (any role).
 */
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    // Optional: check existence first to return 404 instead of generic 500
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    await prisma.user.delete({ where: { id } });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("DELETE /api/users/:id error:", err);
    return res.status(500).json({ error: "Failed to delete user" });
  }
});

/**
 * PUT /api/users/:id/branches
 * Sets all branches for a doctor via DoctorBranch join table.
 */
router.put("/:id/branches", async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId || Number.isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  const { branchIds } = req.body || {};

  if (!Array.isArray(branchIds)) {
    return res
      .status(400)
      .json({ error: "branchIds must be an array of numbers" });
  }

  const uniqueBranchIds = [
    ...new Set(
      branchIds
        .map((b) => Number(b))
        .filter((b) => !Number.isNaN(b))
    ),
  ];

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role !== UserRole.doctor) {
      return res
        .status(400)
        .json({ error: "Only doctors can have multiple branches" });
    }

    if (uniqueBranchIds.length > 0) {
      const existingBranches = await prisma.branch.findMany({
        where: { id: { in: uniqueBranchIds } },
        select: { id: true },
      });
      const existingIds = new Set(existingBranches.map((b) => b.id));
      const invalidIds = uniqueBranchIds.filter((id) => !existingIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({
          error: `Invalid branchIds: ${invalidIds.join(", ")}`,
        });
      }
    }

    await prisma.$transaction([
      prisma.doctorBranch.deleteMany({
        where: { doctorId: userId },
      }),
      ...(uniqueBranchIds.length
        ? [
            prisma.doctorBranch.createMany({
              data: uniqueBranchIds.map((branchId) => ({
                doctorId: userId,
                branchId,
              })),
            }),
          ]
        : []),
    ]);

    const updated = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        doctorBranches: {
          include: { branch: true },
        },
      },
    });

    return res.json({
      id: updated.id,
      role: updated.role,
      branches:
        updated.doctorBranches?.map((db) => ({
          id: db.branch.id,
          name: db.branch.name,
        })) ?? [],
    });
  } catch (err) {
    console.error("PUT /api/users/:id/branches error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/users/:id/schedule
 * ...
 */
router.get("/:id/schedule", async (req, res) => {
  const doctorId = Number(req.params.id);
  if (!doctorId || Number.isNaN(doctorId)) {
    return res.status(400).json({ error: "Invalid doctor id" });
  }

  try {
    const doctor = await ensureDoctorOr404(doctorId, res);
    if (!doctor) return;

    const { from, to, branchId } = req.query;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fromDate = from ? new Date(from as string) : today;
    if (Number.isNaN(fromDate.getTime())) {
      return res.status(400).json({ error: "Invalid from date" });
    }

    let toDate: Date;
    if (to) {
      toDate = new Date(to as string);
      if (Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ error: "Invalid to date" });
      }
    } else {
      toDate = new Date(fromDate);
      toDate.setDate(fromDate.getDate() + 31);
    }

    const where: any = {
      doctorId,
      date: {
        gte: fromDate,
        lte: toDate,
      },
    };

    if (branchId) {
      const bid = Number(branchId);
      if (Number.isNaN(bid)) {
        return res.status(400).json({ error: "Invalid branchId" });
      }
      where.branchId = bid;
    }

    const schedules = await prisma.doctorSchedule.findMany({
      where,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    return res.json(
      schedules.map((s) => ({
        id: s.id,
        date: s.date.toISOString().slice(0, 10),
        branch: s.branch,
        startTime: s.startTime,
        endTime: s.endTime,
        note: s.note,
      }))
    );
  } catch (err) {
    console.error("GET /api/users/:id/schedule error:", err);
    return res.status(500).json({ error: "Failed to fetch doctor schedule" });
  }
});

/**
 * POST /api/users/:id/schedule
 * ...
 */
router.post("/:id/schedule", async (req, res) => {
  const doctorId = Number(req.params.id);
  if (!doctorId || Number.isNaN(doctorId)) {
    return res.status(400).json({ error: "Invalid doctor id" });
  }

  const { date, branchId, startTime, endTime, note } = req.body || {};

  if (!date || !branchId || !startTime || !endTime) {
    return res
      .status(400)
      .json({ error: "date, branchId, startTime, endTime are required" });
  }

  const day = new Date(date);
  if (Number.isNaN(day.getTime())) {
    return res.status(400).json({ error: "Invalid date" });
  }
  day.setHours(0, 0, 0, 0);

  const bid = Number(branchId);
  if (Number.isNaN(bid)) {
    return res.status(400).json({ error: "Invalid branchId" });
  }

  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return res
      .status(400)
      .json({ error: "startTime and endTime must be HH:MM (24h)" });
  }

  if (startTime >= endTime) {
    return res
      .status(400)
      .json({ error: "startTime must be before endTime" });
  }

  try {
    const doctor = await ensureDoctorOr404(doctorId, res);
    if (!doctor) return;

    const branch = await prisma.branch.findUnique({
      where: { id: bid },
      select: { id: true, name: true },
    });
    if (!branch) {
      return res.status(400).json({ error: "Branch not found" });
    }

    const doctorBranch = await prisma.doctorBranch.findFirst({
      where: { doctorId, branchId: bid },
    });
    if (!doctorBranch) {
      return res.status(400).json({
        error: "Doctor is not assigned to this branch",
      });
    }

    const weekday = day.getDay(); // 0=Sun .. 6=Sat
    const isWeekend = weekday === 0 || weekday === 6;
    const clinicOpen = isWeekend ? "10:00" : "09:00";
    const clinicClose = isWeekend ? "19:00" : "21:00";

    if (startTime < clinicOpen || endTime > clinicClose) {
      return res.status(400).json({
        error: "Schedule outside clinic hours",
        clinicOpen,
        clinicClose,
      });
    }

    const existing = await prisma.doctorSchedule.findFirst({
      where: { doctorId, branchId: bid, date: day },
    });

    let schedule;
    if (existing) {
      schedule = await prisma.doctorSchedule.update({
        where: { id: existing.id },
        data: {
          startTime,
          endTime,
          note: note || null,
        },
        include: { branch: { select: { id: true, name: true } } },
      });
    } else {
      schedule = await prisma.doctorSchedule.create({
        data: {
          doctorId,
          branchId: bid,
          date: day,
          startTime,
          endTime,
          note: note || null,
        },
        include: { branch: { select: { id: true, name: true } } },
      });
    }

    return res.status(existing ? 200 : 201).json({
      id: schedule.id,
      date: schedule.date.toISOString().slice(0, 10),
      branch: schedule.branch,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      note: schedule.note,
    });
  } catch (err) {
    console.error("POST /api/users/:id/schedule error:", err);
    return res.status(500).json({ error: "Failed to save doctor schedule" });
  }
});

/**
 * DELETE /api/users/:id/schedule/:scheduleId
 * Deletes a schedule entry for this doctor.
 */
router.delete("/:id/schedule/:scheduleId", async (req, res) => {
  const doctorId = Number(req.params.id);
  const scheduleId = Number(req.params.scheduleId);

  if (!doctorId || Number.isNaN(doctorId)) {
    return res.status(400).json({ error: "Invalid doctor id" });
  }
  if (!scheduleId || Number.isNaN(scheduleId)) {
    return res.status(400).json({ error: "Invalid schedule id" });
  }

  try {
    const doctor = await ensureDoctorOr404(doctorId, res);
    if (!doctor) return;

    const existing = await prisma.doctorSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true, doctorId: true },
    });

    if (!existing || existing.doctorId !== doctorId) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    await prisma.doctorSchedule.delete({
      where: { id: scheduleId },
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(
      "DELETE /api/users/:id/schedule/:scheduleId error:",
      err
    );
    return res
      .status(500)
      .json({ error: "Failed to delete doctor schedule" });
  }
});

export default router;
