// backend/src/routes/bookings.js
import { Router } from "express";
import { PrismaClient, BookingStatus, UserRole } from "@prisma/client";
import crypto from "crypto";
import * as qpayService from "../services/qpayService.js";

const prisma = new PrismaClient();
const router = Router();

const DEPOSIT_AMOUNT = 30_000; // MNT
const HOLD_MINUTES = 10;

const ONLINE_STATUSES = [
  BookingStatus.ONLINE_HELD,
  BookingStatus.ONLINE_CONFIRMED,
  BookingStatus.ONLINE_EXPIRED,
];

/**
 * Validate HH:MM 24h time.
 */
function isValidTime(str) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(str);
}

/**
 * Convert "YYYY-MM-DD" → Date at 00:00.
 */
function parseDateOrNull(str) {
  if (!str) return null;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get or create a placeholder patient for a branch.
 * Placeholder: name="ONLINE", ovog="BOOKING", regNo=null, phone=null.
 * No PatientBook is created.
 */
async function getOrCreatePlaceholderPatient(branchId) {
  // Try to find existing placeholder
  const existing = await prisma.patient.findFirst({
    where: {
      branchId,
      name: "ONLINE",
      ovog: "BOOKING",
    },
    select: { id: true },
  });

  if (existing) return existing;

  return prisma.patient.create({
    data: {
      branchId,
      name: "ONLINE",
      ovog: "BOOKING",
    },
    select: { id: true },
  });
}

/**
 * GET /api/bookings
 * Query params:
 *   date=YYYY-MM-DD (required for now)
 *   branchId=number (optional)
 *   doctorId=number (optional)
 *   includeOnlineAll=true (optional – include ONLINE_HELD and ONLINE_EXPIRED too)
 *
 * By default:
 *   - ONLINE_HELD and ONLINE_EXPIRED are excluded.
 *   - ONLINE_CONFIRMED is included.
 */
router.get("/", async (req, res) => {
  const { date, branchId, doctorId, includeOnlineAll } = req.query;

  const day = parseDateOrNull(date);
  if (!day) {
    return res.status(400).json({ error: "date (YYYY-MM-DD) is required" });
  }

  const where = {
    date: day,
  };

  if (branchId) {
    const bid = Number(branchId);
    if (Number.isNaN(bid)) {
      return res.status(400).json({ error: "Invalid branchId" });
    }
    where.branchId = bid;
  }

  if (doctorId) {
    const did = Number(doctorId);
    if (Number.isNaN(did)) {
      return res.status(400).json({ error: "Invalid doctorId" });
    }
    where.doctorId = did;
  }

  // Visibility: exclude ONLINE_HELD and ONLINE_EXPIRED unless includeOnlineAll is set
  if (includeOnlineAll !== "true") {
    where.status = {
      notIn: [BookingStatus.ONLINE_HELD, BookingStatus.ONLINE_EXPIRED],
    };
  }

  try {
    const bookings = await prisma.booking.findMany({
      where,
      orderBy: [{ startTime: "asc" }, { endTime: "asc" }],
      include: {
        patient: {
          select: { id: true, name: true, regNo: true, phone: true },
        },
        doctor: {
          select: { id: true, name: true, email: true },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
    });

    return res.json(
      bookings.map((b) => ({
        id: b.id,
        date: b.date.toISOString().slice(0, 10),
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        note: b.note,
        doctor: b.doctor,
        branch: b.branch,
        patient: b.patient,
      }))
    );
  } catch (err) {
    console.error("GET /api/bookings error:", err);
    return res.status(500).json({ error: "Failed to list bookings" });
  }
});

/**
 * POST /api/bookings/online/hold
 * Create an online booking with ONLINE_HELD status and a QPay invoice.
 * Body: { branchId, doctorId, date, startTime, endTime, ovog, name, phone, regNo }
 */
router.post("/online/hold", async (req, res) => {
  try {
    const {
      branchId,
      doctorId,
      date,
      startTime,
      endTime,
      ovog,
      name,
      phone,
      regNo,
    } = req.body || {};

    if (!branchId || !doctorId || !date || !startTime || !endTime) {
      return res.status(400).json({
        error: "branchId, doctorId, date, startTime, endTime are required",
      });
    }

    const bid = Number(branchId);
    const did = Number(doctorId);
    if (Number.isNaN(bid) || Number.isNaN(did)) {
      return res.status(400).json({ error: "Invalid branchId/doctorId" });
    }

    const day = parseDateOrNull(date);
    if (!day) return res.status(400).json({ error: "Invalid date" });

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({ error: "startTime/endTime must be HH:MM (24h)" });
    }
    if (startTime >= endTime) {
      return res.status(400).json({ error: "startTime must be before endTime" });
    }

    // Validate doctor
    const doctor = await prisma.user.findUnique({
      where: { id: did },
      select: { id: true, role: true },
    });
    if (!doctor || doctor.role !== UserRole.doctor) {
      return res.status(400).json({ error: "Invalid doctor" });
    }

    // Validate branch
    const branch = await prisma.branch.findUnique({
      where: { id: bid },
      select: { id: true },
    });
    if (!branch) return res.status(400).json({ error: "Branch not found" });

    // Validate schedule
    const schedule = await prisma.doctorSchedule.findFirst({
      where: { doctorId: did, branchId: bid, date: day },
      select: { startTime: true, endTime: true },
    });
    if (!schedule) {
      return res.status(400).json({ error: "Doctor has no schedule for this date/branch" });
    }
    if (startTime < schedule.startTime || endTime > schedule.endTime) {
      return res.status(400).json({
        error: "Booking outside doctor's working hours",
        scheduleStart: schedule.startTime,
        scheduleEnd: schedule.endTime,
      });
    }

    // Check slot collision against active bookings (including online statuses)
    const activeStatuses = [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.IN_PROGRESS,
      BookingStatus.ONLINE_HELD,
      BookingStatus.ONLINE_CONFIRMED,
    ];
    const collision = await prisma.booking.findFirst({
      where: {
        doctorId: did,
        date: day,
        status: { in: activeStatuses },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    if (collision) {
      return res.status(409).json({ error: "Time slot is already taken" });
    }

    // Online capacity rule: slot must be completely empty (0 bookings at exact startTime)
    const exactStartConflict = await prisma.booking.findFirst({
      where: {
        doctorId: did,
        date: day,
        startTime,
        status: { not: BookingStatus.ONLINE_EXPIRED },
      },
    });
    if (exactStartConflict) {
      return res.status(409).json({ error: "Time slot is already taken" });
    }

    // Get or create placeholder patient
    const placeholder = await getOrCreatePlaceholderPatient(bid);

    // Build note
    const noteLines = [
      "[ONLINE BOOKING - DEPOSIT 30000₮]",
      `Овог: ${ovog || ""}`,
      `Нэр: ${name || ""}`,
      `Утас: ${phone || ""}`,
      `РД: ${regNo || ""}`,
    ];
    const note = noteLines.join("\n");

    // Create booking with ONLINE_HELD
    const booking = await prisma.booking.create({
      data: {
        patientId: placeholder.id,
        doctorId: did,
        branchId: bid,
        date: day,
        startTime,
        endTime,
        status: BookingStatus.ONLINE_HELD,
        note,
      },
    });

    // Build QPay callback URL
    const callbackToken = crypto.randomBytes(24).toString("hex");
    const baseUrl = process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || "";
    const callbackUrl = `${baseUrl}/api/qpay/booking/callback?bookingId=${booking.id}&token=${callbackToken}`;

    // Create QPay invoice
    const senderInvoiceNo = `BOOK-${booking.id}-${Date.now()}`;
    const description = `Онлайн цаг захиалга #${booking.id} (${date} ${startTime}-${endTime})`;

    let qpayResponse;
    try {
      qpayResponse = await qpayService.createInvoice({
        sender_invoice_no: senderInvoiceNo,
        amount: DEPOSIT_AMOUNT,
        description,
        callback_url: callbackUrl,
        branchId: bid,
      });
    } catch (qpayErr) {
      // Rollback booking on QPay failure
      await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {});
      console.error("QPay invoice creation failed:", qpayErr);
      return res.status(502).json({ error: "Failed to create QPay invoice: " + qpayErr.message });
    }

    const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);

    // Create BookingDeposit
    await prisma.bookingDeposit.create({
      data: {
        bookingId: booking.id,
        branchId: bid,
        amount: DEPOSIT_AMOUNT,
        status: "NEW",
        holdExpiresAt,
        qpayInvoiceId: qpayResponse.invoice_id,
        senderInvoiceNo,
        callbackToken,
      },
    });

    return res.status(201).json({
      bookingId: booking.id,
      expiresAt: holdExpiresAt.toISOString(),
      qpayInvoiceId: qpayResponse.invoice_id,
      qrText: qpayResponse.qr_text,
      qrImage: qpayResponse.qr_image,
      urls: qpayResponse.urls,
    });
  } catch (err) {
    console.error("POST /api/bookings/online/hold error:", err);
    return res.status(500).json({ error: "Failed to create online booking" });
  }
});

/**
 * GET /api/bookings/online/:bookingId/payment-status
 * Poll payment status for an online booking deposit.
 */
router.get("/online/:bookingId/payment-status", async (req, res) => {
  try {
    const bookingId = Number(req.params.bookingId);
    if (!bookingId || Number.isNaN(bookingId)) {
      return res.status(400).json({ error: "Invalid bookingId" });
    }

    const deposit = await prisma.bookingDeposit.findUnique({
      where: { bookingId },
    });

    if (!deposit) {
      return res.status(404).json({ error: "Deposit not found" });
    }

    // Already settled
    if (deposit.status === "PAID") {
      return res.json({ status: "PAID", bookingStatus: BookingStatus.ONLINE_CONFIRMED });
    }
    if (deposit.status === "EXPIRED" || deposit.status === "CANCELLED") {
      return res.json({ status: deposit.status, bookingStatus: BookingStatus.ONLINE_EXPIRED });
    }

    const now = new Date();
    const isExpired = now > deposit.holdExpiresAt;

    // Check payment
    let checkResult;
    try {
      checkResult = await qpayService.checkInvoicePaid(deposit.qpayInvoiceId, deposit.branchId);
    } catch (checkErr) {
      console.error("Payment check failed:", checkErr);
      return res.status(502).json({ error: "Payment check failed: " + checkErr.message });
    }

    if (checkResult.paid && checkResult.paidAmount >= DEPOSIT_AMOUNT) {
      // Confirm payment
      await prisma.$transaction([
        prisma.bookingDeposit.update({
          where: { bookingId },
          data: {
            status: "PAID",
            paidAmount: checkResult.paidAmount,
            qpayPaymentId: checkResult.paymentId,
            paidAt: checkResult.paidAt ? new Date(checkResult.paidAt) : new Date(),
            raw: checkResult.raw,
          },
        }),
        prisma.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.ONLINE_CONFIRMED },
        }),
      ]);
      return res.json({ status: "PAID", bookingStatus: BookingStatus.ONLINE_CONFIRMED });
    }

    if (isExpired) {
      // Cancel QPay invoice and expire booking
      try {
        await qpayService.cancelInvoice(deposit.qpayInvoiceId, deposit.branchId);
      } catch (cancelErr) {
        console.error("QPay invoice cancel failed (will still expire):", cancelErr);
      }
      await prisma.$transaction([
        prisma.bookingDeposit.update({
          where: { bookingId },
          data: { status: "EXPIRED" },
        }),
        prisma.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.ONLINE_EXPIRED },
        }),
      ]);
      return res.json({ status: "EXPIRED", bookingStatus: BookingStatus.ONLINE_EXPIRED });
    }

    return res.json({
      status: "PENDING",
      bookingStatus: BookingStatus.ONLINE_HELD,
      expiresAt: deposit.holdExpiresAt.toISOString(),
    });
  } catch (err) {
    console.error("GET /api/bookings/online/:bookingId/payment-status error:", err);
    return res.status(500).json({ error: "Failed to check payment status" });
  }
});

/**
 * POST /api/bookings/:id/create-patient-from-online
 * Reception workflow: create a real patient from an online booking note.
 * Allowed only for ONLINE_HELD or ONLINE_CONFIRMED, and only if patientId is still the placeholder.
 */
router.post("/:id/create-patient-from-online", async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    if (!bookingId || Number.isNaN(bookingId)) {
      return res.status(400).json({ error: "Invalid booking id" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        branchId: true,
        patientId: true,
        status: true,
        note: true,
      },
    });

    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // Only allowed for ONLINE_HELD or ONLINE_CONFIRMED
    if (booking.status !== BookingStatus.ONLINE_HELD &&
        booking.status !== BookingStatus.ONLINE_CONFIRMED) {
      return res.status(400).json({
        error: "create-patient-from-online is only allowed for online bookings (ONLINE_HELD or ONLINE_CONFIRMED)",
      });
    }

    // Check that patient is still the placeholder
    const placeholder = await getOrCreatePlaceholderPatient(booking.branchId);
    if (booking.patientId !== placeholder.id) {
      return res.status(400).json({
        error: "Patient already assigned to this booking",
      });
    }

    // Accept patient fields from body, optionally fall back to note parsing
    let { ovog, name, phone, regNo } = req.body || {};

    // If not provided in body, try to parse from note
    if (!ovog && !name && !phone && !regNo && booking.note) {
      const noteLines = booking.note.split("\n");
      for (const line of noteLines) {
        if (line.startsWith("Овог: ")) ovog = line.slice("Овог: ".length).trim() || undefined;
        else if (line.startsWith("Нэр: ")) name = line.slice("Нэр: ".length).trim() || undefined;
        else if (line.startsWith("Утас: ")) phone = line.slice("Утас: ".length).trim() || undefined;
        else if (line.startsWith("РД: ")) regNo = line.slice("РД: ".length).trim() || undefined;
      }
    }

    // At least one field must be present
    if (!ovog && !name && !phone && !regNo) {
      return res.status(400).json({
        error: "At least one of ovog, name, phone, regNo must be provided",
      });
    }

    // name is required for Patient model
    const patientName = name || ovog || "UNKNOWN";

    // Create patient and PatientBook in a transaction with retry on unique constraint
    let newPatient;
    let bookNumber;
    let attempts = 0;
    while (attempts < 5) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          // Create patient
          const patient = await tx.patient.create({
            data: {
              branchId: booking.branchId,
              ovog: ovog || null,
              name: patientName,
              phone: phone || null,
              regNo: regNo || null,
            },
          });

          // Get globally incrementing bookNumber
          const maxEntry = await tx.patientBook.findFirst({
            orderBy: { bookNumber: "desc" },
            select: { bookNumber: true },
          });

          let nextNum = 1;
          if (maxEntry?.bookNumber) {
            const parsed = parseInt(maxEntry.bookNumber, 10);
            if (!Number.isNaN(parsed)) nextNum = parsed + 1;
          }
          const newBookNumber = String(nextNum).padStart(6, "0");

          // Create PatientBook
          await tx.patientBook.create({
            data: {
              patientId: patient.id,
              bookNumber: newBookNumber,
            },
          });

          // Update booking patientId
          await tx.booking.update({
            where: { id: bookingId },
            data: { patientId: patient.id },
          });

          return { patient, bookNumber: newBookNumber };
        });

        newPatient = result.patient;
        bookNumber = result.bookNumber;
        break;
      } catch (txErr) {
        // Retry on unique constraint violation for bookNumber
        if (txErr.code === "P2002" && txErr.meta?.target?.includes("bookNumber")) {
          attempts++;
          continue;
        }
        throw txErr;
      }
    }

    if (!newPatient) {
      return res.status(500).json({ error: "Failed to assign patient after retries" });
    }

    return res.status(201).json({
      patientId: newPatient.id,
      bookNumber,
    });
  } catch (err) {
    console.error("POST /api/bookings/:id/create-patient-from-online error:", err);
    return res.status(500).json({ error: "Failed to create patient from online booking" });
  }
});

/**
 * POST /api/bookings
 * Body:
 * {
 *   patientId: number,
 *   doctorId: number,
 *   branchId: number,
 *   date: "YYYY-MM-DD",
 *   startTime: "HH:MM",
 *   endTime: "HH:MM",
 *   status?: BookingStatus,
 *   note?: string
 * }
 */
router.post("/", async (req, res) => {
  try {
    const {
      patientId,
      doctorId,
      branchId,
      date,
      startTime,
      endTime,
      status,
      note,
    } = req.body || {};

    if (!patientId || !doctorId || !branchId || !date || !startTime || !endTime) {
      return res.status(400).json({
        error:
          "patientId, doctorId, branchId, date, startTime, endTime are required",
      });
    }

    const pid = Number(patientId);
    const did = Number(doctorId);
    const bid = Number(branchId);
    if ([pid, did, bid].some((n) => Number.isNaN(n))) {
      return res.status(400).json({ error: "Invalid patientId/doctorId/branchId" });
    }

    const day = parseDateOrNull(date);
    if (!day) {
      return res.status(400).json({ error: "Invalid date" });
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return res
        .status(400)
        .json({ error: "startTime and endTime must be HH:MM (24h)" });
    }

    if (startTime >= endTime) {
      return res
        .status(400)
        .json({ error: "startTime must be before endTime" });
    }

    // 1) Ensure doctor exists and is a doctor
    const doctor = await prisma.user.findUnique({
      where: { id: did },
      select: { id: true, role: true },
    });

    if (!doctor || doctor.role !== UserRole.doctor) {
      return res.status(400).json({ error: "Invalid doctor" });
    }

    // 2) Ensure branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: bid },
      select: { id: true },
    });
    if (!branch) {
      return res.status(400).json({ error: "Branch not found" });
    }

    // 3) Ensure patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: pid },
      select: { id: true },
    });
    if (!patient) {
      return res.status(400).json({ error: "Patient not found" });
    }

    // 4) Optional: validate against doctorSchedule for that day+branch
    const schedule = await prisma.doctorSchedule.findFirst({
      where: {
        doctorId: did,
        branchId: bid,
        date: day,
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    if (!schedule) {
      return res.status(400).json({
        error: "Doctor has no schedule for this date/branch",
      });
    }

    if (startTime < schedule.startTime || endTime > schedule.endTime) {
      return res.status(400).json({
        error: "Booking outside doctor's working hours",
        scheduleStart: schedule.startTime,
        scheduleEnd: schedule.endTime,
      });
    }

    // 5) Create booking
    const booking = await prisma.booking.create({
      data: {
        patientId: pid,
        doctorId: did,
        branchId: bid,
        date: day,
        startTime,
        endTime,
        status: status && Object.values(BookingStatus).includes(status)
          ? status
          : BookingStatus.PENDING,
        note: note || null,
      },
    });

    return res.status(201).json({
      id: booking.id,
      date: booking.date.toISOString().slice(0, 10),
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      note: booking.note,
      doctorId: booking.doctorId,
      branchId: booking.branchId,
      patientId: booking.patientId,
    });
  } catch (err) {
    console.error("POST /api/bookings error:", err);
    return res.status(500).json({ error: "Failed to create booking" });
  }
});

/**
 * PATCH /api/bookings/:id
 * Allows updating status, time, note.
 */
router.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid booking id" });
  }

  const { startTime, endTime, status, note } = req.body || {};
  const data = {};

  if (startTime !== undefined) {
    if (!isValidTime(startTime)) {
      return res.status(400).json({ error: "Invalid startTime" });
    }
    data.startTime = startTime;
  }

  if (endTime !== undefined) {
    if (!isValidTime(endTime)) {
      return res.status(400).json({ error: "Invalid endTime" });
    }
    data.endTime = endTime;
  }

  if (startTime !== undefined && endTime !== undefined && startTime >= endTime) {
    return res
      .status(400)
      .json({ error: "startTime must be before endTime" });
  }

  if (status !== undefined) {
    if (!Object.values(BookingStatus).includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    data.status = status;
  }

  if (note !== undefined) {
    data.note = note || null;
  }

  try {
    const updated = await prisma.booking.update({
      where: { id },
      data,
    });

    return res.json({
      id: updated.id,
      date: updated.date.toISOString().slice(0, 10),
      startTime: updated.startTime,
      endTime: updated.endTime,
      status: updated.status,
      note: updated.note,
      doctorId: updated.doctorId,
      branchId: updated.branchId,
      patientId: updated.patientId,
    });
  } catch (err) {
    console.error("PATCH /api/bookings/:id error:", err);
    return res.status(500).json({ error: "Failed to update booking" });
  }
});

/**
 * DELETE /api/bookings/:id
 */
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid booking id" });
  }

  try {
    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Booking not found" });
    }

    await prisma.booking.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/bookings/:id error:", err);
    return res.status(500).json({ error: "Failed to delete booking" });
  }
});

export default router;
