/**
 * Storefront configuration constants.
 *
 * These map the Mellow UI onto resources the merchant creates in Shopify.
 * Keep in sync with docs/shopify-setup.md.
 */
export const SHOPIFY_RESOURCES = {
  /** Navigation menus (Online Store > Navigation). */
  headerMenuHandle: 'main-menu',
  footerMenuHandle: 'footer',
  /** Collection that feeds "Explore Our Most Loved Sleep Products". */
  featuredCollectionHandle: 'most-loved',
  /** Page handle rendered with the About template. */
  aboutPageHandle: 'about',
} as const;

/** Number of products shown in the homepage "most loved" grid. */
export const FEATURED_PRODUCTS_COUNT = 6;
