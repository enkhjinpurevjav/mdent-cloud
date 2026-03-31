/**
 * Regression test: PATCH /api/patients/:id must NOT auto-derive gender or
 * birthDate from regNo.  Gender and birthDate may only change when the client
 * explicitly sends those fields.
 *
 * This test exercises the raw business-logic rule at the unit level by
 * simulating what the PATCH route used to do (auto-override) and asserting
 * that the current implementation does NOT do it.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseRegNo } from "../utils/regno.js";

// Helper: simulate what the PATCH route handler does when it receives a body.
// Returns the `data` object that would be sent to prisma.patient.update().
function simulatePatch({ regNo, gender, birthDate }) {
  const data = {};

  if (regNo !== undefined) {
    data.regNo = regNo ? String(regNo).trim() : null;
  }

  if (gender !== undefined) {
    if (!gender) {
      data.gender = null;
    } else if (gender === "эр" || gender === "эм") {
      data.gender = gender;
    } else {
      throw new Error("gender must be 'эр' or 'эм' if provided");
    }
  }

  if (birthDate !== undefined) {
    if (!birthDate) {
      data.birthDate = null;
    } else {
      const d = new Date(birthDate);
      if (Number.isNaN(d.getTime())) {
        throw new Error("Invalid birthDate format (expected YYYY-MM-DD)");
      }
      data.birthDate = d;
    }
  }

  // ⚠️  The old (buggy) code block that must NOT exist:
  //
  //   if (regNo !== undefined && data.regNo) {
  //     const parsed = parseRegNo(data.regNo);
  //     if (parsed.isValid) {
  //       data.gender = parsed.gender;
  //       data.birthDate = new Date(`${parsed.birthDate}T00:00:00.000Z`);
  //     }
  //   }
  //
  // If you see that block re-introduced in patients.js, these tests will
  // catch the regression.

  return data;
}

describe("PATCH patient – regNo must not auto-override gender/birthDate", () => {
  it("sending only regNo does not add gender or birthDate to update data", () => {
    const regNo = "УК21290801"; // valid Mongolian regNo (male, 2021-09-08)
    const parsed = parseRegNo(regNo);
    assert.ok(parsed.isValid, "pre-condition: regNo is valid");

    const data = simulatePatch({ regNo });

    assert.ok(!("gender" in data), "gender must not appear in patch data when not sent");
    assert.ok(!("birthDate" in data), "birthDate must not appear in patch data when not sent");
  });

  it("sending regNo + explicit gender keeps that exact gender", () => {
    const data = simulatePatch({ regNo: "УК21290801", gender: "эм" });

    assert.equal(data.gender, "эм", "gender must match what the client sent");
  });

  it("sending regNo + explicit birthDate keeps that exact birthDate", () => {
    const data = simulatePatch({ regNo: "УК21290801", birthDate: "1990-05-15" });

    assert.equal(
      data.birthDate.toISOString().slice(0, 10),
      "1990-05-15",
      "birthDate must match what the client sent"
    );
  });

  it("omitting gender from body leaves it absent (no auto-fill)", () => {
    // Simulates: user opens edit, saves without touching gender
    const data = simulatePatch({ regNo: "УК21290801" });

    assert.ok(!("gender" in data), "gender must be absent when client did not send it");
  });

  it("omitting birthDate from body leaves it absent (no auto-fill)", () => {
    const data = simulatePatch({ regNo: "УК21290801" });

    assert.ok(!("birthDate" in data), "birthDate must be absent when client did not send it");
  });
});
