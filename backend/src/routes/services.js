import { Router } from "express";
import prisma from "../db.js";
import { generateNextServiceCode } from "../utils/serviceCode.js";

const router = Router();

/**
 * GET /api/services
 * Query params:
 *  - branchId: number (optional)
 *  - category: string (ServiceCategory enum, optional)
 *  - onlyActive: "true" to filter only active services
 */
router.get("/", async (req, res) => {
  try {
    const { branchId, category, onlyActive } = req.query;

    const where = {};

    if (category && typeof category === "string") {
      // must match enum ServiceCategory in Prisma
      where.category = category;
    }

    if (onlyActive === "true") {
      where.isActive = true;
    }

    if (branchId) {
      where.serviceBranches = {
        some: { branchId: Number(branchId) },
      };
    }

    const services = await prisma.service.findMany({
      where,
      include: {
        serviceBranches: {
          include: { branch: true },
        },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    res.json(services);
  } catch (err) {
    console.error("GET /api/services error:", err);
    res.status(500).json({ error: "internal server error" });
  }
});

/**
 * POST /api/services
 * Body:
 *  - name (string, required)
 *  - price (number, required)
 *  - category (ServiceCategory, required)
 *  - description (string, optional)
 *  - branchIds (number[], required, at least one)
 *  - code (string, optional; if empty, auto-generated)
 *  - isActive (boolean, optional; default true)
 */
router.post("/", async (req, res) => {
  try {
    const {
      name,
      price,
      category,
      description,
      branchIds,
      code,
      isActive,
    } = req.body || {};

    if (!name || price === undefined || !category) {
      return res
        .status(400)
        .json({ error: "name, price, category are required" });
    }

    if (!Array.isArray(branchIds)) {
      return res
        .status(400)
        .json({ error: "branchIds must be an array of branch ids" });
    }

    if (branchIds.length === 0) {
      return res
        .status(400)
        .json({ error: "at least one branchId is required" });
    }

    let serviceCode: string | null = null;
    if (typeof code === "string" && code.trim()) {
      serviceCode = code.trim();
    } else {
      serviceCode = await generateNextServiceCode();
    }

    const created = await prisma.service.create({
      data: {
        name,
        price: Number(price),
        category,
        description: description || null,
        code: serviceCode,
        isActive: typeof isActive === "boolean" ? isActive : true,
        serviceBranches: {
          create: branchIds.map((bid: number | string) => ({
            branchId: Number(bid),
          })),
        },
      },
      include: {
        serviceBranches: {
          include: { branch: true },
        },
      },
    });

    res.status(201).json(created);
  } catch (err: any) {
    console.error("POST /api/services error:", err);
    if (err.code === "P2002") {
      // unique constraint, likely on code
      return res.status(400).json({ error: "Service code must be unique" });
    }
    res.status(500).json({ error: "internal server error" });
  }
});

/**
 * PUT /api/services/:id
 * Body (all fields optional; only provided ones will update):
 *  - name (string)
 *  - price (number)
 *  - category (ServiceCategory)
 *  - description (string | null)
 *  - code (string | null)
 *  - isActive (boolean)
 *  - branchIds (number[])  -> replaces all ServiceBranch rows for this service
 */
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid service id" });
    }

    const {
      name,
      price,
      category,
      description,
      code,
      isActive,
      branchIds,
    } = req.body || {};

    const existing = await prisma.service.findUnique({
      where: { id },
      include: { serviceBranches: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Service not found" });
    }

    const data: any = {};

    if (typeof name === "string") data.name = name;
    if (price !== undefined) data.price = Number(price);
    if (typeof category === "string") data.category = category;
    if (description !== undefined) data.description = description || null;
    if (code !== undefined) data.code = code || null;
    if (typeof isActive === "boolean") data.isActive = isActive;

    if (Array.isArray(branchIds)) {
      // full replace of junction table entries
      data.serviceBranches = {
        deleteMany: {},
        create: branchIds.map((bid: number | string) => ({
          branchId: Number(bid),
        })),
      };
    }

    const updated = await prisma.service.update({
      where: { id },
      data,
      include: {
        serviceBranches: {
          include: { branch: true },
        },
      },
    });

    res.json(updated);
  } catch (err: any) {
    console.error("PUT /api/services/:id error:", err);
    if (err.code === "P2002") {
      // unique constraint, likely on code
      return res.status(400).json({ error: "Service code must be unique" });
    }
    res.status(500).json({ error: "internal server error" });
  }
});

/**
 * DELETE /api/services/:id
 * Deletes the service and its ServiceBranch rows.
 * (Invoices/InvoiceItems referencing this service should be handled
 * via FK constraints or application rules; this route assumes
 * it's safe to delete.)
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid service id" });
    }

    const existing = await prisma.service.findUnique({
      where: { id },
      include: { serviceBranches: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Service not found" });
    }

    // Delete junction rows first because of composite PK on ServiceBranch
    await prisma.serviceBranch.deleteMany({
      where: { serviceId: id },
    });

    await prisma.service.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/services/:id error:", err);
    res.status(500).json({ error: "internal server error" });
  }
});

export default router;
