import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import prisma from "../db.js";
import { getAdjustmentTotalsByPatient } from "../routes/reports-patient-balances.js";

let originalQueryRaw;
let originalConsoleError;

beforeEach(() => {
  originalQueryRaw = prisma.$queryRaw;
  originalConsoleError = console.error;
});

afterEach(() => {
  prisma.$queryRaw = originalQueryRaw;
  console.error = originalConsoleError;
});

describe("getAdjustmentTotalsByPatient", () => {
  it("maps grouped SQL sums by patient id with numeric conversion", async () => {
    prisma.$queryRaw = async () => Promise.resolve([
      { patientId: 11, sum: "100.50" },
      { patientId: "12", sum: "-42" },
    ]);

    const result = await getAdjustmentTotalsByPatient();

    assert.equal(result.get(11), 100.5);
    assert.equal(result.get(12), -42);
  });

  it("logs and returns empty map on query failure", async () => {
    prisma.$queryRaw = async () => {
      throw new Error("db failure");
    };

    const messages = [];
    console.error = (...args) => {
      messages.push(args.join(" "));
    };

    const result = await getAdjustmentTotalsByPatient();

    assert.equal(result.size, 0);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /adjustment aggregation failed/i);
    assert.match(messages[0], /db failure/);
  });

  it("applies optional branch filter when branch id is valid", async () => {
    let queryArg;
    prisma.$queryRaw = async (arg) => {
      queryArg = arg;
      return Promise.resolve([]);
    };

    await getAdjustmentTotalsByPatient(7);

    assert.deepEqual(queryArg?.values, [7]);
  });

  it("omits branch filter when branch id is missing or invalid", async () => {
    const captured = [];
    prisma.$queryRaw = async (arg) => {
      captured.push(arg);
      return Promise.resolve([]);
    };

    await getAdjustmentTotalsByPatient();
    await getAdjustmentTotalsByPatient("abc");

    assert.deepEqual(captured[0]?.values, []);
    assert.deepEqual(captured[1]?.values, []);
  });
});
