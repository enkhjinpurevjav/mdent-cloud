import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (!id || Array.isArray(id) || isNaN(Number(id))) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  if (req.method === "GET") {
    return getUser(Number(id), res);
  }

  if (req.method === "PUT") {
    return updateUser(Number(id), req, res);
  }

  res.setHeader("Allow", ["GET", "PUT"]);
  return res.status(405).json({ error: "Method not allowed" });
}

async function getUser(userId: number, res: NextApiResponse) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
    console.error("GET /api/users/[id] error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function updateUser(
  userId: number,
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const {
      name,
      email,
      branchId,
      regNo,
      licenseNumber,
      licenseExpiryDate,
    } = req.body || {};

    const data: any = {};

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
      where: { id: userId },
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
  } catch (err: any) {
    console.error("PUT /api/users/[id] error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
