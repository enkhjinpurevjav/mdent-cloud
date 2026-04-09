/**
 * Auth utilities for cookie-based JWT authentication.
 *
 * All requests use `credentials: "include"` so the httpOnly access_token
 * cookie is sent automatically by the browser.
 */

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  branchId: number | null;
  ovog?: string | null;
  regNo?: string | null;
  canCloseEncounterWithoutPayment?: boolean;
}

/** Call /api/auth/me to get the current authenticated user, or null on 401. */
export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user as AuthUser;
  } catch {
    return null;
  }
}

/** Login with email+password. Returns the user on success, throws on failure. */
export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error((data as any)?.error || `Login failed (HTTP ${res.status})`);
  }

  return (data as any)?.user as AuthUser;
}

/**
 * Logout — clears the httpOnly cookie (best-effort).
 *
 * Even if the request fails (network / server), we still want the UI to proceed
 * with a local logout flow (clear client state + redirect).
 */
export async function logout(): Promise<void> {
  try {
    const res = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      // Don't throw: allow UI to continue logging out locally.
      console.warn("Logout failed:", data || `HTTP ${res.status}`);
    }
  } catch (err) {
    // Don't throw: allow UI to continue logging out locally.
    console.warn("Logout request failed:", err);
  }
}

/**
 * Logout, then hard redirect to /login.
 *
 * Hard redirect is intentional: it stops all in-flight React effects on protected
 * pages that may keep firing API calls and showing 401 errors after logout.
 */
export async function logoutHard(): Promise<void> {
  await logout();
  window.location.href = "/login";
}
