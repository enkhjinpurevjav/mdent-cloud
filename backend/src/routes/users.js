import express from "express";
import prisma from "../db.js";

const router = express.Router();

// GET /api/users - list all users/staff
router.get("/", async (req, res) => {
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

// POST /api/users - create new user/staff
router.post("/", async (req, res) => {
  const { email, password, name, role, branchId } = req.body;
  if (!email || !password || !role || !branchId) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const user = await prisma.user.create({
      data: { email, password, name, role, branchId }
    });
    res.status(201).json(user);
  } catch (err) {
    console.error("POST /api/users error:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// PUT /api/users/:id - update user
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { email, name, role, branchId, password } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: { email, name, role, branchId, password }
    });
    res.json(user);
  } catch (err) {
    console.error("PUT /api/users/:id error:", err);
    res.status(404).json({ error: "User not found or update failed" });
  }
});

// DELETE /api/users/:id - remove user
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
