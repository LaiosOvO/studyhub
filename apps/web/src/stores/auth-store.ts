import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  full_name: string;
  language_preference: string;
  created_at: string;
}

interface AuthState {
  readonly user: User | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly login: (email: string, password: string) => Promise<void>;
  readonly register: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<void>;
  readonly logout: () => Promise<void>;
  readonly loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,

  login: async () => {
    // Implemented in Task 2
  },

  register: async () => {
    // Implemented in Task 2
  },

  logout: async () => {
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    // Implemented in Task 2
  },
}));
