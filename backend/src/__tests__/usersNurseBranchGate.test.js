import { describe, it } from "node:test";
import assert from "node:assert/strict";

function usersGateAllows({ role, method, path, query }) {
  if (role === "admin" || role === "super_admin" || role === "hr") return true;
  if (
    role === "receptionist" &&
    method === "GET" &&
    path === "/" &&
    query?.role === "doctor"
  ) {
    return true;
  }
  if (role === "sterilization" && method === "GET" && path === "/") {
    return (
      query?.role === "doctor" ||
      query?.role === "nurse" ||
      query?.role === "sterilization"
    );
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

  it("allows HR full access to /api/users endpoints", () => {
    assert.equal(
      usersGateAllows({
        role: "hr",
        method: "GET",
        path: "/",
        query: {},
      }),
      true
    );
    assert.equal(
      usersGateAllows({
        role: "hr",
        method: "POST",
        path: "/",
        query: {},
      }),
      true
    );
  });

  it("allows sterilization read-only role-filtered lookups", () => {
    assert.equal(
      usersGateAllows({
        role: "sterilization",
        method: "GET",
        path: "/",
        query: { role: "doctor" },
      }),
      true
    );
    assert.equal(
      usersGateAllows({
        role: "sterilization",
        method: "GET",
        path: "/",
        query: { role: "nurse" },
      }),
      true
    );
    assert.equal(
      usersGateAllows({
        role: "sterilization",
        method: "GET",
        path: "/",
        query: { role: "sterilization", branchId: "1" },
      }),
      true
    );
  });

  it("blocks sterilization from non-scoped /api/users access", () => {
    assert.equal(
      usersGateAllows({
        role: "sterilization",
        method: "POST",
        path: "/",
        query: {},
      }),
      false
    );
    assert.equal(
      usersGateAllows({
        role: "sterilization",
        method: "GET",
        path: "/",
        query: {},
      }),
      false
    );
    assert.equal(
      usersGateAllows({
        role: "sterilization",
        method: "GET",
        path: "/",
        query: { role: "admin" },
      }),
      false
    );
  });
});
