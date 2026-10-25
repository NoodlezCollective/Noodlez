# Development Storefront API mock

`MOCK_STOREFRONT=true` (in `.env`, development only) replaces the Shopify
Storefront API with an in-process GraphQL executor so the Mellow storefront can
be developed and reviewed before a Shopify store is linked.

- Queries and mutations are executed by `graphql-js` against the **real
  Storefront API schema** that ships with Hydrogen, so documents are validated
  exactly like the live API validates them.
- Data comes from `data/catalog.ts` (products, collections, menus, pages,
  policies) and `data/content.ts` (metaobjects generated from the storefront's
  fallback content). The catalog has 13 products. Silk Sleep Mask, Linen Sheet
  Set and Weighted Blanket belong to Shop All only, so `/collections/all` has a
  second page (12 products per page). The demo has no subscription policy, so
  `/policies/subscription-policy` returns 404, and the seeded videos have no
  captions file.
- The cart is an in-memory store (`cart.server.ts`). Cart ids are kept in the
  normal `cart` cookie; the app's own `CartForm` actions, optimistic UI and
  cart drawer run unchanged. Discount codes `MELLOW10` and `WELCOME15` are
  applicable. `checkoutUrl` points at `/dev/mock-checkout`, which explains that
  checkout requires a real store. Cart permalinks accept mock variant ids here
  (`/cart/cloudalign-pillow-1:1?discount=MELLOW10`, see
  `app/routes/cart.$lines.tsx`); a live store accepts only numeric variant ids.
- Like the live API, a failed operation answers `{errors}` (with whatever data
  resolved) instead of throwing. `app/lib/context.ts` then rejects a result that
  has errors and no data with a 502, in development and production alike.
- Customer accounts are **not** mocked; `/account` requires Shopify's Customer
  Account API configuration.

Mock mode needs a 32-character `PUBLIC_STOREFRONT_API_TOKEN` placeholder that
does not start with `shpat_`, for example `mockmockmockmockmockmockmockmock`.
Hydrogen's `useCustomerPrivacy` logs a console error for any other length (or a
`shpat_` token). `.dev.vars.example` states the same rule, and `.dev.vars.e2e`
is a committed mock-mode environment: `npm run dev:e2e` and the Playwright
suite (port 3100) use it through `CLOUDFLARE_ENV=e2e`.

When `data/catalog.ts` changes, update `tests/e2e/support/catalog.ts` in the same
commit. The Playwright suite checks against the hand-typed constants in that
file, not against these seeds.

The mock is only loaded when `import.meta.env.DEV` is true (see
`app/lib/context.ts`), so production bundles never include it. A badge in the
bottom-right corner of every page indicates when mock data is being served.
