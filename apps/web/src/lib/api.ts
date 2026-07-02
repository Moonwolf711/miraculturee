const BASE = import.meta.env.VITE_API_URL || '/api';

// Token refresh mutex — prevents concurrent 401s from racing on refresh
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  try {
    const refreshRes = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (refreshRes.ok) {
      const tokens = await refreshRes.json();
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      return true;
    }
  } catch {
    // refresh failed
  }
  return false;
}

async function refreshWithMutex(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = tryRefreshToken().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {
    ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let res = await fetch(`${BASE}${path}`, { ...options, headers });

  // Session-expiry recovery applies ONLY to requests that actually carried an
  // access token. A 401 on an unauthenticated request (login, register, 2FA
  // verify, forgot/reset password) is a genuine application error — e.g.
  // "Invalid credentials" — and must be surfaced to the caller, not mistaken
  // for an expired session that triggers a refresh + forced logout (CONTRACT-001).
  if (res.status === 401 && token) {
    const refreshed = await refreshWithMutex();
    if (!refreshed) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    // Retry once with the refreshed access token, then fall through to shared
    // error handling so a still-failing retry surfaces the server's message.
    headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    // Prefer field-level validation detail when the server returns it
    // (CONTRACT-003), then the top-level message, then a status fallback.
    const detail = Array.isArray(err?.details)
      ? err.details.map((d: { message?: string }) => d?.message).filter(Boolean).join(', ')
      : '';
    throw new Error(detail || err?.error || `API error: ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
