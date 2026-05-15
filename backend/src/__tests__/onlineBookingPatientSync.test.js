import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ensureOnlineBookingPatientForPayment } from "../services/onlineBookingPatientSync.js";

function createBaseTx(overrides = {}) {
  return {
    booking: {
      findUnique: async () => null,
      update: async () => null,
      ...(overrides.booking || {}),
    },
    onlineBookingDraft: {
      findUnique: async () => null,
      update: async () => null,
      ...(overrides.onlineBookingDraft || {}),
    },
    patient: {
      findUnique: async () => null,
      create: async () => null,
      ...(overrides.patient || {}),
    },
    patientBook: {
      findUnique: async () => null,
      findFirst: async () => ({ bookNumber: "000100" }),
      create: async () => ({ id: 999 }),
      ...(overrides.patientBook || {}),
    },
    $queryRaw: async () => [],
    ...(overrides.$queryRaw ? { $queryRaw: overrides.$queryRaw } : {}),
  };
}

describe("ensureOnlineBookingPatientForPayment", () => {
  it("links existing matched patient from draft and updates booking patientId", async () => {
    let bookingUpdatePayload = null;

    const tx = createBaseTx({
      booking: {
        findUnique: async () => ({
          id: 1001,
          branchId: 1,
          patientId: 501,
          note: "Онлайн захиалга",
          patient: { id: 501, name: "ONLINE", ovog: "BOOKING" },
          onlineBookingDraft: {
            id: 2001,
            matchedPatientId: 77,
            matchStatus: "EXISTING",
            ovog: "Пүрэв",
            name: "Энхжин",
            phone: "99112233",
            regNoRaw: "УБ99112233",
            regNoNormalized: "УБ99112233",
          },
        }),
        update: async ({ data }) => {
          bookingUpdatePayload = data;
          return { id: 1001 };
        },
      },
      patient: {
        findUnique: async ({ where }) => {
          if (where?.id === 77) return { id: 77 };
          return null;
        },
      },
      patientBook: {
        findUnique: async ({ where }) => {
          if (where?.patientId === 77) return { id: 7001 };
          return null;
        },
      },
    });

    const patientId = await ensureOnlineBookingPatientForPayment(tx, 1001);

    assert.equal(patientId, 77);
    assert.deepEqual(bookingUpdatePayload, { patientId: 77 });
  });

  it("creates new patient from online note when no match exists", async () => {
    let createdPatientData = null;
    let bookingUpdatePayload = null;
    let createdPatientBookData = null;

    const tx = createBaseTx({
      booking: {
        findUnique: async () => ({
          id: 1002,
          branchId: 3,
          patientId: 503,
          note: [
            "Онлайн захиалгаар оруулсан мэдээлэл:",
            "Овог: Бат",
            "Нэр: Дорж",
            "Утас: 99112233",
            "РД: УБ99112233",
          ].join("\n"),
          patient: { id: 503, name: "ONLINE", ovog: "BOOKING" },
          onlineBookingDraft: null,
        }),
        update: async ({ data }) => {
          bookingUpdatePayload = data;
          return { id: 1002 };
        },
      },
      patient: {
        create: async ({ data }) => {
          createdPatientData = data;
          return { id: 88 };
        },
      },
      patientBook: {
        findUnique: async () => null,
        findFirst: async () => ({ bookNumber: "000310" }),
        create: async ({ data }) => {
          createdPatientBookData = data;
          return { id: 8310 };
        },
      },
      $queryRaw: async () => [],
    });

    const patientId = await ensureOnlineBookingPatientForPayment(tx, 1002);

    assert.equal(patientId, 88);
    assert.equal(createdPatientData.branchId, 3);
    assert.equal(createdPatientData.ovog, "Бат");
    assert.equal(createdPatientData.name, "Дорж");
    assert.equal(createdPatientData.phone, "99112233");
    assert.equal(createdPatientData.regNo, "УБ99112233");
    assert.deepEqual(bookingUpdatePayload, { patientId: 88 });
    assert.deepEqual(createdPatientBookData, { patientId: 88, bookNumber: "000311" });
  });

  it("keeps existing non-placeholder booking patient and only ensures patientBook", async () => {
    let bookingUpdated = false;
    let patientCreated = false;

    const tx = createBaseTx({
      booking: {
        findUnique: async () => ({
          id: 1003,
          branchId: 1,
          patientId: 42,
          note: null,
          patient: { id: 42, name: "Энхжин", ovog: "Пүрэв" },
          onlineBookingDraft: null,
        }),
        update: async () => {
          bookingUpdated = true;
          return { id: 1003 };
        },
      },
      patient: {
        create: async () => {
          patientCreated = true;
          return { id: 9999 };
        },
      },
      patientBook: {
        findUnique: async ({ where }) => {
          if (where?.patientId === 42) return { id: 4201 };
          return null;
        },
      },
    });

    const patientId = await ensureOnlineBookingPatientForPayment(tx, 1003);

    assert.equal(patientId, 42);
    assert.equal(bookingUpdated, false);
    assert.equal(patientCreated, false);
  });
});
