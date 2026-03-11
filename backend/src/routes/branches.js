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
 * Validate geoLat / geoLng values.
 * Returns { error } string on failure, or { geoLat, geoLng } (possibly null) on success.
 */
function parseGeoCoords(rawLat, rawLng) {
  let geoLat = undefined;
  let geoLng = undefined;

  if (rawLat !== undefined) {
    if (rawLat === null) {
      geoLat = null;
    } else {
      const v = Number(rawLat);
      if (!Number.isFinite(v)) {
        return { error: "geoLat must be a number" };
      }
      if (v < -90 || v > 90) {
        return { error: "geoLat must be between -90 and 90" };
      }
      geoLat = v;
    }
  }

  if (rawLng !== undefined) {
    if (rawLng === null) {
      geoLng = null;
    } else {
      const v = Number(rawLng);
      if (!Number.isFinite(v)) {
        return { error: "geoLng must be a number" };
      }
      if (v < -180 || v > 180) {
        return { error: "geoLng must be between -180 and 180" };
      }
      geoLng = v;
    }
  }

  return { geoLat, geoLng };
}

/**
 * POST /api/branches
 */
router.post("/", async (req, res) => {
  try {
    const { name, address, geoLat: rawLat, geoLng: rawLng } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const geo = parseGeoCoords(rawLat, rawLng);
    if (geo.error) {
      return res.status(400).json({ error: geo.error });
    }

    const data = {
      name,
      address: address || null,
    };
    if (geo.geoLat !== undefined) data.geoLat = geo.geoLat;
    if (geo.geoLng !== undefined) data.geoLng = geo.geoLng;

    const branch = await prisma.branch.create({ data });

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
 *  - geoLat (number | null, optional)
 *  - geoLng (number | null, optional)
 */
router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "invalid branch id" });
    }

    const { name, address, geoLat: rawLat, geoLng: rawLng } = req.body || {};
    const data = {};

    if (typeof name === "string" && name.trim()) {
      data.name = name.trim();
    }
    if (address === null || typeof address === "string") {
      data.address = address ? address.trim() : null;
    }

    if (rawLat !== undefined || rawLng !== undefined) {
      const geo = parseGeoCoords(rawLat, rawLng);
      if (geo.error) {
        return res.status(400).json({ error: geo.error });
      }
      if (geo.geoLat !== undefined) data.geoLat = geo.geoLat;
      if (geo.geoLng !== undefined) data.geoLng = geo.geoLng;
    }

    if (Object.keys(data).length === 0) {
      return res
        .status(400)
        .json({ error: "at least one field (name, address, geoLat, geoLng) is required" });
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
