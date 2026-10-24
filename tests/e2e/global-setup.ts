/**
 * Runs once before the suite (after Playwright has started the dev server).
 *
 * 1. Preflight: the server answering on the base URL must be the Hydrogen dev
 *    server in mock mode. Anything else (a stale process on the port, a
 *    server linked to a real store, a deployed site) would make the whole
 *    suite fail in confusing ways, so fail here with an explanation.
 * 2. Warm the server side: request every route module once, so the first
 *    tests do not pay Vite's on-demand SSR transforms (and time out).
 * 3. Warm the client side: load the main pages in Chromium, so Vite has
 *    pre-bundled the client dependencies and any "optimized dependencies
 *    changed, reloading" full reload happens now, not in the middle of a test.
 * 4. While doing (3), look for Hydrogen's "private access token" console
 *    error. It means the server's PUBLIC_STOREFRONT_API_TOKEN is not exactly
 *    32 characters (typical when E2E_BASE_URL points at a developer server
 *    that runs with the real .env); every test would fail on it.
 */
import {
  chromium,
  request,
  type BrowserContext,
  type Frame,
  type FullConfig,
} from '@playwright/test';
import {installNetworkStubs} from './support/network';
import {waitForHydration} from './support/hydration';

/** Paths requested once to compile server modules (status is ignored). */
const WARM_SERVER_PATHS = [
  '/',
  '/collections',
  '/collections/all',
  '/collections/pillows',
  '/products/cloudalign-pillow',
  '/products/does-not-exist',
  '/search?q=pillow',
  '/search',
  '/cart',
  '/pages/about',
  '/pages/does-not-exist',
  '/policies',
  '/policies/privacy-policy',
  '/blogs',
  '/blogs/news',
  '/blogs/news/does-not-exist',
  '/dev/mock-checkout',
  '/account/login',
  '/account/orders',
  '/account',
  '/discount/MELLOW10',
  '/cart/cloudalign-pillow-1:1',
  '/robots.txt',
  '/sitemap.xml',
  '/sitemap/products/1.xml',
  '/this-page-does-not-exist',
];

/** Pages loaded in a browser to warm the client bundle graph. */
const WARM_CLIENT_PATHS = [
  '/',
  '/products/cloudalign-pillow',
  '/collections/pillows',
  '/collections/all',
  '/search?q=pillow',
  '/cart',
  '/pages/about',
  '/policies/privacy-policy',
  '/blogs',
  '/account/login',
  '/this-page-does-not-exist',
];

/** Warm-up requests whose 5xx is the designed answer, not a problem. */
const EXPECTED_SERVER_ERRORS = new Set(['/account/login']);

const MOCK_BADGE_TEXT = 'Development mock data';
const CLIENT_WARM_CONCURRENCY = 3;
const MAX_VISITS_PER_PAGE = 3;

type PreflightProblem = 'unreachable' | 'bad-status' | 'not-mock';

const PREFLIGHT_HINTS: Record<PreflightProblem, string[]> = {
  unreachable: [
    'Nothing answered. If you set E2E_BASE_URL, start that server first',
    '(`npm run dev:e2e`). Otherwise Playwright should have started its own:',
    're-run with E2E_SERVER_LOGS=1 to see why it did not.',
  ],
  'bad-status': [
    'The server answered, but not with a page. Check its log: the dev server',
    'may have failed to compile the app (`npm run dev:e2e` shows the error).',
  ],
  'not-mock': [
    'Something else is serving this address. The suite needs the Hydrogen dev',
    'server in mock mode (MOCK_STOREFRONT=true, 32-character token), which',
    'Playwright starts itself from tests/e2e/e2e.env on port 3100:',
    '  - stop whatever is listening there, or set E2E_PORT to a free port;',
    '  - to test your own server, set E2E_BASE_URL and make sure it shows the',
    `    "${MOCK_BADGE_TEXT}" badge (see tests/e2e/README.md).`,
  ],
};

function preflightError(
  baseURL: string,
  kind: PreflightProblem,
  problem: string,
): Error {
  return new Error(
    [
      `E2E preflight failed for ${baseURL}: ${problem}`,
      '',
      ...PREFLIGHT_HINTS[kind],
    ].join('\n'),
  );
}

async function preflight(baseURL: string): Promise<void> {
  const api = await request.newContext({baseURL});
  try {
    // The first request compiles the root route: allow for a cold server.
    const response = await api
      .get('/', {maxRedirects: 0, timeout: 120_000})
      .catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        throw preflightError(
          baseURL,
          'unreachable',
          `GET / failed (${reason.split('\n')[0]})`,
        );
      });
    if (response.status() !== 200) {
      throw preflightError(
        baseURL,
        'bad-status',
        `GET / answered ${response.status()}`,
      );
    }
    if (!(await response.text()).includes(MOCK_BADGE_TEXT)) {
      throw preflightError(
        baseURL,
        'not-mock',
        `the home page has no "${MOCK_BADGE_TEXT}" badge, so the server is not in mock mode`,
      );
    }
  } finally {
    await api.dispose();
  }
}

async function warmServer(baseURL: string): Promise<void> {
  const api = await request.newContext({baseURL});
  try {
    const queue = [...WARM_SERVER_PATHS];
    const worker = async () => {
      for (let path = queue.shift(); path; path = queue.shift()) {
        // Redirects are not followed: the redirecting route is the one to compile.
        const response = await api
          .get(path, {maxRedirects: 0, timeout: 120_000})
          .catch(() => null);
        const failed = !response || response.status() >= 500;
        if (failed && !EXPECTED_SERVER_ERRORS.has(path)) {
          console.warn(
            `[e2e warm-up] GET ${path} -> ${response ? response.status() : 'no response'}`,
          );
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  } finally {
    await api.dispose();
  }
}

/** Loads `path` until a visit completes without a Vite-triggered full reload. */
async function warmPage(
  context: BrowserContext,
  path: string,
  tokenErrors: Set<string>,
): Promise<void> {
  const page = await context.newPage();
  try {
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        message.text().includes('private access token')
      ) {
        tokenErrors.add(path);
      }
    });
    for (let visit = 1; visit <= MAX_VISITS_PER_PAGE; visit++) {
      let navigations = 0;
      const onNavigated = (frame: Frame) => {
        if (frame.parentFrame() === null) navigations++;
      };
      page.on('framenavigated', onNavigated);
      try {
        await page.goto(path, {timeout: 120_000});
        // The plain-text responses and 404 documents hydrate like any other.
        await waitForHydration(page);
        // Vite announces dependency re-optimisation shortly after discovery.
        await page.waitForLoadState('networkidle');
      } finally {
        page.off('framenavigated', onNavigated);
      }
      if (navigations <= 1) return;
    }
  } finally {
    await page.close();
  }
}

async function warmClient(baseURL: string): Promise<Set<string>> {
  const browser = await chromium.launch();
  const tokenErrors = new Set<string>();
  try {
    const context = await browser.newContext({baseURL});
    await installNetworkStubs(context, new URL(baseURL).origin);
    const queue = [...WARM_CLIENT_PATHS];
    const worker = async () => {
      for (let path = queue.shift(); path; path = queue.shift()) {
        await warmPage(context, path, tokenErrors).catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : String(error);
          console.warn(`[e2e warm-up] ${path}: ${reason.split('\n')[0]}`);
        });
      }
    };
    await Promise.all(
      Array.from({length: CLIENT_WARM_CONCURRENCY}, () => worker()),
    );
  } finally {
    await browser.close();
  }
  return tokenErrors;
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error('playwright.config.ts must set use.baseURL');

  const started = Date.now();
  await preflight(baseURL);
  await warmServer(baseURL);
  const tokenErrors = await warmClient(baseURL);

  if (tokenErrors.size > 0) {
    throw new Error(
      [
        `Hydrogen logged "It looks like you passed a private access token" on ${tokenErrors.size} warm-up page(s), e.g. ${[...tokenErrors][0]}.`,
        'The server under test has a PUBLIC_STOREFRONT_API_TOKEN that is not exactly 32 characters,',
        'so every test would fail on that console error. tests/e2e/e2e.env uses a 32-character',
        "placeholder; if you set E2E_BASE_URL, fix that server's .env (any 32 characters in mock mode).",
      ].join('\n'),
    );
  }

  process.stderr.write(
    `[e2e] ${baseURL} is a mock-mode dev server; warmed ${WARM_SERVER_PATHS.length} routes in ${((Date.now() - started) / 1000).toFixed(1)}s\n`,
  );
}
