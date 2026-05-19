import { Router } from "express";
import prisma from "../db.js";
import { requireRole } from "../middleware/auth.js";

const router = Router();
const MAX_PRODUCT_IMAGES = 3;

router.use(requireRole("admin"));

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

/**
 * GET /api/supply/categories?branchId=1&includeInactive=true
 */
router.get("/categories", async (req, res) => {
  try {
    const branchId = Number(req.query.branchId);
    const includeInactive = req.query.includeInactive === "true";
    if (!branchId || Number.isNaN(branchId)) {
      return res.status(400).json({ error: "branchId is required" });
    }

    const categories = await prisma.supplyCategory.findMany({
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
    console.error("GET /api/supply/categories failed", e);
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * POST /api/supply/categories
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

    const created = await prisma.supplyCategory.create({
      data: { branchId, name, isActive: true },
    });
    return res.status(201).json(created);
  } catch (e) {
    console.error("POST /api/supply/categories failed", e);
    if (e.code === "P2002") {
      return res.status(400).json({ error: "Category name must be unique per branch" });
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
    if (e.code === "P2002") return res.status(400).json({ error: "Category name must be unique per branch" });
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
 * GET /api/supply/products?branchId=1&categoryId=2&q=abc&onlyActive=true
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

    const products = await prisma.supplyProduct.findMany({
      where,
      include: { category: true },
      orderBy: { name: "asc" },
    });

    return res.json(products);
  } catch (e) {
    console.error("GET /api/supply/products failed", e);
    return res.status(500).json({ error: "internal server error" });
  }
});

async function ensureCategoryInBranch(categoryId, branchId) {
  const category = await prisma.supplyCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, branchId: true },
  });
  if (!category) return { ok: false, error: "Category not found" };
  if (category.branchId !== branchId) return { ok: false, error: "Category branch mismatch" };
  return { ok: true };
}

/**
 * POST /api/supply/products
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

    const categoryCheck = await ensureCategoryInBranch(categoryId, branchId);
    if (!categoryCheck.ok) {
      return res.status(400).json({ error: categoryCheck.error });
    }

    const created = await prisma.supplyProduct.create({
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
      select: { id: true, branchId: true },
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

    const categoryCheck = await ensureCategoryInBranch(categoryId, existing.branchId);
    if (!categoryCheck.ok) {
      return res.status(400).json({ error: categoryCheck.error });
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
