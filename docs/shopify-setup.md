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

| Variable | Purpose |
| --- | --- |
| `SESSION_SECRET` | Signs the session cookie (cart id, customer tokens). |
| `PUBLIC_STORE_DOMAIN` | `your-store.myshopify.com`. |
| `PUBLIC_STOREFRONT_API_TOKEN` | Public Storefront API token (Hydrogen channel). |
| `PUBLIC_STOREFRONT_ID` | Hydrogen storefront id (analytics). |
| `PUBLIC_CHECKOUT_DOMAIN` | Checkout domain (analytics / consent). |
| `PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID`, `PUBLIC_CUSTOMER_ACCOUNT_API_URL`, `SHOP_ID` | Customer Account API (new customer accounts). Required for `/account`. |
| `MOCK_STOREFRONT` | Development only. `true` serves the demo catalog from `app/lib/mock` instead of Shopify. Never set in production. |
| `NEWSLETTER_WEBHOOK_URL` | Optional endpoint that receives newsletter signups as JSON. |

Private tokens never reach the browser: only `PUBLIC_*` variables are exposed,
and all Storefront API calls run in the Hydrogen server context.

## 2. Navigation menus (Online Store → Navigation)

| Handle | Used by | Fallback |
| --- | --- | --- |
| `main-menu` | Header | Shop → `/collections/all`, Bath → `/collections/bath`, Bundles → `/collections/bundles`, About → `/pages/about` |
| `footer` | Footer columns (nested menu items become columns; items of type Shop policy appear in the bottom bar) | Shop / Company / Support columns |

## 3. Collections

| Handle | Used by |
| --- | --- |
| `most-loved` | Homepage "Explore Our Most Loved Sleep Products" (6 products). Falls back to best sellers when missing/empty. Override via the `featured_collection` field of the `mellow_settings` metaobject. |
| `all` | "Shop" navigation target (`/collections/all` also works without a collection: it lists all products). |
| `bath`, `bundles`, `pillows`, `comforters` | Navigation targets (any handle works). |

Collection filtering uses Shopify's Storefront API filters (availability,
price, product type, variant options). Enable them for the Hydrogen sales
channel in **Search & Discovery** if they do not appear.

## 4. Product metafields (Settings → Custom data → Products)

| Namespace.key | Type | Used for |
| --- | --- | --- |
| `reviews.rating` | Rating (standard definition) | Star rating on cards and product page |
| `reviews.rating_count` | Integer (standard definition) | Review count "(51,644)" |
| `mellow.badge` | Single line text | "BESTSELLER" / "NEW" pill on cards |
| `mellow.short_description` | Multi-line text | Card copy (falls back to the product description) |
| `mellow.features` | List of single line text | Feature bullets. Optional icon prefix: `snowflake|Cool to the touch instantly`. Icons: snowflake, heat, couch, wash, feather, moon, sparkle, leaf, shield, truck, check |
| `mellow.materials` | Multi-line text or rich text | "Materials" accordion |
| `mellow.care` | Multi-line text or rich text | "Care" accordion |
| `mellow.swatch_groups` | JSON | Groups colour swatches, e.g. `{"CloudCool™ Cooling Collection": ["Baby Blue","Blush","Sage","Stone"], "Lush Collection": ["Cream","Charcoal"]}` |
| `mellow.savings_note` | Single line text | Overrides "Savings based on comparable value." |
| `mellow.featured_reviews` | List of metaobject references (`mellow_review`) | Review carousel on the product page |

Colour swatches themselves come from Shopify's native option swatches
(Products → option values → swatch colour/image).

## 5. Metaobject definitions (Settings → Custom data → Metaobjects)

Field keys must match exactly. All fields are optional; missing fields fall
back to the copy in `app/lib/content/defaults.ts`.

| Type | Fields | Used by |
| --- | --- | --- |
| `mellow_settings` (one entry) | `announcements` (list text), `trust_badges` (list text `icon|Label`), `savings_note`, `savings_explanation`, `featured_heading`, `featured_subheading`, `featured_collection` (collection ref), `featured_cta_label`, `ugc_heading`, `ugc_subheading`, `testimonials_heading`, `testimonials_subheading`, `faq_heading`, `newsletter_heading`, `newsletter_body`, `newsletter_cta_label` | Announcement bar, section headings, trust badges |
| `mellow_hero` (one) | `rating_label`, `rating` (decimal), `headline` (multi-line; line breaks kept), `subheadline`, `cta_label`, `cta_url`, `image` (file) | Homepage hero |
| `mellow_press_logo` | `name`, `image` (file), `url` | "As seen in" marquee (text fallback when no image) |
| `mellow_story` (one) | `heading`, `body`, `video` (file, Shopify-hosted video), `video_url` (YouTube/Vimeo URL), `poster` (file), `cta_label`, `cta_url` | "Redefining Sleep" section |
| `mellow_ugc_video` | `title`, `video` (file), `video_url`, `poster` (file), `product` (product ref) | "Sleep Better With Mellow" grid |
| `mellow_lifestyle_image` | `image` (file), `caption` | Image pair under the video grid |
| `mellow_testimonial` | `quote`, `author`, `rating`, `product` (product ref) | Reviews section |
| `mellow_faq` | `question`, `answer` | FAQ accordion |
| `mellow_about` (one) | `hero_heading`, `hero_subheading`, `hero_cta_label`, `hero_cta_url`, `hero_image`, `story_heading`, `story_body`, `story_highlight`, `image_left`, `image_bottom`, `values` (list text `icon|Title|Body`), `closing_heading`, `closing_body`, `closing_cta_label`, `closing_cta_url` | `/pages/about` template |
| `mellow_review` | `rating`, `title`, `body`, `author`, `verified` (boolean), `date` | Product review carousel (referenced from `mellow.featured_reviews`) |

Make every definition **accessible from the Storefront API** (Storefront API
access checkbox) or the queries return nothing and the fallbacks are used.

## 6. Pages and policies

* `/pages/about` uses the designed About template; a Shopify page with handle
  `about` adds its body (and SEO title/description) to the template.
* Other Shopify pages render at `/pages/<handle>`.
* Policies render from **Settings → Policies** at `/policies/<handle>`.

## 7. Customer accounts

`/account` uses Hydrogen's Customer Account API integration (OAuth login on
Shopify, order history, profile, addresses). It requires the variables in
section 1; until then the account entry points show a "not configured" page.

## 8. Checkout, cart and analytics

The cart is Shopify's cart (Storefront API cart mutations through Hydrogen's
`context.cart`). Checkout uses the `checkoutUrl` returned by Shopify. Shopify
analytics and the privacy banner come from Hydrogen's `Analytics.Provider`
once `PUBLIC_CHECKOUT_DOMAIN` and `PUBLIC_STOREFRONT_API_TOKEN` are set.

## 9. Newsletter

Shopify's Storefront API has no public marketing-subscription mutation.
Set `NEWSLETTER_WEBHOOK_URL` to a Shopify Flow / Klaviyo / Zapier endpoint
that creates the subscriber; the form posts `{email, source, storefront,
timestamp}` and reports success only when the webhook accepts the request.

## 10. Local development without a store

Set `MOCK_STOREFRONT=true` in `.env` and run `npm run dev`. The storefront
serves the Mellow demo catalog (products, collections, metaobjects, cart)
from `app/lib/mock`. A badge in the corner of every page indicates mock mode.
See `app/lib/mock/README.md`.
