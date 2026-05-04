import { describe, it } from "node:test";
import assert from "node:assert/strict";

function canAccessAdminHome(role) {
  return ["admin", "super_admin", "marketing"].includes(role);
}

describe("dashboard admin-home role access", () => {
  it("allows admin", () => {
    assert.equal(canAccessAdminHome("admin"), true);
  });

  it("allows super_admin", () => {
    assert.equal(canAccessAdminHome("super_admin"), true);
  });

  it("allows marketing", () => {
    assert.equal(canAccessAdminHome("marketing"), true);
  });

  it("blocks receptionist", () => {
    assert.equal(canAccessAdminHome("receptionist"), false);
  });
});
