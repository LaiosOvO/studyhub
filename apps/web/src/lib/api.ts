import { getAccessToken, refreshToken, clearTokens } from './auth';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ApiError {
  readonly success: false;
  readonly error: string;
  readonly message?: string;
}

interface ApiSuccess<T> {
  readonly success: true;
  readonly data: T;
  readonly message?: string;
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;

// Token refresh promise queue to prevent concurrent refresh attempts
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = refreshToken().then(
    (success) => {
      refreshPromise = null;
      return success;
    },
    () => {
      refreshPromise = null;
      return false;
    },
  );

  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${path}`;

  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(url, { ...options, headers });

  // On 401, try refreshing the token once
  if (response.status === 401 && accessToken) {
    const refreshed = await tryRefresh();

    if (refreshed) {
      const newToken = getAccessToken();
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
      }
      const retryResponse = await fetch(url, { ...options, headers });
      return retryResponse.json() as Promise<ApiResponse<T>>;
    }

    // Refresh failed, clear tokens
    clearTokens();
  }

  return response.json() as Promise<ApiResponse<T>>;
}
