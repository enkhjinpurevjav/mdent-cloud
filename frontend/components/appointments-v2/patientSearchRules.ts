export type PatientSearchResult = {
  id: number;
  name: string;
  ovog: string | null;
  phone: string | null;
  regNo: string | null;
};

export const PATIENT_SEARCH_MIN_CHARS = 2;
export const PATIENT_SEARCH_DEBOUNCE_MS = 250;
export const PATIENT_SEARCH_LIMIT = 25;

function asText(value: unknown) {
  return String(value || "").trim();
}

export function formatPatientSearchDropdownRow(patient: PatientSearchResult) {
  const fullName = [asText(patient.name), asText(patient.ovog)].filter(Boolean).join(" ");
  return `${fullName || "-"}, 📞 ${asText(patient.phone) || "-"}, 🆔 ${asText(patient.regNo) || "-"}`;
}

export async function searchPatientsByRules(
  query: string,
  signal?: AbortSignal
): Promise<PatientSearchResult[]> {
  const trimmed = String(query || "").trim();
  if (trimmed.length < PATIENT_SEARCH_MIN_CHARS) return [];

  const params = new URLSearchParams({
    q: trimmed,
    limit: String(PATIENT_SEARCH_LIMIT),
  });

  const res = await fetch(`/api/patients/search?${params.toString()}`, { signal });
  const data = await res.json().catch(() => []);
  if (!res.ok || !Array.isArray(data)) return [];
  return data as PatientSearchResult[];
}
