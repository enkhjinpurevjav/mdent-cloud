const ULAANBAATAR_TIMEZONE = "Asia/Ulaanbaatar";

const ulaanbaatarFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ULAANBAATAR_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function getUlaanbaatarParts(date = new Date()) {
  const parts = ulaanbaatarFormatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function parseMinutes(timeStr) {
  const value = String(timeStr || "");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function getUlaanbaatarYmd(date = new Date()) {
  const parts = getUlaanbaatarParts(date);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getUlaanbaatarMinuteOfDay(date = new Date()) {
  const parts = getUlaanbaatarParts(date);
  return parts.hour * 60 + parts.minute;
}

export function isDateBeforeTodayInUlaanbaatar(targetDate, now = new Date()) {
  const targetYmd = getUlaanbaatarYmd(targetDate);
  const todayYmd = getUlaanbaatarYmd(now);
  return targetYmd < todayYmd;
}

export function isSlotInPastOrCurrentForDate(targetDate, slotStartTime, now = new Date()) {
  const slotMinutes = parseMinutes(slotStartTime);
  if (slotMinutes === null) return true;

  const targetYmd = getUlaanbaatarYmd(targetDate);
  const todayYmd = getUlaanbaatarYmd(now);
  if (targetYmd !== todayYmd) return false;

  return slotMinutes <= getUlaanbaatarMinuteOfDay(now);
}

