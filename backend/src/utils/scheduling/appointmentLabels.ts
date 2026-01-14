export type AppointmentLabelInput = {
  patient?: {
    name?: string | null;
    ovog?: string | null;
    patientBook?: { bookNumber?: string | null } | null;
  } | null;

  patientName?: string | null;
  patientOvog?: string | null;
};

export function formatGridShortLabel(a: AppointmentLabelInput): string {
  const p = a.patient as any;

  const rawName = (p?.name ?? a.patientName ?? "").toString().trim();
  const rawOvog = (p?.ovog ?? a.patientOvog ?? "").toString().trim();

  const rawBookNumber =
    p?.patientBook?.bookNumber != null ? String(p.patientBook.bookNumber).trim() : "";

  let displayName = rawName;

  if (rawOvog) {
    const first = rawOvog.charAt(0).toUpperCase();
    displayName = `${first}.${rawName}`;
  }

  if (!displayName) return "";

  if (rawBookNumber) {
    return `${displayName} (${rawBookNumber})`;
  }

  return displayName;
}
