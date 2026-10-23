# Mellow storefront – implementation report

Branch: `claude/relaxed-archimedes-qm7h5e` (base: `main` @ `066fce0`).

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

| Route | Status | Notes |
| --- | --- | --- |
| `/` | Implemented | Hero, press marquee, story video, "Most Loved" product grid (Shopify collection), UGC video grid, lifestyle images, testimonials, FAQ, newsletter |
| `/products/:handle` | Implemented | Gallery, rating, price/compare-at, savings note, grouped colour swatches, feature bullets, quantity + add to cart, trust badges, accordions, review carousel, recommendations, JSON-LD |
| `/collections/:handle` | Implemented | Header, sort, Storefront API filters (sidebar / mobile sheet), chips, Load more pagination, empty state |
| `/collections/all` | Implemented | Shop-all listing with sort |
| `/collections` | Implemented | Collection cards |
| `/search` | Implemented | Results page + predictive search drawer |
| `/cart` + cart drawer | Implemented | Lines, quantity, remove, discount/gift card forms, checkout CTA, empty state |
| `/pages/about` | Implemented | Designed template (hero card, story card, values, CTA) |
| `/pages/:handle` | Implemented | Prose template |
| `/policies`, `/policies/:handle` | Implemented | |
| `/blogs`, `/blogs/:blog`, `/blogs/:blog/:article` | Implemented | Editorial templates + empty states |
| `/account/*` | Implemented (UI) | Orders, order detail, profile, addresses restyled; friendly 503 page when the Customer Account API is not configured |
| `/newsletter` | Implemented | Form action with webhook boundary |
| `/dev/mock-checkout` | Dev only | Stand-in for Shopify checkout while the mock is active (404 otherwise) |
| 404 / errors | Implemented | Designed error view |
| `robots.txt`, `sitemap.xml` | Preserved | Skeleton routes |

## 3. UI/UX fidelity

Verified by rendering every route at 390, 820 and 1440 px with Playwright
(48 screenshots) and comparing with the references:

* Layout, proportions, typography (Outfit display / Inter body), palette
  (sampled from the references: primary `#4c4184`, lavender `#e1e1fe`, tint
  `#efefff`, coral `#fea58c`), pill buttons, 16 px card radii, badge
  placement, star ratings, price/compare-at treatment, product-page column
  widths (600 px gallery / 536 px info column) and the About page cards match
  the references closely.
* Known differences: the reference photography, press logos and videos are
  not in the repository, so placeholder artwork (`public/images/placeholders`)
  and typographic press logos are used until the merchant uploads media in
  Shopify; a quantity selector was added to the product page (not in the
  reference); sections below the fold that the references do not show
  (testimonials, FAQ, newsletter, footer) follow the same design system.
* Pixel-perfect accuracy is **not** claimed; comparisons were visual, not
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

* Project is a Hydrogen 2026.4.7 / React Router 7.16 app using flat routes,
  `createHydrogenContext`, the built-in cart handler (`context.cart`) and
  `CartForm` actions, the Customer Account API routes, `Analytics.Provider`,
  CSP via `createContentSecurityPolicy` (extended for Google Fonts and video
  embeds) and Storefront codegen (`storefrontapi.generated.d.ts` regenerated).
* All Storefront API reads happen in route loaders through
  `context.storefront`; mutations go through the `/cart` action. No private
  credentials are referenced by client code.
* Variant selection keeps Hydrogen's `getProductOptions` /
  `useOptimisticVariant` / `getAdjacentAndFirstAvailableVariants` pattern.
* Imports use `react-router` (never `react-router-dom`) per the repo rule.

## 6. Storefront API integration status

| Area | Status |
| --- | --- |
| Products, variants, pricing, availability, media, collections, filters, sort, search, predictive search, pages, policies, blogs, menus, shop data | Configured for Shopify; verified against the **development mock only** (this container cannot reach Shopify; no store credentials were available) |
| Cart (create/add/update/remove/discounts/gift cards), checkout URL | Hydrogen cart handler unchanged; verified against the mock cart |
| Customer accounts | Hydrogen Customer Account API routes preserved and restyled; **not verified** (requires `SHOP_ID` / `PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID`); UI verified with fixtures |
| Editorial content (hero, press, story, videos, testimonials, FAQ, About, reviews) | Metaobject/metafield contracts implemented with documented fallbacks; verified with mock metaobjects |
| Newsletter | Webhook boundary (`NEWSLETTER_WEBHOOK_URL`); reports "not connected" otherwise |
| Analytics / consent | Hydrogen defaults; needs `PUBLIC_CHECKOUT_DOMAIN` + token |

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

* Agent 1 – product detail page (`app/routes/products.$handle.tsx`,
  `app/components/product/*`, `product.css`).
* Agent 2 – collections, shop-all, collections index, search
  (`app/routes/collections*.tsx`, `search.tsx`, `app/components/collection/*`,
  search components, `collection.css`).
* Agent 3 – cart drawer/page, account, content pages, error states
  (`CartMain/CartLineItem/CartSummary`, `app/routes/account*.tsx`, policies,
  blogs, pages, `cart.css`, `account.css`, `content.css`).
* Agent 4 – independent QA review (read-only).

The main session owned the design system, layout, homepage, About page,
content contracts, development mock, documentation, integration and
verification, and reviewed every agent's output before committing.

## 8. Verification results

* `npm run lint` – pass. `npm run typecheck` – pass. `npm run build` – pass
  (server bundle 524 kB; the development mock is excluded from production
  bundles).
* Playwright: 16 routes × 3 viewports – all expected status codes (200; 503
  for the unconfigured account page; 404 for unknown URLs), one `h1` per page,
  no horizontal overflow, no unexpected console or page errors. Interaction
  scripts for the product page (48 + 7 checks), collections (26 checks), cart
  (9 checks), drawers, newsletter and FAQ all pass.
* The only console messages are expected in this sandbox: Hydrogen's "mock
  shop" analytics warning and blocked requests to `cdn.shopify.com`.

## 9. Shopify configuration still required

See `docs/shopify-setup.md`: store credentials (`npx shopify hydrogen link`
+ `env pull`), `main-menu` / `footer` menus, collections (`most-loved`, `all`,
`bath`, `bundles`, …), product metafields (`reviews.*`, `mellow.*`),
metaobject definitions (`mellow_settings`, `mellow_hero`, `mellow_press_logo`,
`mellow_story`, `mellow_ugc_video`, `mellow_lifestyle_image`,
`mellow_testimonial`, `mellow_faq`, `mellow_about`, `mellow_review`), the
`about` page, policies, Customer Account API variables, and optionally
`NEWSLETTER_WEBHOOK_URL`. Set `MOCK_STOREFRONT=false` (or remove it) once the
store is linked.

## 10. Outstanding issues and limitations

* Live Shopify behaviour (real images, filters availability, customer
  accounts, checkout, analytics) is unverified in this environment.
* Reference photography/press logos/videos must be supplied through Shopify
  files/metaobjects; placeholder artwork ships in the repo.
* Review data depends on `mellow_review` metaobjects (or a reviews app that
  writes the standard `reviews.rating` metafields).
* Filter value counts in the development mock ignore other active filters
  (the live API recomputes them).
* The dev mock cart lives in memory (reset on server restart).

## 11. Recommended next steps

1. Link the store, pull env vars, create the menus/collections/metafields/
   metaobjects per `docs/shopify-setup.md`, upload media, remove
   `MOCK_STOREFRONT`.
2. Run the storefront against the live store and re-run the Playwright
   scripts in the session scratchpad (or port them into a `tests/` folder
   with `@playwright/test`).
3. Configure the Customer Account API and verify sign-in, orders and
   addresses end to end.
4. Connect a newsletter provider via `NEWSLETTER_WEBHOOK_URL`.
5. Optionally add a reviews app that populates `reviews.rating` /
   `reviews.rating_count` and the review metaobjects.

## 12. Assumptions

* The screenshots were treated as the design specification in place of the
  unavailable blueprint documents.
* Navigation targets: Shop → `/collections/all`, Bath → `/collections/bath`,
  Bundles → `/collections/bundles`, About → `/pages/about` (overridable via
  the Shopify `main-menu`).
* Copy for sections not visible in the screenshots (story paragraph ending,
  testimonials, FAQ, newsletter, About values/closing) was written in the
  brand voice and is editable through metaobjects.
