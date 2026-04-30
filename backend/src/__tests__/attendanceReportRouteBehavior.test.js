import { describe, it } from "node:test";
import assert from "node:assert/strict";
import prisma from "../db.js";

const { default: attendanceReportRouter } = await import(
  "../routes/admin/attendanceReport.js"
);

function getAttendanceHandler() {
  const layer = attendanceReportRouter.stack.find(
    (s) => s.route?.path === "/attendance" && s.route?.methods?.get
  );
  assert.ok(layer, "GET /attendance handler must exist");
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

describe("GET /api/admin/attendance route behavior", () => {
  it("returns unscheduled open status when unscheduled day has an open session", async () => {
    const originalDoctorFindMany = prisma.doctorSchedule.findMany;
    const originalNurseFindMany = prisma.nurseSchedule.findMany;
    const originalReceptionFindMany = prisma.receptionSchedule.findMany;
    const originalAttendanceFindMany = prisma.attendanceSession.findMany;

    prisma.doctorSchedule.findMany = async () => [];
    prisma.nurseSchedule.findMany = async () => [];
    prisma.receptionSchedule.findMany = async () => [];
    prisma.attendanceSession.findMany = async () => [
      {
        id: 1,
        userId: 77,
        checkInAt: new Date("2026-05-01T00:00:00.000Z"),
        checkOutAt: new Date("2026-05-01T01:00:00.000Z"),
        user: {
          id: 77,
          name: "Bat",
          ovog: "Dorj",
          email: "bat@example.com",
          role: "doctor",
        },
        branch: {
          id: 3,
          name: "Central",
        },
      },
      {
        id: 2,
        userId: 77,
        checkInAt: new Date("2026-05-01T02:00:00.000Z"),
        checkOutAt: null,
        user: {
          id: 77,
          name: "Bat",
          ovog: "Dorj",
          email: "bat@example.com",
          role: "doctor",
        },
        branch: {
          id: 3,
          name: "Central",
        },
      },
    ];

    const req = {
      query: {
        fromTs: "2026-05-01T00:00:00.000Z",
        toTs: "2026-05-01T23:59:59.999Z",
      },
    };
    const res = createRes();

    try {
      const handler = getAttendanceHandler();
      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.ok(Array.isArray(res.body?.items));
      assert.equal(res.body.items.length, 1);
      assert.equal(res.body.items[0].rowType, "unscheduled");
      assert.equal(res.body.items[0].status, "open");
      assert.equal(res.body.items[0].sessionCount, 2);
      assert.equal(res.body.items[0].durationMinutes, 60);
    } finally {
      prisma.attendanceSession.findMany = originalAttendanceFindMany;
      prisma.doctorSchedule.findMany = originalDoctorFindMany;
      prisma.nurseSchedule.findMany = originalNurseFindMany;
      prisma.receptionSchedule.findMany = originalReceptionFindMany;
    }
  });
});
