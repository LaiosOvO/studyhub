import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { authApi, clearTokens, type LoginResponse } from "../lib/api";

interface User {
  id: string;
  email: string;
  name?: string;
}

interface RegisterExtra {
  invite_code?: string;
  institution?: string;
  major?: string;
  advisor?: string;
  role?: string;
  research_directions?: string[];
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string, extra?: RegisterExtra) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check existing session on mount
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      authApi
        .me()
        .then(setUser)
        .catch(() => {
          clearTokens();
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res: LoginResponse = await authApi.login(email, password);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string, name?: string, extra?: RegisterExtra) => {
      const res: LoginResponse = await authApi.register(email, password, name, extra);
      setUser(res.user);
    },
    []
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isLoggedIn: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
