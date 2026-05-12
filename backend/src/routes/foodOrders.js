import express from "express";
import { Prisma } from "@prisma/client";
import prisma from "../db.js";
import {
  ULAANBAATAR_TIMEZONE,
  getUlaanbaatarMinuteOfDay,
  getUlaanbaatarYmd,
  isFoodOrderingOpenAt,
  resolveFoodOrderTargetYmd,
  toOrderDateFromYmd,
  addDaysToYmd,
} from "../utils/foodOrderWindow.js";

const router = express.Router();
const HR_ALLOWED_ROLES = new Set(["hr", "admin", "super_admin"]);

function getRequester(req) {
  const authBypassed = process.env.DISABLE_AUTH === "true";
  const userId = req.user?.id ?? (authBypassed ? 2 : null);
  const role = req.user?.role ?? (authBypassed ? "admin" : null);
  return { userId, role };
}

function requireHrAccess(req, res) {
  const { role } = getRequester(req);
  if (!role || !HR_ALLOWED_ROLES.has(role)) {
    res.status(403).json({ error: "Зөвхөн Хүний нөөц хэрэглэгч ашиглах боломжтой." });
    return false;
  }
  return true;
}

function normalizeDateInputOrToday(value) {
  if (value && typeof value === "string") {
    return value;
  }
  return getUlaanbaatarYmd(new Date());
}

function toOrderItem(order) {
  return {
    id: order.id,
    orderDate: getUlaanbaatarYmd(order.orderDate),
    submitTimestamp: order.createdAt.toISOString(),
    quantity: order.quantity ?? 1,
  };
}

/**
 * GET /api/food-orders/status
 * Returns order window status for the current user's target order date.
 */
router.get("/status", async (req, res) => {
  try {
    const { userId } = getRequester(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const now = new Date();
    const todayYmd = getUlaanbaatarYmd(now);
    const targetOrderDateYmd = resolveFoodOrderTargetYmd(now);
    const targetOrderDate = toOrderDateFromYmd(targetOrderDateYmd);
    const orderingOpen = isFoodOrderingOpenAt(now);
    const minuteOfDay = getUlaanbaatarMinuteOfDay(now);

    const existing = await prisma.foodOrder.findUnique({
      where: {
        userId_orderDate: {
          userId,
          orderDate: targetOrderDate,
        },
      },
      select: {
        id: true,
        createdAt: true,
        orderDate: true,
        quantity: true,
      },
    });

    return res.json({
      timezone: ULAANBAATAR_TIMEZONE,
      currentDate: todayYmd,
      orderDate: targetOrderDateYmd,
      orderingOpen,
      alreadyOrdered: !!existing,
      canOrder: orderingOpen && !existing,
      nextOpenDate:
        minuteOfDay >= 21 * 60 ? addDaysToYmd(todayYmd, 1) : todayYmd,
      order: existing
        ? {
            id: existing.id,
            orderDate: getUlaanbaatarYmd(existing.orderDate),
            submitTimestamp: existing.createdAt.toISOString(),
            quantity: existing.quantity ?? 1,
          }
        : null,
    });
  } catch (err) {
    console.error("GET /api/food-orders/status error:", err);
    return res.status(500).json({ error: "Серверийн алдаа гарлаа." });
  }
});

/**
 * POST /api/food-orders
 * Creates food order for current user during open windows:
 * - 00:00-09:59 UB => today's order
 * - 21:00-23:59 UB => next day's order
 */
router.post("/", async (req, res) => {
  try {
    const { userId } = getRequester(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const now = new Date();
    if (!isFoodOrderingOpenAt(now)) {
      return res.status(403).json({
        error: "Хоол захиалга 10:00–20:59 хооронд хаалттай байна. 21:00 цагаас дахин оролдоно уу.",
      });
    }

    const orderDateYmd = resolveFoodOrderTargetYmd(now);
    const orderDate = toOrderDateFromYmd(orderDateYmd);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { branchId: true },
    });
    if (!user) {
      return res.status(404).json({ error: "Ажилтны мэдээлэл олдсонгүй." });
    }

    const created = await prisma.foodOrder.create({
      data: {
        userId,
        branchId: user.branchId ?? null,
        orderDate,
        quantity: 1,
      },
      select: {
        id: true,
        orderDate: true,
        createdAt: true,
        quantity: true,
      },
    });

    return res.status(201).json({
      message: "Таны хоол захиалга амжилттай бүртгэгдлээ",
      order: {
        id: created.id,
        orderDate: getUlaanbaatarYmd(created.orderDate),
        submitTimestamp: created.createdAt.toISOString(),
        quantity: created.quantity ?? 1,
      },
    });
  } catch (err) {
    if (err?.code === "P2002") {
      return res.status(409).json({
        error: "Энэ хоолны өдөрт таны захиалга аль хэдийн бүртгэгдсэн байна.",
      });
    }
    console.error("POST /api/food-orders error:", err);
    return res.status(500).json({ error: "Серверийн алдаа гарлаа." });
  }
});

/**
 * GET /api/food-orders/admin?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD&branchId=ID
 * HR page list grouped by employee with detailed click history.
 */
router.get("/admin", async (req, res) => {
  try {
    if (!requireHrAccess(req, res)) return;

    const fromDate = normalizeDateInputOrToday(req.query.fromDate);
    const toDate = normalizeDateInputOrToday(req.query.toDate);
    const branchIdRaw = req.query.branchId;

    const fromOrderDate = toOrderDateFromYmd(fromDate);
    const toOrderDate = toOrderDateFromYmd(toDate);
    if (fromOrderDate > toOrderDate) {
      return res.status(400).json({ error: "Эхлэх огноо дуусах огнооноос их байж болохгүй." });
    }

    const branchId = branchIdRaw ? Number(branchIdRaw) : null;
    if (branchIdRaw && Number.isNaN(branchId)) {
      return res.status(400).json({ error: "branchId буруу байна." });
    }

    const toDateExclusive = toOrderDateFromYmd(addDaysToYmd(toDate, 1));

    const orders = await prisma.foodOrder.findMany({
      where: {
        orderDate: { gte: fromOrderDate, lt: toDateExclusive },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            ovog: true,
            role: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ userId: "asc" }, { orderDate: "asc" }, { createdAt: "asc" }],
    });

    const grouped = new Map();
    for (const order of orders) {
      const key = String(order.userId);
      if (!grouped.has(key)) {
        grouped.set(key, {
          userId: order.user.id,
          name: order.user.name,
          ovog: order.user.ovog,
          role: order.user.role,
          branchId: order.branch?.id ?? null,
          branchName: order.branch?.name ?? "Салбаргүй",
          totalCount: 0,
          orders: [],
        });
      }
      const row = grouped.get(key);
      row.totalCount += order.quantity ?? 1;
      row.orders.push(toOrderItem(order));
    }

    const items = Array.from(grouped.values()).sort((a, b) => {
      const left = `${a.ovog || ""}${a.name || ""}`;
      const right = `${b.ovog || ""}${b.name || ""}`;
      return left.localeCompare(right, "mn");
    });
    const totalQuantity = orders.reduce(
      (sum, order) => sum + (order.quantity ?? 1),
      0
    );

    return res.json({
      fromDate,
      toDate,
      totalOrders: orders.length,
      totalQuantity,
      items,
    });
  } catch (err) {
    console.error("GET /api/food-orders/admin error:", err);
    return res.status(500).json({ error: "Серверийн алдаа гарлаа." });
  }
});

/**
 * PATCH /api/food-orders/admin/:id
 * HR can manually update ordered food quantity only.
 */
router.patch("/admin/:id", async (req, res) => {
  try {
    if (!requireHrAccess(req, res)) return;
    const { userId: editorId } = getRequester(req);
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: "id буруу байна." });
    }

    const quantityRaw = req.body?.quantity;
    const quantity = Number(quantityRaw);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res
        .status(400)
        .json({ error: "quantity нь 1-с их бүхэл тоо байх ёстой." });
    }

    const existing = await prisma.foodOrder.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "Хоол захиалга олдсонгүй." });
    }

    const updated = await prisma.foodOrder.update({
      where: { id },
      data: {
        quantity,
        updatedByUserId: editorId ?? null,
      },
      select: {
        id: true,
        orderDate: true,
        createdAt: true,
        quantity: true,
      },
    });

    return res.json({
      message: "Хоолны тоо амжилттай шинэчлэгдлээ.",
      order: {
        id: updated.id,
        orderDate: getUlaanbaatarYmd(updated.orderDate),
        submitTimestamp: updated.createdAt.toISOString(),
        quantity: updated.quantity ?? 1,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientValidationError) {
      return res.status(400).json({ error: "Илгээсэн өгөгдөл буруу байна." });
    }
    console.error("PATCH /api/food-orders/admin/:id error:", err);
    return res.status(500).json({ error: "Серверийн алдаа гарлаа." });
  }
});

/**
 * DELETE /api/food-orders/admin/:id
 * HR manual cancellation.
 */
router.delete("/admin/:id", async (req, res) => {
  try {
    if (!requireHrAccess(req, res)) return;
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: "id буруу байна." });
    }

    await prisma.foodOrder.delete({
      where: { id },
    });

    return res.json({ message: "Хоол захиалга цуцлагдлаа." });
  } catch (err) {
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Хоол захиалга олдсонгүй." });
    }
    console.error("DELETE /api/food-orders/admin/:id error:", err);
    return res.status(500).json({ error: "Серверийн алдаа гарлаа." });
  }
});

export default router;
