# Mellow storefront – implementation report

Branch: `claude/relaxed-archimedes-qm7h5e` (base: `main` @ `066fce0`).

> **Note (2026-10-25):** this report covers three increments. Increment 1, the
> initial build (2026-10-23), is described in sections 1 to 6, 8a, 9 and 12 as
> first written. Increment 2, the committed test suites, review fixes and
> migration planning (2026-10-23/24), updates sections 7, 8, 10 and 11 and adds
> section 8b. Increment 3, the removal of Hydrogen (2026-10-24/25), updates
> sections 1, 2, 5, 6, 8, 9, 10 and 11 and adds section 13, which is the current
> record of the stack, the verification and the follow-ups.

## 1. Summary

The Shopify Hydrogen skeleton in this repository (Hydrogen 2026.4.7, React
Router 7.16, TypeScript, plain CSS) was extended, not replaced, into the Mellow
storefront documented by the five design reference screenshots supplied with
the task (increment 1). Every existing Hydrogen route, loader, action,
Storefront/Customer Account client, session and cart integration was preserved;
the UI layer, content model and page templates are new.

The two blueprint documents referenced in the brief
(`01_mellowsleep_frontend_blueprint.md`, `03_integration_strategy_and_file_index.md`)
are Windows paths on the author's machine and were **not available in this
environment**; the design specification was therefore derived from the five
screenshots (homepage top, product grid, video grid, product page, About page)
plus the existing repository structure. Assumptions this forced are listed in
section 12.

**Current state (increment 3, 2026-10-25).** Hydrogen has been removed. The
storefront is a React Router 7.18.4 framework-mode app on Cloudflare Workers:
`server.ts` is the Worker entry, and `@shopify/hydrogen-react` 2026.4.4 supplies
UI components, Storefront API types and analytics helpers. Our own Storefront API
client and Cache API layer, cart service, CSP and nonce, sitemaps and redirects,
pagination and variants, analytics and consent, and a deferred customer-account
stub replace Hydrogen's server helpers. The development mock keeps its data and
responses. Customer accounts stay behind the 503 sign-in page (ADR-D2), and
analytics run only once `PUBLIC_CHECKOUT_DOMAIN` and `PUBLIC_STOREFRONT_ID` are
set. Section 13 has the phases, gates, reviews and follow-ups.

## 2. Pages and routes

| Route                                             | Status            | Notes                                                                                                                                                                                  |
| ------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                               | Implemented       | Hero, press marquee, story video, "Most Loved" product grid (Shopify collection), UGC video grid, lifestyle images, testimonials, FAQ, newsletter                                      |
| `/products/:handle`                               | Implemented       | Gallery, rating, price/compare-at, savings note, grouped colour swatches, feature bullets, quantity + add to cart, trust badges, accordions, review carousel, recommendations, JSON-LD |
| `/collections/:handle`                            | Implemented       | Header, sort, Storefront API filters (sidebar / mobile sheet), chips, Load more pagination, empty state                                                                                |
| `/collections/all`                                | Implemented       | Shop-all listing with sort                                                                                                                                                             |
| `/collections`                                    | Implemented       | Collection cards                                                                                                                                                                       |
| `/search`                                         | Implemented       | Results page + predictive search drawer                                                                                                                                                |
| `/cart` + cart drawer                             | Implemented       | Lines, quantity, remove, discount/gift card forms, checkout CTA, empty state                                                                                                           |
| `/pages/about`                                    | Implemented       | Designed template (hero card, story card, values, CTA)                                                                                                                                 |
| `/pages/:handle`                                  | Implemented       | Prose template                                                                                                                                                                         |
| `/policies`, `/policies/:handle`                  | Implemented       |                                                                                                                                                                                        |
| `/blogs`, `/blogs/:blog`, `/blogs/:blog/:article` | Implemented       | Editorial templates + empty states                                                                                                                                                     |
| `/account/*`                                      | Deferred (ADR-D2) | Every account route ends on the 503 sign-in page; `POST /account/logout` clears the session and redirects home; `GET /account/authorize` redirects to `/account/login`                 |
| `/newsletter`                                     | Implemented       | Form action with webhook boundary                                                                                                                                                      |
| `/dev/mock-checkout`                              | Dev only          | Stand-in for Shopify checkout while the mock is active (404 otherwise)                                                                                                                 |
| 404 / errors                                      | Implemented       | Designed error view                                                                                                                                                                    |
| `robots.txt`, `sitemap.xml`                       | Implemented       | Sitemaps come from `app/lib/sitemap.server.ts` (escaped XML); robots.txt blocks the parameters the storefront uses                                                                     |

## 3. UI/UX fidelity

Verified by rendering every route at 390, 820 and 1440 px with Playwright
(48 screenshots) and comparing with the references:

- Layout, proportions, typography (Outfit display / Inter body), palette
  (sampled from the references: primary `#4c4184`, lavender `#e1e1fe`, tint
  `#efefff`, coral `#fea58c`), pill buttons, 16 px card radii, badge
  placement, star ratings, price/compare-at treatment, product-page column
  widths (600 px gallery / 536 px info column) and the About page cards match
  the references closely.
- Known differences: the reference photography, press logos and videos are
  not in the repository, so placeholder artwork (`public/images/placeholders`)
  and typographic press logos are used until the merchant uploads media in
  Shopify; a quantity selector was added to the product page (not in the
  reference); sections below the fold that the references do not show
  (testimonials, FAQ, newsletter, footer) follow the same design system.
- Pixel-perfect accuracy is **not** claimed; comparisons were visual, not
  pixel-diffed.

## 4. Interactive functionality (verified in the browser)

Header navigation, mobile menu (open/close/Escape), predictive search drawer,
search page, sort and filters (URL-driven, chips, clear all, mobile sheet),
Load more pagination, variant selection (URL params, price, gallery, sold-out
state), gallery arrows/thumbnails/swipe, accordions, savings "Learn more",
review carousel, add to cart (opens drawer with the line), quantity update,
remove, discount apply/remove/invalid, gift card error path, checkout link,
cart page, newsletter forms (home + footer), FAQ accordion, About CTAs, 404
buttons, account "not configured" page.

## 5. Architecture and stack (current)

- **Stack** (`package.json`, 2026-10-25): React Router 7.18.4 framework mode
  (`react-router`, `@react-router/dev` and `@react-router/fs-routes`, all pinned
  to 7.18.4), Vite 8 with `@cloudflare/vite-plugin` 1.65.0, wrangler 4.152.0,
  `@shopify/hydrogen-react` 2026.4.4 (pinned), React 18, TypeScript, Vitest 5,
  Playwright 1.63.0 and jsdom 29.1.1 (for the analytics DOM tests). Hydrogen, the
  Hydrogen CLI, MiniOxygen and the Oxygen tooling are no longer installed
  (`f9274d6`).
- **Worker** (`server.ts`): refuses malformed requests first (a GET or HEAD with a
  body gets 400; a path with `//` gets a 301 to the collapsed path). The
  same-origin Storefront API proxy accepts `POST /api/unstable/graphql.json` and
  `POST /api/YYYY-MM/graphql.json` (other methods get 405), adds the public token
  and follows no redirects. Everything else goes to React Router's request
  handler, and a 404 from the app gets a Storefront redirect lookup. Security
  headers go on every response.
- **Router context** (`app/lib/context.ts`): one `RouterContextProvider` per
  request, carrying `storefront` (`app/lib/storefront`: the client, the Cache API
  layer in the `storefront` cache and the GraphQL helpers), `cart`
  (`app/lib/cart`), `customerAccount` (the deferred stub in
  `app/lib/customer-account`), `session` (`app/lib/session.ts`) and the analytics
  configuration (`app/lib/analytics`).
- **Storefront API:** queries use a cache strategy (`CacheShort`, `CacheLong`,
  `CacheDefault` or `CacheNone`). The cart always uses `CacheNone`, and mutations
  are never cached. A GraphQL answer with errors and no data becomes a 502. Server
  calls use the public token, or `PRIVATE_STOREFRONT_API_TOKEN` with the buyer's IP
  when that is set.
- **Analytics and consent** (`app/lib/analytics`): a provider, the consent script
  and the events `PAGE_VIEW_2`, `PRODUCT_VIEW`, `COLLECTION_VIEW`, `SEARCH_VIEW`
  and `ADD_TO_CART`, built on hydrogen-react's helpers. Nothing loads unless
  analytics are configured.
- **CSP and nonce:** `app/lib/csp.server.ts` builds the policy for each request,
  and `app/lib/nonce.tsx` provides the nonce. The root renders `<Links nonce="">`
  (React Router 7.18), so server and client markup match. Stylesheets are
  same-origin and need no nonce.
- **Routing and build:** `app/routes.ts` uses `flatRoutes()` from
  `@react-router/fs-routes`. `react-router.config.ts` sets `app/` and `dist/`,
  SSR, route discovery `initial` and the v8 flags. `vite.config.ts` loads the
  Cloudflare and React Router plugins.
- **Environment and types:** `env.d.ts` declares the `Env` interface that every
  variable is read through. `codegen.ts` generates `storefrontapi.generated.d.ts`
  and `customer-accountapi.generated.d.ts` from the schemas that ship with
  `@shopify/hydrogen-react`.
- Imports use `react-router` (never `react-router-dom`) per the repo rule.

## 6. Storefront API integration status

| Area                                                                                                                                              | Status                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Products, variants, pricing, availability, media, collections, filters, sort, search, predictive search, pages, policies, blogs, menus, shop data | Configured for Shopify; verified against the **development mock only** (this container cannot reach Shopify; no store credentials were available)                                                                                                                                                                   |
| Storefront API client, cache and proxy                                                                                                            | Own client in `app/lib/storefront` (Phase 2 and the hardening commits): public or private token, Cache API layer in the `storefront` cache with key format `v1`, a 25 s timeout, redirects not followed. Verified with unit tests and the mock; not against Shopify. The cache needs a custom domain (section 13.7) |
| Cart (create/add/update/remove/discounts/gift cards), checkout URL                                                                                | Own cart service in `app/lib/cart` (Phase 3): server-side mutations, the `cart` cookie, `CartForm` and the optimistic cart. Verified against the mock cart; not against Shopify                                                                                                                                     |
| Customer accounts                                                                                                                                 | Deferred (ADR-D2): every call that needs a signed-in customer ends on the 503 sign-in page. Not verified against Shopify                                                                                                                                                                                            |
| Editorial content (hero, press, story, videos, testimonials, FAQ, About, reviews)                                                                 | Metaobject/metafield contracts implemented with documented fallbacks; verified with mock metaobjects                                                                                                                                                                                                                |
| Newsletter                                                                                                                                        | Webhook boundary (`NEWSLETTER_WEBHOOK_URL`); reports "not connected" otherwise                                                                                                                                                                                                                                      |
| Analytics / consent                                                                                                                               | Own analytics and consent in `app/lib/analytics` (Phase 4c). Active only when `PUBLIC_CHECKOUT_DOMAIN` and `PUBLIC_STOREFRONT_ID` are set and the mock is off, so the e2e suite (mock mode) runs with analytics off. Not verified against a live store                                                              |

Legend used in the task: (1) implemented and tested locally = all UI and
interactions; (2) implemented with mock data = everything above when
`MOCK_STOREFRONT=true`; (3) configured for Shopify but not verified against a
live store = all Storefront/Customer Account integration; (4) verified against
a live store = none; (5) blocked by missing configuration = customer accounts,
analytics, newsletter webhook, real checkout.

## 7. Sub-agents used

The "ECC" sub-agent system named in the brief is **not installed** in this
environment (no ECC agents, commands or skills were present). Claude Code's
built-in Agent tool was used instead with exclusive file ownership:

- Agent 1 – product detail page (`app/routes/products.$handle.tsx`,
  `app/components/product/*`, `product.css`).
- Agent 2 – collections, shop-all, collections index, search
  (`app/routes/collections*.tsx`, `search.tsx`, `app/components/collection/*`,
  search components, `collection.css`).
- Agent 3 – cart drawer/page, account, content pages, error states
  (`CartMain/CartLineItem/CartSummary`, `app/routes/account*.tsx`, policies,
  blogs, pages, `cart.css`, `account.css`, `content.css`).
- Agent 4 – independent QA review (read-only).

The main session owned the design system, layout, homepage, About page,
content contracts, development mock, documentation, integration and
verification, and reviewed every agent's output before committing.

**Increment 2 (2026-10-23/24).** Everything Claude Code (ECC) v2.2.3 was
installed into the agent host: agent definitions in `~/.claude/agents` (with
a local, uncommitted copy in `.claude/agents`), skills and rules in
`~/.claude`. The harness registered the agent types mid-session, after an
initial batch had to run as general-purpose agents loading their ECC
definitions. What each class of agent produced, from the commit messages
(`git log 066fce0..HEAD`):

- **Reviews:** the security and code review led to 23d0130, the React review to
  39d3dbb, and a re-review of those fixes to 7d18c7d.
- **Fix-and-test passes:** three, covering lib content, search and newsletter
  (c6fac4e), server and routes (23d0130) and components and accessibility
  (39d3dbb).
- **E2E suite:** three passes. The foundation was checkpointed in 3acb2b1 and
  finished with the smoke, SEO, security and motion specs in 03d7249; product,
  cart and collection specs came in b600264; navigation, search, content and
  axe specs in 6b46419.
- **Refactoring:** 14 commits (cf734e4 to c963097) carry a separate model
  trailer and were made in an isolated agent worktree
  (`.claude/worktrees/`, git-ignored). 09415d7 removed a worktree gitlink that
  had been committed by mistake. f435bb8 is a fifteenth refactor commit.
- **Documentation:** 063cec4 (registry-verified versions in the migration plan)
  and da6005f (merchant setup and mock docs).
- **Hydrogen removal:** the ECC architect produced the architecture decision
  records (d43c81b) and the ECC planner the implementation plan (819ad4f).
  c5dac81 records the owner's decisions.

## 8. Verification results

- Increment 3 (Hydrogen removal), counted on 2026-10-25: `npx vitest run` gives 60
  test files and 2,651 tests, all passing. `npx playwright test --list` gives 520
  test entries in 12 spec files (`desktop-1440` 375, `tablet-820` 26, `mobile-390`
  119). The gates of each phase and the other figures are in section 13.3. The
  increment 2 figures below are kept as recorded.
- Final gate of increment 2 (2026-10-24, on the branch head described here):
  `npm run lint` – pass. `npm run typecheck` – pass. `npm run build` – pass
  (server bundle 540 kB; the development mock is excluded from production
  bundles). Increment 1 recorded the same three checks passing with a 524 kB
  server bundle; a797f69 also records a clean
  `tsc --noUnusedLocals --noUnusedParameters`.
- Unit tests (committed, Vitest): `npm run test:unit` – 38 files, 1,434 tests,
  all passing. `npm run test:unit:coverage` enforces 80% on statements,
  branches, functions and lines in `app/lib`; the final run measured 90.2%
  statements, 92.5% branches, 87.7% functions and 89.3% lines.
- End-to-end tests (committed, Playwright, Chromium only): `npm run test:e2e`
  runs three projects selected by tags: desktop-1440 (370 tests), tablet-820
  (26, `@smoke`) and mobile-390 (119, `@smoke` or `@mobile`), 515 test entries
  in all (`npx playwright test --list`; each test is counted once per project it
  runs in). Specs: smoke (every route at three viewports), seo (server-rendered
  HTML with JavaScript off), security (headers, CSP enforcement, redirects,
  CSRF, cart and newsletter limits), motion (WCAG 2.2.2 pause controls and the
  one-copy marquee), product, cart, collections, navigation, search, content,
  a11y (axe-core WCAG 2.x A/AA plus target-size) and support (helper
  self-tests). The final full run, on a server Playwright started itself:
  513 passed, 2 skipped (viewport-conditional), 0 failed, in 8.2 minutes.
  `npm test` runs both suites; `tests/e2e/README.md` has the details.
- Console policy: every test fails on an unexpected `console.error`,
  `console.warn` or uncaught page error (`tests/e2e/support/console.ts`, an
  automatic fixture). In increment 2 the baseline allowlist had one entry,
  Hydrogen's `[h2:error:Analytics.Provider] - Mock shop is used...` warning. It
  has been empty since Phase 4c (e3c4665, 295debe), because that warning came from
  Hydrogen's `Analytics.Provider`, which is gone. A test that provokes any other
  message allows it itself, with a reason. Third-party requests are answered
  locally (`tests/e2e/support/network.ts`).

## 8a. QA review outcome

An independent QA pass (routes × 3 viewports, 128 scripted interaction
checks, axe-core on 8 page states, keyboard/focus/contrast probes and a code
read) found no blockers. Confirmed findings were fixed before the final
commit:

- Drawers now follow the modal dialog pattern: focus moves into the drawer,
  Tab is trapped, the page behind is `inert`, Escape/overlay click close and
  focus returns to the opener (an unstable context callback was re-running
  the focus effect on every re-render; fixed with memoised context values).
- Colour contrast: badge and cart-count text use the ink colour on coral;
  compare-at prices and filter counts use a darker muted purple; the
  focus ring is primary purple with an offset; inputs show a two-tone ring.
- Settings metaobject fields (savings note/explanation, trust badges) are
  now resolved once in the root loader and consumed by the product page,
  cart and footer; the unused `shop_all_collection` field was removed from
  the docs; press logos link to their URL; review dates render.
- Sitemap no longer advertises unserved locales; absolute canonical URLs;
  `og:site_name` on every page; policy/blog meta completed; product and
  collection 404s carry "not found" titles and `noindex`.
- Development-only issues: mock checkout hydration error, newsletter mock
  message no longer reads as a success, predictive search input reset on
  `/search`, search loader error handling.
- Product cards align price and button across a grid row.

Accepted deviations (documented, not changed): coral star fill contrast
(brand design; numeric rating is exposed to assistive tech), the header
account icon (sign-in entry point required by the brief; the reference shows
only search and cart) and the product-page quantity stepper.

## 8b. Review fixes (increment 2)

Fixed in increment 2 and grouped by theme. Sources are the commit messages of
23d0130, 39d3dbb, c6fac4e, 7d18c7d, 03d7249, 6b46419 and the latest fix commit,
f57cbd9, with 0a7b79b and b600264 where noted. The dead-code items come from the
refactor commits (f435bb8 to cf734e4), not from review findings.

- **Server and routing (23d0130, 7d18c7d).** Paths with more than 16 segments
  are rejected before any work, because react-router 7.16 route matching is
  quadratic in segment count (GHSA-chx6-hx7r-mcp5); the guard goes with
  react-router 7.18. Open redirects are closed: discount `?redirect=` and
  `?return_to=`, and the cart action's `redirectTo`, resolve to same-origin
  paths only. Hydrogen's 404 redirect parameters are resolved before
  `storefrontRedirect` sees them, which also neutralises dot-segment forms such
  as `/.//host`. The catch-all 500 carries the security headers. Malformed cart
  input answers 400, and `/cart/:lines` validates its permalink (410 otherwise).
- **Storefront errors (23d0130, 7d18c7d).** GraphQL errors without data reject
  with a 502 instead of leaking as misleading 404s. The development mock returns
  `{errors}` like the live client, and the cart shows the failure inline. Error
  logs carry only error codes outside development, because messages echo
  variable values.
- **Headers and cookies (23d0130).** CSP `object-src 'none'` and
  `form-action 'self' https://shopify.com`. `X-Content-Type-Options` and
  `Referrer-Policy` on every response. Session and cart cookies are `HttpOnly`,
  `SameSite=Lax`, and `Secure` over https.
- **Content, routes and SEO (23d0130).** Policies resolve through a handle
  allowlist with no object-key lookup, and the subscription policy is supported.
  The sitemap index lists only served resource types, article URLs map to
  `/blogs/:blog/:article`, and unknown types and pages 404. robots.txt blocks
  the parameters the storefront uses. Blog queries show the real title, the API
  excerpt and UTC dates. Pages, policies and blogs have absolute canonicals and
  og tags; missing pages, policies, blogs and articles get "not found" titles
  and `noindex`.
- **Account (23d0130).** Sign-in needs both Customer Account variables. Order
  links URL-encode the id token, bad tokens 404, and the profile action rethrows
  redirect Responses.
- **Newsletter (c6fac4e, 7d18c7d).** Email length is capped at 254 characters,
  with linear validation (the old regex backtracked quadratically). `source`
  must be a short lower-case slug, otherwise a default is used. Local parts that
  are spreadsheet-formula or markup payloads are rejected. The webhook call has
  a 5 s timeout, bodies over 8 KB answer 413 before they are read, and non-form
  POSTs answer 400.
- **Content parsing and filters (c6fac4e).** Ratings are never invented: a
  missing rating shows no stars, and `scale_max` is honoured. Reviews count as
  verified only when the field is exactly `true`. Icon keys are looked up as own
  keys (`Object.hasOwn`), and an unknown `icon|text` prefix keeps the whole text.
  Menu and metaobject links pass through `safeHref`. Category and metafield
  filter values must have the documented shapes or they are dropped, and price
  chips show cents. Review and order dates use the shared UTC formatter.
- **Search (c6fac4e, 6b46419, 0a7b79b, 03d7249).** A generic 503 replaces raw API
  errors; the limit is clamped to 1 to 10; an empty term sends no query and no
  analytics; Enter submits the predictive drawer; terms are URL-encoded once;
  stale predictive results reset on close; the live region is polite. The
  summary shows the connection's exact `totalCount`, replacing the "N+" lower
  bound and the latest page's count after "Load more". The predictive live
  region no longer counts query suggestions. `/search?q=body%20pillow` no longer
  logs a hydration mismatch.
- **Product page and variants (39d3dbb, f57cbd9).** The product page is keyed by
  product id, so quantity, gallery and carousel state reset between products.
  The selected variant is mirrored into the URL by a hook that touches only the
  current page and keeps React Router's history state, so Back no longer writes
  a variant into the previous page's URL.
- **Marquees and pause controls (39d3dbb, 03d7249, 7d18c7d).** A marquee shows
  one copy; repeats are `aria-hidden` and `inert`. The announcement bar and the
  press-logo marquee share a `PauseToggle` (WCAG 2.2.2), and the bar resumes
  after hover or focus. Reduced-motion users get a static strip.
- **Drawers and dialogs (39d3dbb, 03d7249).** Modal behaviour (focus trap, inert
  page, Escape, focus return) lives in `app/lib/useModalDialog.ts`, shared by the
  drawers and the mobile filter sheet, which is now a real dialog. Drawers take
  focus under reduced motion, and opening one before the deferred Suspense
  boundaries hydrate no longer throws.
- **Focus, feedback and announcements (39d3dbb, f57cbd9, 6b46419).** Focus is
  kept after removing cart lines, discount codes and filter chips, and at
  quantity bounds (`aria-disabled` instead of `disabled`). After "Load more" or
  "Load previous", focus moves to the first newly loaded product. Add to cart
  opens the drawer only after a successful add, and failures show an inline
  alert. A route announcer and focus on `<main>` follow client-side navigations.
  Filter option counts read "1 product" to screen readers. The phone gallery
  strip is keyboard reachable.
- **Product cards and media (39d3dbb, 7d18c7d, 03d7249).** Cards have unique CTA
  labels and a configurable heading level. `fetchpriority` reaches Hydrogen
  images. Video play buttons keep focus, and empty caption tracks are removed.
  The `captions` WebVTT file on `mellow_story` and `mellow_ugc_video` reaches
  the video players. The collection toolbar wraps on narrow phones.
- **Fixmes (b600264, f57cbd9).** The four product bugs that b600264 documented
  as `test.fixme` are fixed and their checks are regular assertions: the filter
  count suffix, focus after "Load more" and after "Load previous", and the
  variant written into the previous page's URL on Back. No `test.fixme` remains
  in `tests/` or `app/`.
- **Route discovery and dev tooling (f57cbd9).** `routeDiscovery` is `initial`,
  so the manifest ships with the document and no `/__manifest` request is made
  per navigation. Vite ignores Playwright and coverage output.
- **Dead code (refactor commits f435bb8 to cf734e4).** `react-router-dom` and
  `graphql-tag` were removed from the dependencies, along with the unused
  `pluralize` helper, unread GraphQL selections, two legacy CSS custom
  properties, exports that nothing imported, and unused config tables.
  Duplicated guards, date formats, the route error boundary, the default meta
  constants and the cart action type were shared instead.

## 9. Shopify configuration still required

See `docs/shopify-setup.md`. The store values come from the Hydrogen sales
channel's storefront settings in the Shopify admin: into `.dev.vars` for
development, and as Worker variables or secrets in production (section 1 there
lists them). The rest of the configuration is the `main-menu` and `footer` menus,
collections (`most-loved`, `all`, `bath`, `bundles`, …), product metafields
(`reviews.*`, `mellow.*`), metaobject definitions (`mellow_settings`,
`mellow_hero`, `mellow_press_logo`, `mellow_story`, `mellow_ugc_video`,
`mellow_lifestyle_image`, `mellow_testimonial`, `mellow_faq`, `mellow_about`,
`mellow_review`), the `about` page, policies and, optionally,
`NEWSLETTER_WEBHOOK_URL`. Customer accounts are deferred (ADR-D2), so no Customer
Account API value is needed yet. Remove `MOCK_STOREFRONT` from `.dev.vars` once the
store is linked, since production never runs the mock. A live store also needs
`PRIVATE_STOREFRONT_API_TOKEN` (recommended) and a custom domain for the Cache API
(section 13.7).

## 10. Outstanding issues and limitations

- Live Shopify behaviour (real images, filters availability, customer
  accounts, checkout, analytics) is unverified in this environment.
- Reference photography/press logos/videos must be supplied through Shopify
  files/metaobjects; placeholder artwork ships in the repo.
- Review data depends on `mellow_review` metaobjects (or a reviews app that
  writes the standard `reviews.rating` metafields).
- Filter value counts in the development mock ignore other active filters
  (the live API recomputes them).
- The dev mock cart lives in memory (reset on server restart).
- Before the removal, Hydrogen's dev server (MiniOxygen/workerd) crashed on a
  request line of about 15 KB made of `/a/..` segments. The dev worker also wedged
  after a few thousand concurrent requests, until route discovery was set to
  `initial` (`react-router.config.ts`, f57cbd9). Hydrogen's dev server is gone
  (Phase 1), and neither input has been re-tested on the Vite plugin's dev server.
  The path-segment guard that the 15 KB input motivated is removed in Phase 7
  (`d2e2faa`), with React Router 7.18.
- Accepted deviations from the reviews (documented, not changed):
  - merchant HTML (product descriptions, policies, pages, blog articles) is
    rendered unsanitised with `dangerouslySetInnerHTML`, behind the nonce CSP;
  - Google Fonts: the stylesheet and font files are loaded from Google at
    runtime, and the CSP allows both;
  - the newsletter action has no rate limiting (its size, validation and
    timeout limits do apply);
  - customer accounts are deferred (ADR-D2), so sign-in is not implemented and
    the account flow is absent by design (section 13.6);
  - analytics need `PUBLIC_CHECKOUT_DOMAIN` and `PUBLIC_STOREFRONT_ID`, with the
    mock off, before they report;
  - react-router is 7.18.4 from Phase 7 (`d2e2faa`). The path-segment guard is
    removed, and the 7.16 route-matching cost (GHSA-chx6-hx7r-mcp5) is fixed in
    7.18.
- The hero rating keeps its default of 5 when the `mellow_hero` rating field is
  empty. Other ratings show no stars when they are missing.
- A mistyped icon key in `mellow_about.values` becomes the title of that value.
  Section 5 of `docs/shopify-setup.md` documents this and lists the valid keys.

## 11. Recommended next steps

1. Link the store: put the storefront values in `.dev.vars` (development) and set
   them as Worker variables (production), create the menus, collections, metafields
   and metaobjects per `docs/shopify-setup.md`, upload media, and remove
   `MOCK_STOREFRONT` from `.dev.vars`.
2. Done (increment 2): the unit suite (Vitest) and the end-to-end suite
   (Playwright) are committed and run with `npm test`. The e2e suite refuses a
   server that is not in mock mode, so a run against the live store needs more
   than `E2E_BASE_URL`: the catalog constants in `tests/e2e/support/catalog.ts`
   are mock data and would need a separate design.
3. Customer accounts are deferred (ADR-D2). Porting Hydrogen's OAuth client
   (ADR-D1) is a later decision; until then every account route ends on the 503
   sign-in page. Verify sign-in, orders and addresses end to end only after that
   port.
4. Connect a newsletter provider via `NEWSLETTER_WEBHOOK_URL`.
5. Optionally add a reviews app that populates `reviews.rating` /
   `reviews.rating_count` and the review metaobjects.
6. Done (increment 3, 2026-10-25): Hydrogen is removed (section 13). Still open:
   confirm the e2e result of Phase 7 (`d2e2faa`), work through the owner follow-ups in
   section 13.7 before go-live, and sign off the AGENTS.md wording (section 13.7, item
   10).

## 12. Assumptions

- The screenshots were treated as the design specification in place of the
  unavailable blueprint documents.
- Navigation targets: Shop → `/collections/all`, Bath → `/collections/bath`,
  Bundles → `/collections/bundles`, About → `/pages/about` (overridable via
  the Shopify `main-menu`).
- Copy for sections not visible in the screenshots (story paragraph ending,
  testimonials, FAQ, newsletter, About values/closing) was written in the
  brand voice and is editable through metaobjects.

## 13. Increment 3: Hydrogen removal (2026-10-24 to 2026-10-25)

This section is the current record. Sections 1, 2, 5, 6, 8, 9, 10 and 11 were
brought up to date for the removal. Where an older section still describes
Hydrogen, that text is history.

### 13.1 Result

Hydrogen has been removed. The storefront is React Router 7.18.4 in framework mode
on Cloudflare Workers, with `@shopify/hydrogen-react` 2026.4.4 for UI components,
Storefront API types and analytics helpers. The phases follow
`docs/hydrogen-removal-plan.md`, and the decisions are in
`docs/hydrogen-removal-architecture.md`, now marked implemented.

Phases 0 to 7 are committed: 26 commits from `624bb22` to `d2e2faa`
(`git rev-list --count 624bb22^..HEAD`), including the plan and behaviour-delta
commits (6ab4602, e51d608, 98ab670, cdddc2c, be812cd, fd1de99, ed8507b). Phase 7
landed as `d2e2faa` while this pass was running. The result of its e2e run is not
known to this pass.

### 13.2 Phases and commits

| Phase     | Commits                   | Change                                                                                                                                                                                                                                                                                                                            |
| --------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0         | 624bb22                   | UI components, helpers, types and the schema import come from `@shopify/hydrogen-react` (`Image`, `Money`, option helpers, `flattenConnection`, Storefront API types). Behaviour-neutral.                                                                                                                                         |
| 1         | 4a9f394                   | The Worker runs on Cloudflare: `@cloudflare/vite-plugin` and wrangler replace Oxygen. Adds `wrangler.jsonc`, an explicit `react-router.config.ts`, `app/routes.ts` with `flatRoutes()`, and `.dev.vars` (`.env` is no longer read). The dev-only GraphiQL and subrequest-profiler routes are removed.                             |
| 2         | d2960cb, 52bcfc6          | Own Storefront API client, Cache API layer and GraphQL helpers (`app/lib/storefront`); own router context and request flow (`app/lib/context.ts`); `server.ts` with React Router's request handler, the request rules and the Storefront API proxy; `codegen.ts`.                                                                 |
| 3         | ba42acb, 00f7b33          | Own cart service (`app/lib/cart`), `CartForm` and the optimistic cart. `cart_viewed` is no longer published.                                                                                                                                                                                                                      |
| 4a        | 25daeda                   | Own CSP builder and nonce provider, sitemaps and the Storefront redirect.                                                                                                                                                                                                                                                         |
| 4b        | d08f77a, 835d846          | Own `Pagination` and `getPaginationVariables`; own `getSelectedProductOptions` and `useOptimisticVariant`.                                                                                                                                                                                                                        |
| 4c        | e3c4665, 295debe, a9faa00 | Own analytics and consent, active only when `PUBLIC_CHECKOUT_DOMAIN` and `PUBLIC_STOREFRONT_ID` are set and the mock is off. Tracking cookies and headers are used only with analytics on. The e2e console allowlist is empty. Analytics failures are isolated and logged.                                                        |
| 5         | fc9b41e                   | Customer-account stub behind the 503 sign-in page (ADR-D2). `POST /account/logout` clears the session and redirects home, and `GET /account/authorize` redirects to `/account/login`.                                                                                                                                             |
| Hardening | dadcdd8, 07003cb, 2b5fc5d | Review fixes in the client, cache, proxy and server flow (dadcdd8); linear form parsing, strict cart line shapes and escaped sitemap XML (07003cb); a 64 KiB cap on `POST /cart` bodies and 400 for pending optimistic line ids (2b5fc5d).                                                                                        |
| 6         | f9274d6                   | `@shopify/hydrogen`, `@shopify/cli`, `@shopify/mini-oxygen`, `@shopify/hydrogen-codegen` and `@shopify/oxygen-workers-types` are uninstalled. The grep gate is clean: nothing imports `@shopify/hydrogen`, and nothing uses `createHydrogen` or `HydrogenEnv`. The documentation for Phase 6 (6.4) is the work of this increment. |
| 7         | d2e2faa                   | React Router 7.16.0 becomes 7.18.4 (`react-router`, `@react-router/dev`, `@react-router/fs-routes`). The 16-segment path guard in `server.ts` is removed, so deep paths get the designed HTML 404. `app/root.tsx` renders `<Links nonce="">`. The e2e specs and the plan's Phase 7 entries are updated.                           |

### 13.3 Gates and counts

- **Measured in the documentation pass on 2026-10-25** (read-only: no build, no
  coverage run and no e2e run):
  - `npx vitest run`: `Test Files  60 passed (60)` and `Tests  2651 passed (2651)`.
  - `npx playwright test --list`: `Total: 520 tests in 12 files`. Per project,
    `desktop-1440` 375, `tablet-820` 26 and `mobile-390` 119. Two tests use a
    viewport-conditional `test.skip` in `tests/e2e/support.spec.ts`.
- **Reported by the phase gates** (not re-run for this section): for each phase,
  `npm run lint`, `npm run typecheck`, the Vitest coverage thresholds (80% on
  statements, branches, functions and lines of `app/lib/**/*.ts`; about 97%
  statements at the final gate), `npm run build`, `wrangler deploy --dry-run` from
  Phase 1 on, and the full Playwright suite, which passed with 2 tests skipped by
  design.
- **Not run in this pass:** lint, typecheck, build, coverage and the e2e suite. The
  Phase 7 e2e result is not known to this pass.

### 13.4 Reviews and fixes

- **Phase 2 code review:** approve, with no critical or high findings. The medium
  finding (the discount override was untested) is superseded by the Phase 3 cart
  service and its tests. Low findings fixed: the dead `generateCacheControlHeader`
  export is removed, and the duplicated helpers are consolidated (one
  `describeErrors` in `app/lib/storefront-errors.ts`; operation names from
  `getOperationName` in `app/lib/storefront/graphql.ts`).
- **Phase 2 security review:** approve with warnings (0 critical or high; 1 medium,
  superseded; 11 low; 4 info). Fixed in dadcdd8: the `__proto__` bypass in
  `parseJson`; `null` entries in `errors`; the proxy (POST only, redirects not
  followed, no `session` or `cart` cookie forwarded); lock expiry and a fetch
  timeout for revalidation; a failed `caches.open` tolerated; cache keys with
  headers and the `v1` marker, with no key for uncacheable requests; a mutability
  probe for response headers; redacted error output in `search.tsx`; helper dedupe.
- **Phase 3/4a security review:** approve with warnings (0 critical or high; 1
  medium, 2 low). Fixed in 07003cb: `getFormInput` is linear in the number of
  fields (it was quadratic); malformed cart line shapes get 400; sitemap XML is
  escaped. Kept and noted: the cart id (with `?key=`) appears in loader data and
  analytics payloads, as it did under Hydrogen. Phase 4c does not persist it
  client-side.
- **Review of the hardening and Phase 5 commits:** 0 critical, high or medium; 4
  low. Fixed: the client's server-side redirect is `manual` (Phase 4c); `POST /cart`
  bodies over 64 KiB get 413 before they are read (2b5fc5d); pending optimistic
  line ids get 400 at the route (2b5fc5d). The open `_tracking_consent` question is
  in 13.7.
- **Phases 0 to 6:** the ECC security-reviewer and code-reviewer ran per phase. They
  found no critical or high issues. Their medium and low findings were fixed in the
  hardening and follow-up commits.
- **Dependencies:** the react-router 7.16 advisories are fixed in 7.18 (Phase 7).
  The other high-severity findings from `npm audit` are in dev tooling.

### 13.5 Intended behaviour changes

Copied from the "Intended behaviour changes" section of
`docs/hydrogen-removal-plan.md` when this section was written. The three Phase 7
entries came in with `d2e2faa`.

- Dev-only GraphiQL and subrequest-profiler routes are removed (Phase 1).
- The dev server is Vite with workerd. Dev env comes from `.dev.vars`, not `.env` (Phase 1).
- The `powered-by: Shopify, Hydrogen` header and the `/api/mcp` proxy are gone (Phase 2).
- The cache name changes from `hydrogen` to `storefront`.
- Storefront GraphQL errors are logged redacted instead of as full GraphQLErrors (Phase 2).
- The session cookie is appended instead of overwriting other Set-Cookie headers (Phase 2, D-10).
- Server-side Storefront API calls no longer send Hydrogen's `user-agent`; a 2xx answer that is not GraphQL JSON becomes an errors-only result (`UNREADABLE_RESPONSE`, a 502 through the guard) instead of a silent `{}`; a 404 from the Storefront API proxy is returned as is instead of going through the 404 redirect lookup; the wrong-operation refusal text no longer carries the `h2:error` prefix (Phase 2).
- From Phase 2 until Phase 4c enables it for configured analytics, server-side calls forward no cookie or visitor-token headers and copy no Set-Cookie headers back (Phase 2).
- Discount codes are deduplicated before `cartCreate` as well as before `cartDiscountCodesUpdate` (Phase 2).
- Hardening after the review of the hardening commits: POST `/cart` bodies above 64 KiB are refused with 413 before they are read, and a pending optimistic line id (`__h_pending_...`) in LinesUpdate/LinesRemove is a 400 at the route instead of an error inside the cart service.
- Hardening after the Phase 3/4a reviews: every value written into the sitemap XML (`loc`, `lastmod`, `changefreq`, `hreflang`, `href`, the origin) is XML-escaped where Hydrogen wrote it raw (byte-identical for values without `& < > " '`); `getFormInput` reads the form in one pass (linear in the number of fields); the cart action answers 400 to line entries that are not objects with a string `id`/`merchandiseId` or to non-string line ids.
- Hardening after the Phase 2 review: the Storefront API proxy answers 405 to non-POST requests, does not follow upstream redirects and forwards no `session`/`cart` cookie; a failed `caches.open` bypasses the cache for that request instead of a 500; upstream fetches time out after 25 s; `errors: [null]` entries are tolerated; `__proto__` keys are dropped even when Unicode-escaped; `app/routes/search.tsx` logs error counts and codes instead of messages outside development.
- `cart_viewed` is no longer published (Phase 3).
- Cart service details (Phase 3): `updateBuyerIdentity` no longer writes `companyLocationId` into the session through `setBuyer` (B2B only, no caller); `cart.get()` returns null for a `{cart: null, errors}` answer (unreachable in production, the errors guard answers 502 first); mutation results always carry `cart` (null without a payload) where Hydrogen omitted the key; `getFormInput` ignores an `inputs` value that is not an object; hand-crafted line shapes that Hydrogen forwarded to the API are rejected by the cart action with 400.
- CSP (Phase 4a): `generateNonce` fails closed without Web Crypto instead of falling back to `Math.random`; a nonce that is not a valid CSP base64 value is rejected; the dev-only `ws://*.tryhydrogen.dev:*` source is gone.
- Log prefixes (Phase 4a): `[sitemap]` and `[storefront-redirect]` replace Hydrogen's `[h2:...]` lines; refused cross-origin redirect targets are no longer logged; `[useOptimisticCart]` replaces `[h2:warn:...]` (Phase 3).
- Optimistic cart (Phase 3): `useOptimisticCart` returns the cart object itself (null stays null) when no pending action changes the lines, instead of a clone with recomputed totals; non-positive or fractional quantities are normalised.
- Cart service (Phase 3): a failed `create` keeps the cookie's cart id for the rest of the request; an absolute same-origin redirect target is reduced to its path; the sitemap type lookup uses own keys only (Phase 4a).
- The consent script loads only when analytics is configured.
- Analytics follow-up (Phase 4c): analytics code never throws into React (failures are caught and logged once per tracker or loader with the `[analytics]` prefix); a refusing visitor's browser and token readers are never called; an incomplete product (missing id, title, price, variantId or variantTitle) drops its PRODUCT_VIEW with one development warning per missing field while the page view keeps its product context, and an empty vendor is sent as `brand: ''` as Hydrogen did; the consent script is inserted with the nonce set before it is appended; server-side calls forward every cookie except our `session` and `cart` (the proxy's policy); collected Set-Cookie values named `session` or `cart` are never appended (the proxy strips them from upstream answers too), and collected cookies are appended only to responses without shared-cache `Cache-Control`.
- Analytics details (Phase 4c): events report hydrogen-react's version as `assetVersionId` instead of Hydrogen's; the add-to-cart detection keeps an in-memory cart baseline instead of Hydrogen's `cartLastUpdatedAt` in localStorage (the cart id is never persisted client-side); events queue in memory (at most 50) until consent is known; server-side query and mutation fetches use `redirect: 'manual'`; analytics is refused with a server log when `PUBLIC_STOREFRONT_API_TOKEN` is a private (`shpat_`) token.
- The mock-shop console warning disappears and the e2e allowlist becomes empty (Phase 4c).
- Tracking cookies are forwarded only when analytics is enabled (Phase 4c).
- Stores with the account variables set still get the 503 page. POST `/account/logout` clears the session and redirects to `/`; before, it gave a dev 400 or a production 500 (Phase 5).
- POST `/account/logout` from another origin answers 400 without touching the session: the logout route is a resource route that React Router's own origin check skips, so the stub checks the Origin header itself (Phase 5). GET `/account/authorize` redirects to `/account/login` instead of a dev 400 or production 500 (Phase 5).
- Deep-path requests get the designed HTML 404 (Phase 7).
- React Router 7.18 gives `<Links>` the server nonce from its context; root.tsx passes `nonce=""` so server and client render the same attribute (Chromium hides a link's nonce from the DOM, so hydration cannot match the real one); stylesheets are same-origin and need no nonce (Phase 7).
- React Router 7.18's CSRF check compares the Origin header's full origin with the request URL (Host and X-Forwarded-Host are ignored); the customer-account stub's logout check still mirrors the 7.16 rule, which is stricter in some cases and accepts an `http://` Origin on the same host in another (follow-up: align it) (Phase 7).

### 13.6 Deferred

- **Customer accounts (ADR-D2):** deferred. Every call that needs a signed-in
  customer ends on the 503 sign-in page. Hydrogen's OAuth client (ADR-D1) is not
  ported, so sign-in, orders, profile and addresses have no live data path.
- **Analytics:** off until `PUBLIC_CHECKOUT_DOMAIN` and `PUBLIC_STOREFRONT_ID` are
  set, and never in mock mode. Not verified against a live store.
- **`PRIVATE_STOREFRONT_API_TOKEN`:** supported by the code, and not set in any
  environment.
- **Cache API:** active only on a custom domain.
- **`cart_viewed`:** dropped (ADR-E1; Shopify did not consume it).
- **Privacy or cookie banner:** not added. None existed before the removal either.

### 13.7 Owner follow-ups

1. **Phase 7 (`d2e2faa`):** confirm the result of its e2e run, then run `npm audit`
   and check that nothing new appears.
2. **Edge rate limits (Cloudflare):** for the Storefront API proxy
   (`/api/*/graphql.json`), the 404 redirect lookups and `POST /cart`. The app does
   no rate limiting on these routes.
3. **Private token:** set `PRIVATE_STOREFRONT_API_TOKEN` (recommended). Server-side
   calls then use it with the buyer's IP (`CF-Connecting-IP`), and the proxy keeps
   the public token.
4. **Custom domain:** the Cache API is inactive on `*.workers.dev`. Configure
   `workers_dev: false` and a route with `custom_domain: true` in `wrangler.jsonc`
   (a commented example is in the file).
5. **First live-store smoke test:** the proxy, the private token and buyer IP, the
   `cf-ray` request group id, and the Cache API on the custom domain. None of these
   has run against Shopify.
6. **Cache key version:** keys start with the format marker `v1`
   (`CACHE_KEY_FORMAT` in `app/lib/storefront/client.server.ts`) and live in the
   `storefront` cache. Entries under the Hydrogen-era `hydrogen` cache are not read,
   so the first requests after a deploy miss the cache.
7. **`_tracking_consent`:** the review of the hardening and Phase 5 commits left an owner
   decision open: forward only `_shopify_*` cookies server-side, and add
   `_tracking_consent` to an allowlist if live analytics need it. The code no longer works that way. With analytics on,
   server-side calls forward every cookie except `session` and `cart` (the Phase 4c
   policy in the plan; `OWN_COOKIE_NAMES` in `app/lib/storefront/client.server.ts`),
   so `_tracking_consent` is forwarded. The owner should confirm this policy and
   close the item.
8. **Logout origin check:** align the customer-account stub's check with React
   Router 7.18's rule (`app/lib/customer-account/stub.server.ts`). The stub mirrors
   7.16's rule, which is stricter in some cases and accepts an `http://` origin on
   the same host in another (plan, Phase 7 entry).
9. **Consent:** confirm before analytics go live that the storefront's consent setup
   meets the store's requirements. It renders no privacy or cookie banner.
10. **AGENTS.md:** it still describes the Hydrogen skeleton. The owner signs off the
    new wording. This increment does not change the file.

### 13.8 Not verified, and other notes

- **Live Shopify behaviour:** no store was available. The proxy, the private token
  and buyer IP, the `cf-ray` grouping, the Cache API, analytics and sign-in have run
  only against the mock or in unit tests.
- **Admin path:** "Shopify admin > Sales channels > Hydrogen > Storefront settings"
  comes from `.dev.vars.example`. It was not checked in the Shopify admin.
- **Phase gate results** in 13.3 are as reported by the phase gates. The coverage
  figure is not re-measured here.
- **Phase 7 e2e run:** this pass does not know its result. The commit `d2e2faa`
  landed while the pass was running.
- **CI:** the repository has no CI configuration (no `.github` directory and no other
  CI file). The README therefore refers to the `CI` environment variable, which
  `playwright.config.ts` reads.
- **Other stale items** (outside this increment's files): `tests/e2e/support.spec.ts`
  (line 163) still calls the Hydrogen warning "allowed until Phase 4c";
  `guides/search/search.md` and `guides/predictiveSearch/predictiveSearch.md` are
  titled "Hydrogen"; `package.json` is named `cozio` (version 2026.4.8) while the
  storefront is called Mellow; `docs/hydrogen-removal-plan.md` has no status line;
  and the gitignored `.env` in the repository root is not read by the app since
  Phase 1 and can be deleted.
