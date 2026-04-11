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

    const result = await getAdjustmentTotalsByPatient([11, 12]);

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

    const result = await getAdjustmentTotalsByPatient([1]);

    assert.equal(result.size, 0);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /adjustment aggregation failed/i);
    assert.match(messages[0], /db failure/);
  });

  it("filters invalid patient ids before query", async () => {
    let callCount = 0;
    prisma.$queryRaw = async () => {
      callCount += 1;
      return Promise.resolve([]);
    };

    const result = await getAdjustmentTotalsByPatient([0, -1, "abc", null]);

    assert.equal(result.size, 0);
    assert.equal(callCount, 0);
  });

  it("deduplicates valid patient ids before query", async () => {
    let queryArg;
    prisma.$queryRaw = async (arg) => {
      queryArg = arg;
      return Promise.resolve([]);
    };

    await getAdjustmentTotalsByPatient([5, "5", 5, 6, "6"]);

    assert.deepEqual(queryArg?.values, [5, 6]);
  });
});
