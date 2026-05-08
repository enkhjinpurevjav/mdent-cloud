import { describe, it } from "node:test";
import assert from "node:assert/strict";

const HR_ADMIN_PATH_PATTERN = /^\/users\/\d+\/password-reset$/;

function canAccessAdminApi({ role, path, disableAuth = false }) {
  if (disableAuth) return true;
  if (!role) return false;
  if (role === "admin" || role === "super_admin" || role === "marketing") {
    return true;
  }

  if (
    role === "hr" &&
    (path.startsWith("/attendance") || HR_ADMIN_PATH_PATTERN.test(path))
  ) {
    return true;
  }

  return false;
}

describe("/api/admin RBAC scoped access", () => {
  it("allows full /api/admin access for admin roles", () => {
    assert.equal(
      canAccessAdminApi({ role: "admin", path: "/payment-methods" }),
      true
    );
    assert.equal(
      canAccessAdminApi({ role: "super_admin", path: "/users/10" }),
      true
    );
    assert.equal(
      canAccessAdminApi({ role: "marketing", path: "/income/reports" }),
      true
    );
  });

  it("allows HR attendance paths only", () => {
    assert.equal(
      canAccessAdminApi({ role: "hr", path: "/attendance" }),
      true
    );
    assert.equal(
      canAccessAdminApi({ role: "hr", path: "/attendance/summary" }),
      true
    );
  });

  it("allows HR password reset endpoint only", () => {
    assert.equal(
      canAccessAdminApi({ role: "hr", path: "/users/42/password-reset" }),
      true
    );
    assert.equal(
      canAccessAdminApi({ role: "hr", path: "/users/password-reset" }),
      false
    );
    assert.equal(
      canAccessAdminApi({ role: "hr", path: "/users/abc/password-reset" }),
      false
    );
  });

  it("blocks HR from unrelated /api/admin endpoints", () => {
    assert.equal(
      canAccessAdminApi({ role: "hr", path: "/payment-methods" }),
      false
    );
    assert.equal(
      canAccessAdminApi({ role: "hr", path: "/users/42" }),
      false
    );
  });
});
