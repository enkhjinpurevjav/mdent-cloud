import jwt from "jsonwebtoken";

const COOKIE_NAME = "access_token";

/**
 * Reads the JWT from either the cookie or the Authorization header.
 * Returns the raw token string, or null if not present.
 */
function extractToken(req) {
  if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME];

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7).trim();

  return null;
}

function getJwtSecret() {
  return process.env.JWT_SECRET || "";
}

// JWT Authentication Middleware
// Honors DISABLE_AUTH=true to bypass auth (for rollout compatibility).
export function authenticateJWT(req, res, next) {
  if (process.env.DISABLE_AUTH === "true") {
    req.user = null;
    return next();
  }

  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing or invalid token." });
  }

  const secret = getJwtSecret();
  if (!secret) {
    console.error("JWT_SECRET is not configured");
    return res.status(500).json({ error: "Internal server error." });
  }

  jwt.verify(token, secret, (err, user) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expired." });
      }
      console.error("JWT error:", err.message);
      return res.status(401).json({ error: "Invalid token." });
    }

    req.user = user;
    return next();
  });
}

// Optional JWT Authentication Middleware:
// does not require auth but populates req.user if token is valid.
// If JWT_SECRET is missing, it will NOT attempt verification.
export function optionalAuthenticateJWT(req, _res, next) {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  const secret = getJwtSecret();
  if (!secret) {
    console.warn("JWT_SECRET is not configured; skipping optional auth.");
    req.user = null;
    return next();
  }

  jwt.verify(token, secret, (err, user) => {
    if (err) {
      console.warn("Invalid JWT token:", err.message);
      req.user = null;
    } else {
      req.user = user;
    }
    return next();
  });
}
