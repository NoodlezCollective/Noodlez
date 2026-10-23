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
  /** Collection behind the "Shop" link when no menu is configured. */
  shopAllHandle: 'all',
  /** Page handle rendered with the About template. */
  aboutPageHandle: 'about',
} as const;

/** Metaobject definition types the storefront reads (Settings > Custom data). */
export const METAOBJECT_TYPES = {
  settings: 'mellow_settings',
  hero: 'mellow_hero',
  pressLogo: 'mellow_press_logo',
  story: 'mellow_story',
  ugcVideo: 'mellow_ugc_video',
  lifestyleImage: 'mellow_lifestyle_image',
  testimonial: 'mellow_testimonial',
  faq: 'mellow_faq',
  about: 'mellow_about',
  review: 'mellow_review',
} as const;

/** Number of products shown in the homepage "most loved" grid. */
export const FEATURED_PRODUCTS_COUNT = 6;
