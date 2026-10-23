# Mellow storefront

A Shopify Hydrogen (React Router 7) storefront implementing the Mellow design:
homepage, product pages, collections with filtering and sorting, search, cart
drawer and cart page, customer accounts, About page and content pages.

## Getting started

```bash
npm install
cp .env.example .env   # fill in your store credentials, or set MOCK_STOREFRONT=true
npm run dev            # http://localhost:3000
```

Without a linked Shopify store, set `MOCK_STOREFRONT=true` in `.env` to run the
storefront against an in-memory demo catalog (development only). To connect
your store run `npx shopify hydrogen link` and `npx shopify hydrogen env pull`,
then follow [docs/shopify-setup.md](docs/shopify-setup.md) for the menus,
collections, metafields and metaobjects the storefront reads.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Hydrogen dev server with GraphQL codegen |
| `npm run build` | Production build (Oxygen worker) |
| `npm run preview` | Build and preview with MiniOxygen |
| `npm run typecheck` | React Router typegen + `tsc` |
| `npm run lint` | ESLint |
| `npm run codegen` | Regenerate Storefront / Customer Account API types |

## Project structure

```
app/
  components/        UI (header, footer, product card, cart, home sections, ui primitives)
  lib/content/       Typed content contracts, metaobject queries, metafield parsers, defaults
  lib/mock/          Development-only Storefront API mock (MOCK_STOREFRONT=true)
  routes/            React Router routes (flat routes convention)
  styles/            tokens.css (design tokens), app.css (shared), per-area stylesheets
docs/shopify-setup.md  Shopify configuration reference
```
