/**
 * Minimal auth utility for JWT token management and current user fetching.
 * 
 * Note: This is a minimal implementation. Token is stored in memory only,
 * which means it's lost on page refresh. For production, consider using
 * localStorage or httpOnly cookies.
 */

let authToken: string | null = null;

export function setAuthToken(token: string) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function clearAuthToken() {
  authToken = null;
}

export type CurrentUser = {
  id: number;
  name: string;
  ovog?: string | null;
  email: string;
  role: string;
  branchId?: number | null;
};

/**
 * Fetch current user info from /api/login/me endpoint.
 * Returns null if not authenticated or if request fails.
 */
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const token = getAuthToken();
  if (!token) {
    return null;
  }

  try {
    const res = await fetch("/api/login/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return null;
    }

    const user = await res.json();
    return user as CurrentUser;
  } catch (err) {
    console.error("Failed to fetch current user:", err);
    return null;
  }
}

/**
 * Make an authenticated API request.
 * Automatically adds Authorization header if token is available.
 */
export async function authenticatedFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options?.headers);
  
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
