import jwt from "jsonwebtoken";

// JWT Authentication Middleware (improved for ESM & logging)
export function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token." });
  }

  const token = authHeader.slice(7).trim();

  if (process.env.NODE_ENV === "development") {
    console.log("JWT_SECRET:", process.env.JWT_SECRET);
    console.log("Token received:", token);
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expired." });
      }
      console.error("JWT error:", err.message);
      return res.status(403).json({ error: "Invalid token." });
    }
    req.user = user;
    next();
  });
}
