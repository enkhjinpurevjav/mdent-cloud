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
 * Validate geoLat / geoLng / geoRadiusM / geoMinAccuracyM values.
 * Returns { error } string on failure, or parsed values (possibly null) on success.
 */
function parseGeoFields(rawLat, rawLng, rawRadiusM, rawMinAccuracyM) {
  let geoLat = undefined;
  let geoLng = undefined;
  let geoRadiusM = undefined;
  let geoMinAccuracyM = undefined;

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

  if (rawRadiusM !== undefined) {
    if (rawRadiusM === null) {
      return { error: "geoRadiusM cannot be null" };
    }
    const v = Number(rawRadiusM);
    if (!Number.isFinite(v)) {
      return { error: "geoRadiusM must be a number" };
    }
    if (!Number.isInteger(v)) {
      return { error: "geoRadiusM must be an integer" };
    }
    if (v < 10 || v > 5000) {
      return { error: "geoRadiusM must be between 10 and 5000" };
    }
    geoRadiusM = v;
  }

  if (rawMinAccuracyM !== undefined) {
    if (rawMinAccuracyM === null) {
      return { error: "geoMinAccuracyM cannot be null" };
    }
    const v = Number(rawMinAccuracyM);
    if (!Number.isFinite(v)) {
      return { error: "geoMinAccuracyM must be a number" };
    }
    if (!Number.isInteger(v)) {
      return { error: "geoMinAccuracyM must be an integer" };
    }
    if (v < 1 || v > 5000) {
      return { error: "geoMinAccuracyM must be between 1 and 5000" };
    }
    geoMinAccuracyM = v;
  }

  return { geoLat, geoLng, geoRadiusM, geoMinAccuracyM };
}

/**
 * POST /api/branches
 */
router.post("/", async (req, res) => {
  try {
    const {
      name,
      address,
      geoLat: rawLat,
      geoLng: rawLng,
      geoRadiusM: rawRadiusM,
      geoMinAccuracyM: rawMinAccuracyM,
    } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const geo = parseGeoFields(rawLat, rawLng, rawRadiusM, rawMinAccuracyM);
    if (geo.error) {
      return res.status(400).json({ error: geo.error });
    }

    const data = {
      name,
      address: address || null,
    };
    if (geo.geoLat !== undefined) data.geoLat = geo.geoLat;
    if (geo.geoLng !== undefined) data.geoLng = geo.geoLng;
    if (geo.geoRadiusM !== undefined) data.geoRadiusM = geo.geoRadiusM;
    if (geo.geoMinAccuracyM !== undefined) {
      data.geoMinAccuracyM = geo.geoMinAccuracyM;
    }

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
 *  - geoRadiusM (integer, optional)
 *  - geoMinAccuracyM (integer, optional)
 */
router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "invalid branch id" });
    }

    const {
      name,
      address,
      geoLat: rawLat,
      geoLng: rawLng,
      geoRadiusM: rawRadiusM,
      geoMinAccuracyM: rawMinAccuracyM,
    } = req.body || {};
    const data = {};

    if (typeof name === "string" && name.trim()) {
      data.name = name.trim();
    }
    if (address === null || typeof address === "string") {
      data.address = address ? address.trim() : null;
    }

    if (
      rawLat !== undefined ||
      rawLng !== undefined ||
      rawRadiusM !== undefined ||
      rawMinAccuracyM !== undefined
    ) {
      const geo = parseGeoFields(
        rawLat,
        rawLng,
        rawRadiusM,
        rawMinAccuracyM
      );
      if (geo.error) {
        return res.status(400).json({ error: geo.error });
      }
      if (geo.geoLat !== undefined) data.geoLat = geo.geoLat;
      if (geo.geoLng !== undefined) data.geoLng = geo.geoLng;
      if (geo.geoRadiusM !== undefined) data.geoRadiusM = geo.geoRadiusM;
      if (geo.geoMinAccuracyM !== undefined) {
        data.geoMinAccuracyM = geo.geoMinAccuracyM;
      }
    }

    if (Object.keys(data).length === 0) {
      return res
        .status(400)
        .json({
          error:
            "at least one field (name, address, geoLat, geoLng, geoRadiusM, geoMinAccuracyM) is required",
        });
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
