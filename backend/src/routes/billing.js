import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

/**
 * Helper: Map DiscountPercent enum to numeric value
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
 * Helper: Map numeric percent to DiscountPercent enum
 * Only allow 0 / 5 / 10 (per business rule).
 */
function toDiscountEnum(percent) {
  if (!percent || percent === 0) return "ZERO";
  if (percent === 5) return "FIVE";
  if (percent === 10) return "TEN";
  throw new Error("Invalid discount percent. Allowed: 0, 5, 10.");
}

/**
 * Helper: Compute patient balance from all invoices + payments.
 * Returns { totalBilled, totalPaid, balance }.
 */
async function getPatientBalance(patientId) {
  // 1) All invoices for this patient
  const invoices = await prisma.invoice.findMany({
    where: { patientId },
    select: {
      id: true,
      finalAmount: true,
      totalAmount: true,
    },
  });

  if (invoices.length === 0) {
    return {
      totalBilled: 0,
      totalPaid: 0,
      balance: 0,
    };
  }

  const invoiceIds = invoices.map((inv) => inv.id);

  // 2) Sum payments per invoice
  const payments = await prisma.payment.groupBy({
    by: ["invoiceId"],
    where: { invoiceId: { in: invoiceIds } },
    _sum: { amount: true },
  });

  const paidByInvoice = new Map();
  for (const p of payments) {
    paidByInvoice.set(p.invoiceId, Number(p._sum.amount || 0));
  }

  // 3) Aggregate totals
  let totalBilled = 0;
  let totalPaid = 0;

  for (const inv of invoices) {
    const billed = inv.finalAmount ?? Number(inv.totalAmount || 0);
    const paid = paidByInvoice.get(inv.id) || 0;

    totalBilled += billed;
    totalPaid += paid;
  }

  totalBilled = Number(totalBilled.toFixed(2));
  totalPaid = Number(totalPaid.toFixed(2));
  const balance = Number((totalBilled - totalPaid).toFixed(2));

  return { totalBilled, totalPaid, balance };
}

/**
 * GET /api/billing/encounters/:id/invoice
 * Load or lazily create invoice skeleton for an encounter.
 */
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

    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found." });
    }

    const patient = encounter.patientBook?.patient;
    if (!patient) {
      return res.status(409).json({ error: "Encounter has no linked patient book / patient." });
    }

    const existingInvoice = encounter.invoice;
    const balanceData = await getPatientBalance(patient.id);

    if (existingInvoice) {
      const discountNum = discountPercentToNumber(existingInvoice.discountPercent);

      return res.json({
        id: existingInvoice.id,
        branchId: existingInvoice.branchId,
        encounterId: existingInvoice.encounterId,
        patientId: existingInvoice.patientId,
        status: existingInvoice.statusLegacy || "UNPAID",
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
        patientTotalBilled: balanceData.totalBilled,
        patientTotalPaid: balanceData.totalPaid,
        patientBalance: balanceData.balance,
      });
    }

    const branchId = patient.branchId;
    const provisionalItems = encounter.encounterServices?.map((es) => ({
      itemType: "SERVICE",
      serviceId: es.serviceId,
      productId: null,
      name: es.service?.name || `Service #${es.serviceId}`,
      unitPrice: es.service?.price || 0,
      quantity: es.quantity || 1,
      lineTotal: (es.service?.price || 0) * (es.quantity || 1),
    })) ?? [];

    const totalBeforeDiscount = provisionalItems.reduce((sum, it) => sum + it.lineTotal, 0);

    return res.json({
      id: null,
      branchId,
      encounterId,
      patientId: patient.id,
      status: "UNPAID",
      totalBeforeDiscount,
      discountPercent: 0,
      finalAmount: totalBeforeDiscount,
      items: provisionalItems,
      isProvisional: true,
      patientTotalBilled: balanceData.totalBilled,
      patientTotalPaid: balanceData.totalPaid,
      patientBalance: balanceData.balance,
    });
  } catch (err) {
    console.error("GET /encounters/:id/invoice failed:", err.message);
    return res.status(500).json({ error: "Failed to load invoice." });
  }
});

/**
 * POST /api/billing/encounters/:id/invoice
 * Create or update invoice structure for an encounter.
 */
router.post("/encounters/:id/invoice", async (req, res) => {
  const encounterId = Number(req.params.id);
  const { discountPercent, items } = req.body || {};

  if (!encounterId || Number.isNaN(encounterId)) {
    return res.status(400).json({ error: "Invalid encounter id." });
  }

  try {
    const discountEnum = toDiscountEnum(Number(discountPercent || 0));
    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        patientBook: { include: { patient: true } },
        encounterServices: true,
        invoice: { include: { items: true, eBarimtReceipt: true } },
      },
    });

    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found." });
    }

    const patient = encounter.patientBook?.patient;
    if (!patient) {
      return res.status(409).json({ error: "Encounter has no linked patient book / patient." });
    }

    const branchId = patient.branchId;
    const normalizedItems = items.map((row) => ({
      itemType: row.itemType,
      serviceId: row.itemType === "SERVICE" ? row.serviceId : null,
      productId: row.itemType === "PRODUCT" ? row.productId : null,
      name: row.name,
      unitPrice: row.unitPrice,
      quantity: row.quantity,
      lineTotal: row.unitPrice * row.quantity,
    }));

    const servicesSubtotal = normalizedItems
      .filter((it) => it.itemType === "SERVICE")
      .reduce((sum, it) => sum + Number(it.lineTotal || 0), 0);

    const productsSubtotal = normalizedItems
      .filter((it) => it.itemType === "PRODUCT")
      .reduce((sum, it) => sum + Number(it.lineTotal || 0), 0);

    const discountRate = discountPercentToNumber(discountEnum) / 100;
    const discountOnServices = servicesSubtotal * discountRate;

    const totalBeforeDiscount = servicesSubtotal + productsSubtotal;
    const finalAmount = (servicesSubtotal - discountOnServices) + productsSubtotal;

    const invoiceData = {
      branchId,
      encounterId,
      patientId: patient.id,
      totalBeforeDiscount,
      discountPercent: discountEnum,
      finalAmount,
      items: normalizedItems.map((it) => ({
        itemType: it.itemType,
        serviceId: it.serviceId,
        productId: it.productId,
        name: it.name,
        unitPrice: it.unitPrice,
        quantity: it.quantity,
        lineTotal: it.lineTotal,
      })),
    };

    const existingInvoice = encounter.invoice;
    if (existingInvoice?.eBarimtReceipt) {
      return res.status(409).json({ error: "Invoice already has an e-Barimt." });
    }

    const invoice = existingInvoice
      ? await prisma.invoice.update({
          where: { id: existingInvoice.id },
          data: invoiceData,
          include: { items: true },
        })
      : await prisma.invoice.create({ data: invoiceData, include: { items: true } });

    return res.json(invoice);
  } catch (err) {
    console.error("POST /encounters/:id/invoice failed:", err.message);
    return res.status(500).json({ error: "Failed to save invoice." });
  }
});

export default router;
