import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../lib/api.js';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  totpEnabled: boolean;
  passkeyCount: number;
  socialLoginCount: number;
}

type LoginResult =
  | { success: true }
  | { requiresTwoFactor: true; tempToken: string };

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  loginWith2FA: (tempToken: string, code: string) => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  register: (email: string, password: string, name: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<User>('/auth/me');
      setUser(data);
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const res = await api.post<{ accessToken?: string; refreshToken?: string; requiresTwoFactor?: boolean; tempToken?: string }>('/auth/login', { email, password });

    if (res.requiresTwoFactor) {
      return { requiresTwoFactor: true, tempToken: res.tempToken! };
    }

    localStorage.setItem('accessToken', res.accessToken!);
    localStorage.setItem('refreshToken', res.refreshToken!);
    await fetchUser();
    return { success: true };
  };

  const loginWith2FA = async (tempToken: string, code: string) => {
    const tokens = await api.post<{ accessToken: string; refreshToken: string }>(
      '/auth/2fa/verify',
      { tempToken, code },
    );
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    await fetchUser();
  };

  const loginWithPasskey = async () => {
    const { startAuthentication } = await import('@simplewebauthn/browser');
    // Server returns WebAuthn challenge options conforming to PublicKeyCredentialRequestOptionsJSON
    const options = await api.post<Record<string, unknown>>('/auth/passkeys/auth/options', {});
    // Hint the browser to prefer platform authenticators (Windows Hello PIN, Touch ID)
    // over cross-platform ones (USB security keys)
    options.hints = ['client-device'];
    // The options object matches PublicKeyCredentialRequestOptionsJSON shape at runtime
    const authResponse = await startAuthentication({ optionsJSON: options as unknown as Parameters<typeof startAuthentication>[0]['optionsJSON'] });
    const tokens = await api.post<{ accessToken: string; refreshToken: string }>(
      '/auth/passkeys/auth/verify',
      authResponse,
    );
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    await fetchUser();
  };

  const register = async (email: string, password: string, name: string, role: string) => {
    const tokens = await api.post<{ accessToken: string; refreshToken: string }>('/auth/register', {
      email,
      password,
      name,
      role,
    });
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    await fetchUser();
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken });
      } catch {
        // Best-effort server invalidation — clear locally regardless
      }
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, loginWith2FA, loginWithPasskey, register, logout, refreshUser: fetchUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
