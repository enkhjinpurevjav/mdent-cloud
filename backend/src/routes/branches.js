// backend/src/routes/branches.js
import express from "express";
import prisma from "../db.js";

const router = express.Router();

// GET /api/branches
router.get("/", async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { id: "asc" },
    });
    res.json(branches);
  } catch (err) {
    console.error("GET /api/branches error:", err);
    res.status(500).json({ error: "failed to fetch branches" });
  }
});

export default router;
