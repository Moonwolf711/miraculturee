/* ------------------------------------------------------------------
   In-memory localStorage shim — MUST run before any other setup file.

   Node 22+ (and Node 25 here) ship a native experimental `localStorage`
   that throws `SecurityError: Cannot initialize local storage without a
   `--localstorage-file` path` on first access. MSW instantiates its
   CookieStore as a module-level singleton that touches `localStorage` at
   import time, so the shim has to be installed *before* MSW is imported.

   ES `import` statements are hoisted, so an inline shim in setup.ts runs
   AFTER setup.ts's own imports (including MSW) — too late. This file is
   import-free and listed first in vitest `setupFiles`, so vitest evaluates
   it to completion before setup.ts (and therefore before MSW) loads.
   ------------------------------------------------------------------ */

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

// Exposed so setup.ts can clear storage between tests without re-importing.
(globalThis as unknown as { __memoryStorageMap: Map<string, string> }).__memoryStorageMap =
  storageMap;
