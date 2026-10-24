import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

/**
 * Unit tests (app/**\/*.test.ts[x]).
 *
 * Deliberately does NOT load vite.config.ts: the Hydrogen, Oxygen and React
 * Router plugins expect a real dev/build pipeline and break under Vitest. Only
 * the `~` alias that the app uses is needed here. End-to-end tests live in
 * tests/e2e and run with Playwright (see playwright.config.ts).
 */
export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text-summary', 'html'],
      // The unit layer targets the pure modules; components and routes are
      // covered by the Playwright suite (tests/e2e).
      include: ['app/lib/**/*.ts'],
      exclude: [
        '**/*.test.{ts,tsx}',
        'app/lib/__tests__/**',
        'app/lib/mock/**',
      ],
      // ECC baseline: 80%+ on the unit-tested surface.
      thresholds: {statements: 80, branches: 80, functions: 80, lines: 80},
    },
    environment: 'node',
    include: ['app/**/*.test.{ts,tsx}'],
  },
});
