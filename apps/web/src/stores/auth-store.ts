import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import {
  setTokens,
  clearTokens,
  getRefreshToken,
  refreshToken as refreshAccessToken,
  getAccessToken,
} from '@/lib/auth';

export interface User {
  readonly id: string;
  readonly email: string;
  readonly full_name: string;
  readonly language_preference: string;
  readonly created_at: string;
}

interface TokenData {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly token_type: string;
}

interface AuthState {
  readonly user: User | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly error: string | null;
  readonly login: (email: string, password: string) => Promise<void>;
  readonly register: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<void>;
  readonly logout: () => Promise<void>;
  readonly loadUser: () => Promise<void>;
  readonly clearError: () => void;
}

async function fetchCurrentUser(): Promise<User | null> {
  const result = await apiFetch<User>('/auth/me');
  if (result.success) {
    return result.data;
  }
  return null;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,

  clearError: () => set({ error: null }),

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiFetch<TokenData>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (!result.success) {
        set({ isLoading: false, error: result.error || 'Login failed' });
        return;
      }

      setTokens(result.data.access_token, result.data.refresh_token);

      const user = await fetchCurrentUser();
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch {
      set({ isLoading: false, error: 'Network error' });
    }
  },

  register: async (email: string, password: string, fullName: string) => {
    set({ isLoading: true, error: null });
    try {
      const registerResult = await apiFetch<User>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
        }),
      });

      if (!registerResult.success) {
        set({
          isLoading: false,
          error: registerResult.error || 'Registration failed',
        });
        return;
      }

      // Auto-login after successful registration
      const loginResult = await apiFetch<TokenData>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (!loginResult.success) {
        set({
          isLoading: false,
          error: 'Registered but login failed. Please log in manually.',
        });
        return;
      }

      setTokens(loginResult.data.access_token, loginResult.data.refresh_token);

      const user = await fetchCurrentUser();
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch {
      set({ isLoading: false, error: 'Network error' });
    }
  },

  logout: async () => {
    try {
      const token = getAccessToken();
      if (token) {
        const refreshTok = getRefreshToken();
        await apiFetch('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refreshTok }),
        });
      }
    } catch {
      // Best-effort logout call
    } finally {
      clearTokens();
      set({ user: null, isAuthenticated: false, error: null });
    }
  },

  loadUser: async () => {
    const storedRefresh = getRefreshToken();
    if (!storedRefresh) {
      set({ isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        set({ isLoading: false, isAuthenticated: false, user: null });
        return;
      }

      const user = await fetchCurrentUser();
      if (user) {
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        clearTokens();
        set({ isLoading: false, isAuthenticated: false, user: null });
      }
    } catch {
      clearTokens();
      set({ isLoading: false, isAuthenticated: false, user: null });
    }
  },
}));
