import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSessionCookieOptions,
  shouldUseSecureCookie,
  resolveCookieDomain,
} from "../utils/authCookieOptions.js";

describe("shouldUseSecureCookie", () => {
  it("defaults to secure=true in production", () => {
    assert.equal(
      shouldUseSecureCookie({ nodeEnv: "production", cookieSecure: undefined }),
      true
    );
  });

  it("defaults to secure=false outside production", () => {
    assert.equal(
      shouldUseSecureCookie({ nodeEnv: "development", cookieSecure: undefined }),
      false
    );
  });

  it("honors COOKIE_SECURE override to true", () => {
    assert.equal(
      shouldUseSecureCookie({ nodeEnv: "development", cookieSecure: "true" }),
      true
    );
  });

  it("honors COOKIE_SECURE override to false", () => {
    assert.equal(
      shouldUseSecureCookie({ nodeEnv: "production", cookieSecure: "false" }),
      false
    );
  });
});

describe("resolveCookieDomain", () => {
  it("uses explicit COOKIE_DOMAIN when provided", () => {
    assert.equal(
      resolveCookieDomain({ nodeEnv: "development", cookieDomain: "mdent.cloud" }),
      "mdent.cloud"
    );
  });

  it("defaults to .mdent.cloud in production", () => {
    assert.equal(
      resolveCookieDomain({ nodeEnv: "production", cookieDomain: "" }),
      ".mdent.cloud"
    );
  });

  it("returns undefined in development when domain is absent", () => {
    assert.equal(
      resolveCookieDomain({ nodeEnv: "development", cookieDomain: "" }),
      undefined
    );
  });
});

describe("buildSessionCookieOptions", () => {
  it("builds cookie options with secure override and maxAge", () => {
    const options = buildSessionCookieOptions({
      nodeEnv: "production",
      cookieSecure: "false",
      cookieDomain: "mdent.cloud",
      maxAge: 1000,
    });

    assert.deepEqual(options, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      domain: "mdent.cloud",
      path: "/",
      maxAge: 1000,
    });
  });
});
