export const SLOT_MINUTES = 30;
export const SLOT_MS = SLOT_MINUTES * 60 * 1000;
export const MAX_APPOINTMENTS_PER_SLOT = 2;
export const SLOT_FULL_ERROR_CODE = "SLOT_FULL";
export const SLOT_FULL_MESSAGE = "This slot is full";
export const SLOT_FULL_LEGACY_ERROR = "Энэ цагт 2 захиалга орсон байна";

function normalizedStatus(status) {
  return String(status || "").trim().toLowerCase();
}

export function shouldCountAppointmentInSlot({ status, slotStart, now = new Date() }) {
  const s = normalizedStatus(status);
  if (s === "cancelled") return false;
  if (s === "no_show") {
    return slotStart.getTime() < now.getTime();
  }
  return true;
}

export function getEffectiveEndAt(start, endAt) {
  const startMs = start.getTime();
  const endMs = endAt instanceof Date ? endAt.getTime() : Number.NaN;
  if (Number.isFinite(endMs) && endMs > startMs) return endAt;
  return new Date(startMs + SLOT_MS);
}

export function alignToSlotStart(date, slotMinutes = SLOT_MINUTES) {
  const slotMs = slotMinutes * 60 * 1000;
  return new Date(Math.floor(date.getTime() / slotMs) * slotMs);
}

export function getOverlappedSlotStarts({ start, end, slotMinutes = SLOT_MINUTES }) {
  if (!(start instanceof Date) || !(end instanceof Date) || end <= start) return [];
  const slotMs = slotMinutes * 60 * 1000;
  const slots = [];
  let cur = alignToSlotStart(start, slotMinutes);
  while (cur < end) {
    slots.push(new Date(cur.getTime()));
    cur = new Date(cur.getTime() + slotMs);
  }
  return slots;
}

export function getSlotOccupancy({ appointments, slotStart, now = new Date() }) {
  const slotEnd = new Date(slotStart.getTime() + SLOT_MS);
  let count = 0;
  for (const appt of appointments) {
    if (!shouldCountAppointmentInSlot({ status: appt.status, slotStart, now })) continue;
    const apptStart = appt.scheduledAt instanceof Date ? appt.scheduledAt : new Date(appt.scheduledAt);
    if (Number.isNaN(apptStart.getTime())) continue;
    const apptEnd = getEffectiveEndAt(apptStart, appt.endAt ? new Date(appt.endAt) : null);
    if (apptStart < slotEnd && apptEnd > slotStart) {
      count += 1;
    }
  }
  return count;
}

export function findFirstFullSlot({ appointments, start, end, now = new Date(), maxPerSlot = MAX_APPOINTMENTS_PER_SLOT }) {
  const slots = getOverlappedSlotStarts({ start, end });
  for (const slotStart of slots) {
    if (getSlotOccupancy({ appointments, slotStart, now }) >= maxPerSlot) {
      return slotStart;
    }
  }
  return null;
}

export function slotFullErrorPayload() {
  return {
    code: SLOT_FULL_ERROR_CODE,
    message: SLOT_FULL_MESSAGE,
    error: SLOT_FULL_LEGACY_ERROR,
  };
}
