const REFRESH_TOKEN_KEY = 'study_hub_refresh_token';

// Access token stored in memory only (not localStorage) for XSS protection
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  if (typeof window !== 'undefined') {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
}

export function clearTokens(): void {
  accessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Decode JWT payload without verification (client-side expiry check only).
 * Returns null if token is malformed.
 */
function decodeJwtPayload(
  token: string,
): { exp?: number; [key: string]: unknown } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if current access token exists and is not expired.
 * Uses a 30-second buffer before actual expiry.
 */
export function isAuthenticated(): boolean {
  if (!accessToken) return false;

  const payload = decodeJwtPayload(accessToken);
  if (!payload?.exp) return true; // No expiry claim, assume valid

  const now = Math.floor(Date.now() / 1000);
  return payload.exp > now + 30; // 30s buffer
}

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Returns true on success, false on failure.
 */
export async function refreshToken(): Promise<boolean> {
  const storedRefresh = getRefreshToken();
  if (!storedRefresh) return false;

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  try {
    const response = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: storedRefresh }),
    });

    if (!response.ok) {
      clearTokens();
      return false;
    }

    const data = await response.json();
    if (data.success && data.data) {
      setTokens(data.data.access_token, data.data.refresh_token);
      return true;
    }

    clearTokens();
    return false;
  } catch {
    clearTokens();
    return false;
  }
}
