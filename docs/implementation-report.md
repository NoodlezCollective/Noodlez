# Mellow storefront – implementation report

Branch: `claude/relaxed-archimedes-qm7h5e` (base: `main` @ `066fce0`).

> **Note (2026-10-24):** this report covers two increments. Increment 1, the
> initial build (2026-10-23), is described in sections 1 to 6, 8a, 9 and 12 as
> first written. Increment 2, the committed test suites, review fixes and
> migration planning (2026-10-23/24), updates sections 7, 8, 10 and 11 and adds
> section 8b.

## 1. Summary

The Shopify Hydrogen skeleton in this repository (Hydrogen 2026.4.7, React
Router 7.16, TypeScript, plain CSS) was extended, not replaced, into the Mellow
storefront documented by the five design reference screenshots supplied with
the task. Every existing Hydrogen route, loader, action, Storefront/Customer
Account client, session and cart integration was preserved; the UI layer,
content model and page templates are new.

The two blueprint documents referenced in the brief
(`01_mellowsleep_frontend_blueprint.md`, `03_integration_strategy_and_file_index.md`)
are Windows paths on the author's machine and were **not available in this
environment**; the design specification was therefore derived from the five
screenshots (homepage top, product grid, video grid, product page, About page)
plus the existing repository structure. Assumptions this forced are listed in
section 12.

## 2. Pages and routes

| Route                                             | Status           | Notes                                                                                                                                                                                  |
| ------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                               | Implemented      | Hero, press marquee, story video, "Most Loved" product grid (Shopify collection), UGC video grid, lifestyle images, testimonials, FAQ, newsletter                                      |
| `/products/:handle`                               | Implemented      | Gallery, rating, price/compare-at, savings note, grouped colour swatches, feature bullets, quantity + add to cart, trust badges, accordions, review carousel, recommendations, JSON-LD |
| `/collections/:handle`                            | Implemented      | Header, sort, Storefront API filters (sidebar / mobile sheet), chips, Load more pagination, empty state                                                                                |
| `/collections/all`                                | Implemented      | Shop-all listing with sort                                                                                                                                                             |
| `/collections`                                    | Implemented      | Collection cards                                                                                                                                                                       |
| `/search`                                         | Implemented      | Results page + predictive search drawer                                                                                                                                                |
| `/cart` + cart drawer                             | Implemented      | Lines, quantity, remove, discount/gift card forms, checkout CTA, empty state                                                                                                           |
| `/pages/about`                                    | Implemented      | Designed template (hero card, story card, values, CTA)                                                                                                                                 |
| `/pages/:handle`                                  | Implemented      | Prose template                                                                                                                                                                         |
| `/policies`, `/policies/:handle`                  | Implemented      |                                                                                                                                                                                        |
| `/blogs`, `/blogs/:blog`, `/blogs/:blog/:article` | Implemented      | Editorial templates + empty states                                                                                                                                                     |
| `/account/*`                                      | Implemented (UI) | Orders, order detail, profile, addresses restyled; friendly 503 page when the Customer Account API is not configured                                                                   |
| `/newsletter`                                     | Implemented      | Form action with webhook boundary                                                                                                                                                      |
| `/dev/mock-checkout`                              | Dev only         | Stand-in for Shopify checkout while the mock is active (404 otherwise)                                                                                                                 |
| 404 / errors                                      | Implemented      | Designed error view                                                                                                                                                                    |
| `robots.txt`, `sitemap.xml`                       | Preserved        | Skeleton routes                                                                                                                                                                        |

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

## 5. Hydrogen architecture and compatibility

- Project is a Hydrogen 2026.4.7 / React Router 7.16 app using flat routes,
  `createHydrogenContext`, the built-in cart handler (`context.cart`) and
  `CartForm` actions, the Customer Account API routes, `Analytics.Provider`,
  CSP via `createContentSecurityPolicy` (extended for Google Fonts and video
  embeds) and Storefront codegen (`storefrontapi.generated.d.ts` regenerated).
- All Storefront API reads happen in route loaders through
  `context.storefront`; mutations go through the `/cart` action. No private
  credentials are referenced by client code.
- Variant selection keeps Hydrogen's `getProductOptions` /
  `useOptimisticVariant` / `getAdjacentAndFirstAvailableVariants` pattern.
- Imports use `react-router` (never `react-router-dom`) per the repo rule.

## 6. Storefront API integration status

| Area                                                                                                                                              | Status                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Products, variants, pricing, availability, media, collections, filters, sort, search, predictive search, pages, policies, blogs, menus, shop data | Configured for Shopify; verified against the **development mock only** (this container cannot reach Shopify; no store credentials were available)                       |
| Cart (create/add/update/remove/discounts/gift cards), checkout URL                                                                                | Hydrogen cart handler unchanged; verified against the mock cart                                                                                                         |
| Customer accounts                                                                                                                                 | Hydrogen Customer Account API routes preserved and restyled; **not verified** (requires `SHOP_ID` / `PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID`); UI verified with fixtures |
| Editorial content (hero, press, story, videos, testimonials, FAQ, About, reviews)                                                                 | Metaobject/metafield contracts implemented with documented fallbacks; verified with mock metaobjects                                                                    |
| Newsletter                                                                                                                                        | Webhook boundary (`NEWSLETTER_WEBHOOK_URL`); reports "not connected" otherwise                                                                                          |
| Analytics / consent                                                                                                                               | Hydrogen defaults; needs `PUBLIC_CHECKOUT_DOMAIN` + token                                                                                                               |

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
  automatic fixture). The baseline allowlist has one entry, Hydrogen's
  `[h2:error:Analytics.Provider] - Mock shop is used...` warning, which the
  development mock triggers by design. A test that provokes any other message
  allows it itself, with a reason. Third-party requests are answered locally
  (`tests/e2e/support/network.ts`).

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

See `docs/shopify-setup.md`: store credentials (`npx shopify hydrogen link`
and `env pull`), `main-menu` / `footer` menus, collections (`most-loved`,
`all`, `bath`, `bundles`, …), product metafields (`reviews.*`, `mellow.*`),
metaobject definitions (`mellow_settings`, `mellow_hero`, `mellow_press_logo`,
`mellow_story`, `mellow_ugc_video`, `mellow_lifestyle_image`,
`mellow_testimonial`, `mellow_faq`, `mellow_about`, `mellow_review`), the
`about` page, policies, Customer Account API variables, and optionally
`NEWSLETTER_WEBHOOK_URL`. Set `MOCK_STOREFRONT=false` (or remove it) once the
store is linked.

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
- The Hydrogen dev server (MiniOxygen/workerd) crashes on a request line of
  about 15 KB made of `/a/..` segments. This is dev tooling only, it was
  reproduced twice, and it cannot be fixed in app code. Before route discovery
  was set to `initial` (`react-router.config.ts`, f57cbd9), the dev worker also
  wedged after a few thousand concurrent requests; it no longer does under the
  e2e suite's request volume.
- Accepted deviations from the reviews (documented, not changed):
  - merchant HTML (product descriptions, policies, pages, blog articles) is
    rendered unsanitised with `dangerouslySetInnerHTML`, behind the nonce CSP;
  - Google Fonts: the stylesheet and font files are loaded from Google at
    runtime, and the CSP allows both;
  - the newsletter action has no rate limiting (its size, validation and
    timeout limits do apply);
  - customer accounts are unverified (see the first item above);
  - analytics needs `PUBLIC_CHECKOUT_DOMAIN` and a token before it reports;
  - react-router stays on 7.16 until the Hydrogen removal (section 11, step 6),
    so the path-segment guard stays too.
- The hero rating keeps its default of 5 when the `mellow_hero` rating field is
  empty. Other ratings show no stars when they are missing.
- A mistyped icon key in `mellow_about.values` becomes the title of that value.
  Section 5 of `docs/shopify-setup.md` documents this and lists the valid keys.

## 11. Recommended next steps

1. Link the store, pull env vars, create the menus/collections/metafields/
   metaobjects per `docs/shopify-setup.md`, upload media, remove
   `MOCK_STOREFRONT`.
2. Done (increment 2): the unit suite (Vitest) and the end-to-end suite
   (Playwright) are committed and run with `npm test`. The e2e suite refuses a
   server that is not in mock mode, so a run against the live store needs more
   than `E2E_BASE_URL`: the catalog constants in `tests/e2e/support/catalog.ts`
   are mock data and would need a separate design.
3. Configure the Customer Account API and verify sign-in, orders and
   addresses end to end.
4. Connect a newsletter provider via `NEWSLETTER_WEBHOOK_URL`.
5. Optionally add a reviews app that populates `reviews.rating` /
   `reviews.rating_count` and the review metaobjects.
6. Decided next increment (owner decisions, 2026-10-24; not started): remove
   Hydrogen as described in `docs/hydrogen-removal-architecture.md`, following
   phases 0 to 7 of `docs/hydrogen-removal-plan.md`. Decided: Cloudflare Workers
   as the deployment target; customer accounts deferred behind the existing 503
   page; analytics rebuilt with `@shopify/hydrogen-react` helpers and enabled
   once `PUBLIC_CHECKOUT_DOMAIN` and `PUBLIC_STOREFRONT_ID` are set; the
   Hydrogen sales channel and its public Storefront API token kept; React Router
   upgraded to 7.18 or later in the final phase, which also removes the
   path-segment guard.

## 12. Assumptions

- The screenshots were treated as the design specification in place of the
  unavailable blueprint documents.
- Navigation targets: Shop → `/collections/all`, Bath → `/collections/bath`,
  Bundles → `/collections/bundles`, About → `/pages/about` (overridable via
  the Shopify `main-menu`).
- Copy for sections not visible in the screenshots (story paragraph ending,
  testimonials, FAQ, newsletter, About values/closing) was written in the
  brand voice and is editable through metaobjects.
