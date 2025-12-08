import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

// GET /api/users/:id
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
      return res.status(404).json({ error: "Хэрэглэгч олдсонгүй" });
    }

    return res.status(200).json({
      id: user.id,
      email: user.email,
      name: user.name,
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

// PUT /api/users/:id
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const {
      name,
      email,
      branchId,
      regNo,
      licenseNumber,
      licenseExpiryDate,
    } = req.body || {};

    const data = {}; // <-- fixed

    if (name !== undefined) data.name = name || null;
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
