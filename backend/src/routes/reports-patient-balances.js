import express from "express";
import prisma from "../db.js";

const router = express.Router();

/**
 * GET /api/reports/patient-balances
 *
 * Optional query filters:
 *   - branchId: number (only patients in this branch)
 *
 * Response: Array of
 * {
 *   patientId: number;
 *   name: string | null;
 *   regNo: string | null;
 *   phone: string | null;
 *   branchId: number;
 *   branchName: string | null;
 *   totalBilled: number;
 *   totalPaid: number;
 *   balance: number;  // totalBilled - totalPaid
 * }
 */
router.get("/patient-balances", async (req, res) => {
  try {
    const branchIdParam = req.query.branchId;
    const branchId = branchIdParam
      ? Number(branchIdParam)
      : null;

    if (branchIdParam && (Number.isNaN(branchId) || branchId <= 0)) {
      return res
        .status(400)
        .json({ error: "branchId must be a positive number." });
    }

    // 1) Load all patients (optionally filtered by branch)
    const patients = await prisma.patient.findMany({
      where: branchId
        ? { branchId }
        : undefined,
      include: {
        branch: true,
      },
    });

    if (patients.length === 0) {
      return res.json([]);
    }

    const patientIds = patients.map((p) => p.id);

    // 2) Fetch all invoices per patient
    const invoices = await prisma.invoice.findMany({
      where: {
        patientId: { in: patientIds },
      },
      select: {
        id: true,
        patientId: true,
        finalAmount: true,
        totalAmount: true,
      },
    });

    // 3) Fetch all payments for those invoices
    const invoiceIds = invoices.map((inv) => inv.id);
    const payments = invoiceIds.length
      ? await prisma.payment.groupBy({
          by: ["invoiceId"],
          where: {
            invoiceId: { in: invoiceIds },
          },
          _sum: {
            amount: true,
          },
        })
      : [];

    // Build a map: invoiceId -> totalPaid
    const paidByInvoice = new Map();
    for (const p of payments) {
      paidByInvoice.set(p.invoiceId, Number(p._sum.amount || 0));
    }

    // 4) Aggregate per patient
    const aggregates = new Map(); // patientId -> { totalBilled, totalPaid }

    for (const inv of invoices) {
      const pid = inv.patientId;
      if (!pid) continue;

      const billed = inv.finalAmount != null
        ? Number(inv.finalAmount)
        : Number(inv.totalAmount || 0);

      const paid = paidByInvoice.get(inv.id) || 0;

      const current = aggregates.get(pid) || {
        totalBilled: 0,
        totalPaid: 0,
      };

      current.totalBilled += billed;
      current.totalPaid += paid;
      aggregates.set(pid, current);
    }

    // 5) Build response array
    const result = patients.map((p) => {
      const aggr = aggregates.get(p.id) || {
        totalBilled: 0,
        totalPaid: 0,
      };

      const totalBilled = Number(aggr.totalBilled.toFixed(2));
      const totalPaid = Number(aggr.totalPaid.toFixed(2));
      const balance = Number((totalBilled - totalPaid).toFixed(2));

      return {
        patientId: p.id,
        name: p.name,
        regNo: p.regNo,
        phone: p.phone,
        branchId: p.branchId,
        branchName: p.branch ? p.branch.name : null,
        totalBilled,
        totalPaid,
        balance,
      };
    });

    // You might later add pagination / sorting here if needed
    return res.json(result);
  } catch (err) {
    console.error("GET /api/reports/patient-balances error:", err);
    return res
      .status(500)
      .json({ error: "Failed to compute patient balances." });
  }
});

export default router;
