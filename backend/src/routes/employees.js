import express from "express";
import prisma from "../db.js";

const router = express.Router();

// GET /api/employees - basic staff/doctor list
router.get("/", async (req, res) => {
  try {
    const employees = await prisma.user.findMany({
      orderBy: { id: "asc" },
      include: { branch: true }
    });
    res.json(employees);
  } catch (err) {
    console.error("GET /api/employees error:", err);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

export default router;
