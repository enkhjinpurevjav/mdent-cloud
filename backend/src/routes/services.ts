import { Router } from "express";
import { PrismaClient, ServiceCategory } from "@prisma/client";
import { generateNextServiceCode } from "../utils/serviceCode";

const prisma = new PrismaClient();
const router = Router();

// GET /api/services?branchId=&category=&onlyActive=true
router.get("/", async (req, res) => {
  try {
    const { branchId, category, onlyActive } = req.query;

    const where: any = {};

    if (category && typeof category === "string") {
      // must be a valid enum, but we don't hard-fail here
      where.category = category as ServiceCategory;
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

    return res.json(services);
  } catch (err) {
    console.error("GET /api/services error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/services
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

    let serviceCode: string | null = null;
    if (typeof code === "string" && code.trim()) {
      serviceCode = code.trim();
    } else {
      serviceCode = await generateNextServiceCode(prisma);
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
          create: branchIds.map((bid: any) => ({
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

    return res.status(201).json(created);
  } catch (err: any) {
    console.error("POST /api/services error:", err);
    if (err.code === "P2002") {
      // unique constraint failed (e.g. duplicate code)
      return res.status(400).json({ error: "Service code must be unique" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/services/:id
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
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
      data.serviceBranches = {
        deleteMany: {}, // remove all existing mappings
        create: branchIds.map((bid: any) => ({
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

    return res.json(updated);
  } catch (err: any) {
    console.error("PUT /api/services/:id error:", err);
    if (err.code === "P2002") {
      return res.status(400).json({ error: "Service code must be unique" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
