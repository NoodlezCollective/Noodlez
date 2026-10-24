# Mellow storefront

A Shopify Hydrogen (React Router 7) storefront implementing the Mellow design:
homepage, product pages, collections with filtering and sorting, search, cart
drawer and cart page, customer accounts, About page and content pages.

## Getting started

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in your store credentials, or set MOCK_STOREFRONT=true
npm run dev            # http://localhost:3000
```

Without a linked Shopify store, set `MOCK_STOREFRONT=true` in `.dev.vars` to run
the storefront against an in-memory demo catalog (development only). To connect
your store, copy the Hydrogen sales channel's storefront settings into
`.dev.vars` and follow [docs/shopify-setup.md](docs/shopify-setup.md) for the
menus, collections, metafields and metaobjects the storefront reads. The Worker
runs in workerd locally (Cloudflare Vite plugin) and deploys to Cloudflare
Workers with `npm run deploy` (`wrangler.jsonc`).

## Scripts

| Command                      | Description                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm run dev`                | Vite dev server with the Worker in workerd (port 3000)                                                     |
| `npm run dev:e2e`            | Dev server on port 3100 in mock mode, with the committed `.dev.vars.e2e` (the server the e2e suite starts) |
| `npm run build`              | Production build (Worker + client assets in `dist/`)                                                       |
| `npm run preview`            | Build and preview the Worker in workerd                                                                    |
| `npm run deploy`             | Build and `wrangler deploy`                                                                                |
| `npm run typecheck`          | React Router typegen + `tsc`                                                                               |
| `npm run lint`               | ESLint                                                                                                     |
| `npm run codegen`            | Regenerate Storefront / Customer Account API types (`codegen.ts`)                                          |
| `npm test`                   | Unit tests, then the end-to-end suite                                                                      |
| `npm run test:unit`          | Vitest unit tests                                                                                          |
| `npm run test:unit:coverage` | Unit tests with a coverage report (80% thresholds on `app/lib`)                                            |
| `npm run test:watch`         | Vitest in watch mode                                                                                       |
| `npm run test:e2e`           | Playwright end-to-end suite (Chromium only)                                                                |
| `npm run test:e2e:ui`        | Playwright UI mode                                                                                         |
| `npm run test:e2e:report`    | Open the last Playwright HTML report                                                                       |

`react-router-dom` and `graphql-tag` were removed from the dependencies because nothing imported them.

## Testing

- **Prerequisites:** Node 22 or 24 (see `engines`) and Chromium for Playwright.
  The cloud container has Chromium preinstalled, so do not run
  `playwright install` there. CI installs it with
  `npx playwright install --with-deps chromium`.
- **Unit tests:** `npm run test:unit` runs Vitest over `app/**/*.test.ts(x)`
  (1,434 tests in 38 files). `npm run test:unit:coverage` enforces 80% on
  statements, branches, functions and lines in `app/lib`.
- **End-to-end tests:** `npm run test:e2e` runs Playwright in three projects,
  selected by tags: `desktop-1440` (370 tests), `tablet-820` (26, `@smoke`) and
  `mobile-390` (119, `@smoke` or `@mobile`). Playwright starts its own dev server
  in mock mode on port 3100 with the committed `.dev.vars.e2e` (selected by
  `CLOUDFLARE_ENV=e2e`), so no store credentials are needed. Locally it reuses a
  server already on that port; CI always starts its own.
- **Another server:** `E2E_BASE_URL=http://localhost:3000 npm run test:e2e`
  tests the server you name instead. It must be in mock mode with a 32-character
  `PUBLIC_STOREFRONT_API_TOKEN`.
- **Artefacts:** `test-results/` (traces, screenshots and `junit.xml` in CI),
  `playwright-report/` (the HTML report, `npm run test:e2e:report`) and
  `coverage/` (unit coverage) are git-ignored.
- Do not edit `app/` while the e2e suite runs: the dev server hot-reloads, and
  the mock keeps carts in memory.

The spec list, console policy and helpers are described in
[tests/e2e/README.md](tests/e2e/README.md).

## Project structure

```
app/
  components/        UI (header, footer, product card, cart, home sections, ui primitives)
  lib/content/       Typed content contracts, metaobject queries, metafield parsers, defaults
  lib/mock/          Development-only Storefront API mock (MOCK_STOREFRONT=true)
  routes/            React Router routes (flat routes convention)
  styles/            tokens.css (design tokens), app.css (shared), per-area stylesheets
docs/shopify-setup.md  Shopify configuration reference
playwright.config.ts   Playwright projects, tags and the dev server Playwright starts
tests/e2e/             Playwright specs, support/ helpers and the global setup
wrangler.jsonc         Cloudflare Worker config; .dev.vars.e2e holds the mock-mode e2e variables
vitest.config.ts       Unit test setup (app/**/*.test.ts(x)) and the coverage thresholds for app/lib
```

Planned next step (not started): replace Hydrogen with React Router 7 and
`@shopify/hydrogen-react` on Cloudflare Workers. See
[docs/hydrogen-removal-architecture.md](docs/hydrogen-removal-architecture.md)
and [docs/hydrogen-removal-plan.md](docs/hydrogen-removal-plan.md).
