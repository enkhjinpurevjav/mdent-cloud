export function parseYmd(
  ymd: string
): { y: number; m: number; d: number } | null {
  const [y, m, d] = String(ymd || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

export function isWeekendYmd(ymd: string): boolean {
  const parsed = parseYmd(ymd);
  if (!parsed) return false;
  const dt = new Date(parsed.y, parsed.m - 1, parsed.d);
  const day = dt.getDay();
  return day === 0 || day === 6;
}

export function ymdRangeInclusive(dateFrom: string, dateTo: string): string[] {
  const a = parseYmd(dateFrom);
  const b = parseYmd(dateTo);
  if (!a || !b) return [];

  const cur = new Date(a.y, a.m - 1, a.d, 0, 0, 0, 0);
  const end = new Date(b.y, b.m - 1, b.d, 0, 0, 0, 0);

  if (end < cur) return [];

  const out: string[] = [];
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function toLocalDateTime(ymd: string, hm: string): Date {
  const parsed = parseYmd(ymd);
  const [hh, mm] = String(hm || "").split(":").map(Number);

  const y = parsed?.y ?? new Date().getFullYear();
  const m = parsed?.m ?? new Date().getMonth() + 1;
  const d = parsed?.d ?? new Date().getDate();

  const h = Number.isFinite(hh) ? hh : 0;
  const mi = Number.isFinite(mm) ? mm : 0;

  return new Date(y, m - 1, d, h, mi, 0, 0);
}

export function addMinutesLocal(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

export function getDayLabelMn(ymd: string): string {
  const parsed = parseYmd(ymd);
  if (!parsed) return "";
  const dt = new Date(parsed.y, parsed.m - 1, parsed.d);
  const day = dt.getDay(); // 0 Sun .. 6 Sat
  // Монгол богино нэршил
  switch (day) {
    case 1:
      return "Да";
    case 2:
      return "Мя";
    case 3:
      return "Лх";
    case 4:
      return "Пү";
    case 5:
      return "Ба";
    case 6:
      return "Бя";
    case 0:
      return "Ня";
    default:
      return "";
  }
}
