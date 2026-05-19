import { Router } from "express";
import prisma from "../db.js";
import { requireRole } from "../middleware/auth.js";

const router = Router();
const MAX_PRODUCT_IMAGES = 3;
const MAX_LIMIT = 100;

router.use(requireRole("admin", "super_admin"));

function parseImagePaths(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new Error("imagePaths must be an array");
  }
  const cleaned = value
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  if (cleaned.length !== value.length) {
    throw new Error("imagePaths contains invalid values");
  }
  if (cleaned.length > MAX_PRODUCT_IMAGES) {
    throw new Error(`imagePaths can include up to ${MAX_PRODUCT_IMAGES} images`);
  }
  return cleaned;
}

function parseLimit(limitRaw) {
  if (limitRaw == null) return null;
  const n = Number(limitRaw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("limit must be a positive integer");
  }
  return Math.min(n, MAX_LIMIT);
}

async function ensureCategoryExists(categoryId) {
  const category = await prisma.supplyCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  return Boolean(category);
}

/**
 * GET /api/supply/categories?includeInactive=true
 */
router.get("/categories", async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const categories = await prisma.supplyCategory.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return res.json(categories);
  } catch (e) {
    console.error("GET /api/supply/categories failed", e);
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * POST /api/supply/categories
 * body: { name }
 */
router.post("/categories", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const created = await prisma.supplyCategory.create({
      data: { name, isActive: true },
    });
    return res.status(201).json(created);
  } catch (e) {
    console.error("POST /api/supply/categories failed", e);
    if (e.code === "P2002") {
      return res.status(400).json({ error: "Category name must be unique" });
    }
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * PUT /api/supply/categories/:id
 * body: { name }
 */
router.put("/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body?.name || "").trim();
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid id" });
    if (!name) return res.status(400).json({ error: "name is required" });

    const updated = await prisma.supplyCategory.update({
      where: { id },
      data: { name },
    });
    return res.json(updated);
  } catch (e) {
    console.error("PUT /api/supply/categories/:id failed", e);
    if (e.code === "P2025") return res.status(404).json({ error: "Category not found" });
    if (e.code === "P2002") return res.status(400).json({ error: "Category name must be unique" });
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * PATCH /api/supply/categories/:id/archive
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

    const updated = await prisma.supplyCategory.update({
      where: { id },
      data: { isActive },
    });
    return res.json(updated);
  } catch (e) {
    console.error("PATCH /api/supply/categories/:id/archive failed", e);
    if (e.code === "P2025") return res.status(404).json({ error: "Category not found" });
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * DELETE /api/supply/categories/:id
 */
router.delete("/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid id" });

    const category = await prisma.supplyCategory.findUnique({
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

    await prisma.supplyCategory.delete({ where: { id } });
    return res.status(204).send();
  } catch (e) {
    console.error("DELETE /api/supply/categories/:id failed", e);
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * GET /api/supply/products?categoryId=2&q=abc&onlyActive=true&sort=newest&limit=10
 */
router.get("/products", async (req, res) => {
  try {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    const q = String(req.query.q || "").trim();
    const onlyActive = req.query.onlyActive === "true";
    const sort = String(req.query.sort || "").trim().toLowerCase();
    const limit = parseLimit(req.query.limit);

    const where = {};
    if (onlyActive) where.isActive = true;
    if (categoryId && !Number.isNaN(categoryId)) where.categoryId = categoryId;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
      ];
    }

    const orderBy = sort === "newest" ? { createdAt: "desc" } : { name: "asc" };
    const products = await prisma.supplyProduct.findMany({
      where,
      include: { category: true },
      orderBy,
      ...(limit ? { take: limit } : {}),
    });
    return res.json(products);
  } catch (e) {
    console.error("GET /api/supply/products failed", e);
    if (e.message?.includes("limit")) {
      return res.status(400).json({ error: e.message });
    }
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * POST /api/supply/products
 * body: { categoryId, name, code?, price, description?, imagePaths?, isActive? }
 */
router.post("/products", async (req, res) => {
  try {
    const categoryId = Number(req.body?.categoryId);
    const name = String(req.body?.name || "").trim();
    const code = req.body?.code != null ? String(req.body.code).trim() : null;
    const price = Number(req.body?.price);
    const description =
      req.body?.description != null ? String(req.body.description).trim() : null;
    const imagePaths = parseImagePaths(req.body?.imagePaths);

    if (!categoryId || Number.isNaN(categoryId)) return res.status(400).json({ error: "categoryId is required" });
    if (!name) return res.status(400).json({ error: "name is required" });
    if (Number.isNaN(price) || price < 0) return res.status(400).json({ error: "price must be >= 0" });

    const categoryExists = await ensureCategoryExists(categoryId);
    if (!categoryExists) {
      return res.status(400).json({ error: "Category not found" });
    }

    const created = await prisma.supplyProduct.create({
      data: {
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
    return res.status(201).json(created);
  } catch (e) {
    console.error("POST /api/supply/products failed", e);
    if (e.message?.includes("imagePaths")) {
      return res.status(400).json({ error: e.message });
    }
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * PUT /api/supply/products/:id
 * body: { categoryId, name, code?, price, description?, imagePaths?, isActive }
 */
router.put("/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid id" });

    const existing = await prisma.supplyProduct.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Product not found" });

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

    const categoryExists = await ensureCategoryExists(categoryId);
    if (!categoryExists) {
      return res.status(400).json({ error: "Category not found" });
    }

    const updated = await prisma.supplyProduct.update({
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
    return res.json(updated);
  } catch (e) {
    console.error("PUT /api/supply/products/:id failed", e);
    if (e.message?.includes("imagePaths")) {
      return res.status(400).json({ error: e.message });
    }
    if (e.code === "P2025") return res.status(404).json({ error: "Product not found" });
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * PATCH /api/supply/products/:id/archive
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

    const updated = await prisma.supplyProduct.update({
      where: { id },
      data: { isActive },
      include: { category: true },
    });
    return res.json(updated);
  } catch (e) {
    console.error("PATCH /api/supply/products/:id/archive failed", e);
    if (e.code === "P2025") return res.status(404).json({ error: "Product not found" });
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * DELETE /api/supply/products/:id
 */
router.delete("/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid id" });
    await prisma.supplyProduct.delete({ where: { id } });
    return res.status(204).send();
  } catch (e) {
    console.error("DELETE /api/supply/products/:id failed", e);
    if (e.code === "P2025") return res.status(404).json({ error: "Product not found" });
    return res.status(500).json({ error: "internal server error" });
  }
});

export default router;
