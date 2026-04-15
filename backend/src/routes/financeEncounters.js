import express from "express";
import prisma from "../db.js";
import { requireRole } from "../middleware/auth.js";
import { computePaidTotal } from "../services/settlementService.js";
import { isInvoiceVoidedStatus } from "./invoices.js";

const router = express.Router();

const DEFAULT_PAGE_SIZE = 20;
const MIN_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const BILLING_STATUS_VALUES = new Set([
  "all",
  "no_invoice",
  "unpaid",
  "partial",
  "paid",
  "free",
  "close_without_payment",
]);
const APPOINTMENT_STATUS_VALUES = [
  "booked",
  "confirmed",
  "online",
  "ongoing",
  "imaging",
  "ready_to_pay",
  "partial_paid",
  "completed",
  "cancelled",
  "no_show",
  "other",
];

function parseDateOnlyStart(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const dt = new Date(`${value}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseDateOnlyEndExclusive(value) {
  const start = parseDateOnlyStart(value);
  if (!start) return null;
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function parseIntOrNull(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function getInvoiceTotal(invoice) {
  if (!invoice) return 0;
  if (invoice.finalAmount != null) return Number(invoice.finalAmount || 0);
  return Number(invoice.totalAmount || 0);
}

function parseServiceCategoryValues(rawValue) {
  if (!rawValue) return [];
  if (Array.isArray(rawValue)) {
    return rawValue
      .flatMap((v) => String(v || "").split(","))
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return String(rawValue)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function deriveEncounterBillingStatus({
  closedWithoutPayment,
  invoice,
  totalAmount,
  paidAmount,
}) {
  if (closedWithoutPayment) return "close_without_payment";
  if (!invoice || isInvoiceVoidedStatus(invoice.statusLegacy)) return "no_invoice";

  // Business rule for free encounter in finance monitor:
  // encounter has a real (non-voided) invoice and its total amount is zero.
  if (normalizeMoney(totalAmount) <= 0) return "free";

  const remaining = normalizeMoney(totalAmount - paidAmount);
  if (remaining <= 0) return "paid";
  if (normalizeMoney(paidAmount) <= 0) return "unpaid";
  return "partial";
}

function buildPatientData(encounter) {
  const patient = encounter.patientBook?.patient;
  if (!patient) {
    return {
      id: null,
      name: null,
      phone: null,
    };
  }
  return {
    id: patient.id,
    name: patient.name ?? null,
    phone: patient.phone ?? null,
  };
}

function buildDoctorData(encounter) {
  if (!encounter.doctor) return null;
  return {
    id: encounter.doctor.id,
    name: encounter.doctor.name ?? null,
  };
}

function buildBranchData(encounter) {
  if (!encounter.patientBook?.patient?.branch) return null;
  return {
    id: encounter.patientBook.patient.branch.id,
    name: encounter.patientBook.patient.branch.name,
  };
}

export function buildEncounterFinanceRow(encounter) {
  const invoice = encounter.invoice || null;
  const totalAmount = normalizeMoney(getInvoiceTotal(invoice));
  const paidAmount = normalizeMoney(computePaidTotal(invoice?.payments || []));
  const remainingAmount = normalizeMoney(totalAmount - paidAmount);
  const billingStatus = deriveEncounterBillingStatus({
    closedWithoutPayment: !!encounter.closedWithoutPayment,
    invoice,
    totalAmount,
    paidAmount,
  });

  return {
    id: encounter.id,
    status: encounter.appointment?.status || "other",
    appointment: {
      scheduledAt: encounter.appointment?.scheduledAt
        ? encounter.appointment.scheduledAt.toISOString()
        : null,
    },
    patient: buildPatientData(encounter),
    doctor: buildDoctorData(encounter),
    branch: buildBranchData(encounter),
    invoice: invoice
      ? {
          id: invoice.id,
          totalAmount,
          statusLegacy: invoice.statusLegacy ?? null,
          isVoided: isInvoiceVoidedStatus(invoice.statusLegacy),
        }
      : null,
    paidAmount,
    remainingAmount,
    billingStatus,
    closedWithoutPayment: {
      value: !!encounter.closedWithoutPayment,
      note: encounter.closedWithoutPaymentNote || null,
      at: encounter.closedWithoutPaymentAt
        ? encounter.closedWithoutPaymentAt.toISOString()
        : null,
    },
  };
}

function matchesPatient(row, patientSearch) {
  if (!patientSearch) return true;
  const needle = patientSearch.toLowerCase();
  return [row.patient?.name, row.patient?.phone].some((v) =>
    String(v || "").toLowerCase().includes(needle)
  );
}

function matchesEncounterId(row, encounterId) {
  if (!encounterId) return true;
  return row.id === encounterId;
}

export function buildEncounterSummary(rows = []) {
  return rows.reduce(
    (acc, row) => {
      acc.totalEncounters += 1;
      if (row.billingStatus === "no_invoice") acc.noInvoice += 1;
      if (row.billingStatus === "unpaid" || row.billingStatus === "partial") {
        acc.invoicedUnpaidOrPartial += 1;
      }
      if (row.billingStatus === "free") acc.freeEncounters += 1;
      if (row.closedWithoutPayment?.value) acc.closedWithoutPayment += 1;
      return acc;
    },
    {
      totalEncounters: 0,
      noInvoice: 0,
      invoicedUnpaidOrPartial: 0,
      freeEncounters: 0,
      closedWithoutPayment: 0,
    }
  );
}

router.use(requireRole("admin", "super_admin", "manager", "accountant", "receptionist"));

router.get("/", async (req, res) => {
  try {
    const fromDate = parseDateOnlyStart(req.query.from);
    const toDateExclusive = parseDateOnlyEndExclusive(req.query.to);
    if (!fromDate || !toDateExclusive) {
      return res.status(400).json({
        error: "from, to query parameters are required in YYYY-MM-DD format.",
      });
    }

    const page = Math.max(Number(req.query.page || 1), 1);
    const rawPageSize =
      req.query.pageSize == null || req.query.pageSize === ""
        ? DEFAULT_PAGE_SIZE
        : Number(req.query.pageSize);
    if (Number.isNaN(rawPageSize)) {
      return res.status(400).json({ error: "Invalid pageSize query parameter." });
    }
    const pageSize = Math.min(Math.max(rawPageSize, MIN_PAGE_SIZE), MAX_PAGE_SIZE);

    const branchId = parseIntOrNull(req.query.branchId);
    const doctorId = parseIntOrNull(req.query.doctorId);
    const encounterId = parseIntOrNull(req.query.encounterId);
    const patientSearch = typeof req.query.patient === "string" ? req.query.patient.trim() : "";
    const billingStatusRaw =
      typeof req.query.billingStatus === "string" ? req.query.billingStatus.trim().toLowerCase() : "all";
    const billingStatus = BILLING_STATUS_VALUES.has(billingStatusRaw) ? billingStatusRaw : "all";
    const encounterStatusRaw =
      typeof req.query.encounterStatus === "string" ? req.query.encounterStatus.trim().toLowerCase() : "";
    const serviceCategories = parseServiceCategoryValues(req.query.serviceCategoryIds);

    const encounters = await prisma.encounter.findMany({
      where: { appointmentId: { not: null } },
      orderBy: { id: "desc" },
      include: {
        appointment: { select: { scheduledAt: true, status: true } },
        doctor: { select: { id: true, name: true } },
        patientBook: {
          select: {
            patient: {
              select: {
                id: true,
                name: true,
                phone: true,
                branch: { select: { id: true, name: true } },
              },
            },
          },
        },
        invoice: {
          select: {
            id: true,
            totalAmount: true,
            finalAmount: true,
            statusLegacy: true,
            payments: {
              select: { amount: true },
            },
          },
        },
        encounterServices: {
          select: {
            service: { select: { category: true } },
          },
        },
      },
    });

    const filteredEncounters = encounters.filter((encounter) => {
      const scheduledAt = encounter.appointment?.scheduledAt;
      if (!scheduledAt) return false;
      if (scheduledAt < fromDate || scheduledAt >= toDateExclusive) return false;
      if (branchId && encounter.patientBook?.patient?.branch?.id !== branchId) return false;
      if (doctorId && encounter.doctorId !== doctorId) return false;
      if (encounterStatusRaw && String(encounter.appointment?.status || "").toLowerCase() !== encounterStatusRaw) {
        return false;
      }
      if (serviceCategories.length > 0) {
        const categories = new Set(
          (encounter.encounterServices || []).map((row) => row.service?.category).filter(Boolean)
        );
        const hasCategory = serviceCategories.some((category) => categories.has(category));
        if (!hasCategory) return false;
      }
      return true;
    });

    let rows = filteredEncounters.map((encounter) => buildEncounterFinanceRow(encounter));
    if (patientSearch) rows = rows.filter((row) => matchesPatient(row, patientSearch));
    if (encounterId) rows = rows.filter((row) => matchesEncounterId(row, encounterId));
    if (billingStatus !== "all") rows = rows.filter((row) => row.billingStatus === billingStatus);

    const summary = buildEncounterSummary(rows);
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const items = rows.slice(start, start + pageSize);

    return res.json({
      page,
      pageSize,
      total,
      summary,
      billingStatusOptions: Array.from(BILLING_STATUS_VALUES).filter((value) => value !== "all"),
      encounterStatusOptions: APPOINTMENT_STATUS_VALUES,
      items,
    });
  } catch (err) {
    console.error("GET /api/finance/encounters error:", err);
    return res.status(500).json({ error: "Failed to fetch finance encounters." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id." });
    }

    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        appointment: { select: { id: true, scheduledAt: true, status: true } },
        doctor: { select: { id: true, name: true } },
        patientBook: {
          select: {
            patient: {
              select: {
                id: true,
                name: true,
                phone: true,
                branch: { select: { id: true, name: true } },
              },
            },
          },
        },
        encounterServices: {
          include: {
            service: { select: { id: true, name: true, category: true } },
          },
        },
        invoice: {
          include: {
            items: {
              include: { service: { select: { category: true } } },
            },
            payments: true,
          },
        },
      },
    });

    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found." });
    }

    const row = buildEncounterFinanceRow(encounter);
    const invoiceTotal = row.invoice?.totalAmount || 0;
    const payments = (encounter.invoice?.payments || []).map((payment) => ({
      id: payment.id,
      method: payment.method,
      amount: Number(payment.amount || 0),
      timestamp: payment.timestamp ? payment.timestamp.toISOString() : null,
      status: Number(payment.meta?.reversalPaymentId || 0) > 0 ? "reversed" : "active",
      reversal: {
        reversalPaymentId: Number(payment.meta?.reversalPaymentId || 0) || null,
        reversedAt: payment.meta?.reversedAt || null,
        reason: payment.meta?.reversalReason || null,
      },
    }));

    const clinicalItems = (encounter.encounterServices || []).map((serviceRow) => {
      const qtyRaw = Number(serviceRow.meta?.qty);
      const qty = Number.isFinite(qtyRaw) && qtyRaw >= 1 ? Math.floor(qtyRaw) : serviceRow.quantity || 1;
      const price = Number(serviceRow.service?.price ?? serviceRow.price ?? 0);
      return {
        id: serviceRow.id,
        serviceId: serviceRow.serviceId,
        name: serviceRow.service?.name || `Service #${serviceRow.serviceId}`,
        category: serviceRow.service?.category || null,
        qty,
        price,
        total: normalizeMoney(price * qty),
      };
    });

    return res.json({
      ...row,
      invoice: row.invoice
        ? {
            id: row.invoice.id,
            totalAmount: invoiceTotal,
            paidAmount: row.paidAmount,
            remainingAmount: row.remainingAmount,
            statusLegacy: row.invoice.statusLegacy,
            billingStatus: row.billingStatus,
            isVoided: row.invoice.isVoided,
          }
        : null,
      clinical: {
        totalItems: clinicalItems.length,
        services: clinicalItems,
      },
      payments,
    });
  } catch (err) {
    console.error("GET /api/finance/encounters/:id error:", err);
    return res.status(500).json({ error: "Failed to fetch encounter details." });
  }
});

router.post("/:id/create-invoice", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id." });
    }

    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        appointment: { select: { branchId: true } },
        patientBook: { select: { patient: { select: { id: true } } } },
        encounterServices: {
          include: { service: true },
        },
        invoice: { select: { id: true, statusLegacy: true } },
      },
    });

    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found." });
    }
    if (encounter.closedWithoutPayment) {
      return res.status(409).json({ error: "Төлбөргүй хаагдсан үзлэгт нэхэмжлэл үүсгэх боломжгүй." });
    }
    if (encounter.invoice) {
      return res.status(409).json({ error: "Энэ үзлэг дээр нэхэмжлэл аль хэдийн үүссэн байна." });
    }
    if (!encounter.appointment?.branchId) {
      return res.status(409).json({ error: "Салбарын мэдээлэлгүй тул нэхэмжлэл үүсгэх боломжгүй." });
    }
    if (!encounter.patientBook?.patient?.id) {
      return res.status(409).json({ error: "Үйлчлүүлэгчийн мэдээлэлгүй тул нэхэмжлэл үүсгэх боломжгүй." });
    }

    const invoiceItems = (encounter.encounterServices || []).map((serviceRow) => {
      const unitPrice = Number(serviceRow.service?.price ?? serviceRow.price ?? 0);
      const qtyRaw = Number(serviceRow.meta?.qty);
      const quantity = Number.isFinite(qtyRaw) && qtyRaw >= 1 ? Math.floor(qtyRaw) : serviceRow.quantity || 1;
      const lineTotal = normalizeMoney(unitPrice * quantity);
      return {
        itemType: "SERVICE",
        serviceId: serviceRow.serviceId,
        name: serviceRow.service?.name || `Service #${serviceRow.serviceId}`,
        unitPrice,
        quantity,
        lineTotal,
        source: "ENCOUNTER",
      };
    });

    if (invoiceItems.length === 0) {
      return res.status(409).json({ error: "Үзлэг дээр үйлчилгээ байхгүй тул нэхэмжлэл үүсгэх боломжгүй." });
    }

    const totalAmount = normalizeMoney(invoiceItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0));
    const createdInvoice = await prisma.invoice.create({
      data: {
        branchId: encounter.appointment.branchId,
        encounterId,
        patientId: encounter.patientBook.patient.id,
        totalAmount,
        totalBeforeDiscount: totalAmount,
        finalAmount: totalAmount,
        statusLegacy: "unpaid",
        items: {
          create: invoiceItems,
        },
      },
      select: { id: true, totalAmount: true, finalAmount: true, statusLegacy: true },
    });

    return res.json({
      ok: true,
      invoice: {
        id: createdInvoice.id,
        totalAmount: normalizeMoney(getInvoiceTotal(createdInvoice)),
        statusLegacy: createdInvoice.statusLegacy ?? null,
      },
    });
  } catch (err) {
    console.error("POST /api/finance/encounters/:id/create-invoice error:", err);
    return res.status(500).json({ error: "Нэхэмжлэл үүсгэхэд алдаа гарлаа." });
  }
});

router.post("/:id/mark-free", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id." });
    }

    const noteRaw = typeof req.body?.note === "string" ? req.body.note.trim() : "";
    const note = noteRaw || "Санхүү: Төлбөргүй үзлэг";

    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        appointment: true,
        invoice: {
          include: { payments: true },
        },
      },
    });
    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found." });
    }

    if (encounter.invoice) {
      const totalAmount = getInvoiceTotal(encounter.invoice);
      const paidAmount = computePaidTotal(encounter.invoice.payments || []);
      if (normalizeMoney(totalAmount - paidAmount) > 0) {
        return res.status(409).json({
          error: "Үлдэгдэлтэй нэхэмжлэлтэй үзлэгийг төлбөргүй болгож болохгүй.",
        });
      }
    }

    await prisma.encounter.update({
      where: { id: encounterId },
      data: {
        closedWithoutPayment: true,
        closedWithoutPaymentNote: note,
        closedWithoutPaymentAt: new Date(),
        closedWithoutPaymentByUserId: req.user?.id ?? null,
      },
    });

    if (encounter.appointmentId) {
      await prisma.appointment.update({
        where: { id: encounter.appointmentId },
        data: { status: "completed" },
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/finance/encounters/:id/mark-free error:", err);
    return res.status(500).json({ error: "Төлбөргүй үзлэг болгоход алдаа гарлаа." });
  }
});

export default router;
