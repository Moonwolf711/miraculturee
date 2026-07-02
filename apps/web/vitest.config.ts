/// <reference types="vitest" />
import { defineConfig, mergeConfig } from 'vite';
import viteConfig from './vite.config.js';

// Force the test build of React regardless of an ambient NODE_ENV. CI and this
// project's Railway-flavored environment inherit NODE_ENV=production, which
// makes Vite resolve React's *production* bundles — and `react-dom/test-utils`
// `act` throws "not supported in production builds", breaking every suite that
// renders a component via @testing-library/react. Setting NODE_ENV here (before
// Vite resolves dependencies) selects React's development/test builds so `act`
// works. Tests should always run as NODE_ENV=test.
if (process.env.NODE_ENV === 'production') {
  process.env.NODE_ENV = 'test';
}

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['./src/test/localstorage-shim.ts', './src/test/setup.ts'],
      css: false,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'text-summary', 'lcov'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/test/**',
          'src/main.tsx',
          'src/vite-env.d.ts',
          'src/**/*.d.ts',
        ],
      },
    },
  }),
);
