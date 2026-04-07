export type AppointmentLabelInput = {
  patient?: {
    name?: string | null;
    ovog?: string | null;
    phone?: string | null;
  } | null;

  patientName?: string | null;
  patientOvog?: string | null;
  patientPhone?: string | null;
};

export function formatGridShortLabel(a: AppointmentLabelInput): string {
  const p = a.patient as any;

  const rawName = (p?.name ?? a.patientName ?? "").toString().trim();
  const rawOvog = (p?.ovog ?? a.patientOvog ?? "").toString().trim();

  const phone = (p?.phone ?? a.patientPhone ?? "").toString().trim();

  let displayName = rawName;

  if (rawOvog) {
    const first = rawOvog.charAt(0).toUpperCase();
    displayName = `${first}.${rawName}`;
  }

  if (!displayName) return "";

  if (phone) {
    return `${displayName} (${phone})`;
  }

  return displayName;
}
