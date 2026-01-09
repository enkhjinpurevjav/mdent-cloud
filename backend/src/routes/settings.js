import express from "express";
import prisma from "../db.js";

const router = express.Router();

/**
 * GET /api/settings
 * List all settings (optional - for admin page)
 */
router.get("/", async (req, res) => {
  try {
    const settings = await prisma.settings.findMany({
      orderBy: { key: "asc" },
    });

    return res.json({
      settings: settings.map((s) => ({
        key: s.key,
        value: s.value,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (err) {
    console.error("GET /api/settings error:", err);
    return res.status(500).json({ error: "Failed to retrieve settings" });
  }
});

/**
 * POST /api/settings
 * Upsert a setting
 * Body: { key: string, value: string }
 */
router.post("/", async (req, res) => {
  try {
    const { key, value } = req.body || {};

    if (!key || typeof key !== "string") {
      return res.status(400).json({ error: "key is required and must be a string" });
    }

    if (value === undefined || value === null) {
      return res.status(400).json({ error: "value is required" });
    }

    // Convert value to string if it's not already
    const valueStr = typeof value === "string" ? value : JSON.stringify(value);

    const setting = await prisma.settings.upsert({
      where: { key },
      update: { value: valueStr },
      create: { key, value: valueStr },
    });

    return res.json({
      key: setting.key,
      value: setting.value,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
    });
  } catch (err) {
    console.error("POST /api/settings error:", err);
    return res.status(500).json({ error: "Failed to save setting" });
  }
});

/**
 * GET /api/settings/:key
 * Read a setting by key
 */
router.get("/:key", async (req, res) => {
  try {
    const { key } = req.params;
    
    if (!key || typeof key !== "string") {
      return res.status(400).json({ error: "key is required" });
    }

    const setting = await prisma.settings.findUnique({
      where: { key },
    });

    if (!setting) {
      return res.status(404).json({ error: "Setting not found" });
    }

    return res.json({
      key: setting.key,
      value: setting.value,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
    });
  } catch (err) {
    console.error("GET /api/settings/:key error:", err);
    return res.status(500).json({ error: "Failed to retrieve setting" });
  }
});

/**
 * DELETE /api/settings/:key
 * Delete a setting by key (optional - for admin use)
 */
router.delete("/:key", async (req, res) => {
  try {
    const { key } = req.params;

    if (!key || typeof key !== "string") {
      return res.status(400).json({ error: "key is required" });
    }

    await prisma.settings.delete({
      where: { key },
    });

    return res.json({ success: true, message: "Setting deleted" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Setting not found" });
    }
    console.error("DELETE /api/settings/:key error:", err);
    return res.status(500).json({ error: "Failed to delete setting" });
  }
});

export default router;
