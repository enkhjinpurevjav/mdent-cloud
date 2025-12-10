import { Router } from "express";
import prisma from "../db.js";

const router = Router();

// GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&branchId=?
router.get("/summary", async (req, res) => {
  try {
    const { from, to, branchId } = req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ error: "from and to query parameters are required" });
    }

    const fromDate = new Date(String(from));
    const toDate = new Date(String(to));
    // include entire "to" day
    const toDateEnd = new Date(toDate);
    toDateEnd.setHours(23, 59, 59, 999);

    const branchFilter = branchId ? Number(branchId) : null;

    // 1) Patients created in period
    const patientWhere = {
      createdAt: {
        gte: fromDate,
        lte: toDateEnd,
      },
    };
    if (branchFilter) {
      patientWhere.branchId = branchFilter;
    }

    const newPatientsCount = await prisma.patient.count({
      where: patientWhere,
    });

    // 2) Encounters in period
    const encounterWhere = {
      visitDate: {
        gte: fromDate,
        lte: toDateEnd,
      },
    };
    if (branchFilter) {
      // Encounter doesn't have branchId directly, but Patient does.
      // So join via PatientBook->Patient
      encounterWhere.patientBook = {
        patient: {
          branchId: branchFilter,
        },
      };
    }

    const encountersCount = await prisma.encounter.count({
      where: encounterWhere,
    });

    // 3) Invoices in period
    const invoiceWhere = {
      createdAt: {
        gte: fromDate,
        lte: toDateEnd,
      },
    };
    if (branchFilter) {
      // Join via Encounter -> PatientBook -> Patient
      invoiceWhere.encounter = {
        patientBook: {
          patient: {
            branchId: branchFilter,
          },
        },
      };
    }

    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        payment: true,
        encounter: {
          include: {
            patientBook: {
              include: { patient: true },
            },
          },
        },
      },
    });

    const totalInvoicesCount = invoices.length;
    const totalInvoiceAmount = invoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount || 0),
      0
    );
    const totalPaidAmount = invoices.reduce(
      (sum, inv) => sum + Number(inv.payment?.amount || 0),
      0
    );
    const totalUnpaidAmount = totalInvoiceAmount - totalPaidAmount;

    // 4) Top doctors by revenue (using invoice totals grouped by encounter.doctorId)
    const revenueByDoctor = {};
    for (const inv of invoices) {
      const doctorId = inv.encounter?.doctorId;
      if (!doctorId) continue;
      if (!revenueByDoctor[doctorId]) {
        revenueByDoctor[doctorId] = 0;
      }
      revenueByDoctor[doctorId] += Number(inv.totalAmount || 0);
    }

    const doctorIds = Object.keys(revenueByDoctor).map((id) => Number(id));
    let topDoctors = [];
    if (doctorIds.length > 0) {
      const doctors = await prisma.user.findMany({
        where: { id: { in: doctorIds } },
        select: { id: true, name: true, ovog: true, email: true },
      });

      topDoctors = doctors
        .map((doc) => ({
          id: doc.id,
          name: doc.name,
          ovog: doc.ovog,
          email: doc.email,
          revenue: revenueByDoctor[doc.id] || 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
    }

    // 5) Top services by revenue (sum EncounterService.price * quantity)
    const encounterIds = invoices.map((inv) => inv.encounterId);
    let topServices = [];
    if (encounterIds.length > 0) {
      const encounterServices = await prisma.encounterService.findMany({
        where: { encounterId: { in: encounterIds } },
        include: { service: true },
      });

      const revenueByService = {};
      for (const es of encounterServices) {
        if (!es.service) continue;
        const sid = es.serviceId;
        const lineTotal = Number(es.price || 0) * Number(es.quantity || 1);
        if (!revenueByService[sid]) {
          revenueByService[sid] = {
            id: sid,
            name: es.service.name,
            code: es.service.code,
            revenue: 0,
          };
        }
        revenueByService[sid].revenue += lineTotal;
      }

      topServices = Object.values(revenueByService)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
    }

    return res.json({
      from: fromDate.toISOString(),
      to: toDateEnd.toISOString(),
      branchId: branchFilter,
      newPatientsCount,
      encountersCount,
      totalInvoicesCount,
      totalInvoiceAmount,
      totalPaidAmount,
      totalUnpaidAmount,
      topDoctors,
      topServices,
    });
  } catch (err) {
    console.error("GET /api/reports/summary error:", err);
    res.status(500).json({ error: "internal server error" });
  }
});

export default router;
