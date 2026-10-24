import {defineConfig, devices} from '@playwright/test';

/**
 * End-to-end tests for the Mellow storefront (tests/e2e).
 *
 * The suite runs against the React Router dev server (the Worker runs in
 * workerd through the Cloudflare Vite plugin) in mock mode
 * (MOCK_STOREFRONT=true, see app/lib/mock/README.md). The mock only exists in
 * development builds, so Playwright starts `react-router dev` itself with
 * CLOUDFLARE_ENV=e2e, which makes Wrangler load the committed placeholders in
 * .dev.vars.e2e instead of the developer's .dev.vars, on port 3100. Set
 * E2E_BASE_URL to test an already running server instead; it must be in mock
 * mode with a 32-character token.
 *
 * Browsers: Chromium only (the preinstalled build; never run
 * `playwright install` in the cloud container). Projects and tags:
 *   desktop-1440  every spec except @mobile-only
 *   tablet-820    specs tagged @smoke
 *   mobile-390    specs tagged @smoke or @mobile
 * Untagged specs therefore run on desktop only; @mobile-only specs run on
 * mobile only.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const IS_CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  outputDir: './test-results/e2e',
  // Preflight (mock mode?), server and client warm-up, token-length hint.
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 2 : 3,
  timeout: 60_000,
  expect: {timeout: 10_000},
  reporter: IS_CI
    ? [
        ['list'],
        ['html', {open: 'never'}],
        ['junit', {outputFile: 'test-results/junit.xml'}],
      ]
    : [['list'], ['html', {open: 'never'}]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: BASE_URL,
    locale: 'en-US',
    // A zone west of UTC: the Worker renders in UTC, so any server/client date
    // formatting difference shows up as a hydration error here.
    timezoneId: 'America/Los_Angeles',
    colorScheme: 'light',
    // Collapses transitions and marquee motion so runs are deterministic;
    // motion-specific specs opt back in with test.use().
    reducedMotion: 'reduce',
    trace: IS_CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: 'desktop-1440',
      use: {viewport: {width: 1440, height: 900}},
      grepInvert: /@mobile-only/,
    },
    {
      name: 'tablet-820',
      use: {
        viewport: {width: 820, height: 1180},
        isMobile: true,
        hasTouch: true,
      },
      grep: /@smoke/,
    },
    {
      name: 'mobile-390',
      use: {
        viewport: {width: 390, height: 844},
        isMobile: true,
        hasTouch: true,
      },
      grep: /@smoke|@mobile/,
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx react-router dev --port ${PORT} --strictPort`,
        url: `${BASE_URL}/`,
        reuseExistingServer: !IS_CI,
        timeout: 180_000,
        stdout: 'ignore',
        // The dev server logs every request to stderr (about 1,100 lines per
        // run) and would bury the test output. Set E2E_SERVER_LOGS=1 to see it,
        // or run `npm run dev:e2e` yourself when the server does not start.
        stderr: process.env.E2E_SERVER_LOGS ? 'pipe' : 'ignore',
        gracefulShutdown: {signal: 'SIGTERM', timeout: 10_000},
        // Vite derives import.meta.env.DEV (which gates the mock) from NODE_ENV;
        // CLOUDFLARE_ENV selects the e2e Worker environment and .dev.vars.e2e.
        env: {NODE_ENV: 'development', CLOUDFLARE_ENV: 'e2e'},
      },
});
