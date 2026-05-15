import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeRegNo, parseRegNo } from "../utils/regno.js";

describe("regNo normalization", () => {
  it("normalizes case and removes whitespace", () => {
    assert.equal(normalizeRegNo(" уб 99112233 "), "УБ99112233");
    assert.equal(normalizeRegNo("УБ\t9911 2233"), "УБ99112233");
  });

  it("lets parseRegNo accept spaced and lowercase input", () => {
    const parsed = parseRegNo(" ук 21290801 ");
    assert.equal(parsed.isValid, true);
  });

  it("still rejects invalid format after normalization", () => {
    const parsed = parseRegNo("AB-123");
    assert.equal(parsed.isValid, false);
  });
});
