import express from "express";
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
 * Helper: compute patient balance from all invoices + payments.
 * Returns { totalBilled, totalPaid, balance }.
 */
async function getPatientBalance(patientId) {
  const invoices = await prisma.invoice.findMany({
    where: { patientId },
    select: {
      id: true,
      finalAmount: true,
      totalAmount: true,
    },
  });

  if (invoices.length === 0) {
    return { totalBilled: 0, totalPaid: 0, balance: 0 };
  }

  const invoiceIds = invoices.map((inv) => inv.id);

  const payments = await prisma.payment.groupBy({
    by: ["invoiceId"],
    where: { invoiceId: { in: invoiceIds } },
    _sum: { amount: true },
  });

  const paidByInvoice = new Map();
  for (const p of payments) {
    paidByInvoice.set(p.invoiceId, Number(p._sum.amount || 0));
  }

  let totalBilled = 0;
  let totalPaid = 0;

  for (const inv of invoices) {
    const billed =
      inv.finalAmount != null ? Number(inv.finalAmount) : Number(inv.totalAmount || 0);
    const paid = paidByInvoice.get(inv.id) || 0;
    totalBilled += billed;
    totalPaid += paid;
  }

  totalBilled = Number(totalBilled.toFixed(2));
  totalPaid = Number(totalPaid.toFixed(2));
  const balance = Number((totalBilled - totalPaid).toFixed(2));

  return { totalBilled, totalPaid, balance };
}

router.get("/encounters/:id/invoice", async (req, res) => {
  const encounterId = Number(req.params.id);
  if (!encounterId || Number.isNaN(encounterId)) {
    return res.status(400).json({ error: "Invalid encounter id." });
  }

  try {
    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        patientBook: { include: { patient: { include: { branch: true } } } },
        encounterServices: { include: { service: true } },
        invoice: { include: { items: true, eBarimtReceipt: true } },
      },
    });

    if (!encounter) return res.status(404).json({ error: "Encounter not found." });

    const patient = encounter.patientBook?.patient;
    if (!patient) {
      return res.status(409).json({ error: "Encounter has no linked patient book / patient." });
    }

    const existingInvoice = encounter.invoice;

    if (existingInvoice) {
      const discountNum = discountPercentToNumber(existingInvoice.discountPercent);
      const balanceData = await getPatientBalance(patient.id);

      return res.json({
        id: existingInvoice.id,
        branchId: existingInvoice.branchId,
        encounterId: existingInvoice.encounterId,
        patientId: existingInvoice.patientId,
        status: existingInvoice.statusLegacy || "UNPAID",
        totalBeforeDiscount: existingInvoice.totalBeforeDiscount,
        discountPercent: discountNum,
        collectionDiscountAmount: existingInvoice.collectionDiscountAmount || 0,
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
          source: it.source,
        })),
        patientTotalBilled: balanceData.totalBilled,
        patientTotalPaid: balanceData.totalPaid,
        patientBalance: balanceData.balance,
      });
    }

    const branchId = patient.branchId;
    const patientId = patient.id;

    const provisionalItems =
      encounter.encounterServices?.map((es) => {
        const unitPrice = es.service?.price != null ? es.service.price : es.price || 0;
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
          source: "ENCOUNTER",
        };
      }) ?? [];

    const totalBeforeDiscount = provisionalItems.reduce((sum, it) => sum + it.lineTotal, 0);
    const balanceData = await getPatientBalance(patientId);

    return res.json({
      id: null,
      branchId,
      encounterId,
      patientId,
      status: "UNPAID",
      totalBeforeDiscount,
      discountPercent: 0,
      collectionDiscountAmount: 0,
      finalAmount: totalBeforeDiscount,
      hasEBarimt: false,
      items: provisionalItems,
      isProvisional: true,
      patientTotalBilled: balanceData.totalBilled,
      patientTotalPaid: balanceData.totalPaid,
      patientBalance: balanceData.balance,
    });
  } catch (err) {
    console.error("GET /encounters/:id/invoice failed:", err);
    return res.status(500).json({ error: "Failed to load invoice for encounter." });
  }
});

/**
 * POST /api/billing/encounters/:id/invoice
 *
 * Create or update invoice structure for an encounter.
 */
router.post("/encounters/:id/invoice", async (req, res) => {
  const encounterId = Number(req.params.id);
  if (!encounterId || Number.isNaN(encounterId)) {
    return res.status(400).json({ error: "Invalid encounter id." });
  }

  const { discountPercent, items, collectionDiscountAmount } = req.body || {};

  try {
    const discountEnum = toDiscountEnum(Number(discountPercent || 0));
    const collectionDiscount = Number(collectionDiscountAmount || 0);

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Invoice must have at least one item." });
    }

    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        patientBook: { include: { patient: true } },
        encounterServices: true,
        invoice: { include: { items: true, eBarimtReceipt: true } },
      },
    });

    if (!encounter) return res.status(404).json({ error: "Encounter not found." });

    const patient = encounter.patientBook?.patient;
    if (!patient) {
      return res.status(409).json({ error: "Encounter has no linked patient book / patient." });
    }

    const branchId = patient.branchId;
    const patientId = patient.id;
    const existingInvoice = encounter.invoice;

    if (existingInvoice?.eBarimtReceipt) {
      return res.status(409).json({
        error: "Invoice already has an e-Barimt receipt. Structure cannot be modified.",
      });
    }

    const encounterServiceIds = new Set(
      (encounter.encounterServices || []).map((es) => Number(es.serviceId))
    );

    // ---------- NEW: validate productIds in one DB query ----------
    const productIdsNeeded = (items || [])
      .filter((r) => r?.itemType === "PRODUCT" && r.productId)
      .map((r) => Number(r.productId))
      .filter((id) => Number.isFinite(id));

    const uniqueProductIds = Array.from(new Set(productIdsNeeded));

    let productById = new Map();
    if (uniqueProductIds.length > 0) {
      const products = await prisma.product.findMany({
        where: {
          id: { in: uniqueProductIds },
          branchId,
          isActive: true,
        },
        select: { id: true, name: true, price: true },
      });
      productById = new Map(products.map((p) => [p.id, p]));
    }

    // Build normalized items payload
    const normalizedItems = [];

    for (const row of items) {
      const itemType = row.itemType;
      if (itemType !== "SERVICE" && itemType !== "PRODUCT") {
        return res.status(400).json({ error: "Invalid itemType. Must be SERVICE or PRODUCT." });
      }

      const qty = Number(row.quantity || 0);
      const price = Number(row.unitPrice || 0);

      if (qty <= 0) return res.status(400).json({ error: "Quantity must be greater than zero." });
      if (price < 0) return res.status(400).json({ error: "Unit price cannot be negative." });

      if (itemType === "SERVICE") {
        if (!row.serviceId) {
          return res.status(400).json({
            error:
              "SERVICE item must have serviceId. Use PRODUCT itemType for retail products.",
          });
        }
      } else {
        if (!row.productId) {
          return res.status(400).json({
            error:
              "PRODUCT item must have productId. Use SERVICE itemType for clinical services.",
          });
        }

        // NEW: ensure product exists and matches branch/isActive
        const pid = Number(row.productId);
        if (!productById.has(pid)) {
          return res.status(400).json({
            error: "Invalid productId (not found, inactive, or branch mismatch).",
          });
        }
      }

      const normalizedServiceId = itemType === "SERVICE" ? Number(row.serviceId) : null;
      const normalizedProductId = itemType === "PRODUCT" ? Number(row.productId) : null;

      const source =
        itemType === "SERVICE" &&
        normalizedServiceId != null &&
        encounterServiceIds.has(normalizedServiceId)
          ? "ENCOUNTER"
          : "MANUAL";

      const name = String(row.name || "").trim();
      const lineTotal = qty * price;

      normalizedItems.push({
        id: row.id ?? null,
        itemType,
        serviceId: normalizedServiceId,
        productId: normalizedProductId,
        name,
        unitPrice: price,
        quantity: qty,
        lineTotal,
        source,
      });
    }

    // ---------- NEW: totals + discount only on SERVICES ----------
    const servicesSubtotal = normalizedItems
      .filter((it) => it.itemType === "SERVICE")
      .reduce((sum, it) => sum + Number(it.lineTotal || 0), 0);

    const productsSubtotal = normalizedItems
      .filter((it) => it.itemType === "PRODUCT")
      .reduce((sum, it) => sum + Number(it.lineTotal || 0), 0);

    const totalBeforeDiscount = servicesSubtotal + productsSubtotal;

    const numericDiscount = discountPercentToNumber(discountEnum);
    const discountFactor = numericDiscount === 0 ? 1 : (100 - numericDiscount) / 100;

    const discountedServices = Math.max(Math.round(servicesSubtotal * discountFactor), 0);
    const finalAmount = Math.max(discountedServices + Math.round(productsSubtotal), 0);

    // ---------- save ----------
    let invoice;
    if (!existingInvoice) {
      invoice = await prisma.invoice.create({
        data: {
          branchId,
          encounterId,
          patientId,
          totalBeforeDiscount,
          discountPercent: discountEnum,
          collectionDiscountAmount: collectionDiscount,
          finalAmount,
          statusLegacy: "UNPAID",
          items: {
            create: normalizedItems.map((it) => ({
              itemType: it.itemType,
              serviceId: it.serviceId,
              productId: it.productId,
              name: it.name,
              unitPrice: it.unitPrice,
              quantity: it.quantity,
              lineTotal: it.lineTotal,
              source: it.source,
            })),
          },
        },
        include: { items: true, eBarimtReceipt: true },
      });
    } else {
      invoice = await prisma.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          branchId,
          patientId,
          totalBeforeDiscount,
          discountPercent: discountEnum,
          collectionDiscountAmount: collectionDiscount,
          finalAmount,
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
              source: it.source,
            })),
          },
        },
        include: { items: true, eBarimtReceipt: true },
      });
    }

    const respDiscount = discountPercentToNumber(invoice.discountPercent);
    return res.json({
      id: invoice.id,
      branchId: invoice.branchId,
      encounterId: invoice.encounterId,
      patientId: invoice.patientId,
      status: invoice.statusLegacy || "UNPAID",
      totalBeforeDiscount: invoice.totalBeforeDiscount,
      discountPercent: respDiscount,
      collectionDiscountAmount: invoice.collectionDiscountAmount || 0,
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
        source: it.source,
      })),
    });
  } catch (err) {
    console.error("POST /encounters/:id/invoice failed:", err);
    if (err.message?.startsWith("Invalid discount percent")) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: "Failed to save invoice for encounter." });
  }
});

export default router;
