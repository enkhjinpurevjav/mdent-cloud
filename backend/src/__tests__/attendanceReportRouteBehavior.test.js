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
    const originalUserFindMany = prisma.user.findMany;

    prisma.doctorSchedule.findMany = async () => [];
    prisma.nurseSchedule.findMany = async () => [];
    prisma.receptionSchedule.findMany = async () => [];
    prisma.user.findMany = async () => [];
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
      const target = res.body.items.find((item) => item.userId === 77);
      assert.ok(target);
      assert.equal(target.rowType, "unscheduled");
      assert.equal(target.status, "open");
      assert.equal(target.sessionCount, 2);
      assert.equal(target.durationMinutes, 60);
    } finally {
      prisma.user.findMany = originalUserFindMany;
      prisma.attendanceSession.findMany = originalAttendanceFindMany;
      prisma.doctorSchedule.findMany = originalDoctorFindMany;
      prisma.nurseSchedule.findMany = originalNurseFindMany;
      prisma.receptionSchedule.findMany = originalReceptionFindMany;
    }
  });

  it("sets weekday requiredMinutes=480 for unscheduled standard roles", async () => {
    const originalDoctorFindMany = prisma.doctorSchedule.findMany;
    const originalNurseFindMany = prisma.nurseSchedule.findMany;
    const originalReceptionFindMany = prisma.receptionSchedule.findMany;
    const originalAttendanceFindMany = prisma.attendanceSession.findMany;
    const originalUserFindMany = prisma.user.findMany;

    prisma.doctorSchedule.findMany = async () => [];
    prisma.nurseSchedule.findMany = async () => [];
    prisma.receptionSchedule.findMany = async () => [];
    prisma.user.findMany = async () => [];
    prisma.attendanceSession.findMany = async () => [
      {
        id: 5,
        userId: 88,
        checkInAt: new Date("2026-05-05T01:00:00.000Z"), // Monday 09:00 (UTC+8)
        checkOutAt: new Date("2026-05-05T09:00:00.000Z"), // Monday 17:00 (UTC+8)
        user: {
          id: 88,
          name: "Temuulen",
          ovog: "Bat",
          email: "temuulen@example.com",
          role: "other",
        },
        branch: {
          id: 4,
          name: "West",
        },
      },
    ];

    const req = {
      query: {
        fromTs: "2026-05-05T00:00:00.000Z",
        toTs: "2026-05-05T23:59:59.999Z",
      },
    };
    const res = createRes();

    try {
      const handler = getAttendanceHandler();
      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.ok(Array.isArray(res.body?.items));
      const target = res.body.items.find((item) => item.userId === 88);
      assert.ok(target);
      assert.equal(target.rowType, "unscheduled");
      assert.equal(target.requiredMinutes, 480);
      assert.equal(target.attendanceRatePercent, 100);
    } finally {
      prisma.user.findMany = originalUserFindMany;
      prisma.attendanceSession.findMany = originalAttendanceFindMany;
      prisma.doctorSchedule.findMany = originalDoctorFindMany;
      prisma.nurseSchedule.findMany = originalNurseFindMany;
      prisma.receptionSchedule.findMany = originalReceptionFindMany;
    }
  });

  it("adds absent rows for non-scheduled active roles across range", async () => {
    const originalDoctorFindMany = prisma.doctorSchedule.findMany;
    const originalNurseFindMany = prisma.nurseSchedule.findMany;
    const originalReceptionFindMany = prisma.receptionSchedule.findMany;
    const originalAttendanceFindMany = prisma.attendanceSession.findMany;
    const originalUserFindMany = prisma.user.findMany;

    prisma.doctorSchedule.findMany = async () => [];
    prisma.nurseSchedule.findMany = async () => [];
    prisma.receptionSchedule.findMany = async () => [];
    prisma.attendanceSession.findMany = async () => [];
    prisma.user.findMany = async () => [
      {
        id: 301,
        name: "Manager One",
        ovog: "A",
        email: "manager1@example.com",
        role: "manager",
        branchId: 5,
        branch: { id: 5, name: "North" },
      },
      {
        id: 302,
        name: "Other Two",
        ovog: "B",
        email: "other2@example.com",
        role: "other",
        branchId: 5,
        branch: { id: 5, name: "North" },
      },
    ];

    const req = {
      query: {
        fromTs: "2026-05-05T00:00:00.000Z",
        toTs: "2026-05-06T23:59:59.999Z",
      },
    };
    const res = createRes();

    try {
      const handler = getAttendanceHandler();
      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.ok(Array.isArray(res.body?.items));
      const targetRows = res.body.items.filter(
        (item) => item.userId === 301 || item.userId === 302
      );
      assert.ok(targetRows.length >= 4);
      assert.ok(targetRows.every((item) => item.status === "absent"));
      assert.ok(targetRows.every((item) => item.rowType === "unscheduled"));
      const dates = new Set(targetRows.map((item) => item.scheduledDate));
      assert.equal(targetRows.length, dates.size * 2);
      assert.ok(
        targetRows.every((item) => item.userRole === "manager" || item.userRole === "other")
      );
    } finally {
      prisma.user.findMany = originalUserFindMany;
      prisma.attendanceSession.findMany = originalAttendanceFindMany;
      prisma.doctorSchedule.findMany = originalDoctorFindMany;
      prisma.nurseSchedule.findMany = originalNurseFindMany;
      prisma.receptionSchedule.findMany = originalReceptionFindMany;
    }
  });
});
