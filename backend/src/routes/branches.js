import express from "express";
import prisma from "../db.js";

const router = express.Router();

/**
 * GET /api/branches
 *
 * Returns branches ordered by id. Frontend typically uses:
 *  - id
 *  - name
 */
router.get("/", async (_req, res) => {
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

/**
 * POST /api/branches
 *
 * Body:
 *  - name (string, required)
 *  - address (string, optional)
 */
router.post("/", async (req, res) => {
  try {
    const { name, address } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const branch = await prisma.branch.create({
      data: {
        name,
        address: address || null,
      },
    });

    res.status(201).json(branch);
  } catch (err) {
    console.error("POST /api/branches error:", err);
    res.status(500).json({ error: "failed to create branch" });
  }
});

export default router;
