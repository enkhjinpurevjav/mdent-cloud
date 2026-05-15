function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
}

function combineLocalDateAndTime(dateValue, timeValue) {
  if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) return null;
  if (!isValidTime(timeValue)) return null;

  const [hours, minutes] = String(timeValue).split(":").map(Number);
  return new Date(
    dateValue.getFullYear(),
    dateValue.getMonth(),
    dateValue.getDate(),
    hours,
    minutes,
    0,
    0,
  );
}

function buildCanonicalOnlineNotes(booking) {
  const marker = `[ONLINE BOOKING #${booking.id}]`;
  const bookingNote = typeof booking.note === "string" ? booking.note.trim() : "";
  return bookingNote ? `${marker}\n\n${bookingNote}` : marker;
}

function mergeNotes(existingNotes, marker, canonicalNotes) {
  const current = typeof existingNotes === "string" ? existingNotes.trim() : "";
  if (!current) return canonicalNotes;
  if (current.includes(marker)) return current;
  return `${current}\n\n${canonicalNotes}`;
}

/**
 * Ensure a paid online booking is reflected on Appointment calendar.
 * Idempotent: updates existing ONLINE_BOOKING appointment for the same slot.
 *
 * @param {import("@prisma/client").PrismaClient | any} tx
 * @param {number} bookingId
 */
export async function ensureOnlineAppointmentForBooking(tx, bookingId) {
  const bid = Number(bookingId);
  if (!bid || Number.isNaN(bid)) return null;

  const booking = await tx.booking.findUnique({
    where: { id: bid },
    select: {
      id: true,
      patientId: true,
      doctorId: true,
      branchId: true,
      date: true,
      startTime: true,
      endTime: true,
      note: true,
    },
  });
  if (!booking) return null;

  const scheduledAt = combineLocalDateAndTime(booking.date, booking.startTime);
  const endAt = combineLocalDateAndTime(booking.date, booking.endTime);
  if (!scheduledAt || !endAt || endAt <= scheduledAt) return null;

  const marker = `[ONLINE BOOKING #${booking.id}]`;
  const canonicalNotes = buildCanonicalOnlineNotes(booking);

  const existing = await tx.appointment.findFirst({
    where: {
      branchId: booking.branchId,
      doctorId: booking.doctorId,
      scheduledAt,
      source: "ONLINE_BOOKING",
    },
    select: {
      id: true,
      patientId: true,
      endAt: true,
      status: true,
      notes: true,
      source: true,
    },
  });

  if (existing) {
    const mergedNotes = mergeNotes(existing.notes, marker, canonicalNotes);
    const data = {};

    if (existing.patientId !== booking.patientId) data.patientId = booking.patientId;
    if (!existing.endAt || existing.endAt.getTime() !== endAt.getTime()) data.endAt = endAt;
    if (String(existing.status || "").toLowerCase() !== "online") data.status = "online";
    if (existing.source !== "ONLINE_BOOKING") data.source = "ONLINE_BOOKING";
    if (mergedNotes !== (existing.notes || "")) data.notes = mergedNotes;

    if (Object.keys(data).length === 0) return existing;

    return tx.appointment.update({
      where: { id: existing.id },
      data,
      select: { id: true },
    });
  }

  return tx.appointment.create({
    data: {
      patientId: booking.patientId,
      doctorId: booking.doctorId,
      branchId: booking.branchId,
      scheduledAt,
      endAt,
      status: "online",
      notes: canonicalNotes,
      source: "ONLINE_BOOKING",
    },
    select: { id: true },
  });
}
