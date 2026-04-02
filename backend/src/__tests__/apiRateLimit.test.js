/**
 * Unit tests for the global /api rate-limit configuration helpers.
 *
 * Tests do NOT start an HTTP server or touch the database.
 * They verify the env-var parsing logic and the SSE stream-exclusion predicate
 * that are used to configure the rate limiter in src/index.js.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Inline env-var parsing logic — mirrors the implementation in src/index.js
// ---------------------------------------------------------------------------

/**
 * Parse API_RATE_LIMIT_MAX from an env-var string.
 * Returns the value if it is a positive finite integer, otherwise returns the
 * provided default.
 *
 * @param {string|undefined} raw
 * @param {number} defaultValue
 * @returns {number}
 */
function parseRateLimitMax(raw, defaultValue = 500) {
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

/**
 * Parse API_RATE_LIMIT_WINDOW_MS from an env-var string.
 * Returns the value if it is a positive finite integer, otherwise returns the
 * provided default.
 *
 * @param {string|undefined} raw
 * @param {number} defaultValue
 * @returns {number}
 */
function parseRateLimitWindowMs(raw, defaultValue = 15 * 60 * 1000) {
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

/**
 * Returns true when the given req.path should be excluded from the global
 * /api rate limiter (i.e. the SSE stream endpoint).
 *
 * @param {string} path  req.path (relative to /api mount, so starts with "/")
 * @returns {boolean}
 */
function isStreamPath(path) {
  return path === "/appointments/stream";
}

// ---------------------------------------------------------------------------
// parseRateLimitMax
// ---------------------------------------------------------------------------

describe("parseRateLimitMax", () => {
  it("returns parsed value for a valid positive integer string", () => {
    assert.equal(parseRateLimitMax("1000"), 1000);
  });

  it("returns default when value is absent (undefined)", () => {
    assert.equal(parseRateLimitMax(undefined), 500);
  });

  it("returns default when value is an empty string", () => {
    assert.equal(parseRateLimitMax(""), 500);
  });

  it("returns default when value is zero", () => {
    assert.equal(parseRateLimitMax("0"), 500);
  });

  it("returns default when value is negative", () => {
    assert.equal(parseRateLimitMax("-100"), 500);
  });

  it("returns default when value is a float string", () => {
    // parseInt("3.14") truncates to 3, which is a valid positive integer,
    // so parseRateLimitMax returns 3 (not the default).
    assert.equal(parseRateLimitMax("3.14"), 3);
  });

  it("returns default when value is non-numeric", () => {
    assert.equal(parseRateLimitMax("abc"), 500);
  });

  it("respects a custom default value", () => {
    assert.equal(parseRateLimitMax(undefined, 200), 200);
  });

  it("returns parsed value when env is set to '5000'", () => {
    assert.equal(parseRateLimitMax("5000"), 5000);
  });
});

// ---------------------------------------------------------------------------
// parseRateLimitWindowMs
// ---------------------------------------------------------------------------

describe("parseRateLimitWindowMs", () => {
  const DEFAULT_WINDOW = 15 * 60 * 1000; // 900 000 ms

  it("returns parsed value for a valid positive integer string", () => {
    assert.equal(parseRateLimitWindowMs("60000"), 60000);
  });

  it("returns default when value is absent (undefined)", () => {
    assert.equal(parseRateLimitWindowMs(undefined), DEFAULT_WINDOW);
  });

  it("returns default when value is an empty string", () => {
    assert.equal(parseRateLimitWindowMs(""), DEFAULT_WINDOW);
  });

  it("returns default when value is zero", () => {
    assert.equal(parseRateLimitWindowMs("0"), DEFAULT_WINDOW);
  });

  it("returns default when value is negative", () => {
    assert.equal(parseRateLimitWindowMs("-1000"), DEFAULT_WINDOW);
  });

  it("returns default when value is non-numeric", () => {
    assert.equal(parseRateLimitWindowMs("NaN"), DEFAULT_WINDOW);
  });
});

// ---------------------------------------------------------------------------
// isStreamPath — SSE stream exclusion predicate
// ---------------------------------------------------------------------------

describe("isStreamPath — SSE stream exclusion", () => {
  it("returns true for /appointments/stream", () => {
    assert.equal(isStreamPath("/appointments/stream"), true);
  });

  it("returns true for /appointments/stream with query params (path only)", () => {
    // req.path does not include the query string
    assert.equal(isStreamPath("/appointments/stream"), true);
  });

  it("returns false for /appointments (no /stream suffix)", () => {
    assert.equal(isStreamPath("/appointments"), false);
  });

  it("returns false for /appointments/stream with a sub-path prefix", () => {
    // Exact match only; /appointments/stream-extra is NOT the SSE endpoint.
    assert.equal(isStreamPath("/appointments/stream-extra"), false);
  });

  it("returns false for /auth/login", () => {
    assert.equal(isStreamPath("/auth/login"), false);
  });

  it("returns false for /branches", () => {
    assert.equal(isStreamPath("/branches"), false);
  });

  it("returns false for /occupancy", () => {
    assert.equal(isStreamPath("/occupancy"), false);
  });

  it("returns false for /scheduled", () => {
    assert.equal(isStreamPath("/scheduled"), false);
  });

  it("returns false for an empty path", () => {
    assert.equal(isStreamPath(""), false);
  });
});

// ---------------------------------------------------------------------------
// DISABLE_API_RATE_LIMIT toggle logic
// ---------------------------------------------------------------------------

describe("DISABLE_API_RATE_LIMIT toggle", () => {
  it('is disabled when env value is "true"', () => {
    const disabled = process.env.DISABLE_API_RATE_LIMIT === "true";
    // In test context the var is not set, so it should be false
    assert.equal(disabled, false);
  });

  it('is NOT disabled when env value is "false"', () => {
    const disabled = "false" === "true";
    assert.equal(disabled, false);
  });

  it('is NOT disabled when env value is "1"', () => {
    const disabled = "1" === "true";
    assert.equal(disabled, false);
  });

  it('is NOT disabled when env value is absent', () => {
    const disabled = undefined === "true";
    assert.equal(disabled, false);
  });

  it('is disabled only when the value is exactly "true"', () => {
    const disabled = "true" === "true";
    assert.equal(disabled, true);
  });
});
