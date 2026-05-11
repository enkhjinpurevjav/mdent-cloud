import { describe, it } from "node:test";
import assert from "node:assert/strict";
import prisma from "../db.js";

const { default: attendanceReportRouter } = await import(
  "../routes/admin/attendanceReport.js"
);

function getSummaryHandler() {
  const layer = attendanceReportRouter.stack.find(
    (s) => s.route?.path === "/attendance/summary" && s.route?.methods?.get
  );
  assert.ok(layer, "GET /attendance/summary handler must exist");
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

describe("GET /api/admin/attendance/summary", () => {
  it("returns full-range required time + approved overtime breakdown", async () => {
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
        id: 901,
        userId: 501,
        checkInAt: new Date("2026-05-05T01:00:00.000Z"), // 09:00 UTC+8
        checkOutAt: new Date("2026-05-05T10:00:00.000Z"), // 18:00 UTC+8 => 9h
        overtimeApproved: true,
        overtimeApprovedAt: new Date("2026-05-05T12:00:00.000Z"),
        overtimeApprovedByUserId: 1,
        user: {
          id: 501,
          name: "Manager 1",
          ovog: "Test",
          email: "manager1@example.com",
          role: "manager",
        },
        branch: { id: 11, name: "Central" },
      },
      {
        id: 902,
        userId: 501,
        checkInAt: new Date("2026-05-06T01:00:00.000Z"), // 09:00 UTC+8
        checkOutAt: new Date("2026-05-06T11:00:00.000Z"), // 19:00 UTC+8 => 10h
        overtimeApproved: false,
        overtimeApprovedAt: null,
        overtimeApprovedByUserId: null,
        user: {
          id: 501,
          name: "Manager 1",
          ovog: "Test",
          email: "manager1@example.com",
          role: "manager",
        },
        branch: { id: 11, name: "Central" },
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
      const handler = getSummaryHandler();
      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.ok(Array.isArray(res.body?.items));
      assert.equal(res.body.items.length, 1);

      const row = res.body.items[0];
      assert.equal(row.userId, 501);
      assert.equal(row.requiredMinutes, 960); // 2 weekdays * 480
      assert.equal(row.workedMinutes, 1140); // 9h + 10h
      assert.equal(row.acceptedOvertimeMinutes, 60); // only approved day counts
      assert.equal(row.overtimeBreakdown.length, 1);
      assert.equal(row.overtimeBreakdown[0].date, "2026-05-05");
      assert.equal(row.overtimeBreakdown[0].durationMinutes, 60);
      assert.equal(row.overtimeBreakdown[0].sessionId, 901);
    } finally {
      prisma.user.findMany = originalUserFindMany;
      prisma.attendanceSession.findMany = originalAttendanceFindMany;
      prisma.doctorSchedule.findMany = originalDoctorFindMany;
      prisma.nurseSchedule.findMany = originalNurseFindMany;
      prisma.receptionSchedule.findMany = originalReceptionFindMany;
    }
  });
});
