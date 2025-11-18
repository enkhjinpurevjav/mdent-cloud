import jwt from "jsonwebtoken";

// Middleware to verify JWT from Authorization header
export function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  // Expect header: Authorization: Bearer <token>
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token." });
  }

  const token = authHeader.replace("Bearer ", "");

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token." });
    }
    // Attach user info from token payload to request object
    req.user = user;
    next();
  });
}
