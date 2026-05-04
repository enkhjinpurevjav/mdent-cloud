import { describe, it } from "node:test";
import assert from "node:assert/strict";

function usersGateAllows({ role, method, path, query }) {
  if (role === "admin" || role === "super_admin") return true;
  if (
    role === "receptionist" &&
    method === "GET" &&
    path === "/" &&
    query?.role === "doctor"
  ) {
    return true;
  }
  if (method === "GET" && path === "/nurses/today") return true;
  if (method === "GET" && path === "/nurses/by-branch") return true;
  return false;
}

describe("/api/users RBAC gate nurse list endpoints", () => {
  it("allows authenticated non-admin roles to GET /nurses/today", () => {
    assert.equal(
      usersGateAllows({ role: "nurse", method: "GET", path: "/nurses/today", query: {} }),
      true
    );
    assert.equal(
      usersGateAllows({
        role: "receptionist",
        method: "GET",
        path: "/nurses/today",
        query: {},
      }),
      true
    );
    assert.equal(
      usersGateAllows({
        role: "marketing",
        method: "GET",
        path: "/nurses/today",
        query: {},
      }),
      true
    );
  });

  it("allows authenticated non-admin roles to GET /nurses/by-branch", () => {
    assert.equal(
      usersGateAllows({
        role: "doctor",
        method: "GET",
        path: "/nurses/by-branch",
        query: { branchId: "1" },
      }),
      true
    );
    assert.equal(
      usersGateAllows({
        role: "receptionist",
        method: "GET",
        path: "/nurses/by-branch",
        query: { branchId: "1" },
      }),
      true
    );
    assert.equal(
      usersGateAllows({
        role: "marketing",
        method: "GET",
        path: "/nurses/by-branch",
        query: { branchId: "1" },
      }),
      true
    );
  });
});
