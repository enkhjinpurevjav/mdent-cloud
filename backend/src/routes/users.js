import express from "express";
import prisma from "../db.js";
import bcrypt from "bcryptjs";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { id: "asc" },
      include: { branch: true }
    });
    res.json(users);
  } catch (err) {
    console.error("GET /api/users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.post("/", async (req, res) => {
  const { email, password, name, role, branchId } = req.body;
  if (!email || !password || !role || !branchId) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: passwordHash, name, role, branchId: Number(branchId) }
    });
    res.status(201).json(user);
  } catch (err) {
    console.error("POST /api/users error:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { email, name, role, branchId, password } = req.body;
  try {
    const data = { email, name, role, branchId: branchId ? Number(branchId) : undefined };
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }
    const user = await prisma.user.update({
      where: { id: Number(id) },
      data
    });
    res.json(user);
  } catch (err) {
    console.error("PUT /api/users/:id error:", err);
    res.status(404).json({ error: "User not found or update failed" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.user.delete({ where: { id: Number(id) } });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/users/:id error:", err);
    res.status(404).json({ error: "User not found or delete failed" });
  }
});

export default router;
