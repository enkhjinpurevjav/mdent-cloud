/**
 * Next.js Edge Middleware — canonical host redirect.
 *
 * In production, if a request arrives on any hostname that is not in
 * ALLOWED_HOSTS (e.g. the mistyped `mdendt.cloud`), redirect permanently
 * to the same path/query on `https://mdent.cloud`.
 *
 * Known production and dev subdomains are included in ALLOWED_HOSTS so that
 * the dev deployment (dev.mdent.cloud, NODE_ENV=production) is never
 * incorrectly redirected to mdent.cloud.
 */

import { NextRequest, NextResponse } from "next/server";

const CANONICAL_HOST = "mdent.cloud";

/**
 * Hosts that should never be redirected to the canonical host.
 * Dev subdomains are included here because the dev deployment runs with
 * NODE_ENV=production and would otherwise be incorrectly redirected.
 */
const ALLOWED_HOSTS = new Set([
  "mdent.cloud",
  "www.mdent.cloud",
  "app.mdent.cloud",
  "book.mdent.cloud",
  // Dev deployments — included so NODE_ENV=production dev builds are not
  // incorrectly redirected to the production canonical host.
  "dev.mdent.cloud",
  "dev-api.mdent.cloud",
  // Local development
  "localhost",
  "127.0.0.1",
]);

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  // Strip port for comparison (e.g. "mdent.cloud:3000" → "mdent.cloud")
  const hostname = host.split(":")[0];
  const pathname = req.nextUrl.pathname;

  const isLegacyAppointmentsRoute =
    pathname === "/appointments" ||
    pathname.startsWith("/appointments/") ||
    pathname === "/reports/appointments" ||
    pathname.startsWith("/reports/appointments/");

  // Allow all known hosts (production, dev subdomains, and local)
  if (ALLOWED_HOSTS.has(hostname)) {
    if (isLegacyAppointmentsRoute) {
      const url = req.nextUrl.clone();
      url.pathname = "/appointments-v2";
      url.search = "";
      return NextResponse.redirect(url, 307);
    }
    return NextResponse.next();
  }

  // In production only: redirect any unknown host to mdent.cloud
  if (process.env.NODE_ENV === "production") {
    const url = req.nextUrl.clone();
    url.host = CANONICAL_HOST;
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all paths except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
