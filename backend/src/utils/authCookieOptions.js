/**
 * Helpers for access_token / doctor_kiosk_token cookie options.
 *
 * Default behavior:
 * - production: secure=true, domain=.mdent.cloud
 * - non-production: secure=false, no explicit domain
 *
 * Environment overrides:
 * - COOKIE_SECURE=true|false (also supports 1/0, yes/no, on/off)
 * - COOKIE_DOMAIN=<domain>
 */

function parseBooleanEnv(value) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function isProduction(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === "production";
}

export function shouldUseSecureCookie({
  nodeEnv = process.env.NODE_ENV,
  cookieSecure = process.env.COOKIE_SECURE,
} = {}) {
  const secureOverride = parseBooleanEnv(cookieSecure);
  if (typeof secureOverride === "boolean") return secureOverride;
  return isProduction(nodeEnv);
}

export function resolveCookieDomain({
  nodeEnv = process.env.NODE_ENV,
  cookieDomain = process.env.COOKIE_DOMAIN,
} = {}) {
  const explicitDomain = typeof cookieDomain === "string" ? cookieDomain.trim() : "";
  if (explicitDomain) return explicitDomain;
  return isProduction(nodeEnv) ? ".mdent.cloud" : undefined;
}

export function buildSessionCookieOptions({
  maxAge,
  nodeEnv = process.env.NODE_ENV,
  cookieSecure = process.env.COOKIE_SECURE,
  cookieDomain = process.env.COOKIE_DOMAIN,
} = {}) {
  const options = {
    httpOnly: true,
    secure: shouldUseSecureCookie({ nodeEnv, cookieSecure }),
    sameSite: "lax",
    domain: resolveCookieDomain({ nodeEnv, cookieDomain }),
    path: "/",
  };

  if (typeof maxAge === "number") {
    options.maxAge = maxAge;
  }

  return options;
}
