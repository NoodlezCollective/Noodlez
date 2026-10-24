# Removing Hydrogen from the Mellow storefront: architecture

Status: **proposed** (2026-10-24). Produced by the ECC `architect` agent from a
read-only analysis of the codebase; nothing described here is implemented yet.
Owner decision taken: Shopify Hydrogen (`@shopify/hydrogen`, the Hydrogen CLI
and Vite plugin, MiniOxygen, Oxygen hosting) is removed; the storefront stays
on React Router 7 framework mode and keeps its routes, loaders/actions,
components, design system, content model, development mock, Vitest layer and
Playwright suite. Shopify integration moves to `@shopify/hydrogen-react` plus
direct Storefront API GraphQL where Hydrogen's server helpers have no
framework-agnostic equivalent.

Source citations: "hr:N" is line N of
`node_modules/@shopify/hydrogen/node_modules/@shopify/hydrogen-react/dist/types/index.d.ts`
(hydrogen-react 2026.4.4); "h:N" is line N of
`node_modules/@shopify/hydrogen/dist/development/index.js`.

## 0. Facts that shape the design

- **F1. What hydrogen-react has.** `createStorefrontClient` (hr:34),
  `flattenConnection` (18), `parseGid` (5); `Image` (20), `Money` (24),
  `useMoney` (36), `ShopPayButton` (31), `ShopifyProvider`/`useShop` (30),
  `CartProvider`/`useCart` (14); `getProductOptions`,
  `getAdjacentAndFirstAvailableVariants`, `MappedProductOptions` (19),
  `decodeEncodedVariant` (25), `useSelectedOptionInUrlParam` (37);
  `sendShopifyAnalytics`, `getClientBrowserParameters` (2),
  `AnalyticsEventName`, `AnalyticsPageType`, `ShopifySalesChannel` (3),
  `useShopifyCookies` (38), `getTrackingValues` (35), `useLoadScript` (21).
  Its package also exports `./storefront-api-types`,
  `./customer-account-api-types`, `./storefront.schema.json` and
  `./customer-account.schema.json`. **Not** in hydrogen-react:
  `useOptimisticVariant`, `getSelectedProductOptions`, `useOptimisticCart`,
  `CartForm`, `Pagination`, `getPaginationVariables`, sitemaps,
  `storefrontRedirect`, CSP/nonce, `Analytics`, `useAnalytics`,
  `getShopAnalytics`, `useCustomerPrivacy`, `createCustomerAccountClient`,
  cache strategies.
- **F2. Some Hydrogen exports are hydrogen-react re-exports** (`Image`,
  `Money`, `getProductOptions`, `getAdjacentAndFirstAvailableVariants`,
  `useSelectedOptionInUrlParam`; h:5): swapping those imports changes no
  behaviour. `useShop()` falls back to a US/EN default, so `Money` needs no
  `ShopifyProvider`.
- **F3. `createStorefrontClient` does not fetch.** It returns
  `getShopifyDomain`, `getStorefrontApiUrl`, `getPrivateTokenHeaders`,
  `getPublicTokenHeaders`. Hydrogen does the fetch, the `$country`/`$language`
  injection (h:1914-1921), caching and error shaping.
- **F4. Hydrogen's library helpers work outside Oxygen.** `createCartHandler`,
  `createCustomerAccountClient`, `storefrontRedirect`, `getSitemap`,
  `getSitemapIndex`, `createContentSecurityPolicy` are built on Web APIs
  only, so they can be replaced one at a time.
- **F5. Hydrogen's request handler does more than route** (h:4377-4430): 400
  for GET/HEAD with a body, 301 for paths containing `//`, same-origin proxy
  for `/api/(unstable|YYYY-MM)/graphql.json` and `/api/mcp`, copies
  Storefront API `Set-Cookie` headers, adds `Server-Timing: _sfapi_proxy`.
  Hydrogen 2026.4's consent setup always uses that proxy (h:105, 143).
- **F6. `@shopify/hydrogen-codegen` assumes Hydrogen is installed** (resolves
  `@shopify/hydrogen/<api>.schema.json`; generated types import
  `@shopify/hydrogen/*-api-types` and extend `declare module
'@shopify/hydrogen'`). The underlying `@shopify/graphql-codegen` exports
  `preset`, `pluckConfig`, `ClientReturn`, `ClientVariablesInRestParams`.
- **F7. `hydrogenPreset` sets** `appDirectory: app`, `buildDirectory: dist`,
  `ssr`, `v8_middleware`, `v8_splitRouteModules`,
  `v8_viteEnvironmentApi: false`, no SRI. With middleware on, the load
  context must stay a `RouterContextProvider`.
- **F8. Cross-origin POST rejection comes from React Router**
  (`throwIfPotentialCSRFAttack`, Origin vs `x-forwarded-host`/`host`), so it
  survives any adapter.

## 1. Inventory

45 files in `app/` plus `server.ts` import Hydrogen (16 routes, 17
components, 7 lib files, root, entry.server, entry.client, routes.ts,
server.ts), plus config: vite.config.ts, react-router.config.ts, env.d.ts,
tsconfig `types`, .graphqlrc.ts, both generated `.d.ts` files.

Replacement key: (a) hydrogen-react, (b) React Router 7, (c) reimplement.

| Concern                           | Hydrogen symbols (where)                                                                                                                                                                                                                                      | Replacement                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request handler, context, session | `createRequestHandler`, `storefrontRedirect` (server.ts); `createHydrogenContext`, `cartSetIdDefault` (app/lib/context.ts); `HydrogenRouterContextProvider` (entry.server.tsx); `HydrogenSession` (app/lib/session.ts)                                        | (b) `createRequestHandler(build, mode)` from `react-router`; build the context on `new RouterContextProvider()` and port Hydrogen's property proxy (h:4311-4362) so `context.storefront/cart/env/session/customerAccount` keep working; (c) add the F5 checks and the Storefront API proxy to server.ts; drop `implements HydrogenSession`. |
| Storefront API and caching        | `storefront.query/mutate/i18n/CacheLong/CacheShort/CacheNone`: 20 calls in 14 files, 8 with cache hints; `Storefront` type in storefront-errors.ts and mock/install.server.ts; `createWithCache` unused                                                       | (a) URLs and headers, (c) own client (ADR-B)                                                                                                                                                                                                                                                                                                |
| Cart                              | `context.cart.*` (cart, cart.$lines, discount.$code, dev.mock-checkout, root); `CartForm` (cart, CartLineItem, CartSummary, AddToCartButton, dev.mock-checkout); `useOptimisticCart` (cart, CartMain, Header); `OptimisticCart*`, `CartQueryDataReturn` types | (c) ADR-C                                                                                                                                                                                                                                                                                                                                   |
| Customer accounts                 | `context.customerAccount.*` (10 account routes, `isLoggedIn` in root, cart buyer identity); `customer-account-api-types`                                                                                                                                      | types (a); client (c) ADR-D                                                                                                                                                                                                                                                                                                                 |
| Analytics and consent             | `Analytics.Provider`, `getShopAnalytics` (root); `Analytics.ProductView/CollectionView/SearchView`; `useAnalytics`, `CartViewPayload` (Header)                                                                                                                | (a) F1 helpers + (c) small provider (ADR-E)                                                                                                                                                                                                                                                                                                 |
| CSP and nonce                     | `createContentSecurityPolicy` (entry.server); `useNonce` (root, products.$handle); `NonceProvider` (entry.client)                                                                                                                                             | (c) ADR-F                                                                                                                                                                                                                                                                                                                                   |
| Pagination                        | `Pagination` (PaginatedResourceSection, blogs._index, blogs.$blogHandle._index, account.orders._index); `getPaginationVariables` (7 routes)                                                                                                                   | (c) port `Pagination`/`usePagination` (h:4602-4851) on (a) `flattenConnection`                                                                                                                                                                                                                                                              |
| Sitemaps and redirects            | `getSitemapIndex`, `getSitemap`; `storefrontRedirect`                                                                                                                                                                                                         | (c) ADR-F                                                                                                                                                                                                                                                                                                                                   |
| Variants                          | `getProductOptions`, `getAdjacentAndFirstAvailableVariants`, `useSelectedOptionInUrlParam`, `MappedProductOptions`; `useOptimisticVariant`, `getSelectedProductOptions`                                                                                       | (a) first four; (c) `useOptimisticVariant` (~50 lines on `useNavigation`, h:4852), `getSelectedProductOptions` (10 lines, h:4996)                                                                                                                                                                                                           |
| UI                                | `Image` (11 files), `Money` (6), `flattenConnection`                                                                                                                                                                                                          | (a)                                                                                                                                                                                                                                                                                                                                         |
| Types and schema                  | `storefront-api-types` (8 files), `storefront.schema.json` (mock/schema.server.ts)                                                                                                                                                                            | (a) hydrogen-react subpaths                                                                                                                                                                                                                                                                                                                 |
| Routing and build                 | `hydrogenRoutes` (routes.ts), `hydrogenPreset` (react-router.config.ts), `hydrogen()` (vite.config.ts)                                                                                                                                                        | (b) `export default flatRoutes()` + explicit React Router config (F7)                                                                                                                                                                                                                                                                       |
| Tooling and env types             | `oxygen()` (@shopify/mini-oxygen); CLI scripts `dev`, `build`, `preview`, `dev:e2e`, `codegen`; `@shopify/oxygen-workers-types`; `HydrogenEnv` (env.d.ts, tsconfig)                                                                                           | ADR-A, ADR-G; declare our own `interface Env` incl. `PRIVATE_STOREFRONT_API_TOKEN`                                                                                                                                                                                                                                                          |

## 2. Architecture decision records

### ADR-A: runtime and deployment target

- **A1 Cloudflare Workers (recommended).** server.ts stays a module worker
  using `createRequestHandler` from `react-router`. Dev server:
  `@cloudflare/vite-plugin` runs the worker in workerd, as MiniOxygen does
  today, so server.ts, `caches` and `waitUntil` run in dev and e2e; needs
  `future.v8_viteEnvironmentApi: true` and a `wrangler.jsonc`. Env via
  wrangler vars/secrets and `.dev.vars`. Sessions unchanged (cookie). Cache:
  per-data-centre Cache API without Oxygen's tiered cache; the Cache API is
  documented as inactive on `*.workers.dev`, so production needs a custom
  domain (confirm before launch). Buyer IP from `CF-Connecting-IP`. Types:
  `@cloudflare/workers-types`. Alternative dev mode `cloudflareDevProxy`
  runs SSR in Node and skips server.ts, leaving the segment guard, header
  fill and redirects untested.
- **A2 Node** (`@react-router/node` + `@react-router/serve` or Express,
  Docker): no `caches` (needs LRU/Redis), no `waitUntil`; entry.server must
  use `renderToPipeableStream`; server.ts logic becomes middleware; env from
  `process.env`; reverse-proxy headers needed for `isSecureRequest`, OAuth
  origins and F8.
- **A3 Vercel** (`@vercel/react-router`, unverified): everything in A2 plus
  no custom server entry (logic moves to a root `middleware`), `waitUntil`
  from `@vercel/functions`, CDN-header caching.
- **Decision: A1.** The code is already worker-shaped (`caches.open`,
  `ExecutionContext`, `renderToReadableStream`, fetch handler), so
  server.ts, entry.server.tsx and their tests survive almost unchanged and
  the dev server behaves like production. Keep platform-neutral logic
  (security headers, session commit, 404 redirects) portable so a later move
  to A2/A3 stays small.

### ADR-B: Storefront client and caching

- **B1 own client (recommended)** in `app/lib/storefront/client.server.ts`:
  URLs and headers from hydrogen-react's `createStorefrontClient`; own
  `query`/`mutate` calling `globalThis.fetch` at request time (keeps the
  `vi.stubGlobal('fetch')` tests working); reproduces the
  `$country`/`$language` injection (every query uses `@inContext`); refuses
  a mutation through `query`; throws on non-2xx (logging operation name and
  `x-request-id`); returns `{...data, errors}`. Same surface as today
  (`query`, `mutate`, `i18n`, `CacheLong/CacheShort/CacheNone`,
  `getShopifyDomain`, `getApiUrl`), so the 20 call sites,
  `guardStorefrontErrors` and `installMockStorefront` (both reassign
  `.query`/`.mutate` on the single object) keep working, and the cart
  service shares the instance. Typing via `ClientReturn` /
  `ClientVariablesInRestParams` over the generated `StorefrontQueries`.
  Cache layer `cache.server.ts`: key = SHA-256 of URL + token + body stored
  as a synthetic GET in `caches.open('storefront')`, stale-while-revalidate
  refreshed through `waitUntil`, queries only, never cache results with
  `errors`, cart always `CacheNone`; Hydrogen's timings (Short 1 s + 9 s
  stale, Long 3600 s + 82800 s, default 1 s + 86399 s).
- **B2 no cache:** 4+ uncached Storefront calls per SSR request, throttling
  risk. **B3 `@shopify/storefront-api-client`:** different call shape, no
  cache.
- **Decision: B1**, preferring a new `PRIVATE_STOREFRONT_API_TOKEN` with the
  buyer-IP header server-side (Hydrogen already reads it, h:4275), falling
  back to the public token; the public token reaches the browser only for
  consent and the proxy. Forward cookies/visitor tokens (h:1874-1891) once
  ADR-E ships.

### ADR-C: cart

- **C1 server-side cart (recommended)** in `app/lib/cart/cart.server.ts`:
  `get`, `create`, `addLines`, `updateLines`, `removeLines`,
  `updateDiscountCodes`, `addGiftCardCodes`, `removeGiftCardCodes`,
  `updateBuyerIdentity`, `getCartId`, `setCartId`; standard Storefront
  mutations selecting `cart{id totalQuantity checkoutUrl} userErrors{message
field code} warnings{code message target}`; `get` uses
  `CART_QUERY_FRAGMENT` with `$numCartLines=100` and `CacheNone`. Keep
  Hydrogen behaviour (h:3187-3297): first `addLines`/`updateDiscountCodes`/
  `updateBuyerIdentity` creates the cart; `selectedVariant` stripped before
  sending; cookie `cart=<id without gid prefix>`, HttpOnly, SameSite=Lax,
  Secure over https (shoppers keep their carts across the switch; the mock
  already resolves every cart root field). Local `CartForm` keeping the
  `cartFormInput` JSON field, `ACTIONS` names and `getFormInput` merging
  (h:1606-1670) so cart-action.test.ts and security.spec.ts keep passing.
  Port `useOptimisticCart` (~85 lines on `useFetchers`) with local
  `OptimisticCart*` types.
- **C2 hydrogen-react `CartProvider`/`useCart`:** loses the HttpOnly cookie,
  no-JS forms, the action's 400 validation, the server-rendered cart and the
  mock; `cart.$lines`/`discount.$code` still need a server path.
- **Decision: C1.**

### ADR-D: customer accounts

- **D1 port Hydrogen's `createCustomerAccountClient`** (MIT, h:3413-4236):
  PKCE S256, state/nonce checks, token refresh 2 min early under a lock, 401
  clears the session, sign-out with `id_token_hint`, `getBuyer` for the
  cart, `logged_in=true` on `checkoutUrl`; same interface so the 10 account
  routes stay untouched; dev needs an HTTPS tunnel with hand-registered
  callback URLs. Size L.
- **D2 defer:** stub `customerAccount` (`isLoggedIn` false, everything else
  follows the existing 503 `AccountUnavailable` path; routes already check
  `isCustomerAccountConfigured`). Nothing is lost today: accounts were never
  verified against a live store. Size S.
- **D3 link to Shopify's hosted account pages** (unverified) and drop the
  in-site account UI.
- **Decision: D2 in this migration; D1 later if accounts stay in scope.**

### ADR-E: analytics and consent

- **E1 small provider of our own (recommended):** load
  `consent-tracking-api/v0.2` (h:96) with the nonce via `useLoadScript`,
  headless config with `consentDomain` = our origin (needs the F5 proxy);
  send `PAGE_VIEW_2`, `PRODUCT_VIEW`, `COLLECTION_VIEW`, `SEARCH_VIEW`,
  `ADD_TO_CART` with `sendShopifyAnalytics` + `getClientBrowserParameters`
  tagged `hydrogen` or `headless` (the only events Hydrogen sends,
  h:341-345); `getShopAnalytics` becomes a local shop query; the
  `Analytics.*View` components become thin publishers with the same props;
  Header's `cart_viewed` publish is dropped (Shopify never consumes it).
- **E2 no analytics.**
- **Decision: E1, switched off until `PUBLIC_CHECKOUT_DOMAIN` and
  `PUBLIC_STOREFRONT_ID` are set** (missing configuration blocks analytics
  today anyway).

### ADR-F: SEO, CSP, sitemaps, redirects

- **CSP:** `app/lib/csp.server.ts` ports `createCSPHeader` (h:4446-4521):
  same defaults and merge rule (overrides add sources, `'none'` replaces),
  dev-only `localhost`/`ws:` sources gated on `import.meta.env.DEV`, nonce of
  at least 16 random bytes base64 per request; `app/lib/nonce.tsx` provides
  `NonceProvider`/`useNonce`. Reference tests: entry-server.test.ts and the
  CSP tests in security.spec.ts.
- **Sitemaps:** `app/lib/sitemap.server.ts` keeps the `getSitemapIndex` /
  `getSitemap` signatures and the exact `sitemap(type: X)` query with
  `{variables: {page}}`; the two routes only change imports.
- **Redirects:** `app/lib/storefront-redirect.server.ts`: `/admin` to the
  shop admin, then `urlRedirects(first:1, query:"path:…")`, then the
  existing `?redirect=` handling; client-side `.data` requests get 204 with
  `X-Remix-Redirect`/`X-Remix-Status` (h:5468-5545); `withSafeRedirectParams`
  stays.
- **server.ts:** add the F5 path/body rules and the Storefront API proxy
  with Hydrogen's forwarded-header allowlist and `Server-Timing:
_sfapi_proxy`; drop the `/api/mcp` proxy unless wanted.

### ADR-G: codegen

`codegen.ts` for the installed `@graphql-codegen/cli` using `preset` and
`pluckConfig` from `@shopify/graphql-codegen`; schema via
`require.resolve('@shopify/hydrogen-react/storefront.schema.json')` (and the
customer-account schema likewise); generated types `importTypes.from:
'@shopify/hydrogen-react/storefront-api-types'` with `interfaceExtension`
pointed at the client's own `StorefrontQueries`/`StorefrontMutations`; script
`codegen: graphql-codegen && react-router typegen`; `.graphqlrc.ts` stays for
editors only; the mock's schema import moves to hydrogen-react. Pin
`@shopify/hydrogen-react@2026.4.4` (Storefront API 2026-04) during the
migration; the cart mutations then get generated types too.

### ADR-H: test strategy

- **Unit tests to rewrite:** app/lib/context.test.ts (keep its cookie, 502
  and mock assertions as the contract for B and C);
  app/lib/**tests**/server.test.ts (mock react-router's
  `createRequestHandler` and the local redirect module; add proxy and
  path/body cases); app/lib/search.page.test.tsx (mocks
  `Analytics.SearchView`); content-routes and account-orders-link tests
  (their `Pagination`/`Money` mocks become unnecessary);
  storefront-errors.test.ts (type import only).
- **Kept unchanged as the reference:** entry-server.test.ts (under A1),
  cart-action, cart-permalink, redirects, sitemap-robots, policies and
  account tests (route-test-utils fakes); cart-action only changes where it
  imports `CartForm` from.
- **New unit tests:** client (i18n injection, errors,
  stale-while-revalidate), cart service, CSP builder, pagination, optimistic
  cart, sitemap, redirect; keep the 80% threshold on app/lib.
- **End-to-end:** playwright.config.ts `webServer.command` becomes `vite dev
--port 3100` (keep `NODE_ENV=development`); tests/e2e/e2e.env content
  moves to `.dev.vars.e2e` selected with `CLOUDFLARE_ENV=e2e` (verify how
  the plugin picks env files); `dev:e2e` script updated; global-setup
  preflight wording updated and the Hydrogen-specific "private access
  token" check dropped; the `MOCK_SHOP_WARNING` allowlist entry removed
  (also a Hydrogen message); README updated; run smoke + security after
  every phase.
- **Mock:** only type and schema imports change (install.server.ts,
  schema.server.ts) plus wording in its README and flag.ts.

## 3. Phasing

| #   | Size            | Change (files)                                                                                                                                                                                                                                                                                                | Verification                                                     |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 0   | S               | Add `@shopify/hydrogen-react@2026.4.4` (npm dedupes to one copy). Switch `Image`, `Money`, `flattenConnection`, product-option helpers, API types and the schema import (~25 files; behaviour-neutral per F2).                                                                                                | typecheck, unit, e2e                                             |
| 1   | M               | Platform swap: vite.config.ts (`cloudflare()` + `reactRouter()`), explicit react-router.config.ts (F7), routes.ts, wrangler.jsonc, env.d.ts, tsconfig.json, package scripts, e2e config files. Hydrogen stays installed as a plain library (F4).                                                              | build, typecheck, full e2e on the new dev server                 |
| 2   | M               | Client, context and codegen: app/lib/storefront/*; own `RouterContextProvider` in context.ts; Hydrogen's `createCartHandler` and `createCustomerAccountClient` temporarily run on the new client; server.ts with React Router's handler, path/body rules and proxy; codegen.ts; storefront-errors.ts.         | context and server unit tests, e2e                               |
| 3   | M               | Cart: app/lib/cart/*, `CartForm`, `useOptimisticCart`; cart.tsx, CartMain, CartLineItem, CartSummary, AddToCartButton, Header, dev.mock-checkout.tsx.                                                                                                                                                         | cart unit tests, e2e cart and security                           |
| 4   | M/L             | CSP and nonce (entry.server.tsx, entry.client.tsx, root.tsx, products.$handle.tsx); Pagination and variables (7 routes, PaginatedResourceSection); `useOptimisticVariant`; sitemaps; redirect; analytics (E1, incl. Header).                                                                                  | entry-server, sitemap, redirect unit tests; e2e seo and security |
| 5   | S (D2) / L (D1) | app/lib/customer-account/*; routes unchanged.                                                                                                                                                                                                                                                                 | account unit tests, e2e `/account*`                              |
| 6   | S               | Remove `@shopify/hydrogen`, `@shopify/cli`, `@shopify/mini-oxygen`, `@shopify/hydrogen-codegen`, `@shopify/oxygen-workers-types`; update docs (implementation report, shopify-setup, mock README, AccountUnavailable dev steps; AGENTS.md needs owner sign-off); `grep "@shopify/hydrogen'"` returns nothing. | `npm test`, build, preview deploy                                |

## 4. Risks, losses and open decisions

**What Hydrogen gave for free that degrades or must be replaced:** Oxygen's
tiered edge cache, managed hosting and preview environments (replaced by
per-data-centre caching and our own wrangler/CI setup); the dev-only GraphiQL
and subrequest-profiler routes and Hydrogen's `storefront.query` error
formatting (we log operation name and request id); cache strategies become
our code (risk: stale personal data; guard: queries only, `CacheNone` for the
cart); optimistic variant/cart helpers and `Pagination` become ~400 ported
lines we maintain; `hydrogen link`/`env pull`, Oxygen env sync and the
customer-account tunnel go away, as do PerfKit, cart-change events and the
third-party `useAnalytics` bus; CSP, cookie flags, redirect safety and the
proxy must match today's behaviour, so the security spec gates every phase
(the proxy relays requests with public-token scope only); a production build
can only be fully checked against a linked store because the mock is
dev-only.

**Decisions still needed from the owner:**

1. **Deployment target** (recommended: Cloudflare Workers; determines Phase 1
   and the cache design).
2. **Customer accounts:** defer (D2), implement (D1) or hosted pages (D3).
3. **Channel and tokens:** keep the Hydrogen sales channel (existing public
   token, storefront ID, customer-account client) or move to the Headless
   channel; whether to issue a `PRIVATE_STOREFRONT_API_TOKEN`.
4. **Analytics:** E1 now or later.
5. **React Router upgrade:** once Hydrogen's `~7.16` peer range no longer
   applies, moving to 7.18+ removes the path-segment guard in server.ts and
   the known 7.16 advisories.

Sizes per phase: S, M, M, M, M/L, S or L, S.
