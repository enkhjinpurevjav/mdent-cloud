import { Router } from "express";
import prisma from "../db.js";

const router = Router();

/**
 * GET /api/reports/summary
 * Query: from, to, branchId?, doctorId?, serviceId?, paymentMethod?
 */
router.get("/summary", async (req, res) => {
  try {
    const { from, to, branchId, doctorId, serviceId, paymentMethod } = req.query;

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

    // ---- 1) New patients ----
    const patientWhere = {
      createdAt: {
        gte: fromDate,
        lte: toDateEnd,
      },
    };
    if (branchFilter) {
      patientWhere.branchId = branchFilter;
    }
    // doctor/service/payment filters don't affect "new patients"
    const newPatientsCount = await prisma.patient.count({
      where: patientWhere,
    });

    // ---- 2) Encounters ----
    const encounterWhere = {
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
      // Encounters that have at least one EncounterService with this serviceId
      encounterWhere.encounterServices = {
        some: { serviceId: serviceFilter },
      };
    }

    const encountersCount = await prisma.encounter.count({
      where: encounterWhere,
    });

    // ---- 3) Invoices ----
    const invoiceWhere = {
      createdAt: {
        gte: fromDate,
        lte: toDateEnd,
      },
    };

    // branch/doctor/service use relations via encounter
    invoiceWhere.encounter = {
      AND: [],
    };

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

    // If no relational filters were added, remove the empty AND
    if (invoiceWhere.encounter.AND.length === 0) {
      delete invoiceWhere.encounter;
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
            doctor: true,
          },
        },
      },
    });

    // filter by payment method at application level if needed
    const filteredInvoices = paymentMethodFilter
      ? invoices.filter((inv) => inv.payment?.method === paymentMethodFilter)
      : invoices;

    const totalInvoicesCount = filteredInvoices.length;
    const totalInvoiceAmount = filteredInvoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount || 0),
      0
    );
    const totalPaidAmount = filteredInvoices.reduce(
      (sum, inv) => sum + Number(inv.payment?.amount || 0),
      0
    );
    const totalUnpaidAmount = totalInvoiceAmount - totalPaidAmount;

    // ---- 4) Top doctors (over filtered invoices) ----
    const revenueByDoctor = {};
    for (const inv of filteredInvoices) {
      const docId = inv.encounter?.doctorId;
      if (!docId) continue;
      if (!revenueByDoctor[docId]) {
        revenueByDoctor[docId] = 0;
      }
      revenueByDoctor[docId] += Number(inv.totalAmount || 0);
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

    // ---- 5) Top services (over filtered invoices) ----
    const encounterIds = filteredInvoices.map((inv) => inv.encounterId);
    let topServices = [];
    if (encounterIds.length > 0) {
      const encounterServices = await prisma.encounterService.findMany({
        where: {
          encounterId: { in: encounterIds },
          ...(serviceFilter ? { serviceId: serviceFilter } : {}),
        },
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

/**
 * GET /api/reports/invoices.csv
 * Query: from, to, branchId?, doctorId?, serviceId?, paymentMethod?
 */
router.get("/invoices.csv", async (req, res) => {
  try {
    const { from, to, branchId, doctorId, serviceId, paymentMethod } = req.query;

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

    const invoiceWhere = {
      createdAt: {
        gte: fromDate,
        lte: toDateEnd,
      },
    };

    invoiceWhere.encounter = {
      AND: [],
    };

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
        payment: true,
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

    // Filter by payment method if needed
    const filteredInvoices = paymentMethodFilter
      ? invoices.filter((inv) => inv.payment?.method === paymentMethodFilter)
      : invoices;

    const headers = [
      "invoiceId",
      "invoiceDate",
      "branchId",
      "patientRegNo",
      "patientName",
      "doctorName",
      "totalAmount",
      "status",
      "paidAmount",
      "paymentMethod",
      "paymentTime",
      "eBarimtReceiptNumber",
      "eBarimtTime",
    ];

    const escapeCsv = (value) => {
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

      const paidAmount = inv.payment?.amount ?? "";
      const paymentMethodVal = inv.payment?.method ?? "";
      const paymentTime = inv.payment?.timestamp
        ? inv.payment.timestamp.toISOString()
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
        inv.status || "",
        paidAmount,
        paymentMethodVal,
        paymentTime,
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

export default router;
