# Connecting the Mellow storefront to Shopify

The storefront is a React Router 7 app on Cloudflare Workers. Shopify Hydrogen
has been removed (see docs/implementation-report.md, section 13). Commerce data
(products, variants, pricing, collections, cart and checkout) comes from the
Storefront API through the storefront's own client in `app/lib/storefront`.
Customer accounts are deferred. Editorial content (hero, press logos, videos,
reviews, FAQ, About page) is modelled as Shopify metaobjects and metafields so
merchants can edit it in Shopify admin. Everything below has a documented
fallback so the site renders before configuration is complete.

## 0. Liquid theme instead of the headless storefront

`{AppName}/` is a Shopify theme that reproduces this storefront one to one
(same stylesheet, markup and copy). Upload it as a zip (Online Store → Themes →
Add theme) when the shop should run inside Shopify without a Worker, secrets or
a custom domain. Its README lists the menus, collection, product metafields,
pages and theme settings it expects; sections 2 to 6 below apply to it as well,
except that the storefront's metaobjects are theme sections there and policies
are Pages with the `page.policy` template.

## 1. Environment variables

Development: copy `.dev.vars.example` to `.dev.vars` (gitignored) and fill it in.
Wrangler and the Vite dev server read `.dev.vars` as the Worker's variables. A
`.env` file is not read. The values come from the storefront settings of the
Hydrogen sales channel in the Shopify admin (Shopify admin > Sales channels >
Hydrogen > Storefront settings, as `.dev.vars.example` says).

Production: set the same variables on the Worker, with `npx wrangler secret put
<NAME>` for each secret, or as plain dashboard variables (`keep_vars` keeps those
across deploys).

| Variable                                                                              | Purpose                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`                                                                      | Required. The secret that signs the session cookie. Use a long random value.                                                                                                            |
| `PUBLIC_STORE_DOMAIN`                                                                 | Required. `your-store.myshopify.com`.                                                                                                                                                   |
| `PUBLIC_STOREFRONT_API_TOKEN`                                                         | Required. The public Storefront API token of the sales channel. A private (`shpat_`) token here switches analytics off and logs an error. In mock mode, any placeholder (section 10).   |
| `PRIVATE_STOREFRONT_API_TOKEN`                                                        | Optional, recommended for production. A private token for the Worker's own Storefront API calls, which then send the buyer's IP. Never sent to browsers or to the Storefront API proxy. |
| `PUBLIC_STOREFRONT_ID`                                                                | Storefront id of the sales channel. Analytics need it together with `PUBLIC_CHECKOUT_DOMAIN` (section 8).                                                                               |
| `PUBLIC_CHECKOUT_DOMAIN`                                                              | Checkout domain of the sales channel. Analytics need it together with `PUBLIC_STOREFRONT_ID` (section 8).                                                                               |
| `PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID`, `PUBLIC_CUSTOMER_ACCOUNT_API_URL`, `SHOP_ID` | Customer Account API settings. Nothing uses them for sign-in yet, because customer accounts are deferred (section 7).                                                                   |
| `MOCK_STOREFRONT`                                                                     | Development only. `true` serves the demo catalog from `app/lib/mock` instead of Shopify. Production builds never load the mock. Remove the variable once the store is linked.           |
| `NEWSLETTER_WEBHOOK_URL`                                                              | Optional endpoint that receives newsletter signups as JSON.                                                                                                                             |

`npm run store:check` reads the variables (process environment first, then
`.dev.vars`), calls the Storefront API with them and prints, section by
section, what the store provides and what still uses the storefront's built-in
copy. It changes nothing in Shopify. `npm run store:check -- --write-dev-vars`
also writes `.dev.vars` from the environment with `MOCK_STOREFRONT=false`, for
hosts that hold the values as environment variables.

The browser never receives a private token. The public token reaches the browser
only in the analytics consent configuration, and only while analytics are on. The
Storefront API proxy adds the public token on the server.

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
| `mellow.featured_reviews`  | List of metaobject references (`mellow_review`) | Review carousel on the product page; the first review is also quoted above the product title                                                                                                                                                                                                                                                                                                      |
| `mellow.sold_recently`     | Integer                                         | "2,184 sold in the last 7 days" velocity badge under the price (hidden when missing or 0)                                                                                                                                                                                                                                                                                                         |
| `mellow.size_guide`        | Single line text                                | One-line fit rule under the Size pills, e.g. `Under 5'7" = Regular · Over 5'7" = High`                                                                                                                                                                                                                                                                                                            |
| `mellow.pack_tiers`        | List of single line text                        | Quantity tiers in the buy box as `quantity\|Label\|Note`, e.g. `2\|Pair\|Most popular`. Needs at least two tiers; a tier sets the quantity added                                                                                                                                                                                                                                                  |
| `mellow.proof`             | List of single line text                        | Authority chips under the trust badges, same `icon\|Text` format as `mellow.features`                                                                                                                                                                                                                                                                                                             |
| `mellow.addon`             | Product reference                               | One-click companion offered in the buy box (its first available variant is added with the product)                                                                                                                                                                                                                                                                                                |
| `mellow.addon_note`        | Single line text                                | Why the add-on belongs in the box, e.g. `Ships fitted on the pillow`                                                                                                                                                                                                                                                                                                                              |

Colour swatches themselves come from Shopify's native option swatches
(Products → option values → swatch colour/image).

## 5. Metaobject definitions (Settings → Custom data → Metaobjects)

Field keys must match exactly. Missing fields fall back to the copy in
`app/lib/content/defaults.ts`. A list item is left out when its required field
is empty: `quote` for a testimonial, `body` for a review, `question` and
`answer` for an FAQ, `name` for a press logo, `image` for a lifestyle image and
`title` for an About value. A list falls back to its default copy only when
none of its items is valid.

| Type                          | Fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Used by                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `mellow_settings` (one entry) | `announcements` (list text), `trust_badges` (list text `icon\|Label`; optional icon from snowflake, heat, couch, wash, feather, moon, sparkle, leaf, shield, truck, check. An unrecognised prefix is shown as written, including the pipe, with a default icon), `savings_note`, `savings_explanation`, `featured_heading`, `featured_subheading`, `featured_collection` (collection ref), `featured_cta_label`, `ugc_heading`, `ugc_subheading`, `testimonials_heading`, `testimonials_subheading`, `faq_heading`, `newsletter_heading`, `newsletter_body`, `newsletter_cta_label`, `cart_heading` (cart drawer title, default "Your Sleep Stack"), `rating_label` ("124,952+ Happy Sleepers" on banners and the footer card), `footer_cta_heading`, `footer_cta_label`, `footer_cta_url` (the footer's call-to-action card), `copyright` (the footer's last line), `free_gift_threshold` (decimal, shop currency; 0 switches the reward bar off), `free_gift_label` ("a free Silk Sleep Mask"), `free_gift_code` (discount code shown once the threshold is met), `proof_stats` (list text `95\|sleep at their ideal temperature`; the animated rings on the home page) | Announcement bar, section headings, trust badges, cart reward bar, proof rings |
| `mellow_hero` (one)           | `rating_label`, `rating` (decimal; a missing or non-numeric value shows the default of 5 stars, so the hero never hides its stars), `headline` (multi-line; line breaks kept), `subheadline`, `cta_label`, `cta_url`, `image` (file)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Homepage hero                                                                  |
| `mellow_press_logo`           | `name`, `image` (file), `url`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | "As seen in" marquee (text fallback when no image)                             |
| `mellow_story` (one)          | `heading`, `body`, `video` (file, Shopify-hosted video), `video_url` (YouTube/Vimeo URL), `poster` (file), `captions` (file, WebVTT `.vtt`; self-hosted video only, labelled English), `cta_label`, `cta_url`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | "Redefining Sleep" section                                                     |
| `mellow_ugc_video`            | `title`, `video` (file), `video_url`, `poster` (file), `captions` (file, WebVTT `.vtt`; self-hosted video only, labelled English), `product` (product ref)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | "Sleep Better With Mellow" grid                                                |
| `mellow_lifestyle_image`      | `image` (file), `caption`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Image pair under the video grid                                                |
| `mellow_testimonial`          | `quote`, `author` (missing shows "Customer"), `rating` (Rating value scaled by its `scale_max`, or a decimal from 0 to 5; no stars when missing or unreadable), `product` (product ref)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Reviews section                                                                |
| `mellow_faq`                  | `question`, `answer`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | FAQ accordion                                                                  |
| `mellow_about` (one)          | `hero_heading`, `hero_subheading`, `hero_cta_label`, `hero_cta_url`, `hero_image`, `story_heading`, `story_body`, `story_highlight`, `image_left`, `image_bottom`, `values` (list text `icon\|Title\|Body`; the icon is optional and is one of snowflake, heat, couch, wash, feather, moon, sparkle, leaf, shield, truck, check, defaulting to sparkle. An unrecognised prefix is not an icon, so the mistyped key becomes the title), `closing_heading`, `closing_body`, `closing_cta_label`, `closing_cta_url`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `/pages/about` template                                                        |
| `mellow_review`               | `rating` (Rating value scaled by its `scale_max`, or a decimal from 0 to 5; no stars when missing or unreadable), `title`, `body` (required; a review without it is skipped), `author` (missing shows "Customer"), `verified` (boolean; the "Verified buyer" badge shows only when the value is exactly `true`), `date`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Product review carousel (referenced from `mellow.featured_reviews`)            |

Make every definition **accessible from the Storefront API** (Storefront API
access checkbox) or the queries return nothing and the fallbacks are used.

## 6. Pages and policies

- `/pages/about` uses the designed About template; a Shopify page with handle
  `about` adds its body (and SEO title/description) to the template.
- Other Shopify pages render at `/pages/<handle>`.
- Policies render at `/policies/<handle>`. `privacy-policy`,
  `shipping-policy`, `terms-of-service` and `refund-policy` come from
  **Settings → Policies** when the store has published them; until then the
  storefront serves its own documents from `app/lib/content/policies.ts`
  (paste the same texts into Shopify so checkout and emails link to them).
  `contact-information` and `legal-notice` are not exposed by the Storefront
  API, so they always come from that file. `subscription-policy` is served
  only when Shopify has one. Fill in the bracketed placeholders ([Store
  Name], [Email], [Phone], [Business Address] and so on) before launch.

## 7. Customer accounts

Customer accounts are deferred (`docs/hydrogen-removal-architecture.md`, ADR-D2).
Every call that needs a signed-in customer ends on the 503 sign-in page, which
says that accounts are not available yet. `/account` redirects to the sign-in
page, and `/account/login` shows the 503 page. The Customer Account API variables
in section 1 change nothing for shoppers today. `POST /account/logout` clears the
storefront session and redirects to `/`. `GET /account/authorize` redirects to
`/account/login`. Porting Hydrogen's OAuth client (ADR-D1) is a separate decision.

## 8. Checkout, cart and analytics

The cart is Shopify's cart. The storefront's cart service (`app/lib/cart`) changes
it with Storefront API mutations and reads it on the server. The cart id lives in
the `cart` cookie (`HttpOnly`, `SameSite=Lax`, `Secure` over https). The app never
writes it to `localStorage`. Checkout uses the `checkoutUrl` that Shopify returns.

Analytics run only when `PUBLIC_CHECKOUT_DOMAIN` and `PUBLIC_STOREFRONT_ID` are
both set and the development mock is off. Then the storefront loads Shopify's
consent script (consent-tracking-api v0.2, from cdn.shopify.com, with the CSP
nonce), reads the shop with a server query, and sends `PAGE_VIEW_2`,
`PRODUCT_VIEW`, `COLLECTION_VIEW`, `SEARCH_VIEW` and `ADD_TO_CART` events. Until
then it sends no events, loads no consent script and forwards no tracking cookies.
A private (`shpat_`) token in `PUBLIC_STOREFRONT_API_TOKEN` switches analytics off
and logs an `[analytics]` error. Analytics have not been verified against a live
store.

The storefront renders no privacy or cookie banner, as before the removal
(Hydrogen's banner was turned off). Confirm the consent setup with the owner
before analytics go live.

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

Set `MOCK_STOREFRONT=true` in `.dev.vars` and run `npm run dev`. The storefront
serves the Mellow demo catalog (products, collections, metaobjects, cart) from
`app/lib/mock`. The mock exists in development only: production builds never load
it. A badge in the corner of every page indicates mock mode.

- `PUBLIC_STOREFRONT_API_TOKEN` can be any placeholder, for example
  `mockmockmockmockmockmockmockmock`. Nothing checks its length.
- `.dev.vars.e2e` is a committed mock-mode environment with placeholders only.
  Wrangler loads it instead of `.dev.vars` when `CLOUDFLARE_ENV=e2e`, which
  `npm run dev:e2e` and the Playwright suite (port 3100) set.
- Checkout is not available in mock mode: `/dev/mock-checkout` explains that a
  real store is needed.
- Cart permalinks accept mock variant ids, for example
  `/cart/cloudalign-pillow-1:1?discount=MELLOW10`.
- The demo catalog has 13 products. Three of them (Silk Sleep Mask, Linen Sheet
  Set and Weighted Blanket) appear only under Shop All, which therefore has a
  second page: 12 products, then one more after "Load more".
- A Storefront API query that fails with GraphQL errors and no data returns a 502,
  as it does on a live store.
- Customer accounts are deferred in every mode: `/account` ends on the 503 sign-in
  page.

See `app/lib/mock/README.md`.
