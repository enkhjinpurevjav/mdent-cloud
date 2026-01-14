import { isWeekendYmd } from "./localDate";

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function buildFixedHeaderTimeLabels(slotMinutes = 30): string[] {
  // Fixed header: 09:00–21:00 (inclusive end label)
  const labels: string[] = [];
  const start = 9 * 60;
  const end = 21 * 60;

  for (let t = start; t <= end; t += slotMinutes) {
    const hh = Math.floor(t / 60);
    const mm = t % 60;
    labels.push(`${pad2(hh)}:${pad2(mm)}`);
  }
  return labels;
}

export function getClinicWindowForDay(ymd: string): { start: string; end: string } {
  // Weekday: 09:00–21:00
  // Weekend: 10:00–19:00
  return isWeekendYmd(ymd)
    ? { start: "10:00", end: "19:00" }
    : { start: "09:00", end: "21:00" };
}

export function isTimeWithinRange(time: string, start: string, end: string): boolean {
  // inclusive start, exclusive end
  return time >= start && time < end;
}
