# Mellow storefront

The Mellow storefront is a Shopify storefront for the Mellow design. It is a
React Router 7 app in framework mode that runs as a Cloudflare Worker: `server.ts`
is the Worker, `@cloudflare/vite-plugin` runs it in workerd during development and
preview, and wrangler deploys it. Commerce data comes from the Shopify Storefront
API through the storefront's own client (`app/lib/storefront`).
`@shopify/hydrogen-react` provides UI components, Storefront API types and
analytics helpers. Shopify Hydrogen itself is no longer used (see
[Migration record](#migration-record)).

The storefront has a homepage, product pages, collections with filtering and
sorting, search, a cart drawer and cart page, an About page, content pages and
policies. Customer accounts are deferred: `/account` ends on a 503 sign-in page
until the account client is ported. A development-only mock of the Storefront API
runs the storefront without a store.

## Getting started

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in your store values, or set MOCK_STOREFRONT=true
npm run dev                      # http://localhost:3000
```

- Development variables are read from `.dev.vars` (gitignored). Wrangler and the
  Vite dev server read it as the Worker's variables. A `.env` file is not read.
- Without a store, set `MOCK_STOREFRONT=true` in `.dev.vars` to serve the
  in-memory demo catalog. This is for development only (see
  `app/lib/mock/README.md`).
- To connect a store, copy the storefront values from the Hydrogen sales channel's
  storefront settings in the Shopify admin into `.dev.vars` and set
  `MOCK_STOREFRONT=false`. `npm run store:check` then confirms the connection
  and lists which menus, collections, metafields, metaobjects and policies the
  store already has (with `-- --write-dev-vars` it writes `.dev.vars` from
  variables in the environment). Follow
  [docs/shopify-setup.md](docs/shopify-setup.md) for everything it reports as
  missing.

## Scripts

| Command                      | What it does                                                                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                | Vite dev server with the Worker in workerd, on port 3000                                                                                                                                        |
| `npm run dev:e2e`            | The same server on port 3100 with `CLOUDFLARE_ENV=e2e`, which loads the committed `.dev.vars.e2e` (mock mode). Playwright starts this server when none is running                               |
| `npm run build`              | Production build of the Worker and the client assets (`dist/`)                                                                                                                                  |
| `npm run preview`            | Build, then `vite preview`, which runs the built Worker in the Workers runtime                                                                                                                  |
| `npm run deploy`             | Build, then `wrangler deploy` (see Deployment)                                                                                                                                                  |
| `npm run store:check`        | Checks the Storefront API connection with the variables in the environment or `.dev.vars` and reports which store content the storefront still needs (`-- --write-dev-vars` writes `.dev.vars`) |
| `npm run typecheck`          | `react-router typegen`, then `tsc --noEmit`                                                                                                                                                     |
| `npm run lint`               | ESLint                                                                                                                                                                                          |
| `npm run format`             | Prettier, writing the files                                                                                                                                                                     |
| `npm run codegen`            | Regenerates the Storefront and Customer Account API types from `codegen.ts`                                                                                                                     |
| `npm test`                   | Unit tests, then the end-to-end suite                                                                                                                                                           |
| `npm run test:unit`          | Vitest over `app/**/*.test.ts(x)`                                                                                                                                                               |
| `npm run test:unit:coverage` | Vitest with coverage; 80% thresholds on `app/lib/**/*.ts`                                                                                                                                       |
| `npm run test:watch`         | Vitest in watch mode                                                                                                                                                                            |
| `npm run test:e2e`           | Playwright end-to-end suite (Chromium only)                                                                                                                                                     |
| `npm run test:e2e:ui`        | Playwright UI mode                                                                                                                                                                              |
| `npm run test:e2e:report`    | Opens the last Playwright HTML report                                                                                                                                                           |

The generated types (`storefrontapi.generated.d.ts` and
`customer-accountapi.generated.d.ts`) are committed. To check for drift, run
`npm run codegen && git diff --exit-code *.generated.d.ts`.

## Testing

- **Prerequisites:** Node 22 or 24 (see `engines`) and Chromium for Playwright. On
  a machine without Chromium, install it with
  `npx playwright install --with-deps chromium`.
- **Unit tests:** `npm run test:unit` runs Vitest over `app/**/*.test.ts(x)`:
  2,651 tests in 60 files, all passing. `npm run test:unit:coverage` enforces 80%
  on statements, branches, functions and lines of `app/lib/**/*.ts`. Components
  and routes are covered by the end-to-end suite.
- **End-to-end tests:** `npm run test:e2e` runs Playwright in three projects,
  selected by tags: `desktop-1440` (375 tests), `tablet-820` (26, `@smoke`) and
  `mobile-390` (119, `@smoke` or `@mobile`). That is 520 test entries in 12 spec
  files (`npx playwright test --list`). Two tests skip by design, depending on the
  viewport. Playwright starts its own dev server on port 3100 in mock mode, with
  `CLOUDFLARE_ENV=e2e` and the committed `.dev.vars.e2e`, so no store credentials
  are needed. Locally it reuses a server already on that port. When the `CI`
  environment variable is set, it always starts its own.
- **Another server:** `E2E_BASE_URL=http://localhost:3000 npm run test:e2e` tests
  the server you name instead. It must be a development server in mock mode: the
  preflight in `tests/e2e/global-setup.ts` fails unless the home page shows the
  "Development mock data" badge.
- **Console policy:** a test fails on an unexpected `console.error`,
  `console.warn` or uncaught page error (`tests/e2e/support/console.ts`). The
  baseline allowlist is empty.
- **Artefacts:** `test-results/` (traces and screenshots, plus `junit.xml` when
  `CI` is set), `playwright-report/` (the HTML report) and `coverage/` are
  git-ignored.
- Do not edit `app/` while the e2e suite runs: the dev server hot-reloads, and the
  mock keeps carts in memory.

The spec list, console policy and helpers are described in
[tests/e2e/README.md](tests/e2e/README.md).

## Deployment

Production runs on Cloudflare Workers. `wrangler.jsonc` names the Worker
`mellow-storefront` and uses `server.ts` as its entry point. It enables
observability, uploads source maps (they are not served) and keeps dashboard
variables across deploys (`keep_vars`).

1. **Variables.** Set each variable on the Worker with
   `npx wrangler secret put <NAME>`, or as a plain dashboard variable.
   `SESSION_SECRET`, `PUBLIC_STORE_DOMAIN` and `PUBLIC_STOREFRONT_API_TOKEN` are
   required. `PRIVATE_STOREFRONT_API_TOKEN` is optional and recommended for
   production. Section 1 of [docs/shopify-setup.md](docs/shopify-setup.md) lists
   every variable and where its value comes from. Never set `MOCK_STOREFRONT` in
   production: the mock is for development only.
2. **Custom domain.** The Cache API is inactive on `*.workers.dev`, so production
   needs a custom domain. The commented example in `wrangler.jsonc` shows the
   settings (`workers_dev: false` and a route with `custom_domain: true`). They
   are not configured yet.
3. **Build and deploy.** `npm run deploy` runs the build and then `wrangler deploy`.
   `npx wrangler deploy --dry-run` checks the bundle without uploading it.
4. **Before go-live,** work through the owner follow-ups in
   [docs/implementation-report.md](docs/implementation-report.md), section 13.7.

## Project structure

```
app/
  components/             UI: header and footer, product, collection and cart components, ui primitives
  lib/analytics/          Shopify analytics and consent, active only when configured
  lib/cart/               Cart service, CartForm, optimistic cart, cart cookie
  lib/content/            Typed content contracts, metaobject queries, metafield parsers, defaults
  lib/customer-account/   Deferred customer-account stub (the 503 sign-in page)
  lib/mock/               Development-only Storefront API mock (MOCK_STOREFRONT=true)
  lib/storefront/         Storefront API client, Cache API layer, GraphQL helpers
  lib/*.ts(x)             Router context (context.ts), session, CSP and nonce, sitemaps,
                          Storefront redirects, pagination, variants and other helpers
  routes/                 React Router routes (flat routes convention, see app/routes.ts)
  styles/                 tokens.css (design tokens), app.css (shared), per-area stylesheets
docs/                     Architecture, implementation plan and report, Shopify setup
server.ts                 Worker entry: request rules, Storefront API proxy, 404 redirects, headers
codegen.ts                GraphQL type generation (writes the two *.generated.d.ts files)
react-router.config.ts    React Router framework configuration
vite.config.ts            Vite with the Cloudflare and React Router plugins
wrangler.jsonc            Cloudflare Worker configuration (environment e2e for CLOUDFLARE_ENV=e2e)
.dev.vars.example         Template for .dev.vars; .dev.vars.e2e is the committed mock-mode environment
env.d.ts                  Types for the Worker's variables and runtime globals
playwright.config.ts      Playwright projects, tags and the dev server Playwright starts
tests/e2e/                Playwright specs, support/ helpers and the global setup
vitest.config.ts          Unit test setup (app/**/*.test.ts(x)) and coverage thresholds for app/lib
```

## Migration record

Shopify Hydrogen has been removed. Phases 0 to 7 are committed (`624bb22` to
`d2e2faa`). Phase 7 moved the storefront to React Router 7.18.4.

- [docs/hydrogen-removal-architecture.md](docs/hydrogen-removal-architecture.md):
  the decisions (status: implemented).
- [docs/hydrogen-removal-plan.md](docs/hydrogen-removal-plan.md): the phase plan
  and the list of intended behaviour changes.
- [docs/implementation-report.md](docs/implementation-report.md), section 13: the
  phases, gates, review outcomes, deferred work and follow-ups.
