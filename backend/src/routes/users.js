import express from "express";
import prisma from "../db.js";

const router = express.Router();

// GET /api/users?role=doctor
router.get("/", async (req, res) => {
  try {
    const { role } = req.query;

    const where = role ? { role } : {};

    const users = await prisma.user.findMany({
      where,
      include: {
        branch: true,
      },
      orderBy: { id: "asc" },
    });

    res.json(users);
  } catch (err) {
    console.error("GET /api/users error:", err);
    res.status(500).json({ error: "failed to fetch users" });
  }
});

// POST /api/users
router.post("/", async (req, res) => {
  try {
    const { email, password, name, role, branchId } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await prisma.user.create({
      data: {
        email,
        password, // later: hash this!
        name: name || null,
        role: role || "receptionist",
        branchId: branchId ? Number(branchId) : null,
      },
      include: { branch: true },
    });

    res.status(201).json(user);
  } catch (err) {
    console.error("POST /api/users error:", err);
    res.status(500).json({ error: "failed to create user" });
  }
});

export default router;
