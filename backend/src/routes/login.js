import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

router.post("/", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required." });
  }

  // Look up user by email
  const user = await prisma.user.findUnique({
    where: { email: username }, // database uses 'email' as the login name
  });

  if (!user || !user.password) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  // Validate password with bcrypt
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  // Prepare JWT payload
  const token = jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
    },
    process.env.JWT_SECRET || "testsecret", // Use env variable for production
    { expiresIn: "8h" }
  );

  // Respond with token + user info
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
    },
  });
});

export default router;
