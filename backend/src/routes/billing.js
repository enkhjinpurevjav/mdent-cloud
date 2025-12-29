import express from "express";
import { authenticateJWT } from "../middleware/auth.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();


/**
 * Helper: map DiscountPercent enum to numeric value
 */
function discountPercentToNumber(discountEnum) {
  if (!discountEnum) return 0;
  switch (discountEnum) {
    case "FIVE":
      return 5;
    case "TEN":
      return 10;
    case "ZERO":
    default:
      return 0;
  }
}

/**
 * Helper: map numeric percent to DiscountPercent enum
 * Only allow 0 / 5 / 10 (per business rule).
 */
function toDiscountEnum(percent) {
  if (!percent || percent === 0) return "ZERO";
  if (percent === 5) return "FIVE";
  if (percent === 10) return "TEN";
  throw new Error("Invalid discount percent. Allowed: 0, 5, 10.");
}

/**
 * GET /api/encounters/:id/invoice
 *
 * Load or lazily create invoice skeleton for an encounter.
 * – NO payments
 * – NO e-Barimt
 * – Only describes what was provided.
 */
router.get(
  "/encounters/:id/invoice",
  authenticateJWT,
  async (req, res) => {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res
        .status(400)
        .json({ error: "Invalid encounter id." });
    }

    try {
      // Load encounter with required relations
      const encounter = await prisma.encounter.findUnique({
        where: { id: encounterId },
        include: {
          patientBook: {
            include: {
              patient: {
                include: {
                  branch: true,
                },
              },
            },
          },
          encounterServices: {
            include: {
              service: true,
            },
          },
          invoice: {
            include: {
              items: true,
              eBarimtReceipt: true,
            },
          },
        },
      });

      if (!encounter) {
        return res.status(404).json({ error: "Encounter not found." });
      }

      const patient = encounter.patientBook?.patient;
      if (!patient) {
        return res
          .status(409)
          .json({ error: "Encounter has no linked patient book / patient." });
      }

      const existingInvoice = encounter.invoice;

      // If invoice exists, return it (no mutation, source of truth).
      if (existingInvoice) {
        const discountNum = discountPercentToNumber(
          existingInvoice.discountPercent
        );
        return res.json({
          id: existingInvoice.id,
          branchId: existingInvoice.branchId,
          encounterId: existingInvoice.encounterId,
          patientId: existingInvoice.patientId,
          status: existingInvoice.status,
          totalBeforeDiscount: existingInvoice.totalBeforeDiscount,
          discountPercent: discountNum,
          finalAmount: existingInvoice.finalAmount,
          hasEBarimt: !!existingInvoice.eBarimtReceipt,
          items: existingInvoice.items.map((it) => ({
            id: it.id,
            itemType: it.itemType,
            serviceId: it.serviceId,
            productId: it.productId,
            name: it.name,
            unitPrice: it.unitPrice,
            quantity: it.quantity,
            lineTotal: it.lineTotal,
          })),
        });
      }

      // If no invoice yet, build a read‑only “proposal” from encounter services.
      const branchId = patient.branchId;
      const patientId = patient.id;

      const provisionalItems =
        encounter.encounterServices?.map((es) => {
          const unitPrice =
            es.service?.price != null ? es.service.price : es.price || 0;
          const quantity = es.quantity || 1;
          const lineTotal = unitPrice * quantity;

          return {
            tempId: es.id,
            itemType: "SERVICE",
            serviceId: es.serviceId,
            productId: null,
            name: es.service?.name || `Service #${es.serviceId}`,
            unitPrice,
            quantity,
            lineTotal,
          };
        }) ?? [];

      const totalBeforeDiscount = provisionalItems.reduce(
        (sum, it) => sum + it.lineTotal,
        0
      );

      return res.json({
        // No invoice yet
        id: null,
        branchId,
        encounterId,
        patientId,
        status: "UNPAID",
        totalBeforeDiscount,
        discountPercent: 0,
        finalAmount: totalBeforeDiscount,
        hasEBarimt: false,
        items: provisionalItems,
        // Flag so frontend knows this is a draft proposal, not yet stored
        isProvisional: true,
      });
    } catch (err) {
      console.error("GET /encounters/:id/invoice failed:", err);
      return res
        .status(500)
        .json({ error: "Failed to load invoice for encounter." });
    }
  }
);

/**
 * POST /api/encounters/:id/invoice
 *
 * Create or update invoice structure for an encounter.
 * This route:
 * – ONLY manages invoice + invoice items (services/products).
 * – DOES NOT:
 *   * create payments
 *   * touch ledger
 *   * issue e-Barimt
 *
 * Body shape:
 * {
 *   discountPercent: 0 | 5 | 10,
 *   items: [
 *     {
 *       id?: number;              // existing InvoiceItem id (for update) – optional
 *       itemType: "SERVICE" | "PRODUCT",
 *       serviceId?: number | null,
 *       productId?: number | null,
 *       name: string,
 *       unitPrice: number,
 *       quantity: number
 *     },
 *     ...
 *   ]
 * }
 */
router.post(
  "/encounters/:id/invoice",
  authenticateJWT,
  async (req, res) => {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res
        .status(400)
        .json({ error: "Invalid encounter id." });
    }

    const { discountPercent, items } = req.body || {};

    try {
      const discountEnum = toDiscountEnum(Number(discountPercent || 0));

      if (!Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ error: "Invoice must have at least one item." });
      }

      // Load encounter + patient/branch so we can enforce branchId & patientId.
      const encounter = await prisma.encounter.findUnique({
        where: { id: encounterId },
        include: {
          patientBook: {
            include: {
              patient: true,
            },
          },
          invoice: {
            include: { items: true, eBarimtReceipt: true },
          },
        },
      });

      if (!encounter) {
        return res.status(404).json({ error: "Encounter not found." });
      }
      const patient = encounter.patientBook?.patient;
      if (!patient) {
        return res
          .status(409)
          .json({ error: "Encounter has no linked patient book / patient." });
      }

      const branchId = patient.branchId;
      const patientId = patient.id;
      const existingInvoice = encounter.invoice;

      // Build normalized items payload
      const normalizedItems = [];
      for (const row of items) {
        const itemType = row.itemType;
        if (itemType !== "SERVICE" && itemType !== "PRODUCT") {
          return res.status(400).json({
            error: "Invalid itemType. Must be SERVICE or PRODUCT.",
          });
        }

        const qty = Number(row.quantity || 0);
        const price = Number(row.unitPrice || 0);
        if (qty <= 0) {
          return res
            .status(400)
            .json({ error: "Quantity must be greater than zero." });
        }
        if (price < 0) {
          return res
            .status(400)
            .json({ error: "Unit price cannot be negative." });
        }

        const lineTotal = qty * price;

        // Service vs product rules (structural, NOT financial settlement yet)
        if (itemType === "SERVICE") {
          if (!row.serviceId) {
            return res.status(400).json({
              error:
                "SERVICE item must have serviceId. Use PRODUCT itemType for retail products.",
            });
          }
        } else if (itemType === "PRODUCT") {
          if (!row.productId) {
            return res.status(400).json({
              error:
                "PRODUCT item must have productId. Use SERVICE itemType for clinical services.",
            });
          }
        }

        normalizedItems.push({
          id: row.id ?? null,
          itemType,
          serviceId: itemType === "SERVICE" ? row.serviceId : null,
          productId: itemType === "PRODUCT" ? row.productId : null,
          name: String(row.name || "").trim(),
          unitPrice: price,
          quantity: qty,
          lineTotal,
        });
      }

      const totalBeforeDiscount = normalizedItems.reduce(
        (sum, it) => sum + it.lineTotal,
        0
      );

      const numericDiscount = discountPercentToNumber(discountEnum);
      const discountFactor =
        numericDiscount === 0 ? 1 : (100 - numericDiscount) / 100;
      const finalAmount = Math.max(
        Math.round(totalBeforeDiscount * discountFactor),
        0
      );

      // IMPORTANT: if e-Barimt already issued, we must NOT change the financial truth.
      if (existingInvoice?.eBarimtReceipt) {
        return res.status(409).json({
          error:
            "Invoice already has an e-Barimt receipt. Structure cannot be modified.",
        });
      }

      let invoice;
      if (!existingInvoice) {
        // Create new invoice with items
        invoice = await prisma.invoice.create({
          data: {
            branchId,
            encounterId,
            patientId,
            totalBeforeDiscount,
            discountPercent: discountEnum,
            finalAmount,
            status: "UNPAID", // settlement will update this later
            items: {
              create: normalizedItems.map((it) => ({
                itemType: it.itemType,
                serviceId: it.serviceId,
                productId: it.productId,
                name: it.name,
                unitPrice: it.unitPrice,
                quantity: it.quantity,
                lineTotal: it.lineTotal,
              })),
            },
          },
          include: {
            items: true,
            eBarimtReceipt: true,
          },
        });
      } else {
        // Update existing invoice & replace items fully (idempotent builder)
        invoice = await prisma.invoice.update({
          where: { id: existingInvoice.id },
          data: {
            // Branch/patient must remain consistent with encounter
            branchId,
            patientId,
            totalBeforeDiscount,
            discountPercent: discountEnum,
            finalAmount,
            // status is left as-is for now (UNPAID/PARTIAL/INSURANCE_PENDING/PAID)
            // settlement route will manage transitions
            items: {
              deleteMany: { invoiceId: existingInvoice.id },
              create: normalizedItems.map((it) => ({
                itemType: it.itemType,
                serviceId: it.serviceId,
                productId: it.productId,
                name: it.name,
                unitPrice: it.unitPrice,
                quantity: it.quantity,
                lineTotal: it.lineTotal,
              })),
            },
          },
          include: {
            items: true,
            eBarimtReceipt: true,
          },
        });
      }

      const respDiscount = discountPercentToNumber(
        invoice.discountPercent
      );
      return res.json({
        id: invoice.id,
        branchId: invoice.branchId,
        encounterId: invoice.encounterId,
        patientId: invoice.patientId,
        status: invoice.status,
        totalBeforeDiscount: invoice.totalBeforeDiscount,
        discountPercent: respDiscount,
        finalAmount: invoice.finalAmount,
        hasEBarimt: !!invoice.eBarimtReceipt,
        items: invoice.items.map((it) => ({
          id: it.id,
          itemType: it.itemType,
          serviceId: it.serviceId,
          productId: it.productId,
          name: it.name,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          lineTotal: it.lineTotal,
        })),
      });
    } catch (err) {
      console.error("POST /encounters/:id/invoice failed:", err);
      if (err.message?.startsWith("Invalid discount percent")) {
        return res.status(400).json({ error: err.message });
      }
      return res
        .status(500)
        .json({ error: "Failed to save invoice for encounter." });
    }
  }
);

/**
 * NOTE:
 * This router ONLY handles invoice structure.
 * – NO LedgerEntry is created here.
 * – NO Payment is recorded.
 * – NO e-Barimt is issued.
 *
 * Settlement (payments, ledger, e-Barimt trigger) must be implemented
 * in a separate router, e.g.:
 *   POST /api/invoices/:id/settlement
 * respecting:
 *   - every payment is a LedgerEntry
 *   - one e-Barimt per invoice, only when fully settled
 *   - wallet derived from LedgerEntry sums
 */

// Always use CommonJS export for router if your app uses require()
// Change to ES module export only if your app is pure ESM and your entrypoint uses import/export

export default router;
