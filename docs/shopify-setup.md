# Connecting the Mellow storefront to Shopify

The storefront is a Shopify Hydrogen app (React Router 7). Commerce data
(products, variants, pricing, collections, cart, checkout, customer accounts)
comes from the Storefront API and the Customer Account API through Hydrogen's
built-in clients. Editorial content (hero, press logos, videos, reviews, FAQ,
About page) is modelled as Shopify metaobjects and metafields so merchants can
edit it in Shopify admin. Everything below has a documented fallback so the
site renders before configuration is complete.

## 1. Environment variables

Run `npx shopify hydrogen link` then `npx shopify hydrogen env pull` to create
`.env`, or fill it from `.env.example`:

| Variable                                                                              | Purpose                                                                                                           |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`                                                                      | Signs the session cookie (cart id, customer tokens).                                                              |
| `PUBLIC_STORE_DOMAIN`                                                                 | `your-store.myshopify.com`.                                                                                       |
| `PUBLIC_STOREFRONT_API_TOKEN`                                                         | Public Storefront API token (Hydrogen channel). In mock mode, a 32-character placeholder (see section 10).        |
| `PUBLIC_STOREFRONT_ID`                                                                | Hydrogen storefront id (analytics).                                                                               |
| `PUBLIC_CHECKOUT_DOMAIN`                                                              | Checkout domain (analytics / consent).                                                                            |
| `PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID`, `PUBLIC_CUSTOMER_ACCOUNT_API_URL`, `SHOP_ID` | Customer Account API (new customer accounts). Required for `/account`.                                            |
| `MOCK_STOREFRONT`                                                                     | Development only. `true` serves the demo catalog from `app/lib/mock` instead of Shopify. Never set in production. |
| `NEWSLETTER_WEBHOOK_URL`                                                              | Optional endpoint that receives newsletter signups as JSON.                                                       |

Private tokens never reach the browser: only `PUBLIC_*` variables are exposed,
and all Storefront API calls run in the Hydrogen server context.

## 2. Navigation menus (Online Store → Navigation)

| Handle      | Used by                                                                                               | Fallback                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `main-menu` | Header                                                                                                | Shop → `/collections/all`, Bath → `/collections/bath`, Bundles → `/collections/bundles`, About → `/pages/about` |
| `footer`    | Footer columns (nested menu items become columns; items of type Shop policy appear in the bottom bar) | Shop / Company / Support columns                                                                                |

## 3. Collections

| Handle                                     | Used by                                                                                                                                                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `most-loved`                               | Homepage "Explore Our Most Loved Sleep Products" (6 products). Falls back to best sellers when missing/empty. Override via the `featured_collection` field of the `mellow_settings` metaobject. |
| `all`                                      | "Shop" navigation target (`/collections/all` also works without a collection: it lists all products).                                                                                           |
| `bath`, `bundles`, `pillows`, `comforters` | Navigation targets (any handle works).                                                                                                                                                          |

Collection filtering uses Shopify's Storefront API filters (availability,
price, product type, variant options). Enable them for the Hydrogen sales
channel in **Search & Discovery** if they do not appear.

## 4. Product metafields (Settings → Custom data → Products)

| Namespace.key              | Type                                            | Used for                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reviews.rating`           | Rating (standard definition)                    | Star rating on cards and product page. A missing or unreadable value shows no stars. A Rating value is scaled to 5 stars by its `scale_max`.                                                                                                                                                                                                                                                      |
| `reviews.rating_count`     | Integer (standard definition)                   | Review count "(51,644)"                                                                                                                                                                                                                                                                                                                                                                           |
| `mellow.badge`             | Single line text                                | "BESTSELLER" / "NEW" pill on cards                                                                                                                                                                                                                                                                                                                                                                |
| `mellow.short_description` | Multi-line text                                 | Card copy (falls back to the product description)                                                                                                                                                                                                                                                                                                                                                 |
| `mellow.features`          | List of single line text                        | Feature bullets. Optional icon prefix: `snowflake\|Cool to the touch instantly`. The prefix must be one of these icon keys (case-insensitive): snowflake, heat, couch, wash, feather, moon, sparkle, leaf, shield, truck, check. A line without a valid prefix gets a default icon in rotation. An unrecognised prefix is not an icon, so the whole line is shown as written, including the pipe. |
| `mellow.materials`         | Multi-line text or rich text                    | "Materials" accordion                                                                                                                                                                                                                                                                                                                                                                             |
| `mellow.care`              | Multi-line text or rich text                    | "Care" accordion                                                                                                                                                                                                                                                                                                                                                                                  |
| `mellow.swatch_groups`     | JSON                                            | Groups colour swatches, e.g. `{"CloudCool™ Cooling Collection": ["Baby Blue","Blush","Sage","Stone"], "Lush Collection": ["Cream","Charcoal"]}`                                                                                                                                                                                                                                                   |
| `mellow.savings_note`      | Single line text                                | Overrides "Savings based on comparable value."                                                                                                                                                                                                                                                                                                                                                    |
| `mellow.featured_reviews`  | List of metaobject references (`mellow_review`) | Review carousel on the product page                                                                                                                                                                                                                                                                                                                                                               |

Colour swatches themselves come from Shopify's native option swatches
(Products → option values → swatch colour/image).

## 5. Metaobject definitions (Settings → Custom data → Metaobjects)

Field keys must match exactly. Missing fields fall back to the copy in
`app/lib/content/defaults.ts`. A list item is left out when its required field
is empty: `quote` for a testimonial, `body` for a review, `question` and
`answer` for an FAQ, `name` for a press logo, `image` for a lifestyle image and
`title` for an About value. A list falls back to its default copy only when
none of its items is valid.

| Type                          | Fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Used by                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `mellow_settings` (one entry) | `announcements` (list text), `trust_badges` (list text `icon\|Label`; optional icon from snowflake, heat, couch, wash, feather, moon, sparkle, leaf, shield, truck, check. An unrecognised prefix is shown as written, including the pipe, with a default icon), `savings_note`, `savings_explanation`, `featured_heading`, `featured_subheading`, `featured_collection` (collection ref), `featured_cta_label`, `ugc_heading`, `ugc_subheading`, `testimonials_heading`, `testimonials_subheading`, `faq_heading`, `newsletter_heading`, `newsletter_body`, `newsletter_cta_label` | Announcement bar, section headings, trust badges                    |
| `mellow_hero` (one)           | `rating_label`, `rating` (decimal; a missing or non-numeric value shows the default of 5 stars, so the hero never hides its stars), `headline` (multi-line; line breaks kept), `subheadline`, `cta_label`, `cta_url`, `image` (file)                                                                                                                                                                                                                                                                                                                                                | Homepage hero                                                       |
| `mellow_press_logo`           | `name`, `image` (file), `url`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | "As seen in" marquee (text fallback when no image)                  |
| `mellow_story` (one)          | `heading`, `body`, `video` (file, Shopify-hosted video), `video_url` (YouTube/Vimeo URL), `poster` (file), `captions` (file, WebVTT `.vtt`; self-hosted video only, labelled English), `cta_label`, `cta_url`                                                                                                                                                                                                                                                                                                                                                                       | "Redefining Sleep" section                                          |
| `mellow_ugc_video`            | `title`, `video` (file), `video_url`, `poster` (file), `captions` (file, WebVTT `.vtt`; self-hosted video only, labelled English), `product` (product ref)                                                                                                                                                                                                                                                                                                                                                                                                                          | "Sleep Better With Mellow" grid                                     |
| `mellow_lifestyle_image`      | `image` (file), `caption`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Image pair under the video grid                                     |
| `mellow_testimonial`          | `quote`, `author` (missing shows "Customer"), `rating` (Rating value scaled by its `scale_max`, or a decimal from 0 to 5; no stars when missing or unreadable), `product` (product ref)                                                                                                                                                                                                                                                                                                                                                                                             | Reviews section                                                     |
| `mellow_faq`                  | `question`, `answer`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | FAQ accordion                                                       |
| `mellow_about` (one)          | `hero_heading`, `hero_subheading`, `hero_cta_label`, `hero_cta_url`, `hero_image`, `story_heading`, `story_body`, `story_highlight`, `image_left`, `image_bottom`, `values` (list text `icon\|Title\|Body`; the icon is optional and is one of snowflake, heat, couch, wash, feather, moon, sparkle, leaf, shield, truck, check, defaulting to sparkle. An unrecognised prefix is not an icon, so the mistyped key becomes the title), `closing_heading`, `closing_body`, `closing_cta_label`, `closing_cta_url`                                                                    | `/pages/about` template                                             |
| `mellow_review`               | `rating` (Rating value scaled by its `scale_max`, or a decimal from 0 to 5; no stars when missing or unreadable), `title`, `body` (required; a review without it is skipped), `author` (missing shows "Customer"), `verified` (boolean; the "Verified buyer" badge shows only when the value is exactly `true`), `date`                                                                                                                                                                                                                                                             | Product review carousel (referenced from `mellow.featured_reviews`) |

Make every definition **accessible from the Storefront API** (Storefront API
access checkbox) or the queries return nothing and the fallbacks are used.

## 6. Pages and policies

- `/pages/about` uses the designed About template; a Shopify page with handle
  `about` adds its body (and SEO title/description) to the template.
- Other Shopify pages render at `/pages/<handle>`.
- Policies render from **Settings → Policies** at `/policies/<handle>`. The
  storefront serves five handles: `privacy-policy`, `shipping-policy`,
  `terms-of-service`, `refund-policy` and `subscription-policy`. Any other
  handle returns 404, and so does a handle for which Shopify has no policy.

## 7. Customer accounts

`/account` uses Hydrogen's Customer Account API integration (OAuth login on
Shopify, order history, profile, addresses). It requires the variables in
section 1; until then the account entry points show a "not configured" page.

## 8. Checkout, cart and analytics

The cart is Shopify's cart (Storefront API cart mutations through Hydrogen's
`context.cart`). Checkout uses the `checkoutUrl` returned by Shopify. Shopify
analytics come from Hydrogen's `Analytics.Provider` once
`PUBLIC_CHECKOUT_DOMAIN` and `PUBLIC_STOREFRONT_API_TOKEN` are set. The
storefront turns Hydrogen's privacy banner off (`withPrivacyBanner: false` in
`app/root.tsx`).

## 9. Newsletter

Shopify's Storefront API has no public marketing-subscription mutation.
Set `NEWSLETTER_WEBHOOK_URL` to a Shopify Flow / Klaviyo / Zapier endpoint
that creates the subscriber; the form posts `{email, source, storefront,
timestamp}` and reports success only when the webhook accepts the request.
The webhook call times out after 5 seconds, and a timeout or error response is
reported as a failed signup. The `source` is forwarded only when it is a
lower-case slug (letters, digits, `-` and `_`, up to 32 characters); anything
else is sent as `storefront`. A request whose `Content-Length` is over 8 KB is
rejected with status 413.

## 10. Local development without a store

Set `MOCK_STOREFRONT=true` in `.env` and run `npm run dev`. The storefront
serves the Mellow demo catalog (products, collections, metaobjects, cart)
from `app/lib/mock`. A badge in the corner of every page indicates mock mode.

- `PUBLIC_STOREFRONT_API_TOKEN` must be a 32-character placeholder that does not
  start with `shpat_`, for example `mockmockmockmockmockmockmockmock`. Hydrogen
  logs a console error otherwise.
- `tests/e2e/e2e.env` is a committed mock-mode environment, used by
  `npm run dev:e2e` and the Playwright suite on port 3100.
- Checkout is not available in mock mode: `/dev/mock-checkout` explains that a
  real store is needed.
- Cart permalinks accept mock variant ids, for example
  `/cart/cloudalign-pillow-1:1?discount=MELLOW10`.
- The demo catalog has 13 products. Three of them (Silk Sleep Mask, Linen Sheet
  Set and Weighted Blanket) appear only under Shop All, which therefore has a
  second page: 12 products, then one more after "Load more".
- A Storefront API query that fails with GraphQL errors and no data returns a
  502, as it does on a live store.

See `app/lib/mock/README.md`.
