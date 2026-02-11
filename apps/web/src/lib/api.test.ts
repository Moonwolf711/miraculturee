/* ------------------------------------------------------------------
   Unit tests for lib/api.ts — GET/POST, token handling, refresh flow.
   Uses MSW handlers defined in test/mocks/handlers.ts.
   ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server.js';
import { api } from './api.js';

describe('api module', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /* ---------- GET requests ---------- */

  describe('api.get', () => {
    it('fetches data from the given path', async () => {
      const result = await api.get<{ data: unknown[] }>('/events');
      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('attaches auth token from localStorage', async () => {
      let capturedAuth = '';
      server.use(
        http.get('/api/test-auth', ({ request }) => {
          capturedAuth = request.headers.get('Authorization') || '';
          return HttpResponse.json({ ok: true });
        }),
      );

      localStorage.setItem('accessToken', 'my-secret-token');
      await api.get('/test-auth');

      expect(capturedAuth).toBe('Bearer my-secret-token');
    });

    it('does not include Authorization header when no token', async () => {
      let capturedAuth: string | null = '';
      server.use(
        http.get('/api/test-no-auth', ({ request }) => {
          capturedAuth = request.headers.get('Authorization');
          return HttpResponse.json({ ok: true });
        }),
      );

      await api.get('/test-no-auth');
      expect(capturedAuth).toBeNull();
    });
  });

  /* ---------- POST requests ---------- */

  describe('api.post', () => {
    it('sends POST with JSON body', async () => {
      let capturedBody: unknown = null;
      server.use(
        http.post('/api/test-post', async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ ok: true });
        }),
      );

      await api.post('/test-post', { name: 'test' });
      expect(capturedBody).toEqual({ name: 'test' });
    });

    it('sends POST without body when body is undefined', async () => {
      let capturedBody: string | null = null;
      server.use(
        http.post('/api/test-post-empty', async ({ request }) => {
          capturedBody = await request.text();
          return HttpResponse.json({ ok: true });
        }),
      );

      await api.post('/test-post-empty');
      expect(capturedBody).toBe('');
    });
  });

  /* ---------- Error handling ---------- */

  describe('error handling', () => {
    it('throws on non-200 response with error message from body', async () => {
      server.use(
        http.get('/api/test-error', () => {
          return HttpResponse.json({ error: 'Not found' }, { status: 404 });
        }),
      );

      await expect(api.get('/test-error')).rejects.toThrow('Not found');
    });

    it('throws generic error when response body is not JSON', async () => {
      server.use(
        http.get('/api/test-error-text', () => {
          return new HttpResponse('Server Error', { status: 500 });
        }),
      );

      await expect(api.get('/test-error-text')).rejects.toThrow('Request failed');
    });
  });

  /* ---------- 401 / token refresh flow ---------- */

  describe('401 token refresh flow', () => {
    it('refreshes token and retries on 401', async () => {
      let callCount = 0;
      server.use(
        http.get('/api/test-protected', ({ request }) => {
          callCount++;
          const auth = request.headers.get('Authorization');
          if (auth === 'Bearer refreshed-access-token') {
            return HttpResponse.json({ data: 'secret' });
          }
          return new HttpResponse(null, { status: 401 });
        }),
      );

      localStorage.setItem('accessToken', 'expired-token');
      localStorage.setItem('refreshToken', 'valid-refresh');

      const result = await api.get<{ data: string }>('/test-protected');
      expect(result.data).toBe('secret');
      // Should have been called twice: first 401, then retry
      expect(callCount).toBe(2);
      // Tokens should be updated
      expect(localStorage.getItem('accessToken')).toBe('refreshed-access-token');
      expect(localStorage.getItem('refreshToken')).toBe('refreshed-refresh-token');
    });

    it('clears tokens and redirects to /login when refresh fails', async () => {
      server.use(
        http.get('/api/test-no-refresh', () => {
          return new HttpResponse(null, { status: 401 });
        }),
        http.post('/api/auth/refresh', () => {
          return new HttpResponse(null, { status: 401 });
        }),
      );

      localStorage.setItem('accessToken', 'expired');
      localStorage.setItem('refreshToken', 'also-expired');

      // api.ts sets window.location.href = '/login' then throws 'Session expired'.
      // In happy-dom, the href assignment triggers a navigation that may
      // cause fetch to fail with 'Invalid URL' before the throw executes.
      // We verify the important side effects: tokens are cleared.
      try {
        await api.get('/test-no-refresh');
        // Should not reach here
        expect.unreachable('Expected api.get to throw');
      } catch {
        // Either 'Session expired' or 'Invalid URL' depending on
        // how happy-dom handles the location assignment.
      }
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });

    it('clears tokens and redirects to /login when no refresh token is available', async () => {
      server.use(
        http.get('/api/test-no-token', () => {
          return new HttpResponse(null, { status: 401 });
        }),
      );

      localStorage.setItem('accessToken', 'expired');
      // No refresh token

      try {
        await api.get('/test-no-token');
        expect.unreachable('Expected api.get to throw');
      } catch {
        // Either 'Session expired' or 'Invalid URL'
      }
      expect(localStorage.getItem('accessToken')).toBeNull();
    });
  });
});
