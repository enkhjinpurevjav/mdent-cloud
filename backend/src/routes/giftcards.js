import express from "express";
import { randomInt } from "crypto";
import prisma from "../db.js";

const router = express.Router();

/**
 * =========================
 * ADMIN: Gift Card management page
 * =========================
 * Endpoints (mounted at /api/admin):
 * - GET    /giftcards          -> list all gift cards
 * - POST   /giftcards          -> create new gift card (auto-generates 8-digit code)
 * - PATCH  /giftcards/:id      -> update gift card (note, isActive, possibly balance before usage)
 * - DELETE /giftcards/:id      -> deactivate gift card
 *
 * Billing endpoints (mounted at /api/billing):
 * - POST   /giftcard/verify    -> verify gift card code, return details
 */

/**
 * Generate a cryptographically random 8-digit numeric code.
 * Uses crypto.randomInt for secure, unpredictable codes.
 */
function generateCode() {
  const n = randomInt(0, 100000000);
  return String(n).padStart(8, "0");
}

/**
 * Generate a unique 8-digit code (up to 10 attempts).
 */
async function generateUniqueCode() {
  for (let i = 0; i < 10; i++) {
    const code = generateCode();
    const existing = await prisma.giftCard.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("Could not generate unique gift card code. Please try again.");
}

/**
 * GET /api/admin/giftcards
 */
router.get("/giftcards", async (req, res) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const where = search
      ? {
          OR: [
            { code: { contains: search, mode: "insensitive" } },
            { note: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const giftCards = await prisma.giftCard.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
    });

    return res.json({ giftCards });
  } catch (e) {
    console.error("Failed to load gift cards", e);
    return res.status(500).json({ error: "Failed to load gift cards" });
  }
});

/**
 * POST /api/admin/giftcards
 * Body: { value, note? }
 * Auto-generates an 8-digit code.
 */
router.post("/giftcards", async (req, res) => {
  try {
    const body = req.body || {};
    const value = Number(body.value);
    const note = typeof body.note === "string" ? body.note.trim() : "";

    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ error: "value must be > 0" });
    }

    const code = await generateUniqueCode();

    const created = await prisma.giftCard.create({
      data: {
        code,
        note,
        value,
        remainingBalance: value,
        isActive: true,
      },
      select: { id: true, code: true },
    });

    return res.json({ ok: true, giftCardId: created.id, code: created.code });
  } catch (e) {
    console.error("Failed to create gift card", e);
    return res.status(500).json({ error: e.message || "Failed to create gift card" });
  }
});

/**
 * PATCH /api/admin/giftcards/:id
 * Body: { note, isActive, value?, remainingBalance? }
 * Only allow editing value/remainingBalance if the card has no usages.
 */
router.patch("/giftcards/:id", async (req, res) => {
  try {
    const giftCardId = Number(req.params.id);
    if (!giftCardId || !Number.isFinite(giftCardId)) {
      return res.status(400).json({ error: "Invalid giftCardId" });
    }

    const existing = await prisma.giftCard.findUnique({
      where: { id: giftCardId },
      include: { usages: { select: { id: true }, take: 1 } },
    });
    if (!existing) {
      return res.status(404).json({ error: "Gift card not found" });
    }

    const body = req.body || {};
    const note = typeof body.note === "string" ? body.note.trim() : existing.note;
    const isActive = typeof body.isActive === "boolean" ? body.isActive : existing.isActive;

    const hasUsages = existing.usages.length > 0;

    let value = existing.value;
    let remainingBalance = existing.remainingBalance;

    if (body.value !== undefined || body.remainingBalance !== undefined) {
      if (hasUsages) {
        return res.status(409).json({
          error: "Ашиглагдсан бэлгийн картын үнэ цэнийг өөрчлөх боломжгүй.",
        });
      }
      if (body.value !== undefined) {
        value = Number(body.value);
        if (!Number.isFinite(value) || value <= 0) {
          return res.status(400).json({ error: "value must be > 0" });
        }
      }
      if (body.remainingBalance !== undefined) {
        remainingBalance = Number(body.remainingBalance);
        if (!Number.isFinite(remainingBalance) || remainingBalance < 0) {
          return res.status(400).json({ error: "remainingBalance must be >= 0" });
        }
        if (remainingBalance > value) {
          return res.status(400).json({ error: "remainingBalance cannot exceed value" });
        }
      } else if (body.value !== undefined) {
        // If only value changed and no usages, set remaining to value
        remainingBalance = value;
      }
    }

    const updated = await prisma.giftCard.update({
      where: { id: giftCardId },
      data: { note, isActive, value, remainingBalance },
      select: { id: true },
    });

    return res.json({ ok: true, giftCardId: updated.id });
  } catch (e) {
    console.error("Failed to update gift card", e);
    return res.status(500).json({ error: "Failed to update gift card" });
  }
});

/**
 * DELETE /api/admin/giftcards/:id
 * Deactivates the gift card.
 */
router.delete("/giftcards/:id", async (req, res) => {
  try {
    const giftCardId = Number(req.params.id);
    if (!giftCardId || !Number.isFinite(giftCardId)) {
      return res.status(400).json({ error: "Invalid giftCardId" });
    }

    await prisma.giftCard.update({
      where: { id: giftCardId },
      data: { isActive: false },
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("Failed to deactivate gift card", e);
    return res.status(500).json({ error: "Failed to deactivate gift card" });
  }
});

/**
 * =========================
 * BILLING: verify gift card code
 * =========================
 * POST /api/billing/giftcard/verify
 * Body: { code }
 * Response: { giftCardId, code, note, value, remainingBalance, createdAt }
 */
router.post("/giftcard/verify", async (req, res) => {
  const body = req.body || {};
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!code) {
    return res.status(400).json({ error: "Бэлгийн картын кодыг оруулна уу." });
  }

  try {
    const card = await prisma.giftCard.findUnique({
      where: { code },
    });

    if (!card) {
      return res.status(404).json({ error: "Бэлгийн картын код олдсонгүй." });
    }

    if (!card.isActive) {
      return res.status(400).json({ error: "Энэ бэлгийн карт идэвхгүй байна." });
    }

    if (card.remainingBalance <= 0) {
      return res.status(400).json({ error: "Бэлгийн картын үлдэгдэл дууссан байна." });
    }

    return res.json({
      giftCardId: card.id,
      code: card.code,
      note: card.note,
      value: card.value,
      remainingBalance: card.remainingBalance,
      createdAt: card.createdAt,
    });
  } catch (e) {
    console.error("Failed to verify gift card code", e);
    return res.status(500).json({ error: "Бэлгийн карт шалгахад алдаа гарлаа." });
  }
});

export default router;
