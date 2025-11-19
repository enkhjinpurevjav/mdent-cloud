import jwt from "jsonwebtoken";

// JWT Authentication Middleware (with debug logs)
export function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  // Expect header: Authorization: Bearer <token>
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token." });
  }

  const token = authHeader.slice(7).trim(); // Remove "Bearer " (7 chars) and trim

  // Debug logging
  console.log("JWT_SECRET:", process.env.JWT_SECRET);
  console.log("Token received:", token);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // Print out the JWT verification error to backend logs
      console.error("JWT error:", err.message);
      return res.status(403).json({ error: "Invalid token." });
    }
    // Attach user info from token payload to request object
    req.user = user;
    next();
  });
}
