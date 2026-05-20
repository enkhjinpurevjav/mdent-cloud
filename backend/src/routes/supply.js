import { Router } from "express";
import prisma from "../db.js";
import { requireRole } from "../middleware/auth.js";

const router = Router();
const MAX_PRODUCT_IMAGES = 3;
const MAX_LIMIT = 100;
const WALLET_ID = 1;

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

function parseMoneyAmount(raw, fieldName) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${fieldName} must be a non-negative number`);
  }
  return Number(n.toFixed(2));
}

function parseStockAmount(raw, fieldName) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${fieldName} must be a non-negative number`);
  }
  return Number(n.toFixed(2));
}

function almostEqual(a, b) {
  return Math.abs(a - b) < 0.01;
}

async function ensureCategoryExists(categoryId) {
  const category = await prisma.supplyCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  return Boolean(category);
}

async function ensureWallet(prismaTx) {
  const existing = await prismaTx.supplyWallet.findUnique({ where: { id: WALLET_ID } });
  if (existing) return existing;
  return prismaTx.supplyWallet.create({
    data: {
      id: WALLET_ID,
      currentBalance: 0,
    },
  });
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

/**
 * GET /api/supply/wallet
 */
router.get("/wallet", async (_req, res) => {
  try {
    const wallet = await prisma.supplyWallet.upsert({
      where: { id: WALLET_ID },
      update: {},
      create: { id: WALLET_ID, currentBalance: 0 },
    });
    return res.json(wallet);
  } catch (e) {
    console.error("GET /api/supply/wallet failed", e);
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * PUT /api/supply/wallet
 * body: { amount }
 */
router.put("/wallet", async (req, res) => {
  try {
    const amount = parseMoneyAmount(req.body?.amount, "amount");
    const userId = Number(req.user?.id);
    if (!userId || Number.isNaN(userId)) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await ensureWallet(tx);
      const nextBalance = Number(amount.toFixed(2));
      const delta = Number((nextBalance - Number(wallet.currentBalance || 0)).toFixed(2));

      const updatedWallet = await tx.supplyWallet.update({
        where: { id: WALLET_ID },
        data: { currentBalance: nextBalance },
      });

      await tx.supplyWalletTransaction.create({
        data: {
          delta,
          balanceAfter: nextBalance,
          reason: "ADMIN_SET_BALANCE",
          createdByUserId: userId,
        },
      });

      return updatedWallet;
    });

    return res.json(result);
  } catch (e) {
    console.error("PUT /api/supply/wallet failed", e);
    if (e.message?.includes("amount")) {
      return res.status(400).json({ error: e.message });
    }
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * POST /api/supply/checkout
 * body: {
 *   items: [{ productId, qty }],
 *   walletAmount: number,
 *   transferAmount: number
 * }
 */
router.post("/checkout", async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    if (!userId || Number.isNaN(userId)) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const itemsRaw = Array.isArray(req.body?.items) ? req.body.items : [];
    if (itemsRaw.length === 0) {
      return res.status(400).json({ error: "items are required" });
    }

    const items = itemsRaw.map((item) => ({
      productId: Number(item?.productId),
      qty: Number(item?.qty),
    }));
    if (items.some((x) => !x.productId || Number.isNaN(x.productId) || !Number.isInteger(x.qty) || x.qty <= 0)) {
      return res.status(400).json({ error: "items format is invalid" });
    }

    const walletAmount = parseMoneyAmount(req.body?.walletAmount ?? 0, "walletAmount");
    const transferAmount = parseMoneyAmount(req.body?.transferAmount ?? 0, "transferAmount");

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await ensureWallet(tx);
      const productIds = [...new Set(items.map((x) => x.productId))];
      const products = await tx.supplyProduct.findMany({
        where: { id: { in: productIds }, isActive: true },
      });
      if (products.length !== productIds.length) {
        throw new Error("Some products are missing or inactive");
      }

      const productMap = new Map(products.map((p) => [p.id, p]));
      const orderItems = items.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new Error("Some products are missing or inactive");
        }
        const unitPrice = Number(product.price);
        const lineTotal = Number((unitPrice * item.qty).toFixed(2));
        return {
          productId: item.productId,
          qty: item.qty,
          unitPrice,
          lineTotal,
        };
      });
      const totalAmount = Number(
        orderItems.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2)
      );
      const paymentTotal = Number((walletAmount + transferAmount).toFixed(2));

      if (!almostEqual(totalAmount, paymentTotal)) {
        throw new Error("walletAmount + transferAmount must equal total amount");
      }
      if (walletAmount > Number(wallet.currentBalance || 0)) {
        throw new Error("wallet balance is insufficient");
      }

      const order = await tx.supplyOrder.create({
        data: {
          totalAmount,
          walletAmount,
          transferAmount,
          status: "COMPLETED",
          createdByUserId: userId,
          items: {
            create: orderItems,
          },
        },
        include: { items: true },
      });

      let nextBalance = Number(wallet.currentBalance || 0);
      if (walletAmount > 0) {
        nextBalance = Number((nextBalance - walletAmount).toFixed(2));
        await tx.supplyWallet.update({
          where: { id: WALLET_ID },
          data: { currentBalance: nextBalance },
        });
        await tx.supplyWalletTransaction.create({
          data: {
            orderId: order.id,
            delta: Number((-walletAmount).toFixed(2)),
            balanceAfter: nextBalance,
            reason: "CHECKOUT_WALLET_DEDUCTION",
            createdByUserId: userId,
          },
        });
      }

      return {
        orderId: order.id,
        totalAmount,
        walletAmount,
        transferAmount,
        walletBalance: nextBalance,
      };
    });

    return res.status(201).json(result);
  } catch (e) {
    console.error("POST /api/supply/checkout failed", e);
    if (
      e.message?.includes("items") ||
      e.message?.includes("walletAmount") ||
      e.message?.includes("transferAmount") ||
      e.message?.includes("wallet balance") ||
      e.message?.includes("Some products") ||
      e.message?.includes("must equal total amount")
    ) {
      return res.status(400).json({ error: e.message });
    }
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * GET /api/supply/inventory?includeInactive=true
 * Returns categorized stock rows for supply products.
 */
router.get("/inventory", async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const products = await prisma.supplyProduct.findMany({
      where: includeInactive
        ? undefined
        : {
            isActive: true,
            category: { isActive: true },
          },
      include: {
        category: true,
        inventory: true,
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    });

    const orderedItems = await prisma.supplyOrderItem.findMany({
      where: {
        order: {
          status: "COMPLETED",
        },
      },
      select: {
        productId: true,
        qty: true,
      },
    });

    const orderedByProduct = new Map();
    for (const row of orderedItems) {
      const prev = orderedByProduct.get(row.productId) || 0;
      orderedByProduct.set(row.productId, Number((prev + Number(row.qty || 0)).toFixed(2)));
    }

    const grouped = new Map();
    for (const product of products) {
      const openingBalance = Number(product.inventory?.openingBalance || 0);
      const consumed = Number(product.inventory?.consumed || 0);
      const additionalOrdered = Number(orderedByProduct.get(product.id) || 0);
      const totalBalance = Number((openingBalance + additionalOrdered).toFixed(2));
      const currentBalance = Number((totalBalance - consumed).toFixed(2));

      const row = {
        id: product.id,
        name: product.name,
        code: product.code,
        isActive: product.isActive,
        openingBalance,
        additionalOrdered,
        totalBalance,
        consumed,
        currentBalance,
        updatedAt: product.inventory?.updatedAt || null,
      };

      const catKey = product.categoryId;
      if (!grouped.has(catKey)) {
        grouped.set(catKey, {
          id: product.category.id,
          name: product.category.name,
          isActive: product.category.isActive,
          products: [],
        });
      }
      grouped.get(catKey).products.push(row);
    }

    return res.json({
      categories: Array.from(grouped.values()),
    });
  } catch (e) {
    console.error("GET /api/supply/inventory failed", e);
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * PUT /api/supply/inventory/:productId
 * body: { openingBalance, consumed }
 */
router.put("/inventory/:productId", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    if (!productId || Number.isNaN(productId)) {
      return res.status(400).json({ error: "invalid productId" });
    }

    const openingBalance = parseStockAmount(
      req.body?.openingBalance ?? 0,
      "openingBalance"
    );
    const consumed = parseStockAmount(req.body?.consumed ?? 0, "consumed");
    const userId = Number(req.user?.id);
    if (!userId || Number.isNaN(userId)) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const productExists = await prisma.supplyProduct.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!productExists) {
      return res.status(404).json({ error: "Product not found" });
    }

    const saved = await prisma.supplyInventory.upsert({
      where: { productId },
      update: {
        openingBalance,
        consumed,
        updatedByUserId: userId,
      },
      create: {
        productId,
        openingBalance,
        consumed,
        updatedByUserId: userId,
      },
    });

    return res.json(saved);
  } catch (e) {
    console.error("PUT /api/supply/inventory/:productId failed", e);
    if (e.message?.includes("openingBalance") || e.message?.includes("consumed")) {
      return res.status(400).json({ error: e.message });
    }
    return res.status(500).json({ error: "internal server error" });
  }
});

/**
 * GET /api/supply/orders?limit=20
 * Returns current user's supply order history.
 */
router.get("/orders", async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    if (!userId || Number.isNaN(userId)) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const limit = parseLimit(req.query.limit) ?? 20;
    const orders = await prisma.supplyOrder.findMany({
      where: { createdByUserId: userId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true },
            },
          },
          orderBy: { id: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return res.json(orders);
  } catch (e) {
    console.error("GET /api/supply/orders failed", e);
    if (e.message?.includes("limit")) {
      return res.status(400).json({ error: e.message });
    }
    return res.status(500).json({ error: "internal server error" });
  }
});

export default router;
