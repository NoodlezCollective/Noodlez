# Development Storefront API mock

`MOCK_STOREFRONT=true` (in `.env`, development only) replaces the Shopify
Storefront API with an in-process GraphQL executor so the Mellow storefront can
be developed and reviewed before a Shopify store is linked.

- Queries and mutations are executed by `graphql-js` against the **real
  Storefront API schema** that ships with Hydrogen, so documents are validated
  exactly like the live API validates them.
- Data comes from `data/catalog.ts` (products, collections, menus, pages,
  policies) and `data/content.ts` (metaobjects generated from the storefront's
  fallback content).
- The cart is an in-memory store (`cart.server.ts`). Cart ids are kept in the
  normal Hydrogen `cart` cookie; Hydrogen's `CartForm` actions, optimistic UI
  and cart drawer run unchanged. Discount codes `MELLOW10` and `WELCOME15` are
  applicable. `checkoutUrl` points at `/dev/mock-checkout`, which explains that
  checkout requires a real store.
- Customer accounts are **not** mocked; `/account` requires Shopify's Customer
  Account API configuration.

The mock is only loaded when `import.meta.env.DEV` is true (see
`app/lib/context.ts`), so production bundles never include it. A badge in the
bottom-left corner of every page indicates when mock data is being served.
