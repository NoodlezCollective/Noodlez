# Porting guide: storefront → {AppName} Liquid theme

This theme is a one-to-one port of the React Router storefront in `app/`.
The goal is pixel parity: the theme uses the **same stylesheet** (`assets/theme.css`
is `app/styles/*.css` concatenated in the order `root.tsx` loads them) and the
**same HTML** (classes, attributes, nesting, text) as the storefront renders.

## References

- Rendered DOM of every storefront page and state (hydrated, scripts removed):
  `/tmp/claude-0/-home-user-Noodlez/f8b080fb-226f-53ee-8318-35044f1bc14a/scratchpad/theme-ref/html/*.html`
  (home, collections, shop-all, collection-pillows, collection-filtered,
  product, product-swatches, search, search-empty, cart-empty, cart,
  cart-drawer, search-drawer, mobile-menu, about, journal, policies,
  policy-*, account, not-found). **This DOM is the contract.**
- React sources: `app/components/**`, `app/routes/*.tsx`.
- Copy defaults: `app/lib/content/defaults.ts`, `app/lib/content/policies.ts`,
  `app/lib/menu.ts` (fallback menus), mock seeds `app/lib/mock/data/*.ts`.
- Metafield/metaobject contract: `docs/shopify-setup.md`.

## Rules

1. **Same markup.** Copy the element structure, class names, ARIA attributes,
   `role`s, `aria-label`s, and visible text from the captured DOM. Drop React
   artifacts only: `data-discover`, `<!--$-->`/`<!--/$-->` comments, `nonce`,
   React ids like `:R1j5:` (use stable ids such as `cart-drawer-title`).
2. **No new CSS.** Everything is already in `assets/theme.css`. If a class truly
   does not exist there, you are not matching the DOM. Do not use
   `{% stylesheet %}` or `{% javascript %}`; JavaScript goes in `assets/*.js`.
3. **Shared snippets** (use, do not duplicate):
   - `icon` — `{% render 'icon', name: 'cart', size: 20, class: '', title: '' %}`;
     names: search cart user menu close chevron-left chevron-right chevron-down
     arrow-right plus minus check trash play star shield truck snowflake heat
     couch wash feather moon sparkle leaf quote mail info filter instagram
     facebook tiktok. `feature: true` makes unknown names fall back to sparkle.
   - `stars` — `{% render 'stars', rating: 4.9, count: 51644, label: '', size: 'sm' %}`
   - `price` — `{% render 'price', price: cents, compare_at_price: cents, size: 'md', class: '' %}`
   - `product-card` — `{% render 'product-card', product: p, heading_level: 3, loading: 'lazy' %}`
   - `marquee` — capture the items, then `{% render 'marquee', content: items, duration: 45, gap: 18, label: '' %}`
   - `image` — Shopify image or `placeholder: 'placeholder-hero.svg'`
   - `number` — thousands separators: `{% render 'number', value: 2184 %}`
   - `meta-tags`, `css-variables` (layout only)
4. **Brand placeholder.** Copy that contains `{AppName}` stays literal in
   section defaults and is rendered through
   `{{ text | replace: brand_token, settings.brand_name }}` after
   `{%- assign brand_token = '{AppName}' -%}` at the top of the file. Never
   write `'{AppName}'` inside `{{ … }}`: Shopify's tokenizer ends an output
   tag at the first `}`, so the upload fails with "Liquid templates that can't
   be parsed" (theme check does not catch it; `scripts/theme-preview/liquid-check.rb`
   does). Inside `{% %}` tags the literal is fine. Wordmark and watermark use
   `settings.brand_name`, never `shop.name`.
5. **URLs** come from `routes.*` (`routes.cart_url`, `routes.search_url`,
   `routes.all_products_collection_url`, `routes.root_url`, `collection.url`,
   `product.url`, `page.url`). Never hardcode `/cart` or `/search`. Policy
   pages: Shopify's `/policies/<handle>` has no template, so each policy is also
   a Page with template `page.policy` (see "Policies" below).
6. **Content model.** Editorial content from `defaults.ts` becomes section
   settings/blocks whose `default`s equal the storefront defaults, so an
   untouched theme renders the preview's copy. Product data comes from the
   `mellow.*` and `reviews.*` metafields listed in `docs/shopify-setup.md`
   (`product.metafields.mellow.badge.value`, list metafields are arrays via
   `.value`, `reviews.rating.value.rating` / `.scale_max`, metaobject references
   via `.value` and `.value.<field>`). Fall back exactly as the React code does.
7. **Sections** get a `{% schema %}` with `name`, `settings`, `blocks` where the
   storefront has lists, and `presets` for home sections. JSON templates list the
   sections in the storefront's order. Section groups: `sections/header-group.json`
   (announcement-bar, header), `footer-group.json` (footer),
   `overlay-group.json` (cart-drawer, search-drawer, mobile-menu).
8. **JavaScript contract** (`assets/theme.js`, owned by the header/footer task;
   everyone else codes against it):
   - `theme.drawer.open(name)` / `theme.drawer.close()`; buttons with
     `data-drawer-open="cart|search|mobile"`; drawers are `.overlay[data-drawer="…"]`,
     `.expanded` when open, focus trapped, Escape and `.close-outside` close.
   - `theme.cart.add(items, {open: true})` → POST `routes.cart_add_url`
     (`items: [{id, quantity}]`), re-renders the drawer via the Section Rendering
     API (`?sections=cart-drawer,header`), pulses `.cart-toggle__count`
     (`is-pulsing`), dispatches `theme:cart:updated` with the cart JSON.
   - `theme.cart.change(line, quantity)` → `routes.cart_change_url`.
   - `theme.money(cents)` formats with `window.theme.moneyFormat`.
   - Section JS files: `product.js` (product task), `home.js` (home task),
     `collection.js` (collection/search task). Load them from their sections
     with `{{ 'x.js' | asset_url | script_tag }}` guarded by `defer`.
9. **Text.** Literal English strings are fine (theme check translation rules
   are off). Keep the storefront's exact wording and capitalisation.
10. **Validate** your files: from the theme folder run
    `npx -y @shopify/cli@3.93.2 theme check` and fix every error in files you
    wrote. Do not edit files owned by another task.

## Policies

`app/lib/content/policies.ts` holds six documents (handle, title, hero
headline/subheadline/image, body HTML). In Shopify they become Pages with the
`page.policy` template (`templates/page.policy.json` → `sections/policy-hero` +
`sections/main-page`), plus `templates/page.policies.json` for the index. The
storefront URL `/policies/privacy-policy` is replaced by `/pages/privacy-policy`;
the footer links point at the pages. The hero copy per policy ships as section
defaults keyed by `page.handle` in `sections/policy-hero.liquid`.

## File ownership

| Task                  | Files                                                                                                                                                                                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| header/footer/drawers | `sections/announcement-bar, header, footer, cart-drawer, search-drawer, mobile-menu`, `sections/*-group.json`, `snippets/cart-line.liquid`, `snippets/cart-summary.liquid` (+ gift bar), `snippets/cart-empty.liquid`, `assets/theme.js`                                                                          |
| home                  | `sections/hero, press-bar, featured-products, story, ugc-grid, lifestyle-gallery, stat-rings, testimonials, faq, newsletter`, `templates/index.json`, `assets/home.js`                                                                                                                                            |
| product               | `sections/main-product, product-reviews, recommended-products`, `snippets/product-*.liquid`, `templates/product.json`, `assets/product.js`                                                                                                                                                                        |
| collection/search     | `sections/main-collection, collection-banner, main-list-collections, main-search`, `snippets/filter-*.liquid`, `templates/collection.json, list-collections.json, search.json`, `assets/collection.js`, predictive results markup inside the search drawer via `snippets/predictive-results.liquid`               |
| cart/content          | `sections/main-cart, main-page, policy-hero, policies-index, about-*, main-404, main-blog, main-article, main-password, customers`, `templates/cart.json, page.json, page.about.json, page.policy.json, page.policies.json, 404.json, blog.json, article.json, password.json, gift_card.liquid, customers/*.json` |
