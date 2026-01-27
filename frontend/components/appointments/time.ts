// Time and slot utility functions

export const SLOT_MINUTES = 30;

export function floorToSlotStart(d: Date, slotMinutes = SLOT_MINUTES) {
  const slotMs = slotMinutes * 60_000;
  return new Date(Math.floor(d.getTime() / slotMs) * slotMs);
}

export function addMinutes(d: Date, minutes: number) {
  return new Date(d.getTime() + minutes * 60_000);
}

// doctorId|YYYY-MM-DD|HH:MM (local time)
export function getSlotKey(doctorId: number, slotStart: Date) {
  const y = slotStart.getFullYear();
  const m = String(slotStart.getMonth() + 1).padStart(2, "0");
  const d = String(slotStart.getDate()).padStart(2, "0");
  const hh = String(slotStart.getHours()).padStart(2, "0");
  const mm = String(slotStart.getMinutes()).padStart(2, "0");
  return `${doctorId}|${y}-${m}-${d}|${hh}:${mm}`;
}

/**
 * Enumerate slot start times for any overlap.
 * If appointment starts at 09:10, we still count 09:00 slot as filled.
 */
export function enumerateSlotStartsOverlappingRange(
  start: Date,
  end: Date,
  slotMinutes = SLOT_MINUTES
) {
  const slots: Date[] = [];
  if (end <= start) return slots;

  let cur = floorToSlotStart(start, slotMinutes);
  while (cur < end) {
    slots.push(cur);
    cur = addMinutes(cur, slotMinutes);
  }
  return slots;
}

export function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export function getSlotTimeString(date: Date): string {
  // "HH:MM" in local time
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function addMinutesToTimeString(time: string, minutesToAdd: number): string {
  const [hh, mm] = time.split(":").map(Number);
  const base = new Date();
  base.setHours(hh, mm, 0, 0);
  base.setMinutes(base.getMinutes() + minutesToAdd);
  return getSlotTimeString(base);
}

export function isTimeWithinRange(time: string, startTime: string, endTime: string) {
  // inclusive of start, exclusive of end
  return time >= startTime && time < endTime;
}

export function generateTimeSlotsForDay(day: Date) {
  const slots: { start: Date; end: Date; label: string }[] = [];

  const weekday = day.getDay(); // 0 = Sun, 6 = Sat

  // Visual working window
  // Weekdays: 09:00–21:00
  // Weekends: 10:00–19:00
  const startHour = weekday === 0 || weekday === 6 ? 10 : 9;
  const endHour = weekday === 0 || weekday === 6 ? 19 : 21;

  const d = new Date(day);
  d.setHours(startHour, 0, 0, 0);

  while (d.getHours() < endHour) {
    const start = new Date(d);
    d.setMinutes(d.getMinutes() + SLOT_MINUTES);
    const end = new Date(d);
    slots.push({
      start,
      end,
      label: getSlotTimeString(start),
    });
  }

  return slots;
}

export function getDateFromYMD(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return new Date(); // fallback to today
  return new Date(y, m - 1, d);
}
