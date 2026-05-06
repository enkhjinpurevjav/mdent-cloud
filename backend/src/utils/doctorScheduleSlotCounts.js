export const REPORT_SLOT_MINUTES = 30;
export const REPORT_BOOKED_SLOT_STATUSES = new Set([
  "completed",
  "partial_paid",
  "ready_to_pay",
]);

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function minutesFromTimeStr(hm) {
  if (!hm || typeof hm !== "string") return null;
  const [h, m] = hm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function dateOnlyKey(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(
    dateObj.getDate()
  ).padStart(2, "0")}`;
}

function toSlotKey(dateObj, slotMinutes) {
  const mins = dateObj.getHours() * 60 + dateObj.getMinutes();
  return Math.floor(mins / slotMinutes);
}

/**
 * Build possible 30-minute schedule slots per doctor and date.
 * Multiple schedule windows on the same doctor/date are unioned.
 */
export function buildDoctorScheduleSlotIndex(schedules, slotMinutes = REPORT_SLOT_MINUTES) {
  const groupedByDoctorDate = new Map();

  for (const sch of schedules || []) {
    const startMins = minutesFromTimeStr(sch.startTime);
    const endMins = minutesFromTimeStr(sch.endTime);
    if (startMins == null || endMins == null || endMins <= startMins) continue;
    if (!sch.doctorId) continue;

    const dateObj = sch.date instanceof Date ? sch.date : new Date(sch.date);
    if (Number.isNaN(dateObj.getTime())) continue;

    const dateKey = dateOnlyKey(dateObj);
    const doctorId = Number(sch.doctorId);
    const doctorDateKey = `${doctorId}|${dateKey}`;

    if (!groupedByDoctorDate.has(doctorDateKey)) {
      groupedByDoctorDate.set(doctorDateKey, {
        doctorId,
        dateKey,
        possibleSlots: new Set(),
      });
    }

    const entry = groupedByDoctorDate.get(doctorDateKey);
    const startSlot = Math.floor(startMins / slotMinutes);
    const endSlotExclusive = Math.ceil(endMins / slotMinutes);
    for (let slot = startSlot; slot < endSlotExclusive; slot++) {
      entry.possibleSlots.add(slot);
    }
  }

  const byDoctor = new Map();
  for (const entry of groupedByDoctorDate.values()) {
    if (!byDoctor.has(entry.doctorId)) {
      byDoctor.set(entry.doctorId, {
        doctorId: entry.doctorId,
        possibleSlotCount: 0,
        slotsByDate: new Map(),
      });
    }
    const doctorRec = byDoctor.get(entry.doctorId);
    doctorRec.slotsByDate.set(entry.dateKey, entry.possibleSlots);
    doctorRec.possibleSlotCount += entry.possibleSlots.size;
  }

  return byDoctor;
}

/**
 * Count appointments that:
 * - are in the allowed statuses
 * - have a doctor id
 * - whose start-time slot falls inside that doctor's schedule slots for that date
 *
 * Returns Map<doctorId, bookedSlotCount>.
 */
export function countBookedAppointmentsInScheduleSlots({
  appointments,
  scheduleSlotIndex,
  slotMinutes = REPORT_SLOT_MINUTES,
  allowedStatuses = REPORT_BOOKED_SLOT_STATUSES,
}) {
  const bookedByDoctor = new Map();

  for (const appt of appointments || []) {
    if (!appt?.doctorId) continue;
    const status = normalizeStatus(appt.status);
    if (!allowedStatuses.has(status)) continue;

    const doctorId = Number(appt.doctorId);
    const doctorRec = scheduleSlotIndex.get(doctorId);
    if (!doctorRec) continue;

    const start = appt.scheduledAt instanceof Date ? appt.scheduledAt : new Date(appt.scheduledAt);
    if (Number.isNaN(start.getTime())) continue;

    const dateKey = dateOnlyKey(start);
    const slotKey = toSlotKey(start, slotMinutes);
    const possibleSlots = doctorRec.slotsByDate.get(dateKey);
    if (!possibleSlots || !possibleSlots.has(slotKey)) continue;

    bookedByDoctor.set(doctorId, (bookedByDoctor.get(doctorId) || 0) + 1);
  }

  return bookedByDoctor;
}
