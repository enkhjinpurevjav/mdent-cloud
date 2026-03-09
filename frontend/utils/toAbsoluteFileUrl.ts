/**
 * Converts a stored file path (e.g. "/uploads/staff-photos/photo.png") to an
 * absolute URL using the configured API base URL.
 *
 * - null/empty  → ""
 * - already http/https → returned as-is
 * - relative path → prefixed with NEXT_PUBLIC_API_BASE_URL
 * - env var missing → original string returned (supports dev proxy)
 */
export function toAbsoluteFileUrl(path: string | null | undefined): string {
  if (!path) return "";
  const trimmed = path.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;

  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return trimmed;

  // Avoid double slashes
  const normalizedBase = base.replace(/\/$/, "");
  const normalizedPath = trimmed.startsWith("/") ? trimmed : "/" + trimmed;
  return normalizedBase + normalizedPath;
}
