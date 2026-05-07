import jwt from "jsonwebtoken";
import prisma from "../db.js";

const COOKIE_NAME = "access_token";
export const DOCTOR_KIOSK_COOKIE_NAME = "doctor_kiosk_token";

function decodeCookieValue(value) {
  if (typeof value !== "string") return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getCookieValuesFromHeader(req, cookieName) {
  const header = req.headers?.cookie;
  if (typeof header !== "string" || !header) return [];
  const prefix = `${cookieName}=`;
  const values = [];
  for (const rawPart of header.split(";")) {
    const part = rawPart.trim();
    if (!part.startsWith(prefix)) continue;
    const rawValue = part.slice(prefix.length);
    const decoded = decodeCookieValue(rawValue);
    if (decoded) values.push(decoded);
  }
  return values;
}

function uniqueNonEmpty(values) {
  const seen = new Set();
  const out = [];
  for (const v of values) {
    if (!v || typeof v !== "string") continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/**
 * Reads the JWT from either the cookie or the Authorization header.
 * Returns candidate token strings (deduplicated).
 */
function extractAccessTokenCandidates(req) {
  const candidates = [];
  if (req.cookies?.[COOKIE_NAME]) {
    candidates.push(req.cookies[COOKIE_NAME]);
  }
  candidates.push(...getCookieValuesFromHeader(req, COOKIE_NAME));

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    candidates.push(authHeader.slice(7).trim());
  }

  return uniqueNonEmpty(candidates);
}

function extractKioskTokenCandidates(req) {
  const candidates = [];
  if (req.cookies?.[DOCTOR_KIOSK_COOKIE_NAME]) {
    candidates.push(req.cookies[DOCTOR_KIOSK_COOKIE_NAME]);
  }
  candidates.push(...getCookieValuesFromHeader(req, DOCTOR_KIOSK_COOKIE_NAME));
  return uniqueNonEmpty(candidates);
}

function verifyFromCandidates(candidates, secret) {
  let hadExpired = false;
  for (const token of candidates) {
    try {
      const decoded = jwt.verify(token, secret);
      return { decoded, status: "ok" };
    } catch (err) {
      if (err?.name === "TokenExpiredError") {
        hadExpired = true;
      }
    }
  }
  return { decoded: null, status: hadExpired ? "expired" : "invalid" };
}

function getJwtSecret() {
  return process.env.JWT_SECRET || "";
}

// JWT Authentication Middleware
// Honors DISABLE_AUTH=true to bypass auth (for rollout compatibility).
export async function authenticateJWT(req, res, next) {
  if (process.env.DISABLE_AUTH === "true") {
    req.user = null;
    return next();
  }

  const tokenCandidates = extractAccessTokenCandidates(req);
  if (tokenCandidates.length === 0) {
    return res.status(401).json({ error: "Missing or invalid token." });
  }

  const secret = getJwtSecret();
  if (!secret) {
    console.error("JWT_SECRET is not configured");
    return res.status(500).json({ error: "Internal server error." });
  }

  const { decoded: user, status } = verifyFromCandidates(tokenCandidates, secret);
  if (!user) {
    if (status === "expired") {
      return res.status(401).json({ error: "Token expired." });
    }
    return res.status(401).json({ error: "Invalid token." });
  }

  // Verify the user is still active in the database
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isActive: true },
    });
    if (!dbUser || !dbUser.isActive) {
      return res.status(401).json({ error: "Энэ бүртгэл идэвхгүй байна. Дахин нэвтрэнэ үү." });
    }
  } catch (dbErr) {
    console.error("DB error during isActive check:", dbErr);
    return res.status(500).json({ error: "Internal server error." });
  }

  req.user = user;
  return next();
}

/**
 * Role-based authorization middleware.
 * Usage: router.get('/route', authenticateJWT, requireRole('admin', 'super_admin'), handler)
 * Returns 403 Forbidden if the authenticated user's role is not in the allowed list.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (process.env.DISABLE_AUTH === "true") return next();
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden. Insufficient role." });
    }
    return next();
  };
}

// Optional JWT Authentication Middleware:
// does not require auth but populates req.user if token is valid.
// If JWT_SECRET is missing, it will NOT attempt verification.
export function optionalAuthenticateJWT(req, _res, next) {
  const tokenCandidates = extractAccessTokenCandidates(req);
  if (tokenCandidates.length === 0) {
    req.user = null;
    return next();
  }

  const secret = getJwtSecret();
  if (!secret) {
    console.warn("JWT_SECRET is not configured; skipping optional auth.");
    req.user = null;
    return next();
  }

  const { decoded } = verifyFromCandidates(tokenCandidates, secret);
  req.user = decoded || null;
  return next();
}

/**
 * Synchronously parses and verifies the doctor_kiosk_token cookie.
 * Returns the decoded payload { id (doctorId), branchId, role, name, ovog }
 * or null if missing/invalid.
 *
 * Note: does NOT do a database isActive check — use in low-latency middleware
 * where the short token lifetime provides sufficient security.
 */
export function parseKioskToken(req) {
  const candidates = extractKioskTokenCandidates(req);
  if (candidates.length === 0) return null;
  const secret = getJwtSecret();
  if (!secret) return null;
  return verifyFromCandidates(candidates, secret).decoded || null;
}
