import express from "express";
import prisma from "../db.js";

const router = express.Router();

/**
 * GET /api/branches
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

/**
 * PATCH /api/branches/:id
 *
 * Body:
 *  - name (string, optional)
 *  - address (string | null, optional)
 */
router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "invalid branch id" });
    }

    const { name, address } = req.body || {};
    const data: any = {};

    if (typeof name === "string" && name.trim()) {
      data.name = name.trim();
    }
    if (address === null || typeof address === "string") {
      data.address = address ? address.trim() : null;
    }

    if (Object.keys(data).length === 0) {
      return res
        .status(400)
        .json({ error: "at least one of name or address is required" });
    }

    const updated = await prisma.branch.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (err) {
    console.error("PATCH /api/branches/:id error:", err);
    if (err.code === "P2025") {
      return res.status(404).json({ error: "branch not found" });
    }
    res.status(500).json({ error: "failed to update branch" });
  }
});

export default router;
