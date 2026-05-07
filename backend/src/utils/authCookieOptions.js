/**
 * Helpers for access_token / doctor_kiosk_token cookie options.
 *
 * Default behavior:
 * - production: secure=true
 * - cookie domain:
 *   - explicit COOKIE_DOMAIN when provided
 *   - ".mdent.cloud" only when request host is mdent.cloud or a subdomain
 *   - otherwise host-only cookie (domain omitted)
 * - non-production: secure=false, host-only cookie
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
  requestHost,
} = {}) {
  const explicitDomain = typeof cookieDomain === "string" ? cookieDomain.trim() : "";
  if (explicitDomain) return explicitDomain;
  if (!isProduction(nodeEnv)) return undefined;

  const normalizedHost = String(requestHost || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  if (!normalizedHost) return undefined;

  if (normalizedHost === "mdent.cloud" || normalizedHost.endsWith(".mdent.cloud")) {
    return ".mdent.cloud";
  }
  return undefined;
}

export function buildSessionCookieOptions({
  maxAge,
  nodeEnv = process.env.NODE_ENV,
  cookieSecure = process.env.COOKIE_SECURE,
  cookieDomain = process.env.COOKIE_DOMAIN,
  requestHost,
} = {}) {
  const options = {
    httpOnly: true,
    secure: shouldUseSecureCookie({ nodeEnv, cookieSecure }),
    sameSite: "lax",
    domain: resolveCookieDomain({ nodeEnv, cookieDomain, requestHost }),
    path: "/",
  };

  if (typeof maxAge === "number") {
    options.maxAge = maxAge;
  }

  return options;
}
