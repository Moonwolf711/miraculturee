/* ------------------------------------------------------------------
   Global test setup for Vitest + happy-dom.
   - Provides in-memory localStorage to avoid Node.js 22 SecurityError
   - Imports @testing-library/jest-dom matchers
   - Mocks browser APIs that happy-dom does not implement
   - Sets up MSW server for API mocking
   ------------------------------------------------------------------ */

/* ============== In-Memory localStorage ============== */
/* Node.js 22+ ships a native localStorage that throws SecurityError
   unless --localstorage-file is set.  We replace it with a simple
   in-memory implementation BEFORE anything else imports. */

const storageMap = new Map<string, string>();

const memoryLocalStorage: Storage = {
  getItem(key: string) {
    return storageMap.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    storageMap.set(key, String(value));
  },
  removeItem(key: string) {
    storageMap.delete(key);
  },
  clear() {
    storageMap.clear();
  },
  key(index: number) {
    const keys = [...storageMap.keys()];
    return keys[index] ?? null;
  },
  get length() {
    return storageMap.size;
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: memoryLocalStorage,
  writable: true,
  configurable: true,
});

/* ============== Imports (after localStorage is safe) ============== */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { server } from './mocks/server.js';

/* ============== MSW Server Lifecycle ============== */

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  storageMap.clear();
});
afterAll(() => server.close());

/* ============== Browser API Mocks ============== */

// IntersectionObserver
class MockIntersectionObserver {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly thresholds: readonly number[] = [0];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

// ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

// matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// scrollTo
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

// Geolocation
Object.defineProperty(navigator, 'geolocation', {
  value: {
    getCurrentPosition: vi.fn().mockImplementation((success: PositionCallback) => {
      success({
        coords: {
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 100,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    }),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  },
  writable: true,
});
