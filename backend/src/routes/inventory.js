import { Router } from "express";
import prisma from "../db.js";

const router = Router();
const MAX_PRODUCT_IMAGES = 3;

function normalizeImagePaths(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v || "").trim())
    .filter(Boolean);
}

function parseImagePaths(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new Error("imagePaths must be an array");
  }
  const cleaned = normalizeImagePaths(value);
  if (cleaned.length !== value.length) {
    throw new Error("imagePaths contains invalid values");
  }
  if (cleaned.length > MAX_PRODUCT_IMAGES) {
    throw new Error(`imagePaths can include up to ${MAX_PRODUCT_IMAGES} images`);
  }
  return cleaned;
}

/**
 * GET /api/inventory/categories?branchId=1&includeInactive=true
 */
router.get("/categories", async (req, res) => {
  try {
    const branchId = Number(req.query.branchId);
    const includeInactive = req.query.includeInactive === "true";
    if (!branchId || Number.isNaN(branchId)) {
      return res.status(400).json({ error: "branchId is required" });
    }

    const categories = await prisma.productCategory.findMany({
      where: includeInactive ? { branchId } : { branchId, isActive: true },
      include: {
        _count: {
          select: { products: true },
        },
      },
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
    const hasIsActive = typeof req.body?.isActive === "boolean";

    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid id" });
    if (!name) return res.status(400).json({ error: "name is required" });

    const data = { name };
    if (hasIsActive) {
      data.isActive = req.body.isActive;
    }

    const updated = await prisma.productCategory.update({
      where: { id },
      data,
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
 * PATCH /api/inventory/categories/:id/archive
 * body: { isActive: boolean }
 */
router.patch("/categories/:id/archive", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const isActive = req.body?.isActive;

    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid id" });
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "isActive boolean is required" });
    }

    const updated = await prisma.productCategory.update({
      where: { id },
      data: { isActive },
    });

    return res.json(updated);
  } catch (e) {
    console.error("PATCH /api/inventory/categories/:id/archive failed", e);
    if (e.code === "P2025") return res.status(404).json({ error: "Category not found" });
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * DELETE /api/inventory/categories/:id
 */
router.delete("/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid id" });

    const category = await prisma.productCategory.findUnique({
      where: { id },
      select: {
        id: true,
        _count: {
          select: { products: true },
        },
      },
    });
    if (!category) return res.status(404).json({ error: "Category not found" });
    if (category._count.products > 0) {
      return res.status(400).json({
        error: "Category has products. Archive it first or delete products before removing category.",
      });
    }

    await prisma.productCategory.delete({ where: { id } });
    return res.status(204).send();
  } catch (e) {
    console.error("DELETE /api/inventory/categories/:id failed", e);
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
    const onlyActive = req.query.onlyActive === "true";

    if (!branchId || Number.isNaN(branchId)) {
      return res.status(400).json({ error: "branchId is required" });
    }

    const where = { branchId };
    if (onlyActive) where.isActive = true;
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
    const movements =
      productIds.length > 0
        ? await prisma.productStockMovement.groupBy({
            by: ["productId"],
            where: { branchId, productId: { in: productIds } },
            _sum: { quantityDelta: true },
          })
        : [];

    const stockMap = new Map(movements.map((m) => [m.productId, m._sum.quantityDelta ?? 0]));

    return res.json(
      products.map((p) => ({
        ...p,
        imagePaths: normalizeImagePaths(p.imagePaths),
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
 * body: { branchId, categoryId, name, code?, price, description?, imagePaths?, isActive? }
 */
router.post("/products", async (req, res) => {
  try {
    const branchId = Number(req.body?.branchId);
    const categoryId = Number(req.body?.categoryId);
    const name = String(req.body?.name || "").trim();
    const code = req.body?.code != null ? String(req.body.code).trim() : null;
    const price = Number(req.body?.price);
    const description =
      req.body?.description != null ? String(req.body.description).trim() : null;
    const imagePaths = parseImagePaths(req.body?.imagePaths);

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
        description: description || null,
        imagePaths,
        isActive: req.body?.isActive === false ? false : true,
      },
      include: { category: true },
    });

    return res.status(201).json({
      ...created,
      imagePaths: normalizeImagePaths(created.imagePaths),
      stockOnHand: 0,
    });
  } catch (e) {
    console.error("POST /api/inventory/products failed", e);
    if (e.message?.includes("imagePaths")) {
      return res.status(400).json({ error: e.message });
    }
    if (e.code === "P2002") return res.status(400).json({ error: "Product code must be unique" });
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * PUT /api/inventory/products/:id
 * body: { categoryId, name, code?, price, description?, imagePaths?, isActive }
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
    const description =
      req.body?.description != null ? String(req.body.description).trim() : null;
    const imagePaths = parseImagePaths(req.body?.imagePaths);

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
        description: description || null,
        imagePaths,
        isActive,
      },
      include: { category: true },
    });

    return res.json({
      ...updated,
      imagePaths: normalizeImagePaths(updated.imagePaths),
    });
  } catch (e) {
    console.error("PUT /api/inventory/products/:id failed", e);
    if (e.message?.includes("imagePaths")) {
      return res.status(400).json({ error: e.message });
    }
    if (e.code === "P2025") return res.status(404).json({ error: "Product not found" });
    if (e.code === "P2002") return res.status(400).json({ error: "Product code must be unique" });
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * PATCH /api/inventory/products/:id/archive
 * body: { isActive: boolean }
 */
router.patch("/products/:id/archive", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const isActive = req.body?.isActive;
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid id" });
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "isActive boolean is required" });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { isActive },
      include: { category: true },
    });

    return res.json({
      ...updated,
      imagePaths: normalizeImagePaths(updated.imagePaths),
    });
  } catch (e) {
    console.error("PATCH /api/inventory/products/:id/archive failed", e);
    if (e.code === "P2025") return res.status(404).json({ error: "Product not found" });
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * DELETE /api/inventory/products/:id
 */
router.delete("/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid id" });

    await prisma.product.delete({ where: { id } });
    return res.status(204).send();
  } catch (e) {
    console.error("DELETE /api/inventory/products/:id failed", e);
    if (e.code === "P2025") return res.status(404).json({ error: "Product not found" });
    if (e.code === "P2003") {
      return res.status(400).json({ error: "Product is used in sales records and cannot be deleted." });
    }
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
