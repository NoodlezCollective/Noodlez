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
    environment: 'node',
    include: ['app/**/*.test.{ts,tsx}'],
  },
});
