import express from "express";
import prisma from "../db.js";

const router = express.Router();

// POST /api/billing/employee-benefit/verify
router.post("/employee-benefit/verify", async (req, res) => {
  const body = req.body || {};
  const code = body.code;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "code is required" });
  }

  try {
    const benefit = await prisma.employeeBenefit.findFirst({
      where: {
        code: code.trim(),
        isActive: true,
        OR: [
          { fromDate: null },
          { fromDate: { lte: new Date() } },
        ],
        OR: [
          { toDate: null },
          { toDate: { gte: new Date() } },
        ],
      },
      include: {
        employee: true,
      },
    });

    if (!benefit) {
      return res
        .status(404)
        .json({ error: "Ажилтны код олдсонгүй эсвэл хүчингүй байна." });
    }

    return res.json({
      employeeId: benefit.employeeId,
      employeeName: benefit.employee ? benefit.employee.name : null,
      remainingAmount: benefit.remainingAmount,
    });
  } catch (e) {
    console.error("Failed to verify employee benefit code", e);
    return res.status(500).json({ error: "Серверийн алдаа." });
  }
});

/**
 * POST /api/billing/voucher/verify
 *
 * Body:
 *  {
 *    type: "MARKETING" | "GIFT",
 *    code: string,
 *    invoiceId?: number,
 *    encounterId?: number,
 *    patientId?: number
 *  }
 *
 * Response (example):
 *  {
 *    type: "MARKETING",
 *    code: "ABC123",
 *    maxAmount: 15000
 *  }
 */
router.post("/voucher/verify", async (req, res) => {
  const body = req.body || {};
  const { type, code } = body;

  if (!type || (type !== "MARKETING" && type !== "GIFT")) {
    return res.status(400).json({
      error: "Купоны төрөл буруу. MARKETING эсвэл GIFT байх ёстой.",
    });
  }

  if (!code || typeof code !== "string") {
    return res
      .status(400)
      .json({ error: "Купон / Ваучер кодыг оруулах шаардлагатай." });
  }

  try {
    if (type === "MARKETING") {
      // Маркетингийн купон – тогтмол 15,000₮
      // TODO: дараа нь DB-д код бүрээр хадгалж, нэг удаа ашиглагдах болгож болно.
      const MAX_VALUE = 15000;

      return res.json({
        type,
        code: code.trim(),
        maxAmount: MAX_VALUE,
      });
    }

    if (type === "GIFT") {
      // GIFT: жинхэнэ бэлгийн карт – үлдэгдэлтэй байх ёстой.
      // Одоо бол placeholder. Дараа нь тусдаа GiftVoucher хүснэгттэй холбож болно.

      return res.status(400).json({
        error:
          "GIFT төрлийн бэлгийн картын backend логик хараахан хийгдээгүй байна.",
      });

      /**
       * Жишээ логик (дараа нь GiftVoucher хүснэгт нэмбэл):
       *
       * const voucher = await prisma.giftVoucher.findUnique({
       *   where: { code: code.trim() },
       * });
       *
       * if (!voucher || !voucher.isActive) {
       *   return res
       *     .status(404)
       *     .json({ error: "Бэлгийн карт олдсонгүй эсвэл хүчингүй байна." });
       * }
       *
       * if (voucher.remainingAmount <= 0) {
       *   return res
       *     .status(409)
       *     .json({ error: "Үлдэгдэлгүй бэлгийн карт байна." });
       * }
       *
       * return res.json({
       *   type,
       *   code: voucher.code,
       *   maxAmount: voucher.remainingAmount,
       * });
       */
    }

    // Should not reach here
    return res.status(400).json({ error: "Invalid voucher request." });
  } catch (e) {
    console.error("Failed to verify voucher code", e);
    return res.status(500).json({ error: "Серверийн алдаа." });
  }
});

export default router;
