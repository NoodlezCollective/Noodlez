# {AppName} Shopify theme

A Shopify Online Store 2.0 theme that is a one-to-one port of the React Router
storefront in `app/`: the same stylesheet, the same HTML and the same copy, so
the live shop looks like the storefront preview. Everything a merchant edits
lives in the theme editor (sections, blocks and theme settings) or in the
product metafields documented in `docs/shopify-setup.md`.

## Install

1. Package the theme: `npm run theme:package` (writes `{AppName}-1.0.0.zip` in
   this folder), or zip the contents of this folder yourself (`assets`,
   `config`, `layout`, `locales`, `sections`, `snippets`, `templates` at the
   root of the zip).
2. Shopify admin → Online Store → Themes → Add theme → Upload zip file.
3. Customize → publish when the content below is in place.

With the Shopify CLI and a Theme Access token you can also push and preview
directly: `shopify theme push --store ynvg9n-mw` and `shopify theme dev`.

## Store content the theme expects

| Where                     | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Online Store → Navigation | `main-menu` (header; falls back to Shop / Bath / Bundles / About) and `footer` with child menus **Shop**, **Learn**, **Support** and **Social** (a child menu titled Social renders as icon links: Instagram, Facebook, TikTok).                                                                                                                                                                                                                                                                                                                                                                                                |
| Collections               | `most-loved` feeds the home page's "Explore Our Most Loved Sleep Products" (falls back to all products).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Products                  | Metafields `reviews.rating`, `reviews.rating_count`, `mellow.badge`, `mellow.short_description`, `mellow.features`, `mellow.materials`, `mellow.care`, `mellow.swatch_groups`, `mellow.savings_note`, `mellow.featured_reviews`, `mellow.sold_recently`, `mellow.size_guide`, `mellow.pack_tiers`, `mellow.proof`, `mellow.addon`, `mellow.addon_note`, exactly as `docs/shopify-setup.md` section 4 describes them. Colour swatches come from Shopify's native option swatches.                                                                                                                                                |
| Metaobjects               | `mellow_review` entries referenced from `mellow.featured_reviews` (rating, title, body, author, verified, date). The other metaobjects of the storefront are theme sections here.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Pages                     | `about` with template **page.about**. One page per policy with template **page.policy** and these handles: `privacy-policy`, `terms-of-service`, `refund-policy`, `shipping-policy`, `contact-information`, `legal-notice`. A page `policies` with template **page.policies** is the index. Until the merchant pastes the policy text into a page body, the theme renders the documents shipped in `snippets/policy-body-*.liquid` (the texts from `app/lib/content/policies.ts`, bracketed placeholders included). Shopify's own `/policies/*` pages still exist for checkout; paste the same texts under Settings → Policies. |
| Theme settings            | Brand name (replaces the `{AppName}` placeholder everywhere), rating label, cart drawer title, colours, trust badges, savings note, free-gift threshold/label/code, footer call to action and copyright.                                                                                                                                                                                                                                                                                                                                                                                                                        |

The home page sections (hero, press bar, story, stat rings, featured products,
video grid, lifestyle images, testimonials, FAQ, newsletter) ship with the
storefront's default copy and placeholder artwork; replace images and text in
the theme editor.

## Structure

- `assets/theme.css` is `app/styles/*.css` concatenated in the storefront's load
  order; the editor colour settings override its tokens in
  `snippets/css-variables.liquid`.
- `assets/theme.js` owns drawers, the cart (Ajax API plus Section Rendering API
  re-renders) and the cart count pulse; `product.js`, `collection.js` and
  `home.js` add the page behaviours. No build step, no dependencies.
- `snippets/icon.liquid` is generated from `app/components/ui/Icons.tsx`.
- `PORTING.md` records the porting rules and the file ownership of the port.

## Known differences from the storefront

- Each section is wrapped in Shopify's `div.shopify-section`; the storefront's
  page wrappers (`div.home`, `div.about`) are gone. No stylesheet rule targets
  them.
- Filters, sorting and pagination use Shopify's parameters (`filter.v.*`,
  `sort_by`, `page`) with the storefront's markup. Load more fetches the next
  page through the Section Rendering API.
- Variants are selected with `?variant=ID`; cart line links keep the option
  query parameters.
- Checkout is Shopify's; gift cards are redeemed at checkout, so the cart's
  gift-card field shows a note instead of applying the card.
- Customer accounts are Shopify's own pages (login, register, addresses,
  orders) styled with the storefront's account styles; the storefront's
  "accounts not configured" page has no equivalent.
- The blog index is `/blogs/<handle>`; the storefront's `/blogs` overview does
  not exist in Shopify.
- The newsletter form creates a Shopify customer tagged `newsletter` (full page
  submit) instead of posting to the storefront's webhook.
- Video captions (`.vtt`) cannot be set from section settings.

## Checking parity locally

```bash
npm run theme:check                                  # Shopify theme check
npm run theme:preview                                # renders the theme with the mock catalog on http://localhost:3200
node scripts/theme-preview/capture.cjs               # DOM + screenshots of every page and state
npm run dev                                          # storefront in mock mode (MOCK_STOREFRONT=true), then
node scripts/theme-preview/capture-storefront.cjs    # the storefront's DOM as the reference
node scripts/theme-preview/compare.cjs               # per-page differences in classes, attributes and text
```

The local renderer (`scripts/theme-preview/server.mjs`) implements the parts of
Shopify Liquid the theme uses, fed by `app/lib/mock/data`. It is a parity tool:
Shopify is the reference for anything it renders differently.
