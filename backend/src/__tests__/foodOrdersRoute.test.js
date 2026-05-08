import { describe, it } from "node:test";
import assert from "node:assert/strict";
import prisma from "../db.js";

const { default: foodOrdersRouter } = await import("../routes/foodOrders.js");

function getHandler(path, method) {
  const layer = foodOrdersRouter.stack.find(
    (s) => s.route?.path === path && s.route?.methods?.[method]
  );
  assert.ok(layer, `${method.toUpperCase()} ${path} handler must exist`);
  return layer.route.stack[0].handle;
}

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function withMockedNow(isoString, fn) {
  const RealDate = Date;
  const fixed = new RealDate(isoString);
  global.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) return new RealDate(fixed);
      return new RealDate(...args);
    }
    static now() {
      return fixed.getTime();
    }
    static parse(value) {
      return RealDate.parse(value);
    }
    static UTC(...args) {
      return RealDate.UTC(...args);
    }
  };
  try {
    await fn();
  } finally {
    global.Date = RealDate;
  }
}

describe("food order routes", () => {
  it("GET /status returns alreadyOrdered state for today", async () => {
    const originalFindUnique = prisma.foodOrder.findUnique;
    prisma.foodOrder.findUnique = async () => ({
      id: 12,
      orderDate: new Date("2026-05-08T00:00:00.000+08:00"),
      createdAt: new Date("2026-05-07T23:59:00.000Z"),
    });

    try {
      await withMockedNow("2026-05-08T01:30:00.000Z", async () => {
        const handler = getHandler("/status", "get");
        const req = { user: { id: 7, role: "staff" } };
        const res = createRes();
        await handler(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.orderDate, "2026-05-08");
        assert.equal(res.body.orderingOpen, true);
        assert.equal(res.body.alreadyOrdered, true);
        assert.equal(res.body.canOrder, false);
        assert.equal(res.body.order.id, 12);
      });
    } finally {
      prisma.foodOrder.findUnique = originalFindUnique;
    }
  });

  it("GET /admin groups order rows per employee", async () => {
    const originalFindMany = prisma.foodOrder.findMany;
    prisma.foodOrder.findMany = async () => [
      {
        id: 1,
        userId: 10,
        orderDate: new Date("2026-05-08T00:00:00.000+08:00"),
        createdAt: new Date("2026-05-07T23:55:00.000Z"),
        user: { id: 10, name: "Энхжин", ovog: "П", role: "nurse" },
        branch: { id: 2, name: "Салбар 2" },
      },
      {
        id: 2,
        userId: 10,
        orderDate: new Date("2026-05-09T00:00:00.000+08:00"),
        createdAt: new Date("2026-05-08T23:50:00.000Z"),
        user: { id: 10, name: "Энхжин", ovog: "П", role: "nurse" },
        branch: { id: 2, name: "Салбар 2" },
      },
      {
        id: 3,
        userId: 11,
        orderDate: new Date("2026-05-08T00:00:00.000+08:00"),
        createdAt: new Date("2026-05-07T23:45:00.000Z"),
        user: { id: 11, name: "Бат", ovog: "С", role: "doctor" },
        branch: { id: 1, name: "Салбар 1" },
      },
    ];

    try {
      const handler = getHandler("/admin", "get");
      const req = {
        user: { id: 1, role: "hr" },
        query: { fromDate: "2026-05-08", toDate: "2026-05-09" },
      };
      const res = createRes();
      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.totalOrders, 3);
      assert.equal(res.body.items.length, 2);
      assert.equal(res.body.items[0].totalCount + res.body.items[1].totalCount, 3);
      const user10 = res.body.items.find((r) => r.userId === 10);
      assert.equal(user10.totalCount, 2);
      assert.equal(user10.orders.length, 2);
    } finally {
      prisma.foodOrder.findMany = originalFindMany;
    }
  });
});
