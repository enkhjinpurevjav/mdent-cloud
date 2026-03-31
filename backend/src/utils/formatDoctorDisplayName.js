/**
 * Format a doctor object into a short display name.
 *
 * Format: first letter of ovog + "." + name  (e.g. "П.Энхжин")
 * Fallback: name only if ovog is missing.
 * Returns "-" when both fields are absent.
 *
 * @param {{ name?: string | null, ovog?: string | null } | null | undefined} doctor
 * @returns {string}
 */
function formatDoctorDisplayName(doctor) {
  if (!doctor) return "-";
  const name = doctor.name ? doctor.name.trim() : "";
  const ovog = doctor.ovog ? doctor.ovog.trim() : "";
  if (ovog && name) return `${ovog[0].toUpperCase()}.${name}`;
  if (name) return name;
  return "-";
}

export { formatDoctorDisplayName };
