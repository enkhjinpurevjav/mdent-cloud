import { Router } from "express";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

router.get("/", (req, res) => {
  res.json({
    message: "Login endpoint: Use POST with {username, password} in the body."
  });
});

router.post("/", async (req, res) => {
  const { username, password } = req.body;

  // Basic validation
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required." });
  }

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: username },
  });

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  // Check password
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  // Respond with user info (never send password/hash in response!)
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    branchId: user.branchId,
    // Optionally: issue JWT token here
  });
});

export default router;
