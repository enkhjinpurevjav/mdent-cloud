import { Router } from "express";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const router = Router();

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

    if (!Object.values(UserRole).includes(role)) {
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

    const data = {};

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

export default router;
