import express from "express";
import prisma from "../db.js";
import multer from "multer";
import path from "path";

const router = express.Router();

// --- Media upload config ---
const uploadDir = process.env.MEDIA_UPLOAD_DIR || "/data/media";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    const base = path
      .basename(file.originalname, ext)
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_\-]/g, "");
    const ts = Date.now();
    cb(null, `${base}_${ts}${ext}`);
  },
});

const upload = multer({ storage });

/**
 * GET /api/encounters/:id
 * Detailed encounter view for admin page / billing.
 */
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }

    const encounter = await prisma.encounter.findUnique({
      where: { id },
      include: {
        patientBook: {
          include: {
            patient: {
              include: { branch: true },
            },
          },
        },
        doctor: true,
        diagnoses: {
          include: { diagnosis: true },
          orderBy: { createdAt: "asc" },
        },
        encounterServices: {
          include: {
            service: true,
          },
          orderBy: { id: "asc" },
        },
        invoice: {
          include: {
            invoiceItems: {
              include: {
                procedure: true,
              },
              orderBy: { id: "asc" },
            },
            payment: true,
            eBarimtReceipt: true,
          },
        },
        prescription: {
          include: {
            items: {
              orderBy: { order: "asc" },
            },
          },
        },
        // chartTeeth can be loaded separately via chart-teeth endpoints
      },
    });

    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    const result = {
      ...encounter,
      encounterDiagnoses: encounter.diagnoses,
    };

    return res.json(result);
  } catch (err) {
    console.error("GET /api/encounters/:id error:", err);
    return res.status(500).json({ error: "Failed to load encounter" });
  }
});

/**
 * PUT /api/encounters/:id/diagnoses
 */
router.put("/:id/diagnoses", async (req, res) => {
  const encounterId = Number(req.params.id);
  if (!encounterId || Number.isNaN(encounterId)) {
    return res.status(400).json({ error: "Invalid encounter id" });
  }

  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "items must be an array" });
  }

  try {
    await prisma.$transaction(async (trx) => {
      await trx.encounterDiagnosis.deleteMany({
        where: { encounterId },
      });

      for (const item of items) {
        if (!item.diagnosisId) continue;

        const selectedProblemIds = Array.isArray(item.selectedProblemIds)
          ? item.selectedProblemIds
              .map((id) => Number(id))
              .filter((n) => !Number.isNaN(n))
          : [];

        const toothCode =
          typeof item.toothCode === "string" && item.toothCode.trim()
            ? item.toothCode.trim()
            : null;

        await trx.encounterDiagnosis.create({
          data: {
            encounterId,
            diagnosisId: item.diagnosisId,
            selectedProblemIds:
              selectedProblemIds.length > 0 ? selectedProblemIds : [],
            note: item.note ?? null,
            toothCode,
          },
        });
      }
    });

    const updated = await prisma.encounterDiagnosis.findMany({
      where: { encounterId },
      include: { diagnosis: true },
      orderBy: { id: "asc" },
    });

    return res.json(updated);
  } catch (err) {
    console.error("PUT /api/encounters/:id/diagnoses failed", err);
    return res.status(500).json({ error: "Failed to save diagnoses" });
  }
});

/**
 * PUT /api/encounters/:id/services
 */
router.put("/:id/services", async (req, res) => {
  const encounterId = Number(req.params.id);
  if (!encounterId || Number.isNaN(encounterId)) {
    return res.status(400).json({ error: "Invalid encounter id" });
  }

  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "items must be an array" });
  }

  try {
    await prisma.$transaction(async (trx) => {
      await trx.encounterService.deleteMany({
        where: { encounterId },
      });

      for (const item of items) {
        if (!item.serviceId) continue;

        const svc = await trx.service.findUnique({
          where: { id: item.serviceId },
          select: { price: true },
        });
        if (!svc) continue;

        await trx.encounterService.create({
          data: {
            encounterId,
            serviceId: item.serviceId,
            quantity: item.quantity ?? 1,
            price: svc.price,
          },
        });
      }
    });

    const updated = await prisma.encounterService.findMany({
      where: { encounterId },
      include: { service: true },
      orderBy: { id: "asc" },
    });

    return res.json(updated);
  } catch (err) {
    console.error("PUT /api/encounters/:id/services error:", err);
    return res.status(500).json({ error: "Failed to save services" });
  }
});

/**
 * PUT /api/encounters/:id/prescription
 */
router.put("/:id/prescription", async (req, res) => {
  const encounterId = Number(req.params.id);
  if (!encounterId || Number.isNaN(encounterId)) {
    return res.status(400).json({ error: "Invalid encounter id" });
  }

  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "items must be an array" });
  }

  try {
    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        patientBook: {
          include: {
            patient: true,
          },
        },
        doctor: true,
        prescription: {
          include: { items: true },
        },
      },
    });

    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    // Normalize + filter items (max 3, non-empty drugName)
    const normalized = items
      .map((raw) => ({
        drugName:
          typeof raw.drugName === "string" ? raw.drugName.trim() : "",
        durationDays: Number(raw.durationDays) || 1,
        quantityPerTake: Number(raw.quantityPerTake) || 1,
        frequencyPerDay: Number(raw.frequencyPerDay) || 1,
        note:
          typeof raw.note === "string" && raw.note.trim()
            ? raw.note.trim()
            : null,
      }))
      .filter((it) => it.drugName.length > 0)
      .slice(0, 3);

    // If no valid items -> delete existing prescription (if any) and return null
    if (normalized.length === 0) {
      if (encounter.prescription) {
        await prisma.prescriptionItem.deleteMany({
          where: { prescriptionId: encounter.prescription.id },
        });
        await prisma.prescription.delete({
          where: { id: encounter.prescription.id },
        });
      }
      return res.json({ prescription: null });
    }

    const patient = encounter.patientBook?.patient;
    const doctor = encounter.doctor;

    const doctorNameSnapshot = doctor
      ? (doctor.name && doctor.name.trim()) ||
        (doctor.email || "").split("@")[0]
      : null;

    const patientNameSnapshot = patient
      ? `${patient.ovog ? patient.ovog.charAt(0) + ". " : ""}${
          patient.name || ""
        }`.trim()
      : null;

    const diagnosisSummary = ""; // can be filled later from EncounterDiagnosis

    // Upsert prescription + items in a transaction
    const updatedPrescription = await prisma.$transaction(async (trx) => {
      let prescription = encounter.prescription;

      if (!prescription) {
        prescription = await trx.prescription.create({
          data: {
            encounterId,
            doctorNameSnapshot,
            patientNameSnapshot,
            diagnosisSummary,
            clinicNameSnapshot: patient?.branch?.name || null,
          },
        });
      } else {
        prescription = await trx.prescription.update({
          where: { id: prescription.id },
          data: {
            doctorNameSnapshot,
            patientNameSnapshot,
            diagnosisSummary,
            clinicNameSnapshot: patient?.branch?.name || null,
          },
        });

        await trx.prescriptionItem.deleteMany({
          where: { prescriptionId: prescription.id },
        });
      }

      for (let i = 0; i < normalized.length; i++) {
        const it = normalized[i];
        await trx.prescriptionItem.create({
          data: {
            prescriptionId: prescription.id,
            order: i + 1,
            drugName: it.drugName,
            durationDays: it.durationDays > 0 ? it.durationDays : 1,
            quantityPerTake:
              it.quantityPerTake > 0 ? it.quantityPerTake : 1,
            frequencyPerDay:
              it.frequencyPerDay > 0 ? it.frequencyPerDay : 1,
            note: it.note,
          },
        });
      }

      return trx.prescription.findUnique({
        where: { id: prescription.id },
        include: {
          items: {
            orderBy: { order: "asc" },
          },
        },
      });
    });

    return res.json({ prescription: updatedPrescription });
  } catch (err) {
    console.error("PUT /api/encounters/:id/prescription error:", err);
    return res
      .status(500)
      .json({ error: "Failed to save prescription" });
  }
});

/**
 * GET /api/encounters/:id/chart-teeth
 */
router.get("/:id/chart-teeth", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }

    const chartTeeth = await prisma.chartTooth.findMany({
      where: { encounterId },
      orderBy: { id: "asc" },
      include: {
        chartNotes: true,
      },
    });

    return res.json(chartTeeth);
  } catch (err) {
    console.error("GET /api/encounters/:id/chart-teeth error:", err);
    return res.status(500).json({ error: "Failed to load tooth chart" });
  }
});

/**
 * PUT /api/encounters/:id/chart-teeth
 */
router.put("/:id/chart-teeth", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }

    const { teeth } = req.body || {};
    if (!Array.isArray(teeth)) {
      return res.status(400).json({ error: "teeth must be an array" });
    }

    await prisma.$transaction(async (trx) => {
      await trx.chartTooth.deleteMany({ where: { encounterId } });

      for (const t of teeth) {
        if (!t || typeof t.toothCode !== "string" || !t.toothCode.trim()) {
          continue;
        }
        await trx.chartTooth.create({
          data: {
            encounterId,
            toothCode: t.toothCode.trim(),
            status: t.status || null,
            notes: t.notes || null,
          },
        });
      }
    });

    const updated = await prisma.chartTooth.findMany({
      where: { encounterId },
      orderBy: { id: "asc" },
      include: { chartNotes: true },
    });

    return res.json(updated);
  } catch (err) {
    console.error("PUT /api/encounters/:id/chart-teeth error:", err);
    return res.status(500).json({ error: "Failed to save tooth chart" });
  }
});

/**
 * PUT /api/encounters/:id/finish
 */
router.put("/:id/finish", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }

    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      include: { appointment: true },
    });

    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    if (!encounter.appointmentId || !encounter.appointment) {
      return res.json({ ok: true, updatedAppointment: null });
    }

    const appt = await prisma.appointment.update({
      where: { id: encounter.appointmentId },
      data: {
        status: "ready_to_pay",
      },
    });

    return res.json({ ok: true, updatedAppointment: appt });
  } catch (err) {
    console.error("PUT /api/encounters/:id/finish error:", err);
    return res.status(500).json({
      error: "Үзлэг дууссаны төлөв шинэчлэх үед алдаа гарлаа.",
    });
  }
});

/**
 * POST /api/encounters/:id/billing
 */
router.post("/:id/billing", async (req, res) => {
  const encounterId = Number(req.params.id);
  if (!encounterId || Number.isNaN(encounterId)) {
    return res.status(400).json({ error: "Invalid encounter id" });
  }

  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "items must be an array" });
  }

  try {
    let totalAmount = 0;

    for (const raw of items) {
      const serviceId = Number(raw.serviceId);
      const qty = Number(raw.quantity) || 1;
      const basePrice = Number(raw.price) || 0;
      const discountAmount = Number(raw.discountAmount) || 0;

      if (!serviceId) continue;

      const lineTotal = Math.max(basePrice * qty - discountAmount, 0);
      totalAmount += lineTotal;
    }

    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      include: { invoice: true },
    });

    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    let invoice = encounter.invoice;

    if (!invoice) {
      invoice = await prisma.invoice.create({
        data: {
          encounterId,
          totalAmount,
          status: "pending",
        },
      });
    } else {
      invoice = await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          totalAmount,
        },
      });
    }

    return res.json({
      ok: true,
      invoice,
      totalAmount,
    });
  } catch (err) {
    console.error("POST /api/encounters/:id/billing error:", err);
    return res.status(500).json({ error: "Failed to save billing" });
  }
});

/**
 * GET /api/encounters/:id/media
 */
router.get("/:id/media", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }

    const { type } = req.query;
    const where = { encounterId };
    if (typeof type === "string" && type.trim()) {
      where.type = type.trim();
    }

    const media = await prisma.media.findMany({
      where,
      orderBy: { id: "asc" },
    });

    return res.json(media);
  } catch (err) {
    console.error("GET /api/encounters/:id/media error:", err);
    return res.status(500).json({ error: "Failed to load media" });
  }
});

/**
 * POST /api/encounters/:id/media
 */
router.post(
  "/:id/media",
  upload.single("file"),
  async (req, res) => {
    try {
      const encounterId = Number(req.params.id);
      if (!encounterId || Number.isNaN(encounterId)) {
        return res.status(400).json({ error: "Invalid encounter id" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "file is required" });
      }

      const { toothCode, type } = req.body || {};
      const mediaType =
        typeof type === "string" && type.trim() ? type.trim() : "XRAY";

      const publicPath = `/media/${path.basename(req.file.path)}`;

      const media = await prisma.media.create({
        data: {
          encounterId,
          filePath: publicPath,
          toothCode:
            typeof toothCode === "string" && toothCode.trim()
              ? toothCode.trim()
              : null,
          type: mediaType,
        },
      });

      return res.status(201).json(media);
    } catch (err) {
      console.error("POST /api/encounters/:id/media error:", err);
      return res.status(500).json({ error: "Failed to upload media" });
    }
  }
);

module.exports = router;
