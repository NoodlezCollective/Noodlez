# End-to-end tests

Playwright specs for the Mellow storefront. They run against the React Router
dev server (the Worker runs in workerd through the Cloudflare Vite plugin) in
**mock mode** (`MOCK_STOREFRONT=true`, see `app/lib/mock/README.md`):
no Shopify credentials, no network. Chromium only.

## Running

```bash
npm run test:e2e                                   # everything, all projects
npm run test:e2e -- tests/e2e/smoke.spec.ts        # one spec
npm run test:e2e -- --project=desktop-1440 -g "cart"
npm run test:e2e -- --repeat-each=3                # flakiness check
npm run test:e2e -- --headed --debug               # watch / step through
npm run test:e2e:ui                                # Playwright UI mode
npm run test:e2e:report                            # open the HTML report
npm test                                           # unit tests, then e2e
```

Playwright starts the dev server itself (`npx react-router dev --port 3100
--strictPort` with `CLOUDFLARE_ENV=e2e`, so Wrangler reads the committed
`.dev.vars.e2e` instead of your `.dev.vars`) and reuses one that is already
running on that port locally (never in CI). `tests/e2e/global-setup.ts` then checks that the
server really is in mock mode, requests every route once and loads the main
pages in a browser, so Vite's on-demand compilation and dependency
optimisation do not happen in the middle of a test. The first run on a cold
checkout therefore takes a while; later runs start in about 20 s.
The server's own log (one line per request) is hidden; set `E2E_SERVER_LOGS=1`
to see it, or run `npm run dev:e2e` in another terminal when the server does
not come up.

`.dev.vars.e2e` is committed on purpose: placeholders only. The public token
must stay exactly **32 characters**, otherwise Hydrogen logs "It looks like
you passed a private access token" on every page.

**Do not edit `app/` while the suite runs.** The dev server hot-reloads, and
the mock keeps carts in memory: a reload mid-run drops them and fails
unrelated tests. Browsers are preinstalled in the cloud container; never run
`playwright install` there (CI uses `npx playwright install --with-deps
chromium`).

### Several runs at once

One dev server and one set of output folders are shared by default, so two
concurrent runs interfere (Playwright stops a server it started, and wipes
`test-results/e2e` when it begins). Either keep a single server running
(`npm run dev:e2e`; every run then reuses it and never stops it), or isolate
each run:

```bash
E2E_PORT=3101 PLAYWRIGHT_HTML_REPORT=playwright-report-b \
  npm run test:e2e -- --output=test-results/e2e-b
```

## Projects and tags

| Project        | Viewport | Runs                               |
| -------------- | -------- | ---------------------------------- |
| `desktop-1440` | 1440x900 | everything except `@mobile-only`   |
| `tablet-820`   | 820x1180 | tests tagged `@smoke`              |
| `mobile-390`   | 390x844  | tests tagged `@smoke` or `@mobile` |

Untagged tests run on desktop only. Tag with `test('...', {tag: '@mobile'}, ...)`
or `test.describe('...', {tag: '@smoke'}, ...)`. Both mobile projects use the
touch-emulated mobile layout (the desktop navigation starts at 64em).

The config also sets `timezoneId: 'America/Los_Angeles'` (the server renders in
UTC, so date formatting differences surface as hydration errors),
`reducedMotion: 'reduce'` (collapses transitions and keeps marquees still; opt
back in with `test.use({reducedMotion: 'no-preference'})`) and `locale: 'en-US'`.

## Console policy

Every test fails on an unexpected `console.error`, `console.warn` or uncaught
page error (`support/console.ts`, an automatic fixture). The baseline allowlist
has **one** entry: Hydrogen's `[h2:error:Analytics.Provider] - Mock shop is
used...` warning, which the mock triggers by design. Everything else a test
provokes on purpose must be allowed in that test, with a reason:

```ts
test('unknown product', async ({page, consoleGuard}) => {
  consoleGuard.allowHttpStatus(404, '/products/nope'); // Chromium logs 4xx/5xx documents
  consoleGuard.allow(/Content Security Policy/, 'deliberate CSP probe');
  ...
});
```

Never add a blanket rule. Third-party requests are answered locally by
`support/network.ts` (fonts, Shopify's consent script, analytics), so network
errors and "Unable to load the Customer Privacy API" cannot happen and are
deliberately not allowed: if they appear, a stub is broken.

## Another server

`E2E_BASE_URL=http://localhost:3000 npm run test:e2e` skips the built-in server
and tests the one you give it (`E2E_PORT` changes the built-in server's port).
That server must be in mock mode (it shows the "Development mock data" badge)
with a 32-character `PUBLIC_STOREFRONT_API_TOKEN`; `global-setup.ts` fails fast
with an explanation otherwise.

## Helpers (`support/`)

| File           | Use                                                                       |
| -------------- | ------------------------------------------------------------------------- |
| `fixtures.ts`  | `import {expect, test} from './support/fixtures'` (stubs + console guard) |
| `console.ts`   | `ConsoleGuard`, the baseline allowlist                                    |
| `network.ts`   | hermetic third-party stubs (installed by the fixture)                     |
| `hydration.ts` | `gotoHydrated(page, path)`, `waitForHydration`, `redirectChain`           |
| `layout.ts`    | `expectSingleH1`, `expectNoHorizontalOverflow`, `expectPageChrome`        |
| `catalog.ts`   | expected mock data: `PRODUCTS`, `COLLECTIONS`, `TITLES`, `COPY`, ...      |
| `cart.ts`      | `seedCart(page, 'cloudalign-pillow-1:2', {discount})`                     |
| `dialogs.ts`   | `drawer`, `expectModalOpen`, `expectFocusTrapped`, `WITH_MOTION`, ...     |
| `seo.ts`       | `readJsonLd`, `canonicalHrefs`, `ogContent`, `namedMeta`                  |

`support/catalog.ts` is hand-typed on purpose (an independent oracle). When
`app/lib/mock/data/*` changes, update it in the same commit; `support.spec.ts`
compares it with the running mock and fails on drift.

Conventions: roles and labels over CSS; scope locators (`getByRole('main')`,
the dialog, a region) and use `exact: true` for short names ("Close", "Search");
use `gotoHydrated` for every React page; never `waitForTimeout`; every
Playwright call is awaited (`no-floating-promises` is an error).

## Specs

- `smoke` – every route at three viewports (status, one h1, no overflow,
  landmarks, console guard).
- `seo` – titles, canonicals, robots, og tags, JSON-LD, robots.txt, sitemaps
  (server-rendered HTML with JavaScript off).
- `security` – headers, CSP enforcement, redirects, CSRF, cart and newsletter
  limits.
- `motion` – WCAG 2.2.2 pause controls and the one-copy marquee.
- `product`, `cart`, `collections` – variants, gallery, quantity, add to cart,
  cart page and drawer, discounts, checkout hand-off, sort, filters, pagination.
- `navigation`, `search`, `content`, `a11y` – header/footer/drawers/mobile
  menu, predictive search and the search page, home/About/FAQ/newsletter/404/
  account/policies content, axe-core (WCAG 2.x A/AA plus target-size).
- `support` – self-tests for the helpers above.

### Known app bugs

None at the moment. When a spec finds a real product defect, keep the
assertion correct and skip that single test with
`test.fixme(true, 'BUG: <diagnosis and suggested fix>')`; remove the line when
the app is fixed so the test guards against regressions.
