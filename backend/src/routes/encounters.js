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
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }

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
        doctor: true,
        nurse: true,
        diagnoses: {
          include: {
            diagnosis: true,
            sterilizationIndicators: {
              include: {
                indicator: {
                  select: {
                    id: true,
                    packageName: true,
                    code: true,
                    branchId: true,
          },
        },
      },
    },
  },
  orderBy: { createdAt: "asc" },
},
        encounterServices: {
          include: { service: true },
          orderBy: { id: "asc" },
        },
        invoice: {
          include: {
            items: { orderBy: { id: "asc" } },
            payments: true,
            eBarimtReceipt: true,
            branch: true,
            encounter: true,
            patient: true,
            ledgerEntries: true,
          },
        },
        prescription: {
          include: {
            items: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    const result = { ...encounter, encounterDiagnoses: encounter.diagnoses };
    return res.json(result);
  } catch (err) {
    console.error("GET /api/encounters/:id error:", err);
    return res.status(500).json({ error: "Failed to load encounter" });
  }
});

/**
 * ============================
 * CONSENT FORMS (multi-type)
 * ============================
 *
 * DB constraint: UNIQUE(encounterId, type)
 *
 * New API:
 *  - GET  /api/encounters/:id/consents
 *  - PUT  /api/encounters/:id/consents/:type
 *  - POST /api/encounters/:id/consents/:type/patient-signature   (multipart file=<png>)
 *  - POST /api/encounters/:id/consents/:type/doctor-signature    (attach from encounter doctor profile)
 *
 * Legacy API (kept for backward compatibility):
 *  - GET /api/encounters/:id/consent   (latest)
 *  - PUT /api/encounters/:id/consent   (delete all when type null, else upsert by encounterId_type)
 */

/**
 * NEW: GET /api/encounters/:id/consents
 * Returns ALL consent forms for this encounter (0..N).
 */
router.get("/:id/consents", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }

    const consents = await prisma.encounterConsent.findMany({
      where: { encounterId },
      orderBy: { updatedAt: "desc" },
    });

    return res.json(consents);
  } catch (err) {
    console.error("GET /api/encounters/:id/consents error:", err);
    return res.status(500).json({ error: "Failed to load encounter consents" });
  }
});

/**
 * NEW: PUT /api/encounters/:id/consents/:type
 * Body: { answers?: object | null }
 *
 * - answers === null -> delete consent of that type
 * - else -> upsert consent of that type
 */
router.put("/:id/consents/:type", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    const type = String(req.params.type || "").trim();

    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }
    if (!type) {
      return res.status(400).json({ error: "Invalid consent type" });
    }

    const { answers } = req.body || {};

    // Ensure encounter exists
    const existingEncounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      select: { id: true },
    });
    if (!existingEncounter) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    if (answers === null) {
      await prisma.encounterConsent.deleteMany({
        where: { encounterId, type },
      });
      return res.json(null);
    }

    const consent = await prisma.encounterConsent.upsert({
      where: { encounterId_type: { encounterId, type } },
      create: { encounterId, type, answers: answers ?? {} },
      update: { answers: answers ?? {} },
    });

    return res.json(consent);
  } catch (err) {
    console.error("PUT /api/encounters/:id/consents/:type error:", err);
    return res.status(500).json({ error: "Failed to save encounter consent" });
  }
});

/**
 * POST /api/encounters/:id/patient-signature
 * multipart/form-data: file=<png>
 *
 * Saves patient/guardian drawn signature for this encounter.
 * Shared across all consent forms.
 */
router.post(
  "/:id/patient-signature",
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

      const publicPath = `/media/${path.basename(req.file.path)}`;

      const encounter = await prisma.encounter.update({
        where: { id: encounterId },
        data: {
          patientSignaturePath: publicPath,
          patientSignedAt: new Date(),
        },
        select: {
          patientSignaturePath: true,
          patientSignedAt: true,
        },
      });

      return res.json({
        patientSignaturePath: encounter.patientSignaturePath,
        patientSignedAt: encounter.patientSignedAt,
      });
    } catch (err) {
      console.error(
        "POST /api/encounters/:id/patient-signature error:",
        err
      );
      return res.status(500).json({ error: "Failed to save patient signature" });
    }
  }
);

/**
 * POST /api/encounters/:id/doctor-signature
 * multipart/form-data (optional): file=<png>
 *
 * Saves doctor signature for this encounter (shared across all consent forms).
 * - If file is provided: upload and store
 * - If no file: attach from doctor's profile signatureImagePath
 */
router.post(
  "/:id/doctor-signature",
  upload.single("file"),
  async (req, res) => {
    try {
      const encounterId = Number(req.params.id);

      if (!encounterId || Number.isNaN(encounterId)) {
        return res.status(400).json({ error: "Invalid encounter id" });
      }

      let signaturePath = null;

      if (req.file) {
        // File uploaded - use it
        signaturePath = `/media/${path.basename(req.file.path)}`;
      } else {
        // No file - attach from doctor profile
        const enc = await prisma.encounter.findUnique({
          where: { id: encounterId },
          select: {
            id: true,
            doctor: { select: { signatureImagePath: true } },
          },
        });

        if (!enc) return res.status(404).json({ error: "Encounter not found" });

        signaturePath = enc.doctor?.signatureImagePath || null;
        if (!signaturePath) {
          return res.status(400).json({
            error: "Doctor signature not found. Upload signature on doctor profile first.",
          });
        }
      }

      const encounter = await prisma.encounter.update({
        where: { id: encounterId },
        data: {
          doctorSignaturePath: signaturePath,
          doctorSignedAt: new Date(),
        },
        select: {
          doctorSignaturePath: true,
          doctorSignedAt: true,
        },
      });

      return res.json({
        doctorSignaturePath: encounter.doctorSignaturePath,
        doctorSignedAt: encounter.doctorSignedAt,
      });
    } catch (err) {
      console.error(
        "POST /api/encounters/:id/doctor-signature error:",
        err
      );
      return res.status(500).json({ error: "Failed to attach doctor signature" });
    }
  }
);

/**
 * LEGACY: GET /api/encounters/:id/consent
 * Returns latest consent (or null).
 */
router.get("/:id/consent", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }

    const consent = await prisma.encounterConsent.findFirst({
      where: { encounterId },
      orderBy: { updatedAt: "desc" },
    });

    return res.json(consent || null);
  } catch (err) {
    console.error("GET /api/encounters/:id/consent error:", err);
    return res.status(500).json({ error: "Failed to load encounter consent" });
  }
});

/**
 * LEGACY: PUT /api/encounters/:id/consent
 * Body: { type: string | null, answers?: object }
 *
 * - If type is null -> delete ALL consents for encounter
 * - Otherwise upsert consent for that type (by encounterId_type)
 */
router.put("/:id/consent", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }

    const { type, answers } = req.body || {};

    // Ensure encounter exists
    const existingEncounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      select: { id: true },
    });
    if (!existingEncounter) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    // No type => remove ALL consents
    if (type === null || type === undefined || String(type).trim() === "") {
      await prisma.encounterConsent.deleteMany({
        where: { encounterId },
      });
      return res.json(null);
    }

    const typeStr = String(type).trim();

    const consent = await prisma.encounterConsent.upsert({
      where: { encounterId_type: { encounterId, type: typeStr } },
      create: {
        encounterId,
        type: typeStr,
        answers: answers ?? {},
      },
      update: {
        answers: answers ?? {},
      },
    });

    return res.json(consent);
  } catch (err) {
    console.error("PUT /api/encounters/:id/consent error:", err);
    return res.status(500).json({ error: "Failed to save encounter consent" });
  }
});

/**
 * GET /api/encounters/:id/nurses
 * Returns nurses scheduled on the encounter's visitDate and branch.
 */
router.get("/:id/nurses", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }

    // Load encounter with patient & branch to infer branchId + date
    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        patientBook: {
          include: {
            patient: {
              include: { branch: true },
            },
          },
        },
      },
    });

    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    const visitDate = new Date(encounter.visitDate);
    if (Number.isNaN(visitDate.getTime())) {
      return res.status(400).json({ error: "Invalid encounter date" });
    }

    // Normalize date to day range [start, end)
    visitDate.setHours(0, 0, 0, 0);
    const start = new Date(visitDate);
    const end = new Date(visitDate);
    end.setDate(end.getDate() + 1);

    const branchId = encounter.patientBook.patient.branchId;

    const whereSchedule = {
      date: {
        gte: start,
        lt: end,
      },
    };

    if (branchId) {
      whereSchedule.branchId = branchId;
    }

    const schedules = await prisma.nurseSchedule.findMany({
      where: whereSchedule,
      include: {
        nurse: {
          select: {
            id: true,
            email: true,
            name: true,
            ovog: true,
            phone: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ startTime: "asc" }],
    });

    if (!schedules.length) {
      return res.json({ count: 0, items: [] });
    }

    // Group by nurseId so each nurse appears once with their schedules
    const map = new Map();
    for (const s of schedules) {
      if (!map.has(s.nurseId)) {
        map.set(s.nurseId, {
          nurseId: s.nurseId,
          name: s.nurse.name,
          ovog: s.nurse.ovog,
          email: s.nurse.email,
          phone: s.nurse.phone || null,
          schedules: [],
        });
      }
      const entry = map.get(s.nurseId);
      entry.schedules.push({
        id: s.id,
        date: s.date.toISOString().slice(0, 10),
        branch: s.branch,
        startTime: s.startTime,
        endTime: s.endTime,
        note: s.note,
      });
    }

    const items = Array.from(map.values());
    return res.json({ count: items.length, items });
  } catch (err) {
    console.error("GET /api/encounters/:id/nurses error:", err);
    return res
      .status(500)
      .json({ error: "Failed to load nurses for encounter" });
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
      select: { price: true, category: true }, // category optional; useful later
    });
    if (!svc) continue;

    await trx.encounterService.create({
      data: {
        encounterId,
        serviceId: item.serviceId,
        quantity: item.quantity ?? 1,
        price: svc.price,

        // NEW: store assignment for IMAGING (xray) services.
        // For non-IMAGING services this will still default to DOCTOR; harmless.
        meta: { assignedTo: item.assignedTo ?? "DOCTOR" },
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
 * PUT /api/encounters/:id/nurse
 * Body: { nurseId: number | null }
 */
router.put("/:id/nurse", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }

    const { nurseId } = req.body || {};

    let nurseIdValue = null;

    if (nurseId !== null && nurseId !== undefined) {
      const nid = Number(nurseId);
      if (!nid || Number.isNaN(nid)) {
        return res.status(400).json({ error: "Invalid nurse id" });
      }

      const nurse = await prisma.user.findUnique({
        where: { id: nid },
        select: { id: true, role: true },
      });

      if (!nurse || nurse.role !== "nurse") {
        return res.status(404).json({ error: "Nurse not found" });
      }

      nurseIdValue = nid;
    }

    const updated = await prisma.encounter.update({
      where: { id: encounterId },
      data: { nurseId: nurseIdValue },
      include: { nurse: true },
    });

    return res.json({ nurse: updated.nurse });
  } catch (err) {
    console.error("PUT /api/encounters/:id/nurse error:", err);
    return res.status(500).json({ error: "Failed to update nurse" });
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
        patientBook: { include: { patient: true } },
        doctor: true,
        prescription: { include: { items: true } },
      },
    });

    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    // Normalize + filter items (max 3, non-empty drugName)
    const normalized = items
      .map((raw) => ({
        drugName: typeof raw.drugName === "string" ? raw.drugName.trim() : "",
        durationDays: Number(raw.durationDays) || 1,
        quantityPerTake: Number(raw.quantityPerTake) || 1,
        frequencyPerDay: Number(raw.frequencyPerDay) || 1,
        note:
          typeof raw.note === "string" && raw.note.trim() ? raw.note.trim() : null,
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
      ? (doctor.name && doctor.name.trim()) || (doctor.email || "").split("@")[0]
      : null;

    const patientNameSnapshot = patient
      ? `${patient.ovog ? patient.ovog.charAt(0) + ". " : ""}${patient.name || ""}`.trim()
      : null;

    const diagnosisSummary = "";

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
            quantityPerTake: it.quantityPerTake > 0 ? it.quantityPerTake : 1,
            frequencyPerDay: it.frequencyPerDay > 0 ? it.frequencyPerDay : 1,
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
    return res.status(500).json({ error: "Failed to save prescription" });
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

        const toothGroup =
          typeof t.toothGroup === "string" && t.toothGroup.trim()
            ? t.toothGroup.trim()
            : null;

        await trx.chartTooth.create({
          data: {
            encounterId,
            toothCode: t.toothCode.trim(),
            toothGroup,
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
    console.error("PUT /api/encounters/:id/chart-teeth error", err);
    return res.status(500).json({ error: "Failed to save tooth chart" });
  }
});

/**
 * PUT /api/encounters/:id/finish
 *
 * Doctor finishes encounter → mark related appointment as ready_to_pay
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
        // NOTE: make sure this matches your AppointmentStatus enum value
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
router.post("/:id/media", upload.single("file"), async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "file is required" });
    }

    const { toothCode, type } = req.body || {};
    const mediaType = typeof type === "string" && type.trim() ? type.trim() : "XRAY";

    const publicPath = `/media/${path.basename(req.file.path)}`;

    const media = await prisma.media.create({
      data: {
        encounterId,
        filePath: publicPath,
        toothCode:
          typeof toothCode === "string" && toothCode.trim() ? toothCode.trim() : null,
        type: mediaType,
      },
    });

    return res.status(201).json(media);
  } catch (err) {
    console.error("POST /api/encounters/:id/media error:", err);
    return res.status(500).json({ error: "Failed to upload media" });
  }
});

// PUT /api/encounters/:id/diagnoses/:dxId/sterilization-indicators
// Body: { indicatorIds: number[] }  // duplicates allowed
router.put("/:id/diagnoses/:dxId/sterilization-indicators", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    const dxId = Number(req.params.dxId);
    const indicatorIdsRaw = Array.isArray(req.body?.indicatorIds)
      ? req.body.indicatorIds
      : [];

    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }
    if (!dxId || Number.isNaN(dxId)) {
      return res.status(400).json({ error: "Invalid diagnosis id" });
    }

    const indicatorIds = indicatorIdsRaw
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0);

    // Ensure diagnosis belongs to encounter
    const dx = await prisma.encounterDiagnosis.findFirst({
      where: { id: dxId, encounterId },
      select: { id: true },
    });
    if (!dx) {
      return res.status(404).json({ error: "Encounter diagnosis not found" });
    }

    await prisma.$transaction(async (trx) => {
      await trx.encounterDiagnosisSterilizationIndicator.deleteMany({
        where: { encounterDiagnosisId: dxId },
      });

      // duplicates allowed -> createMany but without skipDuplicates
      if (indicatorIds.length > 0) {
        await trx.encounterDiagnosisSterilizationIndicator.createMany({
          data: indicatorIds.map((indicatorId) => ({
            encounterDiagnosisId: dxId,
            indicatorId,
          })),
        });
      }
    });

    // return updated diagnosis row with included indicators
    const updated = await prisma.encounterDiagnosis.findUnique({
      where: { id: dxId },
      include: {
        diagnosis: true,
        sterilizationIndicators: {
          include: {
            indicator: true,
          },
        },
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error(
      "PUT /api/encounters/:id/diagnoses/:dxId/sterilization-indicators error:",
      err
    );
    return res
      .status(500)
      .json({ error: "Failed to save sterilization indicators" });
  }
});

export default router;
