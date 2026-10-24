# Implementation Plan: Removing Shopify Hydrogen from the Mellow storefront

Repository root: /home/user/Noodlez (branch claude/relaxed-archimedes-qm7h5e). Architecture source: docs/hydrogen-removal-architecture.md (ADR-A..H, owner decisions in section 5). All paths below are absolute. Everything here comes from reading the files, the e2e specs and the installed Hydrogen 2026.4.7 / React Router 7.16.0 sources in node_modules. I did not run any commands. Anything that needs a command to confirm is listed under "Unverified assumptions".

## Overview

Hydrogen is replaced in ten mergeable increments: 0, 1, 2, 3, 4a, 4b, 4c, 5, 6 and 7. The order is:

- Phase 0: switch imports to `@shopify/hydrogen-react` where Hydrogen only re-exports it. No behaviour changes.
- Phase 1: move the dev, e2e and build pipeline to Cloudflare Workers (`@cloudflare/vite-plugin`). Hydrogen stays installed as a plain library.
- Phases 2 to 5: replace the Hydrogen runtime helpers one at a time:
  - Phase 2: our own Storefront client with a Cache API layer, plus the context and server changes.
  - Phase 3: the cart.
  - Phase 4a: CSP and nonce, sitemaps, redirects.
  - Phase 4b: pagination and variants.
  - Phase 4c: analytics and consent.
  - Phase 5: the customer-account stub.
- Phase 6: uninstall the Hydrogen packages and update the docs.
- Phase 7: upgrade React Router to 7.18+ and remove the path-segment guard.

At the end of every increment, all of these must work: `npm run dev:e2e`, the unit suite at 80% coverage, the full Playwright suite, and `npm run build`.

## Requirements

- **Runtime (ADR-A1):** Cloudflare Workers. `server.ts` stays a module worker. Dev and e2e run the worker in workerd through `@cloudflare/vite-plugin` with `future.v8_viteEnvironmentApi: true`.
- **Storefront API (ADR-B1):**
  - Own client in `app/lib/storefront`, using hydrogen-react's `createStorefrontClient` for URLs and headers.
  - Cache API layer.
  - Uses the Hydrogen sales channel's public token. `PRIVATE_STOREFRONT_API_TOKEN` is supported but optional.
- **Cart (ADR-C1):** server-side service, a local `CartForm` and a local `useOptimisticCart`. Cookie format unchanged, so shoppers keep their carts.
- **Customer accounts (ADR-D2):** a stub behind the existing 503 "not configured" page. Routes stay unchanged.
- **Analytics and consent (ADR-E1):**
  - Rebuilt with hydrogen-react helpers.
  - Active only when `PUBLIC_CHECKOUT_DOMAIN` and `PUBLIC_STOREFRONT_ID` are set and the mock is off.
- **Codegen (ADR-G):** our own `codegen.ts` on `@shopify/graphql-codegen`, using hydrogen-react's schema and types.
- **React Router:** 7.18+ only after Hydrogen is uninstalled. Hydrogen's peer range is `react-router ~7.16.0` (see `node_modules/@shopify/hydrogen/package.json`). The segment guard goes at the same time.
- **Contract:** the "Behaviour that must not change" list holds at every phase, except the items listed under "Intended behaviour changes".

## Decisions this plan adds to the ADR (with reasons)

| #    | Decision                                                                                                                                                                                                                          | Reason                                                                                                                                                           |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1  | `codegen.ts` arrives in Phase 1 and reproduces today's `shopify hydrogen codegen` output exactly. Phase 2 points the storefront project at hydrogen-react and our own interfaces. Phase 5 does the same for the customer project. | Phase 1 removes the Hydrogen CLI from the `dev` and `build` scripts. A byte-identical regeneration (`git diff --exit-code`) is a free regression check.          |
| D-2  | The CSP nonce stays at 16 random bytes encoded as lowercase hex (32 characters), not base64.                                                                                                                                      | `entry-server.test.ts` matches `/^'nonce-[\w-]+'$/`, which base64 (`+`, `/`, `=`) would break. Hex is also what Hydrogen's `generateNonce` produces.             |
| D-3  | The context is built with `Object.assign(new RouterContextProvider(), services)`. Hydrogen's Proxy is not ported.                                                                                                                 | No code calls `context.get()` for these services (grep shows only a comment). React Router only needs `instanceof RouterContextProvider` while middleware is on. |
| D-4  | Phase 4 is split into 4a, 4b and 4c, each mergeable on its own.                                                                                                                                                                   | This is the largest phase. The nonce switch must land together with every `useNonce` call site.                                                                  |
| D-5  | Header's analytics publish (`useAnalytics`, `cart_viewed`) is dropped in Phase 3.                                                                                                                                                 | Header is touched only once. ADR-E already drops `cart_viewed`.                                                                                                  |
| D-6  | The e2e "private access token" check and the `MOCK_SHOP_WARNING` allowlist entry are removed in Phase 4c, not Phase 1.                                                                                                            | Both come from Hydrogen's `Analytics.Provider` and `useCustomerPrivacy`, which run until 4c.                                                                     |
| D-7  | The AccountUnavailable developer steps and their e2e assertion change in Phase 5.                                                                                                                                                 | Once the stub is in place, the Hydrogen CLI steps are no longer true.                                                                                            |
| D-8  | In Phase 2 only, the cart's `updateDiscountCodes` is replaced with a mutation that does not use `@defer`.                                                                                                                         | Hydrogen's `cartDiscountCodesUpdate` uses `@defer` and needs Hydrogen's streaming client. Our client handles plain JSON only.                                    |
| D-9  | Shopify cookies and visitor tokens are forwarded to the Storefront API, and its `Set-Cookie` headers are copied back, only when analytics is enabled.                                                                             | Privacy. Hydrogen always did this.                                                                                                                               |
| D-10 | The session cookie is added with `headers.append`, not `set` (optional, called out for security review).                                                                                                                          | Today's `set` can overwrite a cart `Set-Cookie` header in the same response. This is a latent bug fix.                                                           |

## Phase map and sequencing

| Phase | Size | Content                                                                 | Requires         | May be developed in parallel with |
| ----- | ---- | ----------------------------------------------------------------------- | ---------------- | --------------------------------- |
| 0     | S    | hydrogen-react imports, types, schema                                   | none             | none                              |
| 1     | M    | Cloudflare platform swap, Hydrogen-compatible `codegen.ts`, e2e tooling | 0                | none                              |
| 2     | M    | Storefront client and cache, own context, `server.ts`, codegen flip     | 1                | none                              |
| 3     | M    | Cart service, `CartForm`, optimistic cart                               | 2                | 4a, 4b                            |
| 4a    | S/M  | CSP and nonce, sitemaps, Storefront redirect                            | 2                | 3, 4b                             |
| 4b    | M    | Pagination, `getPaginationVariables`, optimistic variant                | 0                | 3, 4a                             |
| 4c    | M    | Analytics and consent, tracking cookies, e2e allowlist                  | 3, 4a, 4b        | 5 (rebase onto 4c)                |
| 5     | S    | Customer-account stub (D2)                                              | 3                | 4c                                |
| 6     | S    | Uninstall Hydrogen packages, docs                                       | 3, 4a, 4b, 4c, 5 | none                              |
| 7     | S    | React Router 7.18+, guard removal                                       | 6                | none                              |

Merge order is the table order. Some files are shared across phases and only conflict on import lines:

- `app/root.tsx`: 4a, 4c
- `app/routes/products.$handle.tsx`: 0, 4a, 4b, 4c
- `app/lib/context.ts`: 2, 3, 4c, 5

The later branch rebases onto the earlier one.

## Architecture changes

**New:**

- wrangler.jsonc
- codegen.ts
- .dev.vars.e2e (committed placeholders)
- .dev.vars.example (git mv from .env.example)
- public/_headers (optional)
- Storefront:
  - app/lib/storefront/types.ts
  - app/lib/storefront/graphql.ts
  - app/lib/storefront/cache.server.ts
  - app/lib/storefront/client.server.ts
  - app/lib/storefront/hydrogen-compat.ts (types only; Phase 2, deleted in 4c)
- Cart:
  - app/lib/cart/types.ts
  - app/lib/cart/cookie.ts
  - app/lib/cart/queries.ts
  - app/lib/cart/cart.server.ts
  - app/lib/cart/form-input.ts
  - app/lib/cart/CartForm.tsx
  - app/lib/cart/optimistic.ts
  - app/lib/cart/useOptimisticCart.ts
- CSP, sitemaps, redirects, pagination:
  - app/lib/csp.server.ts
  - app/lib/nonce.tsx
  - app/lib/sitemap.server.ts
  - app/lib/storefront-redirect.server.ts
  - app/lib/pagination-variables.ts
  - app/lib/pagination.tsx
- Analytics:
  - app/lib/analytics/config.ts
  - app/lib/analytics/shop.server.ts
  - app/lib/analytics/events.ts
  - app/lib/analytics/consent.tsx
  - app/lib/analytics/provider.tsx
  - app/lib/analytics/index.ts
- Customer accounts:
  - app/lib/customer-account/types.ts
  - app/lib/customer-account/stub.server.ts
- A unit test next to every new `.ts` module.

**Removed:**

- tests/e2e/e2e.env (Phase 1)
- `hydrogenRoutes` in `app/routes.ts`, along with the dev-only GraphiQL and subrequest-profiler routes (Phase 1)
- The Hydrogen packages (Phase 6)
- The segment guard in `server.ts` (Phase 7)

**Rule for every implementer:**

- Client-reachable modules (routes, components, `storefront-errors.ts`, `cart/types.ts`) may only use `import type` from `*.server.ts` files.
- Shared types live in non-`.server` files: `storefront/types.ts`, `cart/types.ts`, `customer-account/types.ts`.
- Pure logic goes in `.ts` files, because coverage only includes `app/lib/**/*.ts`. Components and hooks stay thin.

## Import inventory (exact, multi-line imports included)

| File                                                                                                                                                                                                                                                                                  | Hydrogen import today                                                                                                                                                                                                                                                    | Target                                                                                                                                   | Phase         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| app/root.tsx                                                                                                                                                                                                                                                                          | `Analytics, getShopAnalytics, useNonce`                                                                                                                                                                                                                                  | compat cast (2); `useNonce` from `~/lib/nonce` (4a); `Analytics` from `~/lib/analytics` and `getAnalyticsConfig` (4c)                    | 2, 4a, 4c     |
| app/entry.server.tsx                                                                                                                                                                                                                                                                  | `createContentSecurityPolicy, type HydrogenRouterContextProvider`                                                                                                                                                                                                        | `AppRouterContext` (2); `~/lib/csp.server` and `~/lib/nonce` (4a)                                                                        | 2, 4a         |
| app/entry.client.tsx                                                                                                                                                                                                                                                                  | `NonceProvider`                                                                                                                                                                                                                                                          | `~/lib/nonce`                                                                                                                            | 4a            |
| app/routes.ts                                                                                                                                                                                                                                                                         | `hydrogenRoutes`                                                                                                                                                                                                                                                         | removed                                                                                                                                  | 1             |
| server.ts                                                                                                                                                                                                                                                                             | `createRequestHandler, storefrontRedirect`                                                                                                                                                                                                                               | `react-router` (2); `~/lib/storefront-redirect.server` (4a)                                                                              | 2, 4a         |
| app/lib/context.ts                                                                                                                                                                                                                                                                    | `cartSetIdDefault, createHydrogenContext`                                                                                                                                                                                                                                | own builder (2), cart service (3), stub (5)                                                                                              | 2, 3, 5       |
| app/lib/session.ts                                                                                                                                                                                                                                                                    | `type HydrogenSession`                                                                                                                                                                                                                                                   | dropped                                                                                                                                  | 2             |
| app/lib/storefront-errors.ts and its .test.ts                                                                                                                                                                                                                                         | `type Storefront`                                                                                                                                                                                                                                                        | `~/lib/storefront/client.server`                                                                                                         | 2             |
| app/lib/mock/install.server.ts                                                                                                                                                                                                                                                        | `type Storefront`                                                                                                                                                                                                                                                        | ours                                                                                                                                     | 2             |
| app/lib/mock/schema.server.ts                                                                                                                                                                                                                                                         | `@shopify/hydrogen/storefront.schema.json`                                                                                                                                                                                                                               | `@shopify/hydrogen-react/storefront.schema.json`                                                                                         | 0             |
| app/lib/variants.ts                                                                                                                                                                                                                                                                   | `SelectedOption` (storefront-api-types)                                                                                                                                                                                                                                  | hydrogen-react types; new exports in 4b                                                                                                  | 0             |
| app/lib/collectionFilters.ts                                                                                                                                                                                                                                                          | `ProductCollectionSortKeys, ProductFilter, ProductSortKeys`                                                                                                                                                                                                              | hydrogen-react types                                                                                                                     | 0             |
| app/routes/cart.tsx                                                                                                                                                                                                                                                                   | `type CartQueryDataReturn`; `CartBuyerIdentityInput, CartLineInput, CartLineUpdateInput` (types); `CartForm, useOptimisticCart`                                                                                                                                          | hydrogen-react types (0); `~/lib/cart/*` (3)                                                                                             | 0, 3          |
| app/routes/dev.mock-checkout.tsx                                                                                                                                                                                                                                                      | `CartForm, Money`                                                                                                                                                                                                                                                        | `Money` from hydrogen-react (0); `CartForm` local (3)                                                                                    | 0, 3          |
| app/routes/collections._index.tsx                                                                                                                                                                                                                                                     | `getPaginationVariables`                                                                                                                                                                                                                                                 | `~/lib/pagination`                                                                                                                       | 4b            |
| app/routes/collections.all.tsx                                                                                                                                                                                                                                                        | `getPaginationVariables`                                                                                                                                                                                                                                                 | `~/lib/pagination`                                                                                                                       | 4b            |
| app/routes/collections.$handle.tsx                                                                                                                                                                                                                                                    | `Analytics, getPaginationVariables`                                                                                                                                                                                                                                      | 4b, then 4c                                                                                                                              | 4b, 4c        |
| app/routes/search.tsx                                                                                                                                                                                                                                                                 | `getPaginationVariables, Analytics`                                                                                                                                                                                                                                      | 4b, then 4c                                                                                                                              | 4b, 4c        |
| app/routes/blogs._index.tsx                                                                                                                                                                                                                                                           | `Pagination, getPaginationVariables`                                                                                                                                                                                                                                     | `~/lib/pagination`                                                                                                                       | 4b            |
| app/routes/blogs.$blogHandle._index.tsx                                                                                                                                                                                                                                               | `Image, Pagination, getPaginationVariables`                                                                                                                                                                                                                              | `Image` (0); rest (4b)                                                                                                                   | 0, 4b         |
| app/routes/blogs.$blogHandle.$articleHandle.tsx                                                                                                                                                                                                                                       | `Image`                                                                                                                                                                                                                                                                  | hydrogen-react                                                                                                                           | 0             |
| app/routes/account.orders.$id.tsx                                                                                                                                                                                                                                                     | `Money, Image`                                                                                                                                                                                                                                                           | hydrogen-react                                                                                                                           | 0             |
| app/routes/account.orders._index.tsx                                                                                                                                                                                                                                                  | `Money, Pagination, getPaginationVariables, flattenConnection`                                                                                                                                                                                                           | `Money, flattenConnection` (0); rest (4b)                                                                                                | 0, 4b         |
| app/routes/account.profile.tsx                                                                                                                                                                                                                                                        | `CustomerUpdateInput` (customer-account-api-types)                                                                                                                                                                                                                       | hydrogen-react                                                                                                                           | 0             |
| app/routes/account.addresses.tsx                                                                                                                                                                                                                                                      | `CustomerAddressInput`                                                                                                                                                                                                                                                   | hydrogen-react                                                                                                                           | 0             |
| app/routes/products.$handle.tsx                                                                                                                                                                                                                                                       | `getSelectedProductOptions, Analytics, useOptimisticVariant, getProductOptions, getAdjacentAndFirstAvailableVariants, useSelectedOptionInUrlParam, useNonce`                                                                                                             | option helpers (0); `useNonce` (4a); `getSelectedProductOptions` and `useOptimisticVariant` from `~/lib/variants` (4b); `Analytics` (4c) | 0, 4a, 4b, 4c |
| app/routes/[sitemap.xml].tsx                                                                                                                                                                                                                                                          | `getSitemapIndex`                                                                                                                                                                                                                                                        | compat cast (2); `~/lib/sitemap.server` (4a)                                                                                             | 2, 4a         |
| app/routes/sitemap.$type.$page[.xml].tsx                                                                                                                                                                                                                                              | `getSitemap`                                                                                                                                                                                                                                                             | same                                                                                                                                     | 2, 4a         |
| app/components/CartMain.tsx                                                                                                                                                                                                                                                           | `useOptimisticCart`                                                                                                                                                                                                                                                      | local                                                                                                                                    | 3             |
| app/components/CartLineItem.tsx                                                                                                                                                                                                                                                       | `CartLineUpdateInput` (type); `CartForm, Image, Money, type OptimisticCartLine`                                                                                                                                                                                          | `Image, Money` and the type (0); rest (3)                                                                                                | 0, 3          |
| app/components/CartSummary.tsx                                                                                                                                                                                                                                                        | `MoneyV2` (type); `CartForm, Money, type OptimisticCart`                                                                                                                                                                                                                 | `Money` and the type (0); rest (3)                                                                                                       | 0, 3          |
| app/components/AddToCartButton.tsx                                                                                                                                                                                                                                                    | `CartForm, type OptimisticCartLineInput`                                                                                                                                                                                                                                 | local                                                                                                                                    | 3             |
| app/components/Header.tsx                                                                                                                                                                                                                                                             | `type CartViewPayload, useAnalytics, useOptimisticCart`                                                                                                                                                                                                                  | publish dropped; local hook                                                                                                              | 3             |
| app/components/PaginatedResourceSection.tsx                                                                                                                                                                                                                                           | `Pagination`                                                                                                                                                                                                                                                             | `~/lib/pagination`                                                                                                                       | 4b            |
| app/components/ProductForm.tsx                                                                                                                                                                                                                                                        | `type MappedProductOptions`                                                                                                                                                                                                                                              | hydrogen-react                                                                                                                           | 0             |
| app/components/product/VariantSelector.tsx                                                                                                                                                                                                                                            | `type MappedProductOptions`; `Maybe, ProductOptionValueSwatch`                                                                                                                                                                                                           | hydrogen-react                                                                                                                           | 0             |
| app/components/ProductPrice.tsx                                                                                                                                                                                                                                                       | `MoneyV2`                                                                                                                                                                                                                                                                | hydrogen-react                                                                                                                           | 0             |
| app/components/ui/Price.tsx                                                                                                                                                                                                                                                           | `Money`; `MoneyV2`                                                                                                                                                                                                                                                       | hydrogen-react                                                                                                                           | 0             |
| app/components/ProductImage.tsx, app/components/ProductCard.tsx, app/components/SearchResultsPredictive.tsx, app/components/ContentImage.tsx, app/components/product/ProductGallery.tsx, app/components/collection/CollectionCard.tsx, app/components/collection/CollectionHeader.tsx | `Image`                                                                                                                                                                                                                                                                  | hydrogen-react                                                                                                                           | 0             |
| app/lib/search.page.test.tsx                                                                                                                                                                                                                                                          | `vi.mock('@shopify/hydrogen')` (Analytics.SearchView)                                                                                                                                                                                                                    | mock `~/lib/analytics`                                                                                                                   | 4c            |
| app/lib/**tests**/content-routes.test.ts                                                                                                                                                                                                                                              | `vi.mock('@shopify/hydrogen')` (Pagination)                                                                                                                                                                                                                              | mock deleted                                                                                                                             | 4b            |
| app/lib/**tests**/account-orders-link.test.ts                                                                                                                                                                                                                                         | `vi.mock('@shopify/hydrogen')` (Pagination, Money)                                                                                                                                                                                                                       | `Money` stub deleted (0); `Pagination` stub deleted (4b)                                                                                 | 0, 4b         |
| app/lib/**tests**/server.test.ts                                                                                                                                                                                                                                                      | `vi.mock('@shopify/hydrogen')`                                                                                                                                                                                                                                           | mock `react-router` handler (2); redirect module (4a)                                                                                    | 2, 4a         |
| Config                                                                                                                                                                                                                                                                                | `vite.config.ts` (`hydrogen()`, `@shopify/mini-oxygen/vite`), `react-router.config.ts` (`hydrogenPreset`), `env.d.ts` and `tsconfig.json` (oxygen types; `@shopify/hydrogen/react-router-types`), `.graphqlrc.ts` (`@shopify/hydrogen-codegen`), both `*.generated.d.ts` | see phases                                                                                                                               | 1, 2, 5, 6    |

## Public interfaces (contracts for parallel implementers)

### Cloudflare config and env typing

```jsonc
// wrangler.jsonc (Phase 1)
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "mellow-storefront",
  "main": "./server.ts",
  "compatibility_date": "YYYY-MM-DD", // set at implementation: newest date the installed workerd supports
  "observability": {"enabled": true},
  "upload_source_maps": true,
  "keep_vars": true,
  // Production needs a custom domain (Cache API is inactive on *.workers.dev):
  // "workers_dev": false, "routes": [{"pattern": "<shop host>", "custom_domain": true}],
  "env": {
    // Selected by CLOUDFLARE_ENV=e2e (Playwright, npm run dev:e2e); values in .dev.vars.e2e; never deployed.
    "e2e": {},
  },
}
```

Add no `compatibility_flags` unless the build reports a missing `node:` module. app/ uses no Node APIs (grep found `Buffer`, `process.env` and `node:` nowhere). `server.ts` currently uses `process.env.NODE_ENV`; Phase 1 removes that.

```ts
// env.d.ts (Phase 1: swap the workers types; Phase 2: final)
/// <reference types="vite/client" />
/// <reference types="react-router" />
/// <reference types="@cloudflare/workers-types" />
import '@total-typescript/ts-reset';
declare global {
  interface Env {
    SESSION_SECRET: string;
    PUBLIC_STORE_DOMAIN: string;
    PUBLIC_STOREFRONT_API_TOKEN: string;
    PRIVATE_STOREFRONT_API_TOKEN?: string; // server-only, not configured yet (decision 4)
    PUBLIC_STOREFRONT_ID?: string;
    PUBLIC_CHECKOUT_DOMAIN?: string;
    PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID?: string;
    PUBLIC_CUSTOMER_ACCOUNT_API_URL?: string;
    SHOP_ID?: string;
    MOCK_STOREFRONT?: string;
    NEWSLETTER_WEBHOOK_URL?: string;
  }
}
```

The `Env` rewrite must land in the same commit that removes `@shopify/hydrogen/react-router-types` (Phase 2). That file declares `interface Env extends HydrogenEnv` with every variable required, and merging optional properties into it fails to compile.

In `tsconfig.json`, `types` becomes `["@cloudflare/workers-types", "react-router", "vite/client"]`. The Hydrogen entry is removed in Phase 2.

### Build config

```ts
// vite.config.ts (Phase 1)
plugins: [cloudflare({viteEnvironment: {name: 'ssr'}}), reactRouter()],
// keep resolve.alias '~', resolve.tsconfigPaths, build.assetsInlineLimit: 0, ssr.optimizeDeps.include
// drop hydrogen(), oxygen(), server.allowedHosts ['.tryhydrogen.dev']

// react-router.config.ts (Phase 1; explicit copy of hydrogenPreset plus the environment API)
export default {
  appDirectory: 'app', buildDirectory: 'dist', ssr: true, subResourceIntegrity: false,
  future: {v8_middleware: true, v8_splitRouteModules: true, v8_viteEnvironmentApi: true, unstable_optimizeDeps: true},
} satisfies Config;

// app/routes.ts (Phase 1)
export default flatRoutes() satisfies RouteConfig;
```

The preset at `node_modules/@shopify/hydrogen/dist/development/react-router-preset.js` also sets `unstable_optimizeDeps`. F7 does not mention it.

### codegen.ts

- **Phase 1:**
  - Default export: `{overwrite: true, pluckConfig, generates, hooks: {afterOneFileWrite: ['prettier --write']}}`, using `preset` and `pluckConfig` from `@shopify/graphql-codegen`.
  - Schema from `createRequire(import.meta.url).resolve('@shopify/hydrogen/<api>.schema.json')`.
  - `importTypes.from` set to `@shopify/hydrogen/<api>-api-types`.
  - `interfaceExtension` emitting `declare module '@shopify/hydrogen' { interface StorefrontQueries ... }`. The customer project does the same with `CustomerAccountQueries`/`CustomerAccountMutations`.
- **Phase 2 (storefront project):**
  - Schema `@shopify/hydrogen-react/storefront.schema.json`.
  - Types from `@shopify/hydrogen-react/storefront-api-types`.
  - `interfaceExtension` emits `declare global { interface StorefrontQueries extends <q> {} interface StorefrontMutations extends <m> {} }`.
  - The customer project switches `importTypes` to `@shopify/hydrogen-react/customer-account-api-types` and keeps the Hydrogen module extension.
- **Phase 5 (customer project):** `declare global { interface CustomerAccountQueries ... CustomerAccountMutations ... }`.
- **Exported constants:** `STOREFRONT_DOCUMENTS = ['./*.{ts,tsx,js,jsx}', './app/**/*.{ts,tsx,js,jsx}', '!./app/graphql/**/*.{ts,tsx,js,jsx}']` and `CUSTOMER_ACCOUNT_DOCUMENTS = ['./app/graphql/customer-account/*.{ts,tsx,js,jsx}']`, both copied from the current `.graphqlrc.ts`. `.graphqlrc.ts` imports them in Phase 2.
- **Script:** `"codegen": "graphql-codegen && react-router typegen"`. @graphql-codegen/cli 5.0.2 loads `codegen.ts` through jiti, as seen in `esm/config.js`.

### Storefront client and cache (Phase 2)

```ts
// app/lib/storefront/types.ts (client-safe)
export type I18n = {language: LanguageCode; country: CountryCode}; // from @shopify/hydrogen-react/storefront-api-types
export type StorefrontApiError = {
  message: string;
  extensions?: {code?: string} & Record<string, unknown>;
  path?: ReadonlyArray<string | number>;
  locations?: ReadonlyArray<{line: number; column: number}>;
};
export type StorefrontErrors = {errors?: StorefrontApiError[]};

// app/lib/storefront/graphql.ts (pure)
export function minifyQuery(document: string): string; // Hydrogen parity: strip `#…` to end of line, collapse whitespace
export function isQueryDocument(document: string): boolean; // /(^|}\s)query[\s({]/im
export function isMutationDocument(document: string): boolean; // /(^|}\s)mutation[\s({]/im
export function getOperationName(document: string): string; // 'anonymous' when unnamed
export function parseJson<T = unknown>(text: string): T; // reviver drops "__proto__" keys

// app/lib/storefront/cache.server.ts
export interface CacheStrategy {
  mode?: 'public' | 'private' | 'no-store';
  maxAge?: number;
  staleWhileRevalidate?: number;
  sMaxAge?: number;
  staleIfError?: number;
}
export type ExpirableCacheOverrides = Omit<CacheStrategy, 'mode'> & {
  mode?: 'public' | 'private';
}; // other modes throw (parity)
export function CacheNone(): CacheStrategy; // {mode: 'no-store'}
export function CacheShort(o?: ExpirableCacheOverrides): CacheStrategy; // public, maxAge 1, swr 9
export function CacheLong(o?: ExpirableCacheOverrides): CacheStrategy; // public, 3600, 82800
export function CacheDefault(o?: ExpirableCacheOverrides): CacheStrategy; // public, 1, 86399 (queries without a hint)
export function CacheCustom(s: CacheStrategy): CacheStrategy;
export function generateCacheControlHeader(s: CacheStrategy): string; // "public, max-age=1, stale-while-revalidate=9"
export function isCacheable(s: CacheStrategy): boolean; // false for no-store and private
export function createCacheKey(
  origin: string,
  parts: readonly string[],
): Promise<Request>;
//   GET `${origin}/__storefront-cache/${sha256hex(parts.join('\n'))}`, parts = [apiUrl, accessToken, body]
export type CacheStatus = 'BYPASS' | 'MISS' | 'HIT' | 'STALE';
export interface WithCacheOptions<T> {
  cache: Cache | undefined;
  key: Request;
  strategy: CacheStrategy;
  waitUntil: (p: Promise<unknown>) => void;
  shouldCacheResult: (result: T) => boolean;
  now?: () => number;
}
export function withCache<T>(
  fetcher: () => Promise<T>,
  o: WithCacheOptions<T>,
): Promise<{result: T; status: CacheStatus}>;
```

Cache rules:

- **Storage format:** the JSON body plus `cache-control: public, max-age=<maxAge+swr>`, `x-storefront-cache-put-date` and `x-storefront-cache-max-age`. Headers from the Storefront API (Set-Cookie, Server-Timing) are never stored.
- **MISS:** fetch, then `waitUntil(put)` when `shouldCacheResult` passes.
- **HIT:** age ≤ maxAge.
- **STALE:** maxAge < age ≤ maxAge+swr. Return the cached value and revalidate once through `waitUntil`, guarded by a per-isolate `Set` lock. A failed revalidation is logged and never thrown.
- **Expired entry or unreadable body:** treated as a MISS.
- **Never cached:** results with `errors`, mutations, and `no-store` or `private` strategies.

```ts
// app/lib/storefront/client.server.ts
declare global {
  interface StorefrontQueries {}
  interface StorefrontMutations {}
} // augmented by storefrontapi.generated.d.ts
export const STOREFRONT_API_VERSION = '2026-04';
type Common = {
  headers?: HeadersInit;
  storefrontApiVersion?: string;
  displayName?: string;
};
export interface Storefront {
  query<OverrideReturnType = never, RawGqlString extends string = string>(
    query: RawGqlString,
    ...options: ClientVariablesInRestParams<
      StorefrontQueries,
      RawGqlString,
      Common & {cache?: CacheStrategy},
      'country' | 'language'
    >
  ): Promise<
    ClientReturn<StorefrontQueries, RawGqlString, OverrideReturnType> &
      StorefrontErrors
  >;
  mutate<OverrideReturnType = never, RawGqlString extends string = string>(
    mutation: RawGqlString,
    ...options: ClientVariablesInRestParams<
      StorefrontMutations,
      RawGqlString,
      Common,
      'country' | 'language'
    >
  ): Promise<
    ClientReturn<StorefrontMutations, RawGqlString, OverrideReturnType> &
      StorefrontErrors
  >;
  readonly i18n: I18n;
  readonly CacheNone: typeof CacheNone;
  readonly CacheShort: typeof CacheShort;
  readonly CacheLong: typeof CacheLong;
  readonly CacheCustom: typeof CacheCustom;
  getShopifyDomain(): string; // https://<PUBLIC_STORE_DOMAIN>
  getApiUrl(o?: {storefrontApiVersion?: string}): string;
  getPublicTokenHeaders(): Record<string, string>;
  isStorefrontApiUrl(request: Request): boolean; // /^\/api\/(unstable|2\d{3}-\d{2})\/graphql\.json$/
  forward(request: Request): Promise<Response>; // same-origin Storefront API proxy
  setCollectedSubrequestHeaders(response: Response): void; // no-op until 4c
}
export interface CreateStorefrontClientOptions {
  storeDomain: string;
  publicStorefrontToken: string;
  privateStorefrontToken?: string;
  storefrontId?: string;
  storefrontApiVersion?: string;
  i18n: I18n;
  request: Request;
  cache?: Cache;
  waitUntil: (p: Promise<unknown>) => void;
  trackingEnabled?: boolean; /* 4c */
}
export function createStorefrontClient(
  o: CreateStorefrontClientOptions,
): Storefront;
export class StorefrontApiHttpError extends Error {
  readonly status: number;
  readonly requestId: string | null;
  readonly operationName: string;
}
export type {I18n, StorefrontApiError, StorefrontErrors} from './types';
```

Client behaviour (ported from h:1838-2219):

- **Shape:** a plain object with own, writable `query` and `mutate`, so the mock and the guard can reassign them. Internals never call `this.query`.
- **Fetch:** always `globalThis.fetch(...)` looked up at call time, which keeps the `vi.stubGlobal` tests working.
- **Request:**
  - POST JSON to `getStorefrontApiUrl()`, with the document minified.
  - `$country` and `$language` are injected from `i18n` when the document declares them and the caller did not pass them.
- **Document checks:** `query` throws on a mutation document and `mutate` throws on a query document, both before any fetch.
- **Headers:**
  - Public token headers by default.
  - When `privateStorefrontToken` is set, use `getPrivateTokenHeaders({buyerIp: CF-Connecting-IP})`. `X-Shopify-Client-IP` is added when the buyer IP is known.
  - Always: `Shopify-Storefront-Id` (when set), `Custom-Storefront-Request-Group-ID` (`cf-ray` or `crypto.randomUUID()`), and `accept: application/json`.
- **Non-2xx:** log `[storefront] <Op> failed: HTTP <status> (request id <x-request-id>)` without variables or body, then throw `StorefrontApiHttpError`.
- **2xx:** return `{...data, errors}`, with the `errors` key present only when there are errors.
- **Logging GraphQL errors:**
  - Partial-data errors are logged redacted (count and codes; messages only in DEV).
  - Errors-only results are left to `guardStorefrontErrors`.
- **Caching:** queries use `withCache` with `options.cache ?? CacheDefault()` and `shouldCacheResult: body => !body.errors`. Mutations always bypass.
- **`forward()` (Hydrogen parity):**
  - Forwards only the allowlisted request headers: accept, accept-encoding, accept-language, access-control-request-headers, access-control-request-method, content-type, content-length, cookie, origin, referer, user-agent, Shopify-Storefront-Consent-Management, X-Shopify-Storefront-Access-Token, Shopify-Unique-Token, Shopify-Visit-Token.
  - Adds our IP, storefront id and group-id headers and `x-forwarded-for`.
  - Never adds a server token.
  - Takes the API version from the path, streams the body, and deletes `server-timing` from the response.
- **`trackingEnabled` (4c):**
  - Forward the request `cookie`.
  - Set `Shopify-Unique-Token`/`Shopify-Visit-Token` from `_shopify_y`/`_shopify_s`, or random UUIDs, when no `_shopify_analytics|_shopify_marketing` cookie exists.
  - Remember the first Storefront API response's `getSetCookie()` values; `setCollectedSubrequestHeaders` appends them.

### Context and server

```ts
// app/lib/context.ts
export interface AppContextServices {
  storefront: Storefront;
  cart: AppCart;
  customerAccount: AppCustomerAccount;
  env: Env;
  session: AppSession;
  waitUntil: (p: Promise<unknown>) => void;
}
// Phase 2: AppCart = ReturnType of the local createLegacyCart() (Hydrogen createCartHandler + updateDiscountCodes override),
//          AppCustomerAccount = import('@shopify/hydrogen').CustomerAccount
// Phase 3: AppCart = CartService.  Phase 5: AppCustomerAccount = CustomerAccount (stub)
export type AppRouterContext = RouterContextProvider & AppContextServices;
export function createAppRouterContext(
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
): Promise<AppRouterContext>;
declare module 'react-router' {
  interface RouterContextProvider extends AppContextServices {}
  interface AppLoadContext extends AppContextServices {}
}
```

`createAppRouterContext` steps, in order:

1. Throw if `SESSION_SECRET` is missing.
2. Bind `waitUntil` from `executionContext`.
3. `caches.open('storefront')` and `AppSession.init` in parallel.
4. Create the client with `i18n {language: 'EN', country: 'US'}`.
5. Create customerAccount, then the cart. The cart calls `storefront.query/mutate` at call time.
6. `if (import.meta.env.DEV && env.MOCK_STOREFRONT === 'true')`, run `installMockStorefront`.
7. `guardStorefrontErrors(storefront)`.
8. Return `Object.assign(new RouterContextProvider(), services)`.

```ts
// server.ts
export function withSafeRedirectParams(request: Request): Request;          // unchanged
export function rejectMalformedRequest(request: Request): Response | null;  // F5: 400 "<METHOD> requests cannot have a body" for GET/HEAD with body; 301 to pathname.replace(/\/+/g,'/') when the path contains '//'
export function ensureSecurityHeaders(response: Response): Response;        // unchanged logic, exported
export default {fetch(request, env, ctx): Promise<Response>} satisfies ExportedHandler<Env>;
```

Fetch flow:

1. Segment guard (until Phase 7).
2. `rejectMalformedRequest`.
3. Build the context.
4. If `isStorefrontApiUrl`, return `ensureSecurityHeaders(await storefront.forward(request))`.
5. `handleRequest(request, context)`, where `handleRequest = createRequestHandler(() => import('virtual:react-router/server-build'), import.meta.env.MODE)` is created at module scope.
6. One header-mutation helper with an immutable-copy fallback applies:
   - the session cookie (append),
   - `setCollectedSubrequestHeaders`,
   - `Server-Timing: _sfapi_proxy;desc=1` on document requests (`sec-fetch-dest: document` or `accept` containing `text/html`).
7. On 404, `storefrontRedirect({request: withSafeRedirectParams(request), response, storefront})`.
8. `ensureSecurityHeaders`.
9. Any error returns a plain 500, as today.

Not ported: the `powered-by` header and the `/api/mcp` proxy.

### Cart (Phase 3)

```ts
// app/lib/cart/types.ts (client-safe)
export type CartUserError = {
  message: string;
  field?: string[] | null;
  code?: string | null;
};
export type CartWarning = {code: string; message: string; target: string};
export type CartMutationCart = {
  id: string;
  totalQuantity: number;
  checkoutUrl: string;
};
export type CartQueryDataReturn<TCart = CartMutationCart> = {
  cart: TCart | null;
  userErrors?: CartUserError[];
  warnings?: CartWarning[];
  errors?: StorefrontApiError[];
};
export type CartReturn = CartApiQueryFragment & {errors?: StorefrontApiError[]};
export type OptimisticCartLineInput = CartLineInput & {
  selectedVariant?: unknown;
};
// OptimisticCartLine<T> / OptimisticCart<T>: exact ports of Hydrogen d.ts lines 2434-2456 with a local PartialDeep<T>

// app/lib/cart/cookie.ts (byte-compatible with worktop/cookie as Hydrogen uses it)
export const CART_COOKIE_NAME = 'cart';
export function readCartId(cookieHeader: string | null): string | undefined; // cart=c1-abc -> gid://shopify/Cart/c1-abc (decodeURIComponent on '%')
export function serializeCartIdCookie(
  cartId: string,
  o: {secure: boolean},
): string;
//   `cart=${encodeURIComponent(id.split('/').pop() ?? '')}; Path=/; SameSite=Lax[; Secure]; HttpOnly`

// app/lib/cart/queries.ts (all `#graphql` ... as const, so codegen types them)
export const CART_QUERY; // query CartQuery($cartId: ID!, $numCartLines: Int = 100, $country: CountryCode = ZZ, $language: LanguageCode) @inContext(...) { cart(id: $cartId) { ...CartApiQuery } } + CART_QUERY_FRAGMENT
export const CART_CREATE_MUTATION,
  CART_LINES_ADD_MUTATION,
  CART_LINES_UPDATE_MUTATION,
  CART_LINES_REMOVE_MUTATION,
  CART_DISCOUNT_CODES_UPDATE_MUTATION /* no @defer; created in Phase 2 */,
  CART_GIFT_CARD_CODES_ADD_MUTATION,
  CART_GIFT_CARD_CODES_REMOVE_MUTATION,
  CART_BUYER_IDENTITY_UPDATE_MUTATION;
// each selects cart { ...CartApiMutation } (id totalQuantity checkoutUrl) userErrors { message field code } warnings { code message target };
// fragment names CartApiMutation / CartApiError / CartApiWarning (no clash with Money, CartLine, CartLineComponent, CartApiQuery)

// app/lib/cart/cart.server.ts
export interface CartService {
  get(): Promise<CartReturn | null>;
  getCartId(): string | undefined;
  setCartId(cartId: string): Headers;
  create(input: CartInput): Promise<CartQueryDataReturn>;
  addLines(lines: OptimisticCartLineInput[]): Promise<CartQueryDataReturn>;
  updateLines(lines: CartLineUpdateInput[]): Promise<CartQueryDataReturn>;
  removeLines(lineIds: string[]): Promise<CartQueryDataReturn>;
  updateDiscountCodes(codes: string[]): Promise<CartQueryDataReturn>;
  addGiftCardCodes(codes: string[]): Promise<CartQueryDataReturn>;
  removeGiftCardCodes(
    appliedGiftCardIds: string[],
  ): Promise<CartQueryDataReturn>;
  updateBuyerIdentity(
    buyerIdentity: CartBuyerIdentityInput,
  ): Promise<CartQueryDataReturn>;
}
export function createCartService(o: {
  storefront: Pick<Storefront, 'query' | 'mutate' | 'CacheNone'>;
  customerAccount: {
    isLoggedIn(): Promise<boolean>;
    getBuyer(): Promise<Partial<CartBuyerIdentityInput> | undefined>;
  };
  requestHeaders: Headers;
  secureCookie: boolean;
}): CartService;
```

Cart service rules (Hydrogen parity, h:2236-3297):

- **`get()`:** null without a cookie. Otherwise `query(CART_QUERY, {variables: {cartId}, cache: CacheNone()})`. Add `logged_in=true` to `checkoutUrl` when logged in. Return `{...cart, errors}`, or null.
- **Cart creation:** `addLines`, `updateDiscountCodes` and `updateBuyerIdentity` call `create(...)` when there is no cart id. The new id is reused for the rest of the request.
- **`addLines`:** keeps only `attributes, quantity, merchandiseId, sellingPlanId, parent`, so `selectedVariant` is stripped.
- **`updateDiscountCodes`:** dedupes codes.
- **`updateLines`/`removeLines`:** throw on optimistic ids (prefix `__h_pending_`).
- **Buyer identity:** `create` and `updateBuyerIdentity` merge `getBuyer()`.
- **Call through the object:** never destructure `storefront`, so the mock and the guard apply.

```ts
// app/lib/cart/form-input.ts (pure)
export const CART_FORM_INPUT_NAME = 'cartFormInput';
export const CART_ACTIONS: {readonly LinesAdd: 'LinesAdd'; ... };    // all 18 Hydrogen names (h:1628-1647), as const
export function getFormInput(formData: FormData): {action: string | undefined; inputs: Record<string, unknown>};
//   repeated keys -> arrays; 'on'/'off' -> booleans; {...cartFormInput.inputs, ...otherFields}; invalid JSON throws (action maps to 400)

// app/lib/cart/CartForm.tsx
export type CartFormProps = {route?: string; fetcherKey?: string;
    children: React.ReactNode | ((fetcher: FetcherWithComponents<any>) => React.ReactNode)} & (
  | {action: 'LinesAdd'; inputs: {lines: OptimisticCartLineInput[]} & Record<string, unknown>}
  | {action: 'LinesUpdate'; inputs: {lines: CartLineUpdateInput[]} & Record<string, unknown>}
  | {action: 'LinesRemove'; inputs: {lineIds: string[]} & Record<string, unknown>}
  | {action: 'DiscountCodesUpdate'; inputs?: {discountCodes: string[]} & Record<string, unknown>}
  | {action: 'GiftCardCodesAdd'; inputs?: {giftCardCodes: string[]} & Record<string, unknown>}
  | {action: 'GiftCardCodesRemove'; inputs: {giftCardCodes: string[]} & Record<string, unknown>}
  | {action: 'BuyerIdentityUpdate'; inputs: {buyerIdentity: CartBuyerIdentityInput} & Record<string, unknown>});
export const CartForm: ((props: CartFormProps) => JSX.Element) &
  {ACTIONS: typeof CART_ACTIONS; INPUT_NAME: typeof CART_FORM_INPUT_NAME; getFormInput: typeof getFormInput};
//   renders <fetcher.Form action={route ?? ''} method="post"> with hidden input cartFormInput={JSON.stringify({action, inputs})} when action || inputs

// app/lib/cart/optimistic.ts (pure) and useOptimisticCart.ts
export const OPTIMISTIC_LINE_ID_PREFIX = '__h_pending_';
export function isOptimisticLineId(id: string): boolean;
export function applyOptimisticCartActions<T extends CartLike | null | undefined>(cart: T,
  fetchers: ReadonlyArray<{formData?: FormData | null}>): OptimisticCart<T>;  // returns `cart` when fetchers is empty; never mutates it
export function useOptimisticCart<T extends CartLike | null | undefined>(cart: T): OptimisticCart<T>; // = apply(cart, useFetchers())
```

### CSP, nonce, sitemaps, redirect (Phase 4a)

```ts
// app/lib/csp.server.ts
export type CspDirective =
  | 'defaultSrc'
  | 'scriptSrc'
  | 'styleSrc'
  | 'imgSrc'
  | 'fontSrc'
  | 'connectSrc'
  | 'mediaSrc'
  | 'frameSrc'
  | 'frameAncestors'
  | 'objectSrc'
  | 'formAction'
  | 'baseUri'
  | 'workerSrc'
  | 'manifestSrc';
export type CspOptions = Partial<Record<CspDirective, string | string[]>> & {
  shop?: {checkoutDomain?: string; storeDomain?: string};
};
export function generateNonce(): string; // 16 random bytes, lowercase hex (D-2)
export function buildCspHeader(
  nonce: string,
  o?: CspOptions,
  isDev = import.meta.env.DEV,
): string;
export function createContentSecurityPolicy(o?: CspOptions): {
  nonce: string;
  header: string;
};
```

CSP port of h:4446-4521:

- **Default directives, in this order:**
  - `baseUri ['self']`
  - `defaultSrc ['self', https://cdn.shopify.com, https://shopify.com]`
  - `frameAncestors ['none']`
  - `styleSrc ['self', 'unsafe-inline', https://cdn.shopify.com]`
  - `connectSrc ['self', https://cdn.shopify.com/, https://monorail-edge.shopifysvc.com, https://<checkoutDomain>, https://<storeDomain>]`
- **Dev additions:**
  - `http://localhost:*` on styleSrc and defaultSrc.
  - `http://localhost:*`, `ws://localhost:*` and `ws://127.0.0.1:*` on connectSrc (drop `*.tryhydrogen.dev`).
- **Merging:** `Object.assign(defaults, overrides)`. For keys that have defaults, the result is `[...override, ...defaults]`, except an all-`'none'` default, which the override replaces.
- **Nonce:** strip any existing nonce and append `'nonce-…'` to `scriptSrc` if it is set, otherwise to `defaultSrc`.
- **Serialization:** kebab-case directive names, sources joined by spaces, directives joined by `'; '`.

```tsx
// app/lib/nonce.tsx
export const NonceProvider: React.Provider<string | undefined>;
export function useNonce(): string | undefined;

// app/lib/sitemap.server.ts (port of h:6204-6479; XML templates byte-identical)
export type SitemapType =
  'products' | 'collections' | 'pages' | 'blogs' | 'articles' | 'metaObjects';
export function getSitemapIndex(o: {
  storefront: Pick<Storefront, 'query'>;
  request: Request;
  types?: ReadonlyArray<SitemapType>;
  customChildSitemaps?: ReadonlyArray<string>;
}): Promise<Response>;
export function getSitemap(o: {
  storefront: Pick<Storefront, 'query'>;
  request: Request;
  params: {type?: string; page?: string};
  getLink: (a: {
    type: string;
    baseUrl: string;
    handle?: string;
    locale?: string;
  }) => string;
  locales?: ReadonlyArray<string>;
  getChangeFreq?: (a: {type: string; handle: string}) => string;
  noItemsFallback?: string;
}): Promise<Response>;
// query calls exactly storefront.query(SITEMAP_INDEX_QUERY) and storefront.query(QUERIES[type], {variables: {page: parseInt(page, 10)}})
// (sitemap-robots.test.ts asserts the second argument with toHaveBeenCalledWith); Content-Type application/xml; Cache-Control max-age=86400

// app/lib/storefront-redirect.server.ts (port of h:5464-5578)
export function storefrontRedirect(o: {
  storefront: Pick<Storefront, 'query' | 'getShopifyDomain'>;
  request: Request;
  response?: Response;
  noAdminRedirect?: boolean;
  matchQueryParams?: boolean;
}): Promise<Response>;
export function parseSingleFetchPathname(pathname: string): {
  pathname: string;
  isSoftNavigation: boolean;
};
```

Redirect behaviour:

- Strip `redirect`, `return_to` and `_routes` from the carried-over parameters. The lookup path is lowercased.
- `/admin` goes to `<shop>/admin`.
- Then `urlRedirects(first: 1, query: "path:<path without trailing />")`.
- Then a same-origin `return_to`/`redirect`.
- `.data` requests get a 204 with `X-Remix-Redirect` and `X-Remix-Status: 301`. Other requests get a 301 with `location`.
- On a Storefront API failure: `console.error` and return the original response.

### Pagination and variants (Phase 4b)

```ts
// app/lib/pagination-variables.ts (pure)
export type PaginationVariables =
  | {first: number; endCursor: string | null}
  | {last: number; startCursor: string | null};
export function getPaginationVariables(
  request: Request,
  o?: {pageBy: number; namespace?: string},
): PaginationVariables; // default pageBy 20
export function getParamsWithoutPagination(
  search: string,
  state: unknown,
): string;
export function buildPaginationUrls(
  search: string,
  info: {startCursor?: string | null; endCursor?: string | null},
  namespace?: string,
): {previousPageUrl: string; nextPageUrl: string}; // set direction first, then cursor (search.spec.ts:481)
```

```tsx
// app/lib/pagination.tsx (port of h:4602-4827)
export type PageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | null;
  endCursor?: string | null;
};
export type Connection<N> =
  | {nodes: N[]; pageInfo: PageInfo}
  | {edges: Array<{node: N}>; pageInfo: PageInfo};
export type PaginationLinkProps = Omit<LinkProps, 'to' | 'state' | 'replace'>;
export interface PaginationRenderProps<N> {
  nodes: N[];
  isLoading: boolean;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextPageUrl: string;
  previousPageUrl: string;
  state: unknown;
  NextLink: React.ForwardRefExoticComponent<
    PaginationLinkProps & React.RefAttributes<HTMLAnchorElement>
  >;
  PreviousLink: React.ForwardRefExoticComponent<
    PaginationLinkProps & React.RefAttributes<HTMLAnchorElement>
  >;
}
export function Pagination<N>(p: {
  connection: Connection<N>;
  children: (r: PaginationRenderProps<N>) => React.ReactNode;
  namespace?: string;
}): React.ReactNode;
export {getPaginationVariables} from './pagination-variables';
```

The links use `replace` and `preventScrollReset`, and carry `state.pagination[namespace]`. A module-level flag replaces `window.__hydrogenHydrated`. Throw the same descriptive Error when a `pageInfo` field is missing.

```ts
// app/lib/variants.ts (additions)
export function getSelectedProductOptions(
  request: Request,
): Array<{name: string; value: string}>; // all params; TypeError for non-Request
export type VariantWithOptions = {
  selectedOptions?: Array<{name: string; value: string}> | null;
};
export function findOptimisticVariant<T extends VariantWithOptions>(
  variants: ReadonlyArray<T>,
  search: string,
): T | undefined;
export function useOptimisticVariant<S, V = ReadonlyArray<VariantWithOptions>>(
  selected: S,
  variants: V | Promise<V>,
): S & {isOptimistic?: boolean};
```

### Analytics and consent (Phase 4c)

```ts
// app/lib/analytics/config.ts (pure)
export type AnalyticsShop = {
  shopId: string;
  acceptedLanguage: string;
  currency: string;
  hydrogenSubchannelId: string;
};
export type ConsentConfig = {
  checkoutDomain: string;
  storefrontAccessToken: string;
  withPrivacyBanner: false;
  country: CountryCode;
  language: LanguageCode;
};
export type AnalyticsConfig =
  | {enabled: false; shop: null; consent: null}
  | {
      enabled: true;
      shop: Promise<AnalyticsShop | null>;
      consent: ConsentConfig;
    };
export function isAnalyticsEnabled(
  env: Pick<
    Env,
    'PUBLIC_CHECKOUT_DOMAIN' | 'PUBLIC_STOREFRONT_ID' | 'MOCK_STOREFRONT'
  >,
): boolean; // both set and mock off
// app/lib/analytics/shop.server.ts
export function getShopAnalytics(a: {
  storefront: Pick<Storefront, 'query' | 'CacheLong'>;
  publicStorefrontId: string;
}): Promise<AnalyticsShop>; // ShopData query, CacheLong
export function getAnalyticsConfig(a: {
  env: Env;
  storefront: Storefront;
}): AnalyticsConfig; // disabled: no Storefront query at all
// app/lib/analytics/events.ts (pure; ports h:375-590)
export type AnalyticsProduct = {
  id: string;
  title: string;
  price: string;
  vendor: string;
  variantId: string;
  variantTitle: string;
  quantity: number;
  sku?: string;
  productType?: string;
};
export type ProductViewData = {products: AnalyticsProduct[]};
export type CollectionViewData = {collection: {id: string; handle: string}};
export type SearchViewData = {searchTerm: string; searchResults?: unknown};
export type ConsentState = {
  analyticsAllowed: boolean;
  marketingAllowed: boolean;
  saleOfDataAllowed: boolean;
};
export function buildBasePayload(
  shop: AnalyticsShop,
  consent: ConsentState,
  browser: ClientBrowserParameters,
): ShopifyPageViewPayload; // shopifySalesChannel 'hydrogen'
export function buildPageView(
  base: ShopifyPageViewPayload,
  view?: {pageType?: string; resourceId?: string},
): ShopifyAnalytics; // PAGE_VIEW_2
export function buildProductView(
  base: ShopifyPageViewPayload,
  d: ProductViewData,
): ShopifyAnalytics | null; // PRODUCT_VIEW
export function buildCollectionView(
  base: ShopifyPageViewPayload,
  d: CollectionViewData,
): ShopifyAnalytics; // COLLECTION_VIEW
export function buildSearchView(
  base: ShopifyPageViewPayload,
  d: SearchViewData,
): ShopifyAnalytics; // SEARCH_VIEW
export function buildAddToCart(
  base: ShopifyPageViewPayload,
  cartId: string,
  line: CartLineLike,
): ShopifyAnalytics | null; // ADD_TO_CART
export function linesAddedToCart(
  previous: CartLike | null,
  next: CartLike | null,
): CartLineLike[]; // new lines or increased quantity
// app/lib/analytics/consent.tsx
export const CONSENT_API_URL =
  'https://cdn.shopify.com/shopifycloud/consent-tracking-api/v0.2/consent-tracking-api.js';
export function readConsentState(): ConsentState | null; // null unless window.Shopify.customerPrivacy.consentStatus === 'loaded'
export function CustomerPrivacyLoader(p: {
  config: ConsentConfig;
  nonce?: string;
  onReady: () => void;
}): null;
//   useLoadScript(CONSENT_API_URL, {attributes: {id: 'customer-privacy-api', nonce}}); sets customerPrivacy.config
//   {isHeadless, asyncConsent, asyncVisitorState, consentDomain: location.host, storefrontAccessToken}; listens for
//   consentTrackingApiLoaded and visitorConsentCollected; useRevalidator().revalidate() when getTrackingValues() tokens change
// app/lib/analytics/provider.tsx and index.ts
export function AnalyticsProvider(p: {
  config: AnalyticsConfig;
  cart: Promise<CartApiQueryFragment | null> | CartApiQueryFragment | null;
  children: React.ReactNode;
}): JSX.Element;
export const Analytics: {
  Provider: typeof AnalyticsProvider;
  ProductView(p: {data: ProductViewData}): null;
  CollectionView(p: {data: CollectionViewData}): null;
  SearchView(p: {data: SearchViewData}): null;
};
```

Provider rules:

- **When disabled:** render only the children. The views are no-ops, and no script, query or cookie handling happens.
- **When enabled:**
  - Queue events until consent is ready, then send them with `sendShopifyAnalytics(event)` (no shopDomain, so they go to monorail-edge, which CSP already allows).
  - The page-view publisher renders after `children`, so product, collection and search views set `pageType`/`resourceId` first (Hydrogen ordering).
  - ADD_TO_CART comes from the cart diff on `updatedAt`.
- **`Analytics.*View` props stay the same,** so call sites only change the import path.

### Customer-account stub (Phase 5)

```ts
// app/lib/customer-account/types.ts
declare global {
  interface CustomerAccountQueries {}
  interface CustomerAccountMutations {}
}
export type CustomerAccountApiError = {
  message: string;
  extensions?: Record<string, unknown>;
  path?: ReadonlyArray<string | number>;
};
export interface CustomerAccount {
  readonly i18n: {language: LanguageCode}; // customer-account-api-types
  login(o?: {
    countryCode?: CountryCode;
    acrValues?: string;
    loginHint?: string;
    loginHintMode?: string;
    locale?: string;
    uiLocales?: string;
  }): Promise<Response>;
  authorize(): Promise<Response>;
  logout(o?: {
    postLogoutRedirectUri?: string;
    headers?: HeadersInit;
    keepSession?: boolean;
  }): Promise<Response>;
  isLoggedIn(): Promise<boolean>;
  handleAuthStatus(): Promise<void>;
  getAccessToken(): Promise<string | undefined>;
  getApiUrl(): string;
  getBuyer(): Promise<
    {customerAccessToken: string; companyLocationId?: string} | undefined
  >;
  setBuyer(b: {companyLocationId?: string}): void;
  query<O = never, Q extends string = string>(
    q: Q,
    ...o: ClientVariablesInRestParams<CustomerAccountQueries, Q>
  ): Promise<{
    data: ClientReturn<CustomerAccountQueries, Q, O>;
    errors?: CustomerAccountApiError[];
  }>;
  mutate<O = never, M extends string = string>(
    m: M,
    ...o: ClientVariablesInRestParams<CustomerAccountMutations, M>
  ): Promise<{
    data: ClientReturn<CustomerAccountMutations, M, O>;
    errors?: CustomerAccountApiError[];
  }>;
}
// app/lib/customer-account/stub.server.ts
export const ACCOUNT_LOGIN_PATH = '/account/login';
export function createCustomerAccountStub(o: {
  session: AppSession;
  language?: LanguageCode;
}): CustomerAccount;
```

Stub behaviour:

- **Logged-out answers:** `isLoggedIn` resolves false. `getBuyer` and `getAccessToken` resolve undefined. `getApiUrl` returns `''`. `setBuyer` does nothing.
- **Redirects:** `handleAuthStatus`, `query`, `mutate` and `authorize` throw `redirect('/account/login')` (302).
- **`login`:** resolves `new Response('Customer accounts are not available on this storefront yet.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'}})`. The login route renders `<AccountUnavailable />` regardless of its data.
- **`logout`:** unsets `customerAccount` and `buyer`, sets `Set-Cookie` from `session.destroy()`, sets `session.isPending = false`, and returns `redirect('/')`.
- **Routes stay unchanged.** `isCustomerAccountConfigured` keeps its env semantics, and account.test.ts is the reference.

## Dev and test tooling

**Scripts** in package.json (Phase 1; `lint`, `format`, `typecheck` and `test*` unchanged):

```json
"build": "react-router build",
"dev": "react-router dev --port 3000",
"dev:e2e": "CLOUDFLARE_ENV=e2e react-router dev --port 3100 --strictPort",
"preview": "npm run build && vite preview",
"deploy": "npm run build && wrangler deploy",
"codegen": "graphql-codegen && react-router typegen"
```

Notes on the scripts:

- `vite dev` and `vite build` (the ADR wording) are equivalent to the `react-router` commands; either may be used.
- The inline variable is POSIX syntax. The README already uses POSIX syntax; use `cross-env` only if Windows must be supported.
- `build` no longer runs codegen. The generated `.d.ts` files stay committed, and `npm run codegen && git diff --exit-code storefrontapi.generated.d.ts customer-accountapi.generated.d.ts` is the drift check.

**How `MOCK_STOREFRONT` and the placeholder token reach the worker:**

- **Dev:** .dev.vars, gitignored, created from `.dev.vars.example`. For mock mode set `MOCK_STOREFRONT=true` and any token. `.env` is no longer read by our scripts.
- **E2E (primary):**
  - .dev.vars.e2e is committed. It holds exactly today's tests/e2e/e2e.env content, with comments updated.
  - The Cloudflare plugin selects it via `CLOUDFLARE_ENV=e2e`, which comes from Playwright `webServer.env` and from `dev:e2e`. `wrangler.jsonc` defines `env.e2e`.
- **What must be verified at implementation:**
  - (a) With `CLOUDFLARE_ENV=e2e` the plugin loads `.dev.vars.e2e` instead of `.dev.vars`, and does not merge `.env*` files (newer Wrangler versions read `.env` when no `.dev.vars` exists).
  - (b) An undefined `env.e2e` is an error or a warning.
  - (c) The worker's `env.MOCK_STOREFRONT === 'true'` and the home page shows the badge.
- **Fallbacks:**
  - B: put the placeholders in `wrangler.jsonc` under `env.e2e.vars`. This only works if a developer's `.dev.vars` does not override them.
  - C: `CLOUDFLARE_INCLUDE_PROCESS_ENV=true` plus all placeholders in `webServer.env`.
- **Safety net:** the global-setup preflight badge check catches every misconfiguration.

**.gitignore** (Phase 1): add `.wrangler/`, `.dev.vars`, `.dev.vars.*`, `!.dev.vars.e2e` and `!.dev.vars.example`; drop the obsolete `!.env.example`.

**playwright.config.ts** (playwright.config.ts, Phase 1):

- `webServer.command` becomes `` `npx react-router dev --port ${PORT} --strictPort` ``.
- `env: {NODE_ENV: 'development', CLOUDFLARE_ENV: 'e2e'}`.
- Keep the URL, `reuseExistingServer: !IS_CI`, 180 s timeout, stdout/stderr switches and graceful shutdown.
- Update the header comment ("Hydrogen dev server", "shopify hydrogen dev", tests/e2e/e2e.env) and the "Oxygen renders in UTC" comment (workerd also renders in UTC).

**global-setup.ts** (tests/e2e/global-setup.ts):

- Phase 1:
  - Preflight doc item 1 and the `not-mock` hint should say "the React Router dev server (Cloudflare Vite plugin) in mock mode, which Playwright starts with CLOUDFLARE_ENV=e2e (values from .dev.vars.e2e) on port 3100".
  - Keep the 32-character wording until 4c.
- Phase 4c: delete step 4 (`tokenErrors`, the `private access token` listener and the thrown error) and its doc comment.

**support/console.ts** (tests/e2e/support/console.ts), Phase 4c:

- Delete `MOCK_SHOP_WARNING` and its baseline entry. `BASELINE_ALLOWLIST` becomes `[]`.
- Rewrite the header doc ("holds exactly one entry" becomes "empty; read before adding").
- tests/e2e/support.spec.ts: the test 'the baseline allows only the exact mock-shop warning' becomes 'the baseline allowlist is empty' (any `console.warn` is unexpected).

**e2e.env and README:**

- Delete tests/e2e/e2e.env in Phase 1.
- tests/e2e/README.md:
  - Phase 1: the server command and env file in the "Running" section.
  - Phase 4c: the console policy, the "Another server" token note, and the 32-character note.
- tests/e2e/support/network.ts: update the comment in 4c.
- tests/e2e/support/hydration.ts: update the deep-path comment in Phase 7.

**Vitest:**

- vitest.config.ts keeps not loading vite.config.ts. Only its comment changes.
- Coverage `include: ['app/lib/**/*.ts']` and the 80% thresholds stay. Every new `.ts` module comes with a test written first.

## Implementation Steps

Standard gate at the end of every phase:

```bash
npm install                      # only after package.json changes; commit package-lock.json
npm run lint
npm run typecheck
npx vitest run --coverage        # 80% statements/branches/functions/lines on app/lib/**/*.ts
npx playwright test              # FULL suite; iterate with the specs listed per phase
npm run build
```

From Phase 1 on, also run `npx wrangler deploy --dry-run` after the build.

Before the first e2e run of Phase 1, stop any `shopify hydrogen dev` still listening on 3100. `reuseExistingServer` would otherwise test the old stack and pass the preflight. Never edit app/ while the suite runs (README rule).

ECC flow per step: tdd-guide writes the failing test first, then the code. At each phase end, code-reviewer runs, and security-reviewer runs for Phases 2, 3, 4a, 4c and 5.

### Phase 0: hydrogen-react for re-exported UI, helpers, types and schema (S)

Dependencies: add `@shopify/hydrogen-react@2026.4.4` to dependencies, exact pin.

0.1 **Add the dependency** (Files: package.json, package-lock.json)

- Action:
  - `npm install --save-exact @shopify/hydrogen-react@2026.4.4`.
  - Run `npm view @shopify/hydrogen-react@2026.4.4 peerDependencies` (expect react/react-dom ^18.3.1 and vite ^5–^8, all satisfied).
  - Run `npm ls @shopify/hydrogen-react`: exactly one copy, with the one under @shopify/hydrogen marked deduped. Today it is nested at node_modules/@shopify/hydrogen/node_modules.
- Why: schema, types and components must resolve from the package that survives Phase 6.
- Depends on: none.
- Risk: Low.

0.2 **Components** (Files: app/components/ProductImage.tsx, app/components/ProductCard.tsx, app/components/SearchResultsPredictive.tsx, app/components/ContentImage.tsx, app/components/product/ProductGallery.tsx, app/components/collection/CollectionCard.tsx, app/components/collection/CollectionHeader.tsx, app/components/ui/Price.tsx, app/components/ProductPrice.tsx, app/components/ProductForm.tsx, app/components/product/VariantSelector.tsx, app/components/CartLineItem.tsx, app/components/CartSummary.tsx)

- Action: move `Image`, `Money`, `type MappedProductOptions` and the storefront API types to `@shopify/hydrogen-react` and `@shopify/hydrogen-react/storefront-api-types`. Split the CartLineItem and CartSummary imports; `CartForm` and the `Optimistic*` types stay on Hydrogen until Phase 3.
- Why: F2 (identical modules).
- Depends on: 0.1.
- Risk: Low.

0.3 **Routes** (Files: app/routes/blogs.$blogHandle.$articleHandle.tsx, app/routes/blogs.$blogHandle._index.tsx, app/routes/account.orders.$id.tsx, app/routes/account.orders._index.tsx, app/routes/dev.mock-checkout.tsx, app/routes/products.$handle.tsx, app/routes/cart.tsx, app/routes/account.profile.tsx, app/routes/account.addresses.tsx)

- Action: as in the inventory table: `Image`, `Money`, `flattenConnection`, `getProductOptions`, `getAdjacentAndFirstAvailableVariants`, `useSelectedOptionInUrlParam`, the storefront types, and the customer-account types (`CustomerUpdateInput`, `CustomerAddressInput`) from `@shopify/hydrogen-react/customer-account-api-types`.
- Depends on: 0.1.
- Risk: Low.

0.4 **Lib and mock** (Files: app/lib/variants.ts, app/lib/collectionFilters.ts, app/lib/mock/schema.server.ts)

- Action: types from hydrogen-react. Schema `import storefrontSchema from '@shopify/hydrogen-react/storefront.schema.json'`, which is exported at the package root.
- Why: the mock, and `expectValidStorefrontDocument` in route-test-utils, validate against the schema.
- Depends on: 0.1.
- Risk: Low (fragments.test.ts and content-routes.test.ts exercise the schema).

0.5 **Test cleanup** (File: app/lib/**tests**/account-orders-link.test.ts)

- Action: delete the `Money` stub from the `vi.mock('@shopify/hydrogen')` factory. Keep the `Pagination` stub until 4b.
- Why: `Money` now comes from hydrogen-react, where `useShop()` falls back to defaults (F2). The stub no longer applies.
- Depends on: 0.3.
- Risk: Low.

Ownership:

- A: 0.1, 0.2.
- B: 0.3–0.5 (after A's lockfile lands).

Gate: standard, plus these greps must return nothing:

- `rg -n "from '@shopify/hydrogen/(storefront|customer-account)-api-types'|@shopify/hydrogen/storefront.schema.json" app`
- `rg -n -U "import \{[^}]*\b(Image|Money|flattenConnection|getProductOptions|getAdjacentAndFirstAvailableVariants|useSelectedOptionInUrlParam|MappedProductOptions)\b[^}]*\} from '@shopify/hydrogen'" app`

E2E focus: smoke, product, cart, collections, content, seo, security.

### Phase 1: Cloudflare Workers platform swap (M)

Dependencies: add devDependencies `@cloudflare/vite-plugin`, `wrangler` (4.x), `@cloudflare/workers-types` and `@shopify/graphql-codegen@0.0.2`, all exact pins. 0.0.2 is installed today only as a transitive dependency of @shopify/hydrogen-codegen. Nothing is removed until Phase 6.

1.1 **Version checks and install** (Files: package.json, package-lock.json)

- Action:
  - `npm view @cloudflare/vite-plugin version peerDependencies`: choose the newest version whose `vite` peer includes the installed 8.3.x.
  - `npm view wrangler version`: satisfy both the plugin's peer and `@react-router/dev@7.16.0`'s optional `wrangler: ^3.28.2 || ^4.0.0` (read from node_modules).
  - `npm view @cloudflare/workers-types version`.
  - `npm view @shopify/graphql-codegen versions`.
- If no plugin release supports Vite 8, stop and escalate. The fallback is Vite 7 (Hydrogen and RR dev allow ^7). It would require dropping `resolve.tsconfigPaths` and checking vitest 5's Vite peer. Runtime imports only need the `~` alias, because the generated files are imported type-only.
- Depends on: Phase 0.
- Risk: High until verified.

1.2 **wrangler.jsonc** (File: wrangler.jsonc)

- Action: as in the interface section. Set `compatibility_date` to the newest date the installed workerd supports, so dev boots without the future-date warning.
- Depends on: 1.1.
- Risk: Low.

1.3 **Vite config** (File: vite.config.ts)

- Action:
  - `plugins: [cloudflare({viteEnvironment: {name: 'ssr'}}), reactRouter()]`.
  - Remove `hydrogen()`, `oxygen()` and `server.allowedHosts`.
  - Keep the alias, `tsconfigPaths`, `assetsInlineLimit: 0` and `ssr.optimizeDeps.include`.
- Why: the worker runs in workerd in dev, so `server.ts`, `caches` and `waitUntil` run exactly as in production.
- Depends on: 1.1.
- Risk: Medium. If a CJS dependency fails in the worker environment ("module is not defined"), add it to `ssr.optimizeDeps.include`.

1.4 **React Router config and routes** (Files: react-router.config.ts, app/routes.ts)

- Action: explicit config (interface section); `export default flatRoutes() satisfies RouteConfig`.
- Why: drops `hydrogenPreset` and `hydrogenRoutes`. The GraphiQL and profiler dev routes disappear (intended).
- Depends on: 1.3.
- Risk: Low. If `unstable_optimizeDeps` misbehaves with the worker environment, disable it; it is only a performance optimisation.

1.5 **Server mode** (File: server.ts)

- Action: replace `mode: process.env.NODE_ENV` with `import.meta.env.MODE`. Keep the Hydrogen `createRequestHandler`/`storefrontRedirect` imports for now.
- Why: `process` is not guaranteed in workerd without `nodejs_compat`.
- Depends on: 1.3.
- Risk: Low.

1.6 **Worker types** (Files: env.d.ts, tsconfig.json)

- Action:
  - Replace the `@shopify/oxygen-workers-types` reference and `types` entry with `@cloudflare/workers-types`.
  - Keep `@shopify/hydrogen/react-router-types` (it provides the context typing and `Env` until Phase 2).
- Depends on: 1.1.
- Risk: Low/Medium. If DOM-lib conflicts appear, declare a minimal `ExecutionContext` and `ExportedHandler` in env.d.ts instead (`skipLibCheck` is on).

1.7 **codegen.ts, Hydrogen-compatible** (Files: codegen.ts, the `codegen` script)

- Action:
  - Phase-1 variant from the interface section (Hydrogen schema and types, module extension `'@shopify/hydrogen'`, prettier hook).
  - Run `npm run codegen` and require `git diff --exit-code` on storefrontapi.generated.d.ts and customer-accountapi.generated.d.ts.
- Why: D-1.
- Depends on: 1.1.
- Risk: Low (adjust the presetConfig or prettier options until the diff is empty).

1.8 **Scripts** (File: package.json)

- Action: as in the tooling section.
- Depends on: 1.3–1.7.
- Risk: Low. Confirm that `react-router dev` accepts `--strictPort`.

1.9 **Env files** (Files: .dev.vars.example (git mv from .env.example), .dev.vars.e2e, delete tests/e2e/e2e.env, .gitignore)

- Action:
  - `.dev.vars.example` keeps today's keys, adds a commented `PRIVATE_STOREFRONT_API_TOKEN`, and is reworded ("copy to .dev.vars").
  - `.dev.vars.e2e` gets the e2e.env content verbatim (same placeholders and 32-character token) with updated comments.
  - Add the .gitignore entries listed in the tooling section.
- Depends on: 1.2.
- Risk: Medium (env selection; see tooling).

1.10 **E2E tooling** (Files: playwright.config.ts, tests/e2e/global-setup.ts, tests/e2e/README.md)

- Action: as in the tooling section (Phase-1 parts only).
- Depends on: 1.8, 1.9.
- Risk: Low.

1.11 **Developer docs** (Files: README.md "Getting started" and scripts table, vitest.config.ts comment)

- Action:
  - `cp .dev.vars.example .dev.vars` replaces `.env`.
  - New script meanings.
  - Port 3000 unchanged.
- Risk: Low.

1.12 **Optional: static asset headers** (File: public/_headers)

- Action: `/*` with `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`.
- Why: Workers Static Assets serve assets before the Worker, so server.ts never adds these headers to them.
- Risk: Low. Verify the file is honoured and not served.

1.13 **Verification**

- Each of these must pass:
  - `npm run dev:e2e` boots, and `/` shows "Development mock data".
  - security.spec "cross-origin requests" passes (Host and Origin reach React Router's CSRF check).
  - The newsletter 413 test passes (`content-length` arrives).
  - `npm run build` produces dist/client and dist/server plus `.wrangler/deploy/config.json`.
  - `npx wrangler deploy --dry-run` passes.
  - `npm run preview` with a `.dev.vars` holding placeholders answers `GET /robots.txt` with 200 and nosniff.
- Also check whether the plugin copies `.dev.vars` into dist/ (dist is gitignored; never upload it).

Ownership:

- A: 1.1–1.9, 1.11, 1.12 (`.dev.vars.e2e` included).
- B: 1.10, 1.13.

Gate: standard, full e2e, and the codegen diff check.

### Phase 2: Storefront client, cache, own context and server (M)

Dependencies: none.

2.1 **GraphQL helpers** (Files: app/lib/storefront/types.ts, app/lib/storefront/graphql.ts, graphql.test.ts)

- Tests first:
  - Minify parity.
  - Query and mutation detection, including the anonymous `{ shop }` document, which is rejected like in Hydrogen.
  - Operation names.
  - `__proto__` stripping.
- Risk: Low.

2.2 **Cache layer** (Files: app/lib/storefront/cache.server.ts, cache.server.test.ts)

- Tests first, using an in-memory `Cache` fake and an injected clock:
  - MISS, HIT, STALE (exactly one revalidation via `waitUntil`, then the entry is updated) and expired.
  - Errors are not stored, including during revalidation.
  - `CacheNone`, `private` and mutations bypass.
  - The key depends on URL, token and body.
  - Strategy values and header strings.
  - A failed revalidation is logged and not thrown.
  - A corrupt body counts as a miss.
- Depends on: 2.1.
- Risk: Medium (stale personal data). The guards above are the mitigation.

2.3 **Client** (Files: app/lib/storefront/client.server.ts, client.server.test.ts)

- Tests first, stubbing `fetch` with `vi.stubGlobal`:
  - i18n injection.
  - URL and public-token headers; private token with buyer IP.
  - Query and mutation refusal.
  - Non-2xx throws `StorefrontApiHttpError` and logs without variables.
  - Result shapes: `{data}`, `{data, errors}` and `{errors}`.
  - `fetch` is looked up at call time.
  - `isStorefrontApiUrl` and `forward` header allowlist; the server token is never forwarded; `server-timing` is stripped.
  - Cache options are passed through.
- Depends on: 2.2.
- Risk: Medium.

2.4 **Temporary compat type and discount mutation** (Files: app/lib/storefront/hydrogen-compat.ts, app/lib/cart/queries.ts)

- Action:
  - `export type {Storefront as HydrogenStorefront} from '@shopify/hydrogen'` (types only).
  - `CART_DISCOUNT_CODES_UPDATE_MUTATION` without `@defer`. Test it against `getMockSchema()`.
- Why: Hydrogen helpers still in use (cart handler, sitemaps, redirect, `getShopAnalytics`) need an explicit `as unknown as HydrogenStorefront` cast. Covers D-8.
- Risk: Low.

2.5 **Codegen flip** (Files: codegen.ts, .graphqlrc.ts, both generated `.d.ts` files)

- Action:
  - Storefront project uses hydrogen-react and global interfaces.
  - The customer project only switches `importTypes`.
  - `.graphqlrc.ts` uses the `node_modules/@shopify/hydrogen-react/*.schema.json` paths and the document constants from codegen.ts.
  - Regenerate.
- Depends on: 2.3 (the global interfaces).
- Risk: Low.

2.6 **Env and types** (Files: env.d.ts, tsconfig.json)

- Action: final `Env`; remove `@shopify/hydrogen/react-router-types` in the same commit as 2.8.
- Risk: Low. If root.tsx's Hydrogen `consent` props reject optional values, use `?? ''` at the call site until 4c.

2.7 **Session, guard, mock types** (Files: app/lib/session.ts, app/lib/storefront-errors.ts, app/lib/storefront-errors.test.ts, app/lib/mock/install.server.ts)

- Action: drop `implements HydrogenSession`; `type Storefront` from `~/lib/storefront/client.server` (type-only import).
- Risk: Low.

2.8 **Context builder** (Files: app/lib/context.ts, app/lib/context.test.ts)

- Action:
  - `createAppRouterContext` as specified.
  - Phase-2 cart: `createCartHandler({storefront: asHydrogen, customerAccount, getCartId: cartGetIdDefault(request.headers), setCartId: cartSetIdDefault({httponly: true, samesite: 'Lax', secure: isSecureRequest(request)}), cartQueryFragment: CART_QUERY_FRAGMENT, customMethods: {updateDiscountCodes}})`. The override dedupes codes, calls `cartDiscountCodesUpdate` without `@defer` when a cart id exists, and otherwise calls `cart.create({discountCodes})`.
  - Customer account: Hydrogen's `createCustomerAccountClient({session, request, waitUntil, customerAccountId: env.PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID ?? '', shopId: env.SHOP_ID, language: 'EN'})`.
  - Keep the `HydrogenCustomCartFragment` augmentation for now.
  - Cache name becomes `storefront`.
  - context.test.ts only renames the import. Every assertion must pass unchanged.
- Depends on: 2.3, 2.4, 2.7.
- Risk: Medium.

2.9 **Server** (Files: server.ts, app/lib/**tests**/server.test.ts)

- Action:
  - Flow as specified, with Hydrogen's `storefrontRedirect` behind a cast.
  - Tests:
    - Mock `react-router` (`createRequestHandler: () => mocks.handleRequest`), `~/lib/context` and `virtual:react-router/server-build`.
    - The context mock provides `storefront.isStorefrontApiUrl/forward/setCollectedSubrequestHeaders`.
    - Keep every existing case.
    - New cases: GET or HEAD with a body gives 400 (build a Request-like object, because the Fetch API forbids GET bodies); `//` gives 301; `/api/2026-04/graphql.json` and `/api/unstable/graphql.json` are forwarded with security headers; `.jsonx` is not; `Server-Timing` only on document requests; the session cookie is appended next to the cart cookie (D-10).
- Depends on: 2.8.
- Risk: High (security headers, proxy) → security-reviewer.

2.10 **Call-site types** (Files: app/entry.server.tsx, app/root.tsx, app/routes/[sitemap.xml].tsx, app/routes/sitemap.$type.$page[.xml].tsx)

- Action: context type `AppRouterContext`; the Hydrogen helpers receive `storefront as unknown as HydrogenStorefront`.
- Risk: Low.

Ownership:

- A: 2.1–2.5.
- B: 2.6–2.10. Codes against the interfaces; merge after A.

Gate: standard, full e2e. The proxy is not e2e-tested in mock mode, because it would reach the placeholder store.

### Phase 3: Cart (M)

Dependencies: none.

3.1 **Types** (File: app/lib/cart/types.ts)

- Action: as specified. Owner A's first commit.
- Risk: Low.

3.2 **Cookie** (Files: app/lib/cart/cookie.ts, cookie.test.ts)

- Tests first:
  - Byte format and attribute order.
  - `Secure` only over https.
  - Encoding of `c1-abc?key=k`.
  - `cart=c1-abc` reads back as `gid://shopify/Cart/c1-abc`.
  - Malformed percent sequences.
- Risk: Medium (shoppers' carts survive the switch only if the format is identical).

3.3 **Queries** (Files: app/lib/cart/queries.ts, queries.test.ts)

- Action: every document from the interface section.
- Tests: every document validates against `getMockSchema()` (CART_QUERY with CART_QUERY_FRAGMENT appended); no `@defer`; unique operation names.
- Then run `npm run codegen`.
- Risk: Low.

3.4 **Service** (Files: app/lib/cart/cart.server.ts, cart.server.test.ts)

- Tests first: every rule in the interface section, including create-on-first-mutation, `selectedVariant` stripping, the optimistic-id error, discount dedupe, buyer-identity merge, the logged-in checkout URL, `CacheNone` on `get`, and errors propagating as `{...payload, errors}`.
- Depends on: 3.1–3.3.
- Risk: Medium.

3.5 **Wire it up** (Files: app/lib/context.ts, app/lib/context.test.ts)

- Action:
  - `cart: createCartService({storefront, customerAccount, requestHeaders: request.headers, secureCookie: isSecureRequest(request)})`.
  - Remove `createCartHandler`, `cartGetIdDefault`, `cartSetIdDefault`, the override and `HydrogenCustomCartFragment`.
  - The cookie, 502 and mock assertions in context.test.ts are the contract and stay as they are.
- Risk: Medium → security-reviewer (cookie).

3.6 **Form input and CartForm** (Files: app/lib/cart/form-input.ts, form-input.test.ts, app/lib/cart/CartForm.tsx)

- Tests first (getFormInput): merging, booleans, arrays, a missing `cartFormInput` gives `action` undefined, invalid JSON throws, `__proto__` is dropped.
- Optional: an SSR render test of the hidden input via `renderRoute`.
- Risk: Low.

3.7 **Optimistic cart** (Files: app/lib/cart/optimistic.ts, optimistic.test.ts, app/lib/cart/useOptimisticCart.ts)

- Tests first:
  - LinesAdd: a new line with prefix id, or an incremented existing line.
  - LinesRemove; LinesUpdate (quantity 0 removes the line).
  - Non-cart fetchers are ignored.
  - `totalQuantity` is recomputed.
  - A null cart gets an empty base.
  - The input is never mutated.
- Risk: Low.

3.8 **Call sites** (Files: app/routes/cart.tsx, app/routes/dev.mock-checkout.tsx, app/components/CartMain.tsx, app/components/CartLineItem.tsx, app/components/CartSummary.tsx, app/components/AddToCartButton.tsx, app/components/Header.tsx)

- Action: imports only. Header drops `useAnalytics`, `CartViewPayload` and the `publish('cart_viewed')` call (D-5). The action logic in cart.tsx is unchanged, so cart-action.test.ts and redirects.test.ts are the reference.
- Risk: Low.

3.9 **Comment** (File: app/lib/**tests**/route-test-utils.ts)

- Action: "Minimal Hydrogen cart handler" becomes "Minimal cart service".

Ownership:

- A: 3.1–3.5.
- B: 3.6–3.9.

Gate: standard, full e2e. Focus: cart, product, security (cookies, cart validation, redirects), navigation, smoke.

### Phase 4a: CSP and nonce, sitemaps, Storefront redirect (S/M)

4a.1 **CSP builder** (Files: app/lib/csp.server.ts, csp.server.test.ts)

- Before switching, capture Hydrogen's header for today's options in app/entry.server.tsx with `isDev` false. Take Hydrogen's nonce from the header, feed it to ours, and commit the result as a golden string. No Hydrogen import stays in the test.
- Tests:
  - Golden equality.
  - Dev sources.
  - Merge order (override first).
  - `'none'` replacement.
  - Nonce placement in scriptSrc versus defaultSrc.
  - Nonce format (32 hex characters, unique).
- Risk: High → security-reviewer.

4a.2 **Nonce and entries** (Files: app/lib/nonce.tsx, app/entry.server.tsx, app/entry.client.tsx, app/root.tsx (useNonce import only), app/routes/products.$handle.tsx (useNonce import only))

- Action: `createContentSecurityPolicy` from csp.server and `<NonceProvider value={nonce}>`. These files must land in one commit: a mixed provider and consumer leaves JSON-LD without a nonce.
- Reference test: app/lib/**tests**/entry-server.test.ts, unchanged.
- Risk: High.

4a.3 **Sitemaps** (Files: app/lib/sitemap.server.ts, sitemap.server.test.ts, app/routes/[sitemap.xml].tsx, app/routes/sitemap.$type.$page[.xml].tsx)

- Action: port the module; the routes only change imports and drop the casts.
- Reference test: sitemap-robots.test.ts, unchanged.
- New tests: XML byte templates, locales, fallback, unknown type gives 404, missing data, headers.
- Risk: Low.

4a.4 **Redirect** (Files: app/lib/storefront-redirect.server.ts, storefront-redirect.server.test.ts, server.ts, app/lib/**tests**/server.test.ts)

- Action: port the module; server.ts imports it; server.test mocks `~/lib/storefront-redirect.server`.
- Tests: `/admin`, a urlRedirects hit, lowercased path and trailing-slash stripping, `.data`, `_root.data` and `_.data` soft navigation (204 headers), same-origin `redirect`, an API failure.
- Risk: High → security-reviewer.

Ownership:

- A: 4a.1–4a.2.
- B: 4a.3–4a.4.

Gate: standard, full e2e. Focus: security (CSP, nonce, 404 redirects), seo, smoke.

### Phase 4b: Pagination and variants (M)

4b.1 **Pure pagination** (Files: app/lib/pagination-variables.ts, pagination-variables.test.ts)

- Tests: default 20; next and previous; namespace; null cursor; URL order `?q=a&direction=next&cursor=…`; stripping on parameter change.
- Risk: Low.

4b.2 **Pagination component** (Files: app/lib/pagination.tsx, pagination.test.tsx)

- Tests (SSR via `renderRoute`):
  - Link hrefs and visibility.
  - nodes from `edges` or `nodes`.
  - Missing `pageInfo` fields throw.
- Risk: Medium. The e2e collections, search and support specs cover append, prepend and URL state.

4b.3 **Call sites and tests** (Files: app/components/PaginatedResourceSection.tsx, app/routes/collections._index.tsx, app/routes/collections.all.tsx, app/routes/collections.$handle.tsx, app/routes/search.tsx, app/routes/blogs._index.tsx, app/routes/blogs.$blogHandle._index.tsx, app/routes/account.orders._index.tsx, app/lib/**tests**/content-routes.test.ts, app/lib/**tests**/account-orders-link.test.ts, app/lib/collectionFilters.ts (comment))

- Action: imports from `~/lib/pagination`. Delete both `vi.mock('@shopify/hydrogen')` blocks; the local component shares the test's react-router copy. In collections.$handle.tsx and search.tsx, `Analytics` stays on Hydrogen until 4c.
- Risk: Low.

4b.4 **Variants** (Files: app/lib/variants.ts, variants.test.ts, app/routes/products.$handle.tsx)

- Action: port `getSelectedProductOptions` and `useOptimisticVariant` around the pure `findOptimisticVariant`. Use `console.error` instead of `reportError`.
- Reference e2e: product.spec and seo.spec (JSON-LD follows the selected variant).
- Risk: Low.

Ownership:

- A: 4b.1–4b.3.
- B: 4b.4.

Gate: standard, full e2e. Focus: collections, search, product, content, seo, smoke.

### Phase 4c: Analytics and consent (M)

4c.1 **Pure config and events** (Files: app/lib/analytics/config.ts, config.test.ts, app/lib/analytics/events.ts, events.test.ts)

- Tests:
  - Enabled only with both variables set and the mock off.
  - Exact payload keys per event (Hydrogen h:375-590).
  - No payload without consent.
  - Products are validated.
  - The cart diff detects added lines and increased quantities.
- Risk: Medium (cannot be verified against a live store).

4c.2 **Shop query** (Files: app/lib/analytics/shop.server.ts, shop.server.test.ts)

- Action: `ShopData` query with `CacheLong`. `getAnalyticsConfig` returns the disabled shape without querying.
- Risk: Low.

4c.3 **Consent and provider** (Files: app/lib/analytics/consent.tsx, app/lib/analytics/provider.tsx, app/lib/analytics/index.ts)

- Action: as specified. When disabled, render children only, with no script, query or cookie handling.
- Risk: Medium.

4c.4 **Call sites** (Files: app/root.tsx, app/routes/products.$handle.tsx, app/routes/collections.$handle.tsx, app/routes/search.tsx, app/lib/search.page.test.tsx)

- Action:
  - The root loader returns `analytics: getAnalyticsConfig({env, storefront})` instead of `shop`/`consent`, and keeps the `cart` catch.
  - `App` wraps in `<AnalyticsProvider config cart>`.
  - The routes import `Analytics` from `~/lib/analytics`.
  - The search test mocks `~/lib/analytics` with the same `SearchView` spy. Its assertions are unchanged.
- Risk: Low.

4c.5 **Tracking cookies** (Files: app/lib/storefront/client.server.ts, client.server.test.ts, app/lib/context.ts)

- Action: `trackingEnabled: isAnalyticsEnabled(env)` (D-9).
- Tests:
  - With tracking off, no cookie is forwarded and nothing is collected.
  - With tracking on, the cookie and visitor-token headers are sent, the first response's Set-Cookie values are appended, and cache hits replay nothing.
- Risk: Medium → security-reviewer.

4c.6 **Remove the compat type** (File: delete app/lib/storefront/hydrogen-compat.ts)

- Action: `rg HydrogenStorefront app` must be empty.
- Risk: Low.

4c.7 **E2E tooling** (Files: tests/e2e/support/console.ts, tests/e2e/support.spec.ts, tests/e2e/global-setup.ts, tests/e2e/support/network.ts, tests/e2e/README.md, .dev.vars.e2e (comment))

- Action: as in the tooling section (D-6).
- Risk: Low.

Ownership:

- A: 4c.1–4c.4.
- B: 4c.5–4c.7.

Gate: standard, full e2e. Focus: support (empty allowlist), smoke, security, search, product.

### Phase 5: Customer accounts deferred (S)

5.1 **Types and stub** (Files: app/lib/customer-account/types.ts, app/lib/customer-account/stub.server.ts, stub.server.test.ts)

- Tests first: every behaviour listed for the stub, including the logout Set-Cookie and `isPending` reset, and the 503 body and headers from `login`.
- Also run the login route loader with configured env vars and the stub, and assert status 503.
- Risk: Medium → security-reviewer.

5.2 **Wire it up** (File: app/lib/context.ts)

- Action: `customerAccount: createCustomerAccountStub({session, language: 'EN'})`. The cart service already accepts `isLoggedIn` and `getBuyer`.
- Risk: Low.

5.3 **Codegen** (Files: codegen.ts (customer project, global interfaces), customer-accountapi.generated.d.ts)

- Action: regenerate. The account routes keep their types.
- Risk: Low.

5.4 **Copy and e2e** (Files: app/components/account/AccountUnavailable.tsx, tests/e2e/content.spec.ts lines 509-525)

- Action:
  - Keep exactly 4 developer steps, so `toHaveCount(4)` holds. They should say:
    1. Customer accounts are deferred (ADR-D).
    2. Set the three variables from the Shopify admin.
    3. Port the OAuth client (D1) and register `/account/authorize`.
    4. OAuth needs an https origin in development.
  - Update the `steps.first()` text assertion.
  - Update the `isCustomerAccountConfigured` doc comment.
  - Keep the h1, "Customer Account API" text and links, which other specs assert.
- Risk: Low.

Single implementer.

Gate: standard, full e2e. Focus: content (accounts), smoke, navigation, security (logout CSRF 400).

### Phase 6: Remove Hydrogen packages, update docs (S)

6.1 **Uninstall** (Files: package.json, package-lock.json)

- Action: `npm uninstall @shopify/hydrogen @shopify/cli @shopify/mini-oxygen @shopify/hydrogen-codegen @shopify/oxygen-workers-types`.
- Checks:
  - `npm ls @shopify/hydrogen` is empty.
  - `npm ls @shopify/hydrogen-react` shows a single top-level copy.
  - `npm ls @shopify/graphql-codegen` is the direct pin.
  - `npm audit` has no new advisories.
- Risk: Low.

6.2 **Grep gate**

- `rg -n "@shopify/(hydrogen|hydrogen-codegen|mini-oxygen|oxygen-workers-types|cli)(['\"/]|$)" /home/user/Noodlez --glob '!node_modules/**' --glob '!docs/**' --glob '!CHANGELOG.md'` returns nothing. `hydrogen-react` does not match because of the `-`.
- Also: `rg -n "shopify hydrogen|HydrogenEnv|createHydrogen" app server.ts tests`.

6.3 **Comments and copy** (Files: app/routes/dev.mock-checkout.tsx (store-linking copy), app/lib/mock/flag.ts, app/lib/mock/README.md, app/lib/dates.ts, app/components/account/orderUtils.test.ts, vitest.config.ts, .cursor/rules/hydrogen-react-router.mdc (rename or reword, optional))

- Action: reword; "Development mock data" must stay in DevNotice, because the preflight depends on it.
- Risk: Low.

6.4 **Docs** (Files: docs/implementation-report.md sections 1, 5, 6, 8, 9 and 11, docs/shopify-setup.md, README.md, docs/hydrogen-removal-architecture.md (status "implemented"))

- Content to cover:
  - Env via `.dev.vars` and `wrangler secret put`.
  - The custom-domain requirement.
  - When analytics is enabled.
  - Accounts deferred.
  - Deploy and preview commands.
- Proposed wording for AGENTS.md goes to the owner for sign-off; do not edit it.

6.5 **Deploy readiness**

- `npx wrangler deploy --dry-run`.
- Owner actions: Cloudflare account, custom domain route, secrets, and a `npx wrangler versions upload` preview against the linked store. The production build cannot be checked end to end without a store, because the mock is dev-only.

Ownership:

- A: 6.1–6.3, 6.5.
- B: 6.4.

Gate: standard, full e2e, `npm test`, dry-run.

### Phase 7: React Router 7.18+ and guard removal (S)

7.1 **Upgrade** (Files: package.json, package-lock.json)

- Version checks:
  - `npm view react-router versions --json`: newest 7.x ≥ 7.18.0.
  - `npm view @react-router/dev@<v> peerDependencies`: vite ^8 and a wrangler range that includes the pin.
  - Same version for `@react-router/fs-routes`.
- Read the React Router changelog for 7.17 and 7.18:
  - future flags: `v8_*`, `unstable_optimizeDeps`;
  - single fetch and redirect headers;
  - CSRF / `allowedActionOrigins`;
  - typegen output.
- Confirm GHSA-chx6-hx7r-mcp5 is fixed in the chosen version.
- Pin `react-router`, `@react-router/dev` and `@react-router/fs-routes` exactly.
- Risk: Medium.

7.2 **Guard removal** (Files: server.ts, app/lib/**tests**/server.test.ts)

- Action:
  - Delete `MAX_PATH_SEGMENTS`, its comment and the early 404.
  - Replace the "deep paths" describe block with "a 3,000-segment path is handed to React Router (no early 404)".
  - Keep the security-header cases.
- Risk: Medium.

7.3 **E2E** (Files: tests/e2e/smoke.spec.ts lines 170-185, tests/e2e/security.spec.ts lines 186 and 208 (LONG_PATH case name) and 766-784, tests/e2e/support/hydration.ts comment)

- Action:
  - A 40-segment path now returns the designed HTML 404 from the `$` splat route: status 404, `text/html`, h1 notFound, `noindex`.
  - The `.data` variant returns 404.
  - Security headers are still present.
- Re-check the `/account` two-hop redirect chain (content.spec, smoke.spec). It depends on React Router's redirect precedence between parent and index loaders.
- Risk: Medium.

Single implementer.

Gate: standard, full e2e.

## Behaviour that must not change (enforced by tests)

| Contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Enforced by                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Cart cookie is `cart=<encoded id without gid prefix>; Path=/; SameSite=Lax; [Secure only over https]; HttpOnly`. It is read back to a gid, never visible to JS, and set identically by permalinks (302), discount links (303) and cart POSTs. Rejected requests (cross-origin 400, invalid cart input 400, malformed permalink 410) set no cookie.                                                                                                                                                                                                                                      | context.test.ts, security.spec (cookies, input validation, cross-origin) |
| Session cookie is HttpOnly, SameSite=Lax, Path=/, and Secure only over https.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | session.test.ts                                                          |
| CSP on documents only:<br>- nonce `'nonce-…'` (hex) in `default-src`, no `script-src`, fresh per response, on every SSR `<script>`;<br>- `object-src 'none'`; `form-action 'self' https://shopify.com`; `frame-ancestors 'none'`; `base-uri 'self'`;<br>- fonts.googleapis.com in style-src; fonts.gstatic.com in font-src; frame-src with `'self'`, youtube(-nocookie) and player.vimeo;<br>- checkout and store domains in connect-src;<br>- no `unsafe-eval` and no `*` or `unsafe-inline` in default-src;<br>- the browser blocks nonce-less inline scripts and foreign form posts. | entry-server.test.ts, security.spec CSP                                  |
| `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin` on documents, resource routes, `.data`, redirects, early or large-path 404s and action errors. Route-set values are kept; immutable headers are copied.                                                                                                                                                                                                                                                                                                                                        | server.test.ts, security.spec headers                                    |
| 404 handling: hostile `redirect`/`return_to` values give a plain 404 without Location (document and `.data`). A same-site value gives a 301 that keeps its query. `withSafeRedirectParams` semantics. `/admin` goes to the shop admin.                                                                                                                                                                                                                                                                                                                                                  | server.test.ts, security.spec 404s, redirect unit tests                  |
| Cart action:<br>- malformed body, missing or invalid `cartFormInput`, non-array lines or lineIds, unknown action → 400 with `{cart: null, errors: [CART_INVALID_MESSAGE], userErrors: [], warnings: [], analytics}`;<br>- errors-only Storefront answer → 502 with the generic message, raw API text never sent;<br>- `redirectTo` only same-origin (303), otherwise `/`;<br>- cross-origin POST → 400 (React Router CSRF check).                                                                                                                                                       | cart-action.test.ts, redirects.test.ts, security.spec                    |
| Storefront guard: errors-only results reject with a 502 Response; only the operation name (and codes outside dev) is logged.                                                                                                                                                                                                                                                                                                                                                                                                                                                            | storefront-errors.test.ts, context.test.ts                               |
| Newsletter:<br>- 8192 bytes accepted, larger → 413 based on content-length;<br>- invalid or unreadable → 400;<br>- mock message 200;<br>- silent honeypot;<br>- injection payloads rejected.                                                                                                                                                                                                                                                                                                                                                                                            | security.spec newsletter, newsletter tests                               |
| Sitemaps:<br>- index lists `<origin>/sitemap/<type>/<n>.xml` for products, collections, pages, blogs and articles (no metaObjects);<br>- child `<loc>` values come from `sitemapPath`, with `/` as fallback;<br>- `application/xml`, `max-age=86400`;<br>- unknown type or page → 404 without an API call;<br>- robots.txt rules.                                                                                                                                                                                                                                                       | sitemap-robots.test.ts, seo.spec                                         |
| SEO:<br>- exactly one title;<br>- one absolute canonical with the query dropped;<br>- `og:site_name` exactly once;<br>- og tags;<br>- noindex on cart, search, account, mock checkout and 404s.                                                                                                                                                                                                                                                                                                                                                                                         | seo.spec, content-routes.test.ts                                         |
| Product JSON-LD: `<` escaped; offers follow the selected variant and availability.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | seo.spec                                                                 |
| Mock badge text "Development mock data".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | global-setup preflight                                                   |
| Route announcer `#route-announcer` (role=status, focus moves to main).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | navigation.spec                                                          |
| Drawers follow the modal dialog pattern: focus moves in, Tab is trapped, the page is inert, Escape and overlay close, focus returns to the opener.                                                                                                                                                                                                                                                                                                                                                                                                                                      | support.spec, cart and navigation specs                                  |
| Account routes:<br>- `/account` → 302 `/account/orders` → 302 `/account/login` → 503 AccountUnavailable;<br>- `/account/profile`, `/addresses` and `/orders/1001` → 302 `/account/login`.                                                                                                                                                                                                                                                                                                                                                                                               | content.spec, smoke.spec                                                 |
| Permalinks: malformed → 410; valid → 302 to checkoutUrl with the cookie. Discount links: 303 to a safe target with tracking parameters carried over.                                                                                                                                                                                                                                                                                                                                                                                                                                    | security.spec, cart-permalink.test.ts                                    |
| Pagination:<br>- Load more and Load previous URLs (`direction` then `cursor`);<br>- nodes appended or prepended in order;<br>- pagination params dropped on filter change.                                                                                                                                                                                                                                                                                                                                                                                                              | collections, search and support specs                                    |
| Optimistic UI: optimistic lines keep their controls disabled until the server answers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | product.spec                                                             |
| Deep paths (>15 segments) → text/plain "Not found" 404, until Phase 7.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | server.test.ts, smoke and security specs                                 |
| No unexpected console errors or warnings.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | console guard                                                            |

## Intended behaviour changes (must be listed in the PRs)

- Dev-only GraphiQL and subrequest-profiler routes are removed (Phase 1).
- The dev server is Vite with workerd. Dev env comes from `.dev.vars`, not `.env` (Phase 1).
- The `powered-by: Shopify, Hydrogen` header and the `/api/mcp` proxy are gone (Phase 2).
- The cache name changes from `hydrogen` to `storefront`.
- Storefront GraphQL errors are logged redacted instead of as full GraphQLErrors (Phase 2).
- The session cookie is appended instead of overwriting other Set-Cookie headers (Phase 2, D-10).
- `cart_viewed` is no longer published (Phase 3).
- The consent script loads only when analytics is configured.
- The mock-shop console warning disappears and the e2e allowlist becomes empty (Phase 4c).
- Tracking cookies are forwarded only when analytics is enabled (Phase 4c).
- Stores with the account variables set still get the 503 page. POST `/account/logout` clears the session and redirects to `/`; before, it gave a dev 400 or a production 500 (Phase 5).
- Deep-path requests get the designed HTML 404 (Phase 7).

## Testing strategy

**Kept unchanged as the reference:**

- app/lib/**tests**/entry-server.test.ts
- app/lib/**tests**/cart-action.test.ts
- app/lib/**tests**/cart-permalink.test.ts
- app/lib/**tests**/redirects.test.ts
- app/lib/**tests**/sitemap-robots.test.ts
- app/lib/**tests**/policies.test.ts
- app/lib/**tests**/account.test.ts
- app/lib/session.test.ts
- app/lib/fragments.test.ts
- the search.loader, newsletter, content, menu, seo, urls and component tests

**Edited:**

| Test                                          | Phase    | Change                                                                                          |
| --------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| app/lib/context.test.ts                       | 2        | Import rename only. The assertions are the contract for Phases 2, 3 and 5.                      |
| app/lib/**tests**/server.test.ts              | 2, 4a, 7 | Phase 2: new mocks and cases. Phase 4a: redirect module mock. Phase 7: deep-path block removed. |
| app/lib/storefront-errors.test.ts             | 2        | Type import.                                                                                    |
| app/lib/**tests**/account-orders-link.test.ts | 0, 4b    | Phase 0: `Money` stub removed. Phase 4b: Hydrogen mock removed.                                 |
| app/lib/**tests**/content-routes.test.ts      | 4b       | Hydrogen mock removed.                                                                          |
| app/lib/search.page.test.tsx                  | 4c       | Mock `~/lib/analytics`.                                                                         |

**Added (write first; keep pure modules at ≥ 90%):**

- storefront: graphql, cache.server, client.server
- cart: cookie, queries (schema validation), cart.server, form-input, optimistic
- csp.server, sitemap.server, storefront-redirect.server
- pagination-variables, pagination (SSR), variants
- analytics: config, events, shop.server
- customer-account/stub.server

Coverage: `include` stays at `app/lib/**/*.ts` with 80% thresholds. `.tsx` wrappers are kept thin and covered by e2e.

**E2E:** every gate runs the full hermetic suite (mock mode, three projects). There are no new e2e specs, because analytics and the proxy cannot run against the mock. Optionally, add a security.spec case for the `//` → 301 rule, using the absolute URL `${baseURL}//collections/all`.

## Risks and mitigations

| Risk                                                                    | Mitigation                                                                                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `@cloudflare/vite-plugin` does not support Vite 8.3 / React Router 7.16 | Check in 1.1 before any edit; escalate; fallback Vite 7.                                                                           |
| E2E env not delivered (`.dev.vars.e2e` selection, `.env` leaking in)    | Committed `.dev.vars.e2e`; `env.e2e` in wrangler.jsonc; preflight badge check; fallbacks B and C.                                  |
| Security drift in CSP, cookies, headers, redirects or the proxy         | CSP golden captured from Hydrogen; cookie byte tests; security.spec on every gate; security-reviewer on Phases 2, 3, 4a, 4c and 5. |
| Stale or personal data from the cache                                   | Queries only; `CacheNone` for the cart; errors never stored; `private` bypasses; key includes the token; Set-Cookie never cached.  |
| Cache API inactive on *.workers.dev                                     | Production on a custom domain (owner); documented.                                                                                 |
| SFAPI proxy abuse                                                       | Public-token scope only (the client supplies its token); header allowlist; no server token forwarded.                              |
| `@defer` in Phase 2                                                     | D-8 override; removed by Phase 3.                                                                                                  |
| `workers-types` vs DOM-lib type conflicts                               | `skipLibCheck`; minimal local declarations as fallback.                                                                            |
| React Router 7.18 changes (flags, redirect precedence, typegen)         | Changelog review; full e2e; account redirect chain re-checked.                                                                     |
| Analytics cannot be verified against the mock                           | Pure-function unit tests; disabled by default; manual check against a store before enabling.                                       |
| Coverage below 80%                                                      | TDD per module; logic kept in `.ts`.                                                                                               |
| Conflicts in shared files (root.tsx, products.$handle.tsx, context.ts)  | Fixed merge order; single owner per file within a phase.                                                                           |
| Old dev server reused on port 3100                                      | Kill it before the first Phase 1 run, or use `E2E_PORT`.                                                                           |
| Mock carts lost when the workerd isolate restarts mid-run               | Global-setup warm-up (unchanged); do not edit app/ during runs.                                                                    |
| Static assets without security headers                                  | `public/_headers` (1.12).                                                                                                          |
| `.dev.vars` copied into the build output                                | dist/ is gitignored; deploy uses wrangler only.                                                                                    |

## Unverified assumptions (check at implementation time)

1. Compatibility of `@cloudflare/vite-plugin` with Vite 8.3.x and React Router 7.16 using `v8_viteEnvironmentApi` and `viteEnvironment: {name: 'ssr'}`. Also its `wrangler` peer range.
2. Plugin env handling: `.dev.vars.<env>` selection via `CLOUDFLARE_ENV`, no merging of `.dev.vars` or `.env*`, and whether `env.e2e` is required. Also whether `vite preview` reads vars, and whether `.dev.vars` is copied into dist/.
3. `react-router dev` supports `--port` and `--strictPort`.
4. The dev worker receives `Host`/`Origin` (CSRF check) and `Content-Length` (newsletter 413) unchanged.
5. `@cloudflare/workers-types` coexists with `lib: DOM` under `skipLibCheck` (as in former Remix-on-Cloudflare templates).
6. Vite or the plugin does not provide `process.env.NODE_ENV` in workerd. The plan sidesteps this with `import.meta.env.MODE`.
7. Build layout (dist/client, dist/server, `.wrangler/deploy/config.json`) and `wrangler deploy --dry-run` without credentials.
8. Workers Static Assets serve assets before the Worker, and `public/_headers` is applied and not served.
9. Cache API keys on the request origin work on a custom domain, and Miniflare implements `caches.open`.
10. graphql-codegen 5.0.2 plus jiti handles `import.meta.url`/`createRequire` in `codegen.ts`, and the prettier hook reproduces the CLI output byte for byte.
11. React Router treats a loader-returned non-redirect `Response` as data with its status (the stub's `login()`). Covered by the 5.1 test.
12. The React Router client honours `X-Remix-Redirect`/`X-Remix-Status` on a 204 for `.data` redirects (Hydrogen parity), in 7.16 and 7.18.
13. React Router 7.18 keeps the `v8_*` flags, the middleware context contract and redirect precedence, and fixes GHSA-chx6-hx7r-mcp5.
14. hydrogen-react `Money` renders without `ShopifyProvider` (F2; true in production today).
15. npm dedupes hydrogen-react to a single copy.
16. Shopify's consent script works with `consentDomain = location.host` through our proxy, and events with `shopifySalesChannel: 'hydrogen'` from a non-Oxygen host are accepted. Both need a live store.
17. The Hydrogen channel admin exposes the token, storefront id and account ids without the Hydrogen CLI (affects the docs).
18. A Wrangler 4.x release exists that satisfies both the plugin's peer and `@react-router/dev`'s `^3.28.2 || ^4.0.0`.

Verified by reading the installed packages:

- Hydrogen's peer `react-router ~7.16.0` and the preset contents.
- `@react-router/dev@7.16.0` peers (vite ^5–^8; wrangler optional ^3.28.2 || ^4.0.0).
- @graphql-codegen/cli 5.0.2 uses jiti.
- `@shopify/graphql-codegen@0.0.2` exports `preset`, `pluckConfig`, `ClientReturn` and `ClientVariablesInRestParams`.
- hydrogen-react 2026.4.4 export map (schema JSON files and both type subpaths).
- worktop cookie format.
- CSP defaults and merge rules.
- hex nonce.
- Minimal cart mutation fragment; `@defer` in the discount mutation.
- Storefront default cache (1 s + 86399 s).
- Pagination parameter order and `getPaginationVariables` defaults.
- Hydrogen's customer client behaviour in dev: a tunnel-400 on localhost.
- React Router's static-handler redirect handling in `callDataStrategy`.

## Success criteria

- [ ] Every phase (0, 1, 2, 3, 4a, 4b, 4c, 5, 6, 7) merged separately with lint, typecheck, `vitest --coverage` (≥ 80%), the full Playwright suite and `npm run build` green.
- [ ] `npm run dev:e2e` and the Playwright `webServer` start the worker in workerd via the Cloudflare plugin, in mock mode, from `.dev.vars.e2e`. tests/e2e/e2e.env is gone.
- [ ] `npm run codegen` is reproducible (no diff) and generates types from `@shopify/hydrogen-react` into our own `StorefrontQueries`/`CustomerAccountQueries`.
- [ ] Every item in "Behaviour that must not change" still passes; only the listed intended changes occur.
- [ ] The Phase 6 grep gate returns nothing. `npm ls` shows no Hydrogen, CLI, MiniOxygen, hydrogen-codegen or oxygen-workers-types, and exactly one `@shopify/hydrogen-react@2026.4.4`.
- [ ] Analytics is inactive unless `PUBLIC_CHECKOUT_DOMAIN` and `PUBLIC_STOREFRONT_ID` are set and the mock is off. The e2e console allowlist is empty.
- [ ] Customer accounts show the 503 page in every configuration, and the account routes are unchanged.
- [ ] React Router (and `@react-router/dev`, `@react-router/fs-routes`) is at ≥ 7.18, the segment guard and its tests are gone, deep paths return the designed 404, and `npm audit` shows no React Router advisory.
- [ ] `npx wrangler deploy --dry-run` passes. Docs explain `.dev.vars`, secrets, the custom-domain requirement and deploy/preview. AGENTS.md wording has been proposed to the owner.
