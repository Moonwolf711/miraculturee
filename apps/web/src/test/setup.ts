/* ------------------------------------------------------------------
   Global test setup for Vitest + happy-dom.
   - Imports @testing-library/jest-dom matchers
   - Mocks browser APIs that happy-dom does not implement
   - Sets up MSW server for API mocking

   NOTE: the in-memory localStorage shim lives in ./localstorage-shim.ts
   and is listed FIRST in vitest `setupFiles`. It must run before MSW is
   imported (MSW touches localStorage at import time via a module-level
   CookieStore singleton), and ES import hoisting would run an inline shim
   here too late. See that file for details.
   ------------------------------------------------------------------ */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { server } from './mocks/server.js';

// Shared with ./localstorage-shim.ts so we can reset storage between tests.
const storageMap = (globalThis as unknown as { __memoryStorageMap: Map<string, string> })
  .__memoryStorageMap;

/* ============== MSW Server Lifecycle ============== */

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  storageMap?.clear();
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
