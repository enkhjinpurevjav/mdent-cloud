const ULAANBAATAR_TIMEZONE = "Asia/Ulaanbaatar";
const ORDER_CUTOFF_MINUTES = 10 * 60; // 10:00
const ORDER_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const datePartFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ULAANBAATAR_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function getUlaanbaatarDateParts(date = new Date()) {
  const parts = datePartFormatter.formatToParts(date);
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

export function getUlaanbaatarYmd(date = new Date()) {
  const parts = getUlaanbaatarDateParts(date);
  const year = String(parts.year).padStart(4, "0");
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getUlaanbaatarMinuteOfDay(date = new Date()) {
  const parts = getUlaanbaatarDateParts(date);
  return parts.hour * 60 + parts.minute;
}

export function isFoodOrderingOpenAt(date = new Date()) {
  return getUlaanbaatarMinuteOfDay(date) < ORDER_CUTOFF_MINUTES;
}

export function toOrderDateFromYmd(ymd) {
  if (!ORDER_DATE_RE.test(String(ymd || ""))) {
    throw new Error("orderDate must be YYYY-MM-DD.");
  }
  const dt = new Date(`${ymd}T00:00:00.000+08:00`);
  if (Number.isNaN(dt.getTime())) {
    throw new Error("orderDate must be valid.");
  }
  return dt;
}

export function addDaysToYmd(ymd, days) {
  const base = toOrderDateFromYmd(ymd);
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return getUlaanbaatarYmd(next);
}

export { ORDER_CUTOFF_MINUTES, ULAANBAATAR_TIMEZONE };
