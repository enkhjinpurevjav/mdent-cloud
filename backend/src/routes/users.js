import { Router } from "express";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/users?role=DOCTOR
 */
router.get("/", async (req, res) => {
  const { role } = req.query;

  try {
    // plain object, no inline TS type
    const where: { role?: UserRole } = {};

    if (role) {
      // role is string; check against enum values
      if (!Object.values(UserRole).includes(role as UserRole)) {
        return res.status(400).json({ error: "Invalid role filter" });
      }
      where.role = role as UserRole;
    }

    const users = await prisma.user.findMany({
      where,
      include: { branch: true },
      orderBy: { id: "desc" },
    });

    const result = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      ovog: u.ovog,
      role: u.role,
      branchId: u.branchId,
      branch: u.branch ? { id: u.branch.id, name: u.branch.name } : null,
      regNo: u.regNo,
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
 */
router.post("/", async (req, res) => {
  try {
    const { email, password, name, ovog, role, branchId } = req.body || {};

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
      },
      include: { branch: true },
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
      createdAt: created.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("POST /api/users error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/users/:id
 */
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { branch: true },
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
    });
  } catch (err) {
    console.error("GET /api/users/:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/users/:id
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
      include: { branch: true },
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
    });
  } catch (err) {
    console.error("PUT /api/users/:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
