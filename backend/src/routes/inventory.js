import { Router } from "express";
import prisma from "../db.js";

const router = Router();

/**
 * GET /api/inventory/categories?branchId=1
 */
router.get("/categories", async (req, res) => {
  try {
    const branchId = Number(req.query.branchId);
    if (!branchId || Number.isNaN(branchId)) {
      return res.status(400).json({ error: "branchId is required" });
    }

    const categories = await prisma.productCategory.findMany({
      where: { branchId, isActive: true },
      orderBy: { name: "asc" },
    });

    return res.json(categories);
  } catch (e) {
    console.error("GET /api/inventory/categories failed", e);
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * POST /api/inventory/categories
 * body: { branchId, name }
 */
router.post("/categories", async (req, res) => {
  try {
    const branchId = Number(req.body?.branchId);
    const name = String(req.body?.name || "").trim();

    if (!branchId || Number.isNaN(branchId)) {
      return res.status(400).json({ error: "branchId is required" });
    }
    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const created = await prisma.productCategory.create({
      data: { branchId, name, isActive: true },
    });

    return res.status(201).json(created);
  } catch (e) {
    console.error("POST /api/inventory/categories failed", e);
    if (e.code === "P2002") {
      return res.status(400).json({ error: "Category name must be unique per branch" });
    }
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * PUT /api/inventory/categories/:id
 * body: { name, isActive? }
 */
router.put("/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body?.name || "").trim();

    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid id" });
    if (!name) return res.status(400).json({ error: "name is required" });

    const updated = await prisma.productCategory.update({
      where: { id },
      data: { name },
    });

    return res.json(updated);
  } catch (e) {
    console.error("PUT /api/inventory/categories/:id failed", e);
    if (e.code === "P2025") return res.status(404).json({ error: "Category not found" });
    if (e.code === "P2002") return res.status(400).json({ error: "Category name must be unique per branch" });
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * GET /api/inventory/products?branchId=1&categoryId=2&q=abc
 * returns products + computed stockOnHand
 */
router.get("/products", async (req, res) => {
  try {
    const branchId = Number(req.query.branchId);
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    const q = String(req.query.q || "").trim();

    if (!branchId || Number.isNaN(branchId)) {
      return res.status(400).json({ error: "branchId is required" });
    }

    const where = { branchId };
    if (categoryId && !Number.isNaN(categoryId)) where.categoryId = categoryId;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: "asc" },
    });

    // compute stock per product
    const productIds = products.map((p) => p.id);
    const movements = await prisma.productStockMovement.groupBy({
      by: ["productId"],
      where: { branchId, productId: { in: productIds } },
      _sum: { quantityDelta: true },
    });

    const stockMap = new Map(movements.map((m) => [m.productId, m._sum.quantityDelta ?? 0]));

    return res.json(
      products.map((p) => ({
        ...p,
        stockOnHand: stockMap.get(p.id) ?? 0,
      }))
    );
  } catch (e) {
    console.error("GET /api/inventory/products failed", e);
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * POST /api/inventory/products
 * body: { branchId, categoryId, name, code?, price, isActive? }
 */
router.post("/products", async (req, res) => {
  try {
    const branchId = Number(req.body?.branchId);
    const categoryId = Number(req.body?.categoryId);
    const name = String(req.body?.name || "").trim();
    const code = req.body?.code != null ? String(req.body.code).trim() : null;
    const price = Number(req.body?.price);

    if (!branchId || Number.isNaN(branchId)) return res.status(400).json({ error: "branchId is required" });
    if (!categoryId || Number.isNaN(categoryId)) return res.status(400).json({ error: "categoryId is required" });
    if (!name) return res.status(400).json({ error: "name is required" });
    if (Number.isNaN(price) || price < 0) return res.status(400).json({ error: "price must be >= 0" });

    const created = await prisma.product.create({
      data: {
        branchId,
        categoryId,
        name,
        code: code || null,
        price,
        isActive: req.body?.isActive === false ? false : true,
      },
      include: { category: true },
    });

    return res.status(201).json({ ...created, stockOnHand: 0 });
  } catch (e) {
    console.error("POST /api/inventory/products failed", e);
    if (e.code === "P2002") return res.status(400).json({ error: "Product code must be unique" });
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * PUT /api/inventory/products/:id
 * body: { categoryId, name, code?, price, isActive }
 */
router.put("/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid id" });

    const categoryId = Number(req.body?.categoryId);
    const name = String(req.body?.name || "").trim();
    const code = req.body?.code != null ? String(req.body.code).trim() : null;
    const price = Number(req.body?.price);
    const isActive = Boolean(req.body?.isActive);

    if (!categoryId || Number.isNaN(categoryId)) return res.status(400).json({ error: "categoryId is required" });
    if (!name) return res.status(400).json({ error: "name is required" });
    if (Number.isNaN(price) || price < 0) return res.status(400).json({ error: "price must be >= 0" });

    const updated = await prisma.product.update({
      where: { id },
      data: {
        categoryId,
        name,
        code: code || null,
        price,
        isActive,
      },
      include: { category: true },
    });

    return res.json(updated);
  } catch (e) {
    console.error("PUT /api/inventory/products/:id failed", e);
    if (e.code === "P2025") return res.status(404).json({ error: "Product not found" });
    if (e.code === "P2002") return res.status(400).json({ error: "Product code must be unique" });
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * POST /api/inventory/products/:id/adjust
 * body: { branchId, quantityDelta, note? }
 */
router.post("/products/:id/adjust", async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const branchId = Number(req.body?.branchId);
    const quantityDelta = Number(req.body?.quantityDelta);
    const note = req.body?.note != null ? String(req.body.note).trim() : null;

    if (!productId || Number.isNaN(productId)) return res.status(400).json({ error: "invalid product id" });
    if (!branchId || Number.isNaN(branchId)) return res.status(400).json({ error: "branchId is required" });
    if (!Number.isFinite(quantityDelta) || quantityDelta === 0) {
      return res.status(400).json({ error: "quantityDelta must be a non-zero number" });
    }

    // ensure product belongs to this branch
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, branchId: true } });
    if (!product) return res.status(404).json({ error: "Product not found" });
    if (product.branchId !== branchId) return res.status(400).json({ error: "Product branch mismatch" });

    const movement = await prisma.productStockMovement.create({
      data: {
        branchId,
        productId,
        type: "ADJUSTMENT",
        quantityDelta: Math.trunc(quantityDelta),
        note: note || null,
      },
    });

    return res.status(201).json(movement);
  } catch (e) {
    console.error("POST /api/inventory/products/:id/adjust failed", e);
    return res.status(500).json({ error: "internal server error" });
  }
});

export default router;
