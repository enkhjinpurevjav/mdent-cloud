import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /api/payment-settings
 * Public endpoint - returns active payment methods and their providers
 * Used by billing page to dynamically load payment options
 */
router.get("/", async (req, res) => {
  try {
    const methods = await prisma.paymentMethodConfig.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        providers: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            note: true,
          },
        },
      },
    });

    res.json({
      methods: methods.map((m) => ({
        key: m.key,
        label: m.label,
        providers: m.providers,
      })),
    });
  } catch (error) {
    console.error("Failed to load payment settings:", error);
    res.status(500).json({ error: "Failed to load payment settings" });
  }
});

export default router;
