import { defineConfig } from 'vitest/config';

/**
 * API test runner config.
 *
 * `env` is applied before test modules load, so security-critical env vars are
 * present at import time (the auth plugin reads JWT_SECRET at registration, and
 * crypto lazily reads TOKEN_ENCRYPTION_KEY). These are throwaway test values —
 * never real secrets.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-not-for-production',
      TOKEN_ENCRYPTION_KEY: '0'.repeat(64),
    },
  },
});
