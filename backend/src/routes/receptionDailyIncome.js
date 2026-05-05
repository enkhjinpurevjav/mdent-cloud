import express from "express";
import prisma from "../db.js";
import { authenticateJWT, requireRole } from "../middleware/auth.js";

const router = express.Router();

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Server-local (naive) datetime: "YYYY.MM.DD HH:mm"
function toNaiveYmdHm(dt) {
  if (!dt) return null;
  const d = dt instanceof Date ? dt : new Date(dt);
  if (Number.isNaN(d.getTime())) return null;

  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());

  return `${y}.${m}.${day} ${hh}:${mm}`;
}

/**
 * GET /api/reception/daily-income
 * Returns daily income for receptionist or marketing users.
 *
 * Query params:
 *   date - required, YYYY-MM-DD
 *
 * Scope rules:
 *   - receptionist: createdByUserId = req.user.id, invoice.branchId = req.user.branchId
 *   - marketing/admin/super_admin: no creator or branch restriction (all branches)
 */
router.get(
  "/daily-income",
  authenticateJWT,
  requireRole("receptionist", "marketing", "admin", "super_admin"),
  async (req, res) => {
    try {
      const { date } = req.query;

      if (!date || typeof date !== "string") {
        return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
      }

      const [y, m, d] = date.split("-").map(Number);
      if (!y || !m || !d) {
        return res
          .status(400)
          .json({ error: "Invalid date format, expected YYYY-MM-DD" });
      }

      const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
      const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);

      // Scope based on role — never accept user-scoping from query params
      const userId = req.user.id;
      const branchId = req.user.branchId;
      const role = req.user.role;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required." });
      }

      const paymentWhere = {
        timestamp: {
          gte: dayStart,
          lte: dayEnd,
        },
      };

      // Receptionists see only their own collections in their own branch.
      if (role === "receptionist") {
        paymentWhere.createdByUserId = userId;
        if (branchId) {
          paymentWhere.invoice = { branchId };
        }
      }

      // Fetch all payments for the day with full related data
      const payments = await prisma.payment.findMany({
        where: paymentWhere,
        include: {
          createdBy: {
            select: { id: true, name: true, ovog: true },
          },
          invoice: {
            select: {
              id: true,
              branchId: true,
              patientId: true,
              encounterId: true,
              finalAmount: true,
              totalAmount: true,
              encounter: {
                select: {
                  id: true,
                  appointmentId: true,
                  visitDate: true,
                  patientBook: {
                    select: {
                      patient: {
                        select: {
                          id: true,
                          name: true,
                          ovog: true,
                        },
                      },
                    },
                  },
                  doctor: {
                    select: {
                      id: true,
                      name: true,
                      ovog: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { timestamp: "asc" },
      });

      // Fetch active payment method labels
      const methodConfigs = await prisma.paymentMethodConfig.findMany({
        where: { isActive: true },
        select: { key: true, label: true },
      });
      const methodLabelMap = Object.fromEntries(
        methodConfigs.map((c) => [c.key, c.label])
      );

      // Group payments by method
      const groupMap = new Map();

      for (const p of payments) {
        const method = p.method || "OTHER";
        if (!groupMap.has(method)) {
          groupMap.set(method, {
            method,
            label: methodLabelMap[method] || method,
            totalAmount: 0,
            count: 0,
            items: [],
          });
        }
        const group = groupMap.get(method);
        const amount = Number(p.amount || 0);
        group.totalAmount += amount;
        group.count += 1;

        const encounter = p.invoice?.encounter;
        const patient = encounter?.patientBook?.patient;
        const doctor = encounter?.doctor;

        group.items.push({
          paymentId: p.id,
          invoiceId: p.invoiceId,
          encounterId: encounter?.id ?? null,
          appointmentId: encounter?.appointmentId ?? null,
          patientId: patient?.id ?? null,
          patientName: patient?.name ?? null,
          patientOvog: patient?.ovog ?? null,
          scheduledAt: encounter?.visitDate ?? null,
          visitDate: encounter?.visitDate ?? null,
          visitDateNaive: toNaiveYmdHm(encounter?.visitDate),
          doctorId: doctor?.id ?? null,
          doctorName: doctor?.name ?? null,
          doctorOvog: doctor?.ovog ?? null,
          amount,
          collectedById: p.createdByUserId ?? null,
          collectedByName: p.createdBy?.name ?? null,
          collectedByOvog: p.createdBy?.ovog ?? null,
          paymentTimestamp: p.timestamp,
          meta: p.meta,
        });
      }

      // Convert map to sorted array (maintain payment method config sort order)
      const paymentTypes = Array.from(groupMap.values()).sort((a, b) => {
        const aIdx = methodConfigs.findIndex((c) => c.key === a.method);
        const bIdx = methodConfigs.findIndex((c) => c.key === b.method);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });

      const grandTotal = paymentTypes.reduce((sum, g) => sum + g.totalAmount, 0);

      return res.json({
        date,
        grandTotal,
        paymentTypes,
      });
    } catch (err) {
      console.error("GET /api/reception/daily-income error:", err);
      return res.status(500).json({ error: "Failed to fetch daily income data" });
    }
  }
);

export default router;
