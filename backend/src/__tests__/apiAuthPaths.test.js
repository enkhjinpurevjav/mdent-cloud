import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isBranchKioskApiPath } from "../utils/apiAuthPaths.js";

describe("api auth path helpers", () => {
  it("skips auth for branch kiosk routes only", () => {
    assert.equal(isBranchKioskApiPath("/branch"), true);
    assert.equal(isBranchKioskApiPath("/branch/doctor/me"), true);
    assert.equal(isBranchKioskApiPath("/branch-nurse"), false);
    assert.equal(isBranchKioskApiPath("/branch-announce"), false);
  });
});
