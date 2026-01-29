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
 * PUT /api/encounters/:id/services
 * Body: { items: Array<{ serviceId, quantity?, assignedTo?, diagnosisId? }> }
 *
 * NOTE: Frontend sends partial updates (only services for edited diagnosis rows).
 * This endpoint uses SAFE PARTIAL-UPDATE semantics:
 * - Empty array: returns current services, does not delete anything
 * - Non-empty array: only deletes/recreates services for diagnosis IDs present in payload
 * - Services for other diagnosis rows remain unchanged
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
    // SAFETY: empty payload must not wipe everything
    if (items.length === 0) {
      const current = await prisma.encounterService.findMany({
        where: { encounterId },
        include: { service: true },
        orderBy: { id: "asc" },
      });
      return res.json(current);
    }

    await prisma.$transaction(async (trx) => {
      const diagnosisRowIds = Array.from(
        new Set(
          items
            .map((x) => Number(x.diagnosisId))
            .filter((n) => Number.isFinite(n) && n > 0)
        )
      );

      // Delete only services for the diagnosis row(s) in payload
      if (diagnosisRowIds.length > 0) {
        await trx.encounterService.deleteMany({
          where: {
            encounterId,
            OR: diagnosisRowIds.map((did) => ({
              meta: { path: ["diagnosisId"], equals: did },
            })),
          },
        });
      } else {
        // If no diagnosisId in payload, don't delete anything (avoid mass wipe)
      }

      for (const item of items) {
        const serviceId = Number(item.serviceId);
        if (!Number.isFinite(serviceId) || serviceId <= 0) continue;

        const svc = await trx.service.findUnique({
          where: { id: serviceId },
          select: { price: true },
        });
        if (!svc) continue;

        await trx.encounterService.create({
          data: {
            encounterId,
            serviceId,
            quantity: item.quantity ?? 1,
            price: svc.price,
            meta: {
              assignedTo: item.assignedTo ?? "DOCTOR",
              diagnosisId: item.diagnosisId ?? null,
            },
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

/**
 * PUT /api/encounters/:id/diagnoses
 * Body: { items: Array<{ id?, diagnosisId, selectedProblemIds, note?, toothCode? }> }
 *
 * NOTE: Frontend sends partial updates (only diagnosis rows being edited).
 * This endpoint is NON-DESTRUCTIVE: it only updates/creates rows present in the payload.
 * Diagnosis rows not included in the payload are left unchanged.
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
      // PARTIAL UPDATE: only update/create rows in payload, do not delete others
      for (const item of items) {
        // ---- Validate diagnosisId type (to avoid silently dropping selectedProblemIds) ----
        if (
          item.diagnosisId !== null &&
          item.diagnosisId !== undefined &&
          item.diagnosisId !== ""
        ) {
          const n = Number(item.diagnosisId);
          if (!Number.isFinite(n) || n <= 0) {
            const err = new Error("diagnosisId must be a numeric ID, not a code string");
            err.statusCode = 400;
            err.received = item.diagnosisId;
            throw err;
          }
        }

        // normalize diagnosisId
        let diagnosisIdValue = null;
        if (
          item.diagnosisId !== null &&
          item.diagnosisId !== undefined &&
          item.diagnosisId !== ""
        ) {
          const n = Number(item.diagnosisId);
          diagnosisIdValue = Number.isFinite(n) && n > 0 ? n : null;
        }

        const toothCode =
          typeof item.toothCode === "string" && item.toothCode.trim()
            ? item.toothCode.trim()
            : null;

        const selectedProblemIdsRaw = Array.isArray(item.selectedProblemIds)
          ? item.selectedProblemIds
              .map((id) => Number(id))
              .filter((n) => Number.isFinite(n) && n > 0)
          : [];

        // Only allow problems when diagnosisId is present
        const selectedProblemIds = diagnosisIdValue ? selectedProblemIdsRaw : [];

        const data = {
          encounterId,
          diagnosisId: diagnosisIdValue,
          selectedProblemIds,
          note: item.note ?? null,
          toothCode,
        };

        const rowId = Number(item.id);
        if (Number.isFinite(rowId) && rowId > 0) {
          // update existing (stable id)
          await trx.encounterDiagnosis.update({
            where: { id: rowId },
            data,
          });
        } else {
          // create new
          await trx.encounterDiagnosis.create({ data });
        }
      }
    });

    const updated = await prisma.encounterDiagnosis.findMany({
      where: { encounterId },
      include: {
        diagnosis: true,
        sterilizationIndicators: {
          include: {
            indicator: {
              select: { id: true, packageName: true, code: true, branchId: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return res.json(updated);
  } catch (err) {
    if (err?.statusCode === 400) {
      return res.status(400).json({ error: err.message, received: err.received });
    }
    console.error("PUT /api/encounters/:id/diagnoses failed", err);
    return res.status(500).json({ error: "Failed to save diagnoses" });
  }
});

/**
 * PUT /api/encounters/:id/diagnoses/:diagnosisId/sterilization-indicators
 * Body: { indicatorIds: number[] }
 *
 * Replaces sterilization indicators for a single EncounterDiagnosis row.
 */
router.put("/:id/diagnoses/:diagnosisId/sterilization-indicators", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    const diagnosisRowId = Number(req.params.diagnosisId);

    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }
    if (!diagnosisRowId || Number.isNaN(diagnosisRowId)) {
      return res.status(400).json({ error: "Invalid diagnosis id" });
    }

    const { indicatorIds } = req.body || {};
    if (!Array.isArray(indicatorIds)) {
      return res.status(400).json({ error: "indicatorIds must be an array" });
    }

    const ids = indicatorIds
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0);

    // Ensure this diagnosis row belongs to this encounter
    const row = await prisma.encounterDiagnosis.findFirst({
      where: { id: diagnosisRowId, encounterId },
      select: { id: true },
    });
    if (!row) {
      return res.status(404).json({ error: "EncounterDiagnosis not found for this encounter" });
    }

    await prisma.$transaction(async (trx) => {
      await trx.encounterDiagnosisSterilizationIndicator.deleteMany({
        where: { encounterDiagnosisId: diagnosisRowId },
      });

      if (ids.length) {
        const existing = await trx.sterilizationIndicator.findMany({
          where: { id: { in: ids } },
          select: { id: true },
        });
        const ok = new Set(existing.map((x) => x.id));

        for (const id of ids) {
          if (!ok.has(id)) continue;
          await trx.encounterDiagnosisSterilizationIndicator.create({
            data: { encounterDiagnosisId: diagnosisRowId, indicatorId: id },
          });
        }
      }
    });

    // Return updated diagnosis row with indicators
    const updated = await prisma.encounterDiagnosis.findUnique({
      where: { id: diagnosisRowId },
      include: {
        diagnosis: true,
        sterilizationIndicators: {
          include: {
            indicator: { select: { id: true, packageName: true, code: true, branchId: true } },
          },
        },
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error(
      "PUT /api/encounters/:id/diagnoses/:diagnosisId/sterilization-indicators error:",
      err
    );
    return res.status(500).json({ error: "Failed to save sterilization indicators" });
  }
});

/**
 * POST /api/encounters/:id/follow-up-appointments
 * Create a follow-up appointment with correct branch assignment.
 * The branchId is derived from the doctor's schedule for the selected date/time.
 */
router.post("/:id/follow-up-appointments", async (req, res) => {
  try {
    const encounterId = Number(req.params.id);
    if (!encounterId || Number.isNaN(encounterId)) {
      return res.status(400).json({ error: "Invalid encounter id" });
    }

    const { slotStartIso, durationMinutes } = req.body || {};

    // Validate required fields
    if (!slotStartIso) {
      return res.status(400).json({ error: "slotStartIso is required" });
    }

    // Parse and validate slot start time
    const slotStart = new Date(slotStartIso);
    if (Number.isNaN(slotStart.getTime())) {
      return res.status(400).json({ error: "slotStartIso is invalid date" });
    }

    // Validate and set duration
    let duration = 30; // default
    if (durationMinutes !== undefined && durationMinutes !== null) {
      if (typeof durationMinutes !== "number" || durationMinutes <= 0) {
        return res.status(400).json({ error: "durationMinutes must be a positive number" });
      }
      duration = durationMinutes;
    }

    // Calculate end time
    const slotEnd = new Date(slotStart.getTime() + duration * 60_000);

    // Load encounter to get patientId and doctorId
    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        patientBook: {
          include: {
            patient: true,
          },
        },
      },
    });

    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    if (!encounter.doctorId) {
      return res.status(400).json({ error: "Encounter has no doctor assigned" });
    }

    // Validate patient data is available
    if (!encounter.patientBook?.patient) {
      return res.status(400).json({ error: "Encounter has no patient assigned" });
    }

    const patientId = encounter.patientBook.patient.id;
    const doctorId = encounter.doctorId;

    // NOTE: Timezone handling - Server operates in local timezone (Asia/Ulaanbaatar)
    // The slotStart date comes from the client as ISO string, but we use local time methods
    // (getHours, getMinutes) for comparison with DoctorSchedule times which are also in local time.
    // This is consistent with the rest of the application's timezone handling.

    // Get the date portion for schedule lookup (in local timezone)
    // --- Timezone-safe local day range for Asia/Ulaanbaatar (UTC+8) ---
const TZ_OFFSET_MINUTES = 8 * 60;

// slotStart is already: const slotStart = new Date(slotStartIso);
const slotUtcMs = slotStart.getTime();

// Convert the UTC instant into "local wall time" ms by adding +8h,
// then read its Y/M/D using UTC getters.
const localMs = slotUtcMs + TZ_OFFSET_MINUTES * 60_000;
const local = new Date(localMs);

const y = local.getUTCFullYear();
const m = local.getUTCMonth();
const d = local.getUTCDate();

// Compute the UTC instant that corresponds to local midnight
const localMidnightUtcMs = Date.UTC(y, m, d) - TZ_OFFSET_MINUTES * 60_000;

const dayStart = new Date(localMidnightUtcMs);
const dayEnd = new Date(localMidnightUtcMs + 24 * 60 * 60_000);

// Also compute slot time in local minutes for schedule window comparison
const slotHourLocal = local.getUTCHours();
const slotMinuteLocal = local.getUTCMinutes();
const slotMinutes = slotHourLocal * 60 + slotMinuteLocal;

const slotTimeString = `${String(slotHourLocal).padStart(2, "0")}:${String(
  slotMinuteLocal
).padStart(2, "0")}`;

    // Find all schedules for this doctor on this date
    const schedules = await prisma.doctorSchedule.findMany({
      where: { doctorId, date: { gte: dayStart, lt: dayEnd } },
    });

    if (schedules.length === 0) {
      return res.status(400).json({
        error: "No schedule found for this doctor on the selected date",
      });
    }



    // Find the schedule that contains this time slot
    // Schedule times are stored as strings like "09:00", "17:00"
    let matchingSchedule = null;
    for (const schedule of schedules) {
      // Parse schedule times - validate format
      const startParts = schedule.startTime.split(":");
      const endParts = schedule.endTime.split(":");
      
      if (startParts.length !== 2 || endParts.length !== 2) {
        console.warn(`Invalid schedule time format: ${schedule.startTime} - ${schedule.endTime}`);
        continue;
      }

      const startHour = Number(startParts[0]);
      const startMin = Number(startParts[1]);
      const endHour = Number(endParts[0]);
      const endMin = Number(endParts[1]);

      if (Number.isNaN(startHour) || Number.isNaN(startMin) || Number.isNaN(endHour) || Number.isNaN(endMin)) {
        console.warn(`Invalid schedule time values: ${schedule.startTime} - ${schedule.endTime}`);
        continue;
      }

      // Convert to comparable time values (minutes from midnight)
      const scheduleStartMinutes = startHour * 60 + startMin;
      const scheduleEndMinutes = endHour * 60 + endMin;
      // const slotMinutes = slotHour * 60 + slotMinute;

      // Check if slot is within schedule window: startTime <= slotTime < endTime
      if (slotMinutes >= scheduleStartMinutes && slotMinutes < scheduleEndMinutes) {
        matchingSchedule = schedule;
        break;
      }
    }

    if (!matchingSchedule) {
      return res.status(400).json({
        error: `Selected time slot ${slotTimeString} is not within any schedule window for this doctor on this date`,
      });
    }

    // Use the branch from the matching schedule
    const branchId = matchingSchedule.branchId;

    // Create the appointment
    const appointment = await prisma.appointment.create({
      data: {
        patientId: patientId,
        doctorId: doctorId,
        branchId: branchId,
        scheduledAt: slotStart,
        endAt: slotEnd,
        status: "booked",
        notes: `Давтан үзлэг — Encounter #${encounterId}`,
      },
      include: {
        patient: {
          include: {
            patientBook: true,
          },
        },
        doctor: true,
        branch: true,
      },
    });

    res.status(201).json(appointment);
  } catch (err) {
    console.error("Error creating follow-up appointment:", err);
    res.status(500).json({ error: "Failed to create follow-up appointment" });
  }
});

export default router;
