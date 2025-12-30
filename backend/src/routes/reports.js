import { Router } from "express";
import prisma from "../db.js";

const router = Router();

/**
 * GET /api/reports/summary
 * Query: from, to, branchId?, doctorId?, serviceId?, paymentMethod?
 */
router.get("/summary", async (req, res) => {
  try {
    const { from, to, branchId, doctorId, serviceId, paymentMethod } =
      req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ error: "from and to query parameters are required" });
    }

    const fromDate = new Date(String(from));
    const toDate = new Date(String(to));
    const toDateEnd = new Date(toDate);
    toDateEnd.setHours(23, 59, 59, 999);

    const branchFilter = branchId ? Number(branchId) : null;
    const doctorFilter = doctorId ? Number(doctorId) : null;
    const serviceFilter = serviceId ? Number(serviceId) : null;
    const paymentMethodFilter =
      typeof paymentMethod === "string" && paymentMethod.trim()
        ? paymentMethod.trim()
        : null;

    // 1) New patients
    const patientWhere: any = {
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

    // 2) Encounters
    const encounterWhere: any = {
      visitDate: {
        gte: fromDate,
        lte: toDateEnd,
      },
    };
    if (branchFilter) {
      encounterWhere.patientBook = {
        patient: {
          branchId: branchFilter,
        },
      };
    }
    if (doctorFilter) {
      encounterWhere.doctorId = doctorFilter;
    }
    if (serviceFilter) {
      encounterWhere.encounterServices = {
        some: { serviceId: serviceFilter },
      };
    }

    const encountersCount = await prisma.encounter.count({
      where: encounterWhere,
    });

    // 3) Invoices
    const invoiceWhere: any = {
      createdAt: {
        gte: fromDate,
        lte: toDateEnd,
      },
    };

    // We filter by encounter relations via AND-array pattern
    invoiceWhere.encounter = { AND: [] as any[] };

    if (branchFilter) {
      invoiceWhere.encounter.AND.push({
        patientBook: {
          patient: {
            branchId: branchFilter,
          },
        },
      });
    }
    if (doctorFilter) {
      invoiceWhere.encounter.AND.push({
        doctorId: doctorFilter,
      });
    }
    if (serviceFilter) {
      invoiceWhere.encounter.AND.push({
        encounterServices: {
          some: { serviceId: serviceFilter },
        },
      });
    }

    if (invoiceWhere.encounter.AND.length === 0) {
      delete invoiceWhere.encounter;
    }

    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        // NEW: payments (list) instead of single payment
        payments: true,
        encounter: {
          include: {
            patientBook: {
              include: { patient: true },
            },
            doctor: true,
          },
        },
      },
    });

    // If a paymentMethod filter is selected, keep invoices that have at least
    // one payment with that method.
    const filteredInvoices = paymentMethodFilter
      ? invoices.filter((inv) =>
          inv.payments?.some((p) => p.method === paymentMethodFilter)
        )
      : invoices;

    const totalInvoicesCount = filteredInvoices.length;
    const totalInvoiceAmount = filteredInvoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount || 0),
      0
    );
    const totalPaidAmount = filteredInvoices.reduce((sum, inv) => {
      const invoicePaid = (inv.payments || []).reduce(
        (ps, p) => ps + Number(p.amount || 0),
        0
      );
      return sum + invoicePaid;
    }, 0);
    const totalUnpaidAmount = totalInvoiceAmount - totalPaidAmount;

    // 4) Top doctors (by totalAmount)
    const revenueByDoctor: Record<number, number> = {};
    for (const inv of filteredInvoices) {
      const docId = inv.encounter?.doctorId;
      if (!docId) continue;
      if (!revenueByDoctor[docId]) revenueByDoctor[docId] = 0;
      revenueByDoctor[docId] += Number(inv.totalAmount || 0);
    }

    const doctorIds = Object.keys(revenueByDoctor).map((id) => Number(id));
    let topDoctors: any[] = [];
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

    // 5) Top services (from encounterServices of these encounters)
    const encounterIds = filteredInvoices.map((inv) => inv.encounterId);
    let topServices: any[] = [];
    if (encounterIds.length > 0) {
      const encounterServices = await prisma.encounterService.findMany({
        where: {
          encounterId: { in: encounterIds },
          ...(serviceFilter ? { serviceId: serviceFilter } : {}),
        },
        include: { service: true },
      });

      const revenueByService: Record<
        number,
        { id: number; name: string; code: string | null; revenue: number }
      > = {};
      for (const es of encounterServices) {
        if (!es.service) continue;
        const sid = es.serviceId;
        const lineTotal =
          Number(es.price || 0) * Number(es.quantity || 1);
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

/**
 * GET /api/reports/invoices.csv
 * Query: from, to, branchId?, doctorId?, serviceId?, paymentMethod?
 */
router.get("/invoices.csv", async (req, res) => {
  try {
    const { from, to, branchId, doctorId, serviceId, paymentMethod } =
      req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ error: "from and to query parameters are required" });
    }

    const fromDate = new Date(String(from));
    const toDate = new Date(String(to));
    const toDateEnd = new Date(toDate);
    toDateEnd.setHours(23, 59, 59, 999);

    const branchFilter = branchId ? Number(branchId) : null;
    const doctorFilter = doctorId ? Number(doctorId) : null;
    const serviceFilter = serviceId ? Number(serviceId) : null;
    const paymentMethodFilter =
      typeof paymentMethod === "string" && paymentMethod.trim()
        ? paymentMethod.trim()
        : null;

    const invoiceWhere: any = {
      createdAt: {
        gte: fromDate,
        lte: toDateEnd,
      },
    };

    invoiceWhere.encounter = { AND: [] as any[] };

    if (branchFilter) {
      invoiceWhere.encounter.AND.push({
        patientBook: {
          patient: {
            branchId: branchFilter,
          },
        },
      });
    }
    if (doctorFilter) {
      invoiceWhere.encounter.AND.push({
        doctorId: doctorFilter,
      });
    }
    if (serviceFilter) {
      invoiceWhere.encounter.AND.push({
        encounterServices: {
          some: { serviceId: serviceFilter },
        },
      });
    }

    if (invoiceWhere.encounter.AND.length === 0) {
      delete invoiceWhere.encounter;
    }

    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        payments: true, // NEW
        eBarimtReceipt: true,
        encounter: {
          include: {
            patientBook: {
              include: { patient: true },
            },
            doctor: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Filter by paymentMethod if provided (invoice passes if any payment has that method)
    const filteredInvoices = paymentMethodFilter
      ? invoices.filter((inv) =>
          inv.payments?.some((p) => p.method === paymentMethodFilter)
        )
      : invoices;

    const headers = [
      "invoiceId",
      "invoiceDate",
      "branchId",
      "patientRegNo",
      "patientName",
      "doctorName",
      "totalAmount",
      "statusLegacy",
      "paidAmount",
      "paymentMethods",
      "latestPaymentTime",
      "eBarimtReceiptNumber",
      "eBarimtTime",
    ];

    const escapeCsv = (value: any) => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes('"') || str.includes(",") || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = [headers.join(",")];

    for (const inv of filteredInvoices) {
      const patient = inv.encounter?.patientBook?.patient;
      const doctor = inv.encounter?.doctor;

      const branchIdVal = patient?.branchId ?? "";
      const patientRegNo = patient?.regNo ?? "";
      const patientName = patient
        ? `${patient.ovog ? patient.ovog + " " : ""}${patient.name ?? ""}`
        : "";

      const doctorName = doctor
        ? `${doctor.ovog ? doctor.ovog + " " : ""}${doctor.name ?? ""}`
        : "";

      // Sum all payments
      const paidAmount = (inv.payments || []).reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0
      );
      const paymentMethods = (inv.payments || [])
        .map((p) => p.method)
        .filter(Boolean)
        .join("|");

      // Latest payment timestamp (if any)
      const latestPayment = (inv.payments || []).reduce(
        (latest: Date | null, p) => {
          if (!p.timestamp) return latest;
          const ts = p.timestamp as Date;
          if (!latest || ts > latest) return ts;
          return latest;
        },
        null
      );
      const latestPaymentTime = latestPayment
        ? latestPayment.toISOString()
        : "";

      const eBarimtNumber = inv.eBarimtReceipt?.receiptNumber ?? "";
      const eBarimtTime = inv.eBarimtReceipt?.timestamp
        ? inv.eBarimtReceipt.timestamp.toISOString()
        : "";

      const row = [
        inv.id,
        inv.createdAt.toISOString(),
        branchIdVal,
        patientRegNo,
        patientName,
        doctorName,
        Number(inv.totalAmount || 0),
        inv.statusLegacy || "",
        paidAmount,
        paymentMethods,
        latestPaymentTime,
        eBarimtNumber,
        eBarimtTime,
      ].map(escapeCsv);

      rows.push(row.join(","));
    }

    const csvContent = rows.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="invoices_${from}_${to}${
        branchFilter ? "_b" + branchFilter : ""
      }${doctorFilter ? "_d" + doctorFilter : ""}${
        serviceFilter ? "_s" + serviceFilter : ""
      }.csv"`
    );

    return res.send(csvContent);
  } catch (err) {
    console.error("GET /api/reports/invoices.csv error:", err);
    res.status(500).json({ error: "internal server error" });
  }
});

/**
 * GET /api/reports/doctor
 * Query: from, to, doctorId (required), branchId?, serviceId?, paymentMethod?
 */
router.get("/doctor", async (req, res) => {
  try {
    const { from, to, doctorId, branchId, serviceId, paymentMethod } =
      req.query;

    if (!from || !to || !doctorId) {
      return res.status(400).json({
        error: "from, to and doctorId query parameters are required",
      });
    }

    const fromDate = new Date(String(from));
    const toDate = new Date(String(to));
    const toDateEnd = new Date(toDate);
    toDateEnd.setHours(23, 59, 59, 999);

    const doctorFilter = Number(doctorId);
    const branchFilter = branchId ? Number(branchId) : null;
    const serviceFilter = serviceId ? Number(serviceId) : null;
    const paymentMethodFilter =
      typeof paymentMethod === "string" && paymentMethod.trim()
        ? paymentMethod.trim()
        : null;

    const doctor = await prisma.user.findUnique({
      where: { id: doctorFilter },
      select: { id: true, name: true, ovog: true, email: true },
    });
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    const encounterWhere: any = {
      doctorId: doctorFilter,
      visitDate: {
        gte: fromDate,
        lte: toDateEnd,
      },
    };
    if (branchFilter) {
      encounterWhere.patientBook = {
        patient: {
          branchId: branchFilter,
        },
      };
    }
    if (serviceFilter) {
      encounterWhere.encounterServices = {
        some: { serviceId: serviceFilter },
      };
    }

    const encounters = await prisma.encounter.findMany({
      where: encounterWhere,
      include: {
        patientBook: {
          include: { patient: true },
        },
        invoice: {
          include: { payments: true },
        },
        encounterServices: {
          include: { service: true },
        },
      },
    });

    const encountersCount = encounters.length;

    const uniquePatientIds = new Set(
      encounters
        .map((e) => e.patientBook?.patient?.id)
        .filter((id) => id !== undefined && id !== null)
    );

    const newPatientsCount = await prisma.patient.count({
      where: {
        id: { in: Array.from(uniquePatientIds) as number[] },
        createdAt: { gte: fromDate, lte: toDateEnd },
        ...(branchFilter ? { branchId: branchFilter } : {}),
      },
    });

    const invoices = encounters
      .map((e) => e.invoice)
      .filter((inv): inv is NonNullable<typeof inv> => !!inv);

    const filteredInvoices = paymentMethodFilter
      ? invoices.filter((inv) =>
          inv.payments?.some((p) => p.method === paymentMethodFilter)
        )
      : invoices;

    const invoiceCount = filteredInvoices.length;
    const totalInvoiceAmount = filteredInvoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount || 0),
      0
    );
    const totalPaidAmount = filteredInvoices.reduce((sum, inv) => {
      const paid = (inv.payments || []).reduce(
        (ps, p) => ps + Number(p.amount || 0),
        0
      );
      return sum + paid;
    }, 0);
    const totalUnpaidAmount = totalInvoiceAmount - totalPaidAmount;

    const allEncounterServices = encounters.flatMap(
      (e) => e.encounterServices || []
    );
    const filteredEncounterServices = serviceFilter
      ? allEncounterServices.filter((es) => es.serviceId === serviceFilter)
      : allEncounterServices;

    const servicesMap: Record<
      number,
      {
        serviceId: number;
        code: string | null;
        name: string;
        totalQuantity: number;
        revenue: number;
      }
    > = {};
    for (const es of filteredEncounterServices) {
      if (!es.service) continue;
      const sid = es.serviceId;
      if (!servicesMap[sid]) {
        servicesMap[sid] = {
          serviceId: sid,
          code: es.service.code,
          name: es.service.name,
          totalQuantity: 0,
          revenue: 0,
        };
      }
      const qty = Number(es.quantity || 1);
      const lineTotal = Number(es.price || 0) * qty;
      servicesMap[sid].totalQuantity += qty;
      servicesMap[sid].revenue += lineTotal;
    }

    const services = Object.values(servicesMap).sort(
      (a, b) => b.revenue - a.revenue
    );

    const dailyMap: Record<
      string,
      { date: string; encounters: number; revenue: number }
    > = {};
    for (const e of encounters) {
      const day = e.visitDate.toISOString().slice(0, 10);
      if (!dailyMap[day]) {
        dailyMap[day] = {
          date: day,
          encounters: 0,
          revenue: 0,
        };
      }
      dailyMap[day].encounters += 1;

      const inv = e.invoice;
      if (inv) {
        const hasMethod =
          !paymentMethodFilter ||
          (inv.payments || []).some((p) => p.method === paymentMethodFilter);
        if (hasMethod) {
          dailyMap[day].revenue += Number(inv.totalAmount || 0);
        }
      }
    }

    const daily = Object.values(dailyMap).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    );

    return res.json({
      doctor,
      from: fromDate.toISOString(),
      to: toDateEnd.toISOString(),
      branchId: branchFilter,
      totals: {
        encountersCount,
        invoiceCount,
        totalInvoiceAmount,
        totalPaidAmount,
        totalUnpaidAmount,
        newPatientsCount,
      },
      services,
      daily,
    });
  } catch (err) {
    console.error("GET /api/reports/doctor error:", err);
    res.status(500).json({ error: "internal server error" });
  }
});

/**
 * GET /api/reports/branches
 * Query: from, to
 * Optional: doctorId?, serviceId?, paymentMethod?
 *
 * Returns per-branch metrics for the selected period.
 */
router.get("/branches", async (req, res) => {
  try {
    const { from, to, doctorId, serviceId, paymentMethod } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        error: "from and to query parameters are required",
      });
    }

    const fromDate = new Date(String(from));
    const toDate = new Date(String(to));
    const toDateEnd = new Date(toDate);
    toDateEnd.setHours(23, 59, 59, 999);

    const doctorFilter = doctorId ? Number(doctorId) : null;
    const serviceFilter = serviceId ? Number(serviceId) : null;
    const paymentMethodFilter =
      typeof paymentMethod === "string" && paymentMethod.trim()
        ? paymentMethod.trim()
        : null;

    // Load all branches
    const branches = await prisma.branch.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    // For each branch, compute metrics
    const results: any[] = [];

    for (const branch of branches) {
      const branchIdVal = branch.id;

      // Patients for this branch
      const patientWhere = {
        createdAt: {
          gte: fromDate,
          lte: toDateEnd,
        },
        branchId: branchIdVal,
      };

      const newPatientsCount = await prisma.patient.count({
        where: patientWhere,
      });

      // Encounters for this branch
      const encounterWhere: any = {
        visitDate: {
          gte: fromDate,
          lte: toDateEnd,
        },
        patientBook: {
          patient: {
            branchId: branchIdVal,
          },
        },
      };

      if (doctorFilter) {
        encounterWhere.doctorId = doctorFilter;
      }
      if (serviceFilter) {
        encounterWhere.encounterServices = {
          some: { serviceId: serviceFilter },
        };
      }

      const encountersCount = await prisma.encounter.count({
        where: encounterWhere,
      });

      // Invoices via encounters for this branch
      const invoiceWhere: any = {
        createdAt: {
          gte: fromDate,
          lte: toDateEnd,
        },
        encounter: {
          patientBook: {
            patient: {
              branchId: branchIdVal,
            },
          },
        },
      };

      if (doctorFilter) {
        invoiceWhere.encounter.doctorId = doctorFilter;
      }
      if (serviceFilter) {
        invoiceWhere.encounter.encounterServices = {
          some: { serviceId: serviceFilter },
        };
      }

      const invoices = await prisma.invoice.findMany({
        where: invoiceWhere,
        include: {
          payments: true,
        },
      });

      const filteredInvoices = paymentMethodFilter
        ? invoices.filter((inv) =>
            inv.payments?.some((p) => p.method === paymentMethodFilter)
          )
        : invoices;

      const invoiceCount = filteredInvoices.length;

      const totalInvoiceAmount = filteredInvoices.reduce(
        (sum, inv) => sum + Number(inv.totalAmount || 0),
        0
      );
      const totalPaidAmount = filteredInvoices.reduce((sum, inv) => {
        const paid = (inv.payments || []).reduce(
          (ps, p) => ps + Number(p.amount || 0),
          0
        );
        return sum + paid;
      }, 0);
      const totalUnpaidAmount = totalInvoiceAmount - totalPaidAmount;

      results.push({
        branchId: branchIdVal,
        branchName: branch.name,
        newPatientsCount,
        encountersCount,
        invoiceCount,
        totalInvoiceAmount,
        totalPaidAmount,
        totalUnpaidAmount,
      });
    }

    return res.json({
      from: fromDate.toISOString(),
      to: toDateEnd.toISOString(),
      branches: results,
    });
  } catch (err) {
    console.error("GET /api/reports/branches error:", err);
    res.status(500).json({ error: "internal server error" });
  }
});

// GET /api/reports/daily-revenue?date=YYYY-MM-DD&branchId=optional
router.get("/daily-revenue", async (req, res) => {
  try {
    const { date, branchId } = req.query;

    if (!date || typeof date !== "string") {
      return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
    }

    const [y, m, d] = date.split("-").map(Number);
    if (!y || !m || !d) {
      return res.status(400).json({ error: "invalid date format" });
    }

    // Same local-day logic as in appointments.js (parseClinicDay)
    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const end = new Date(y, m - 1, d, 23, 59, 59, 999);

    const whereInvoice: any = {
      createdAt: {
        gte: start,
        lte: end,
      },
      // legacy paid status
      statusLegacy: "paid",
    };

    if (branchId) {
      const bid = Number(branchId);
      if (!Number.isNaN(bid)) {
        // Filter by branch through Encounter -> PatientBook -> Patient -> branchId
        whereInvoice.encounter = {
          patientBook: {
            patient: {
              branchId: bid,
            },
          },
        };
      }
    }

    const result = await prisma.invoice.aggregate({
      _sum: {
        totalAmount: true,
      },
      where: whereInvoice,
    });

    const total = result._sum.totalAmount || 0;
    return res.json({ total });
  } catch (err) {
    console.error("GET /api/reports/daily-revenue error:", err);
    return res
      .status(500)
      .json({ error: "failed to compute daily revenue" });
  }
});

export default router;
