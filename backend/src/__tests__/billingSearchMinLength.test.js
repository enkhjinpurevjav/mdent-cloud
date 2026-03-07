/**
 * Unit tests for billing service search minimum query length.
 *
 * Mirrors the guard logic in frontend/pages/billing/[id].tsx searchServices().
 * Ensures search results are only returned for queries of length >= 1,
 * and that an empty query returns no results.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Inline guard logic mirroring searchServices() in billing/[id].tsx
//
// NOTE: The actual guard lives in a Next.js/React TypeScript component that
// cannot be imported here without a full browser/bundler setup.  This test
// therefore inlines the same one-liner so the intent and boundary are
// documented and regression-protected at the unit level.  If the guard is
// ever extracted to a shared utility it should be imported directly.
// ---------------------------------------------------------------------------

/**
 * Returns true when the query should trigger a service search (length >= 1).
 * Returns false when the query should be suppressed (empty).
 */
function shouldSearch(rawQuery) {
  const query = rawQuery.trim();
  return query.length >= 1;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("billing service search – minimum query length", () => {
  it("empty string → should NOT search", () => {
    assert.equal(shouldSearch(""), false);
  });

  it("whitespace-only string → should NOT search", () => {
    assert.equal(shouldSearch("   "), false);
  });

  it("single character → SHOULD search", () => {
    assert.equal(shouldSearch("a"), true);
  });

  it("two characters → SHOULD search", () => {
    assert.equal(shouldSearch("ab"), true);
  });

  it("longer query → SHOULD search", () => {
    assert.equal(shouldSearch("dental"), true);
  });

  it("single character with surrounding whitespace → SHOULD search (trimmed)", () => {
    assert.equal(shouldSearch("  x  "), true);
  });

  it("single space after trimming → should NOT search", () => {
    assert.equal(shouldSearch(" "), false);
  });
});
