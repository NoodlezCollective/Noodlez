/**
 * Expected values for the development mock catalog (app/lib/mock/data/*).
 *
 * These constants are the tests' independent oracle: they are typed by hand
 * and deliberately NOT imported from the mock seeds, so a wrong price or a
 * dropped product in the app fails a test instead of silently agreeing with
 * itself. When the seeds change, update this file in the same commit (the
 * mock README says so too). Dependency-free; safe to import anywhere.
 *
 *   import {PRODUCTS, COLLECTIONS, COPY} from './support/catalog';
 *   await gotoHydrated(page, productPath(PRODUCTS.cloudAlign));
 *   await expect(price).toHaveText(PRODUCTS.cloudAlign.variants[0].price);
 *
 * Display strings (`price`, `compareAt`) are exactly what the UI renders:
 * current prices keep their cents ("$129.00"), compare-at prices drop
 * trailing zeros ("$199").
 *
 * Products, by best-selling rank (the default listing order):
 *   1 CloudAlign Pillow     2 MarshMellow Comforter   3 CloudCool Cooling Comforter
 *   4 Better Sleep Bundle   5 CloudControl Comforter  6 Pebble Pillow
 *   7 Cool Sleeper Bundle   8 Cloud Body Pillow       9 Cloud Bath Towel
 *  10 Cloud Bath Robe      11 Silk Sleep Mask        12 Linen Sheet Set
 *  13 Weighted Blanket (11 to 13 only exist in "all", to make "Load more" reachable)
 * Only Pebble Pillow's Charcoal variant is sold out; no product is fully sold out.
 */

export const SHOP_NAME = 'Mellow';

/** Products per listing page (collections, search, "all"). */
export const PAGE_SIZE = 12;

export interface VariantFixture {
  /** Mock variant id; also the id used by cart permalinks: /cart/<id>:<qty>. */
  id: string;
  /** Option value as shown on the page (the option is `optionName`). */
  option: string;
  /** Current price as displayed, e.g. "$59.99". */
  price: string;
  /** Current price as an amount string (JSON-LD, API), e.g. "59.99". */
  amount: string;
  /** Compare-at price as displayed, e.g. "$120". */
  compareAt: string;
  sku: string;
  available: boolean;
}

export interface ProductFixture {
  handle: string;
  title: string;
  optionName: 'Size' | 'Color';
  /** Average rating shown in the stars label, e.g. "4.9". */
  rating: string;
  ratingCount: number;
  imageCount: number;
  /** In seed order; the first available one is the default selection. */
  variants: readonly VariantFixture[];
}

/** `amount` always carries cents ("129.00"): the mock formats with toFixed(2). */
function variant(
  id: string,
  option: string,
  amount: string,
  compareAt: string,
  sku: string,
  available = true,
): VariantFixture {
  return {id, option, price: `$${amount}`, amount, compareAt, sku, available};
}

export const PRODUCTS = {
  cloudAlign: {
    handle: 'cloudalign-pillow',
    title: 'CloudAlign Pillow',
    optionName: 'Size',
    rating: '4.9',
    ratingCount: 51644,
    imageCount: 3,
    variants: [
      variant('cloudalign-pillow-1', 'Standard', '49.99', '$100', 'CLOUDALI-1'),
      variant('cloudalign-pillow-2', 'King', '59.99', '$120', 'CLOUDALI-2'),
    ],
  },
  marshMellow: {
    handle: 'marshmellow-comforter',
    title: 'MarshMellow Comforter',
    optionName: 'Size',
    rating: '4.9',
    ratingCount: 15744,
    imageCount: 3,
    variants: [
      variant('marshmellow-comforter-1', 'Twin', '87.99', '$200', 'MARSHMEL-1'),
      variant(
        'marshmellow-comforter-2',
        'Full/Queen',
        '97.99',
        '$220',
        'MARSHMEL-2',
      ),
      variant(
        'marshmellow-comforter-3',
        'King',
        '107.99',
        '$240',
        'MARSHMEL-3',
      ),
    ],
  },
  cloudCool: {
    handle: 'cloudcool-cooling-comforter',
    title: 'CloudCool Cooling Comforter',
    optionName: 'Size',
    rating: '4.8',
    ratingCount: 4030,
    imageCount: 3,
    variants: [
      variant(
        'cloudcool-cooling-comforter-1',
        'Twin',
        '79.99',
        '$119.99',
        'CLOUDCOO-1',
      ),
      variant(
        'cloudcool-cooling-comforter-2',
        'Full/Queen',
        '89.99',
        '$139.99',
        'CLOUDCOO-2',
      ),
      variant(
        'cloudcool-cooling-comforter-3',
        'King',
        '99.99',
        '$159.99',
        'CLOUDCOO-3',
      ),
    ],
  },
  betterSleepBundle: {
    handle: 'better-sleep-bundle',
    title: 'Better Sleep Bundle',
    optionName: 'Size',
    rating: '4.9',
    ratingCount: 2311,
    imageCount: 2,
    variants: [
      variant('better-sleep-bundle-1', 'Twin', '139.99', '$300', 'BETTER-S-1'),
      variant(
        'better-sleep-bundle-2',
        'Full/Queen',
        '149.99',
        '$320',
        'BETTER-S-2',
      ),
      variant('better-sleep-bundle-3', 'King', '169.99', '$360', 'BETTER-S-3'),
    ],
  },
  cloudControl: {
    handle: 'cloudcontrol-comforter',
    title: 'CloudControl Comforter',
    optionName: 'Size',
    rating: '4.9',
    ratingCount: 1208,
    imageCount: 3,
    variants: [
      variant(
        'cloudcontrol-comforter-1',
        'Twin',
        '109.99',
        '$220',
        'CLOUDCON-1',
      ),
      variant(
        'cloudcontrol-comforter-2',
        'Full/Queen',
        '119.99',
        '$240',
        'CLOUDCON-2',
      ),
      variant(
        'cloudcontrol-comforter-3',
        'King',
        '129.99',
        '$260',
        'CLOUDCON-3',
      ),
    ],
  },
  /** Eight images (six per colour, two lifestyle); Charcoal is sold out. */
  pebble: {
    handle: 'pebble-pillow',
    title: 'Pebble Pillow',
    optionName: 'Color',
    rating: '4.8',
    ratingCount: 365,
    imageCount: 8,
    variants: [
      variant('pebble-pillow-1', 'Baby Blue', '44.99', '$69.99', 'PEBBLE-1'),
      variant('pebble-pillow-2', 'Blush', '44.99', '$69.99', 'PEBBLE-2'),
      variant('pebble-pillow-3', 'Sage', '44.99', '$69.99', 'PEBBLE-3'),
      variant('pebble-pillow-4', 'Stone', '44.99', '$69.99', 'PEBBLE-4'),
      variant('pebble-pillow-5', 'Cream', '44.99', '$69.99', 'PEBBLE-5'),
      variant(
        'pebble-pillow-6',
        'Charcoal',
        '44.99',
        '$69.99',
        'PEBBLE-6',
        false,
      ),
    ],
  },
  coolSleeperBundle: {
    handle: 'cool-sleeper-bundle',
    title: 'Cool Sleeper Bundle',
    optionName: 'Size',
    rating: '4.8',
    ratingCount: 980,
    imageCount: 2,
    variants: [
      variant(
        'cool-sleeper-bundle-1',
        'Full/Queen',
        '119.99',
        '$220',
        'COOL-SLE-1',
      ),
      variant('cool-sleeper-bundle-2', 'King', '139.99', '$260', 'COOL-SLE-2'),
    ],
  },
  cloudBody: {
    handle: 'cloud-body-pillow',
    title: 'Cloud Body Pillow',
    optionName: 'Color',
    rating: '4.8',
    ratingCount: 892,
    imageCount: 2,
    variants: [
      variant('cloud-body-pillow-1', 'Cloud White', '69.99', '$110', 'BODY-1'),
      variant('cloud-body-pillow-2', 'Lavender', '69.99', '$110', 'BODY-2'),
    ],
  },
  bathTowel: {
    handle: 'cloud-bath-towel',
    title: 'Cloud Bath Towel',
    optionName: 'Color',
    rating: '4.7',
    ratingCount: 640,
    imageCount: 2,
    variants: [
      variant('cloud-bath-towel-1', 'White', '34.99', '$55', 'TOWEL-1'),
      variant('cloud-bath-towel-2', 'Lavender', '34.99', '$55', 'TOWEL-2'),
      variant('cloud-bath-towel-3', 'Sand', '34.99', '$55', 'TOWEL-3'),
    ],
  },
  bathRobe: {
    handle: 'cloud-bath-robe',
    title: 'Cloud Bath Robe',
    optionName: 'Size',
    rating: '4.8',
    ratingCount: 312,
    imageCount: 2,
    variants: [
      variant('cloud-bath-robe-1', 'S/M', '79.99', '$130', 'CLOUD-BA-1'),
      variant('cloud-bath-robe-2', 'L/XL', '79.99', '$130', 'CLOUD-BA-2'),
    ],
  },
  silkSleepMask: {
    handle: 'silk-sleep-mask',
    title: 'Silk Sleep Mask',
    optionName: 'Size',
    rating: '4.6',
    ratingCount: 412,
    imageCount: 2,
    variants: [
      variant('silk-sleep-mask-1', 'One Size', '29.99', '$45', 'SILK-SLE-1'),
    ],
  },
  linenSheetSet: {
    handle: 'linen-sheet-set',
    title: 'Linen Sheet Set',
    optionName: 'Size',
    rating: '4.8',
    ratingCount: 1203,
    imageCount: 2,
    variants: [
      variant('linen-sheet-set-1', 'Twin', '129.00', '$199', 'LINEN-SH-1'),
      variant('linen-sheet-set-2', 'Queen', '159.00', '$249', 'LINEN-SH-2'),
      variant('linen-sheet-set-3', 'King', '179.00', '$279', 'LINEN-SH-3'),
    ],
  },
  weightedBlanket: {
    handle: 'weighted-blanket',
    title: 'Weighted Blanket',
    optionName: 'Size',
    rating: '4.7',
    ratingCount: 876,
    imageCount: 2,
    variants: [
      variant('weighted-blanket-1', '12 lb', '119.00', '$169', 'WEIGHTED-1'),
      variant('weighted-blanket-2', '15 lb', '129.00', '$179', 'WEIGHTED-2'),
      variant('weighted-blanket-3', '20 lb', '139.00', '$189', 'WEIGHTED-3'),
    ],
  },
} as const satisfies Record<string, ProductFixture>;

export type ProductKey = keyof typeof PRODUCTS;

/** The only sold-out variant in the catalog. */
export const SOLD_OUT_VARIANT = PRODUCTS.pebble.variants[5];

/** Pebble Pillow swatch groups (group label -> colours). */
export const PEBBLE_SWATCH_GROUPS = {
  'CloudCool™ Cooling Collection': ['Baby Blue', 'Blush', 'Sage', 'Stone'],
  'Lush Collection': ['Cream', 'Charcoal'],
} as const;

export function productPath(product: {handle: string}): string {
  return `/products/${product.handle}`;
}

/** Title of the catalog product with this handle (throws for unknown handles). */
export function productTitle(handle: string): string {
  const product = Object.values(PRODUCTS).find((p) => p.handle === handle);
  if (!product) throw new Error(`Unknown product handle "${handle}"`);
  return product.title;
}

/** Accessible label of the star rating, e.g. "Rated 4.9 out of 5 from 51,644 reviews". */
export function ratingLabel(product: {
  rating: string;
  ratingCount: number;
}): string {
  return `Rated ${product.rating} out of 5 from ${product.ratingCount.toLocaleString('en-US')} reviews`;
}

export interface CollectionFixture {
  handle: string;
  title: string;
  /** Product handles in the default ("Best selling" / manual) order. */
  products: readonly string[];
  /** Products on the first page (PAGE_SIZE at most). */
  firstPage: number;
}

const BEST_SELLING_ORDER = [
  PRODUCTS.cloudAlign,
  PRODUCTS.marshMellow,
  PRODUCTS.cloudCool,
  PRODUCTS.betterSleepBundle,
  PRODUCTS.cloudControl,
  PRODUCTS.pebble,
  PRODUCTS.coolSleeperBundle,
  PRODUCTS.cloudBody,
  PRODUCTS.bathTowel,
  PRODUCTS.bathRobe,
  PRODUCTS.silkSleepMask,
  PRODUCTS.linenSheetSet,
  PRODUCTS.weightedBlanket,
].map((product) => product.handle);

function collection(
  handle: string,
  title: string,
  products: readonly string[],
): CollectionFixture {
  return {
    handle,
    title,
    products,
    firstPage: Math.min(products.length, PAGE_SIZE),
  };
}

/**
 * "all" has 13 products: page one shows 12 with the label "12+ products" and a
 * "Load more" link; after loading, 13. Every other collection fits one page and
 * reads "<n> products".
 */
export const COLLECTIONS = {
  all: collection('all', 'Shop All', BEST_SELLING_ORDER),
  mostLoved: collection('most-loved', 'Most Loved', [
    PRODUCTS.cloudAlign.handle,
    PRODUCTS.marshMellow.handle,
    PRODUCTS.cloudCool.handle,
    PRODUCTS.pebble.handle,
    PRODUCTS.cloudControl.handle,
    PRODUCTS.cloudBody.handle,
  ]),
  pillows: collection('pillows', 'Pillows', [
    PRODUCTS.cloudAlign.handle,
    PRODUCTS.pebble.handle,
    PRODUCTS.cloudBody.handle,
  ]),
  comforters: collection('comforters', 'Comforters', [
    PRODUCTS.marshMellow.handle,
    PRODUCTS.cloudCool.handle,
    PRODUCTS.cloudControl.handle,
  ]),
  bath: collection('bath', 'Bath', [
    PRODUCTS.bathTowel.handle,
    PRODUCTS.bathRobe.handle,
  ]),
  bundles: collection('bundles', 'Bundles', [
    PRODUCTS.betterSleepBundle.handle,
    PRODUCTS.coolSleeperBundle.handle,
  ]),
} as const satisfies Record<string, CollectionFixture>;

/** Collections listed on /collections (everything except "all"), in order. */
export const COLLECTION_INDEX = [
  COLLECTIONS.mostLoved,
  COLLECTIONS.pillows,
  COLLECTIONS.comforters,
  COLLECTIONS.bath,
  COLLECTIONS.bundles,
] as const;

export function collectionPath(collection: {handle: string}): string {
  return `/collections/${collection.handle}`;
}

/** The product count line of a listing: "6 products", "1 product", "12+ products". */
export function countLabel(collection: CollectionFixture): string {
  const total = collection.products.length;
  if (total > PAGE_SIZE) return `${PAGE_SIZE}+ products`;
  return total === 1 ? '1 product' : `${total} products`;
}

/** Discount codes the mock cart accepts (percentage off the subtotal). */
export const DISCOUNT_CODES = {
  MELLOW10: {percent: 10},
  WELCOME15: {percent: 15},
} as const;

/** Page titles (<title>), also announced by the route announcer. */
export const TITLES = {
  home: 'Mellow | Premium Cooling Comforters & Pillows For Better Sleep',
  collections: 'Collections | Mellow',
  shopAll: 'Shop All | Mellow',
  mostLoved: 'Most Loved | Mellow',
  pillows: 'Pillows | Mellow',
  cart: 'Cart | Mellow',
  search: 'Search | Mellow',
  about: 'About Mellow | Sleep Was Broken. We Fixed It.',
  policies: 'Policies | Mellow',
  privacyPolicy: 'Privacy Policy | Mellow',
  journal: 'Journal | Mellow',
  signIn: 'Sign in | Mellow',
  mockCheckout: 'Development checkout | Mellow',
  pageNotFound: 'Page not found | Mellow',
  productNotFound: 'Product not found | Mellow',
  collectionNotFound: 'Collection not found | Mellow',
  product: (product: {title: string}) => `${product.title} | Mellow`,
  searchResults: (term: string) => `Search results for “${term}” | Mellow`,
} as const;

/**
 * User-visible copy that contains typographic characters (curly quotes, en
 * dashes, the minus sign U+2212, ellipses, ™). Keeping them here avoids
 * look-alike mistakes (' vs ’, - vs –) across specs. Every entry was checked
 * against the live markup.
 */
export const COPY = {
  homeH1: 'Shop Premium Cooling Comforters & Pillows For Better Sleep',
  aboutH1: 'Sleep Was Broken. We Fixed It.',
  notFoundH1: 'We couldn’t find that page',
  signInUnavailableH1: 'Sign-in isn’t available yet',
  mockCheckoutH1: 'Checkout is not available in mock mode',
  accountDeveloperSummary: 'For developers: enabling customer accounts',
  logoLink: 'Mellow – home',
  searchPlaceholder: 'Search pillows, comforters, bundles…',
  sortAlphabetical: 'Alphabetically: A–Z',
  aboutValueTested: 'Tested by 124,952+ sleepers',
  ugcLink:
    'Does your pillow do this? A chiropractor tests the CloudAlign. – shop the product',
  pebbleGroupCool: 'CloudCool™ Cooling Collection',
  pebbleGroupLush: 'Lush Collection',
  /** Active-filter chip for a price range of 50 to 70 (en dash, spaces). */
  priceChip50to70: '$50 – $70',
  savingsNote: 'Savings based on comparable value.',
  savingsExplanationStart:
    'Compare-at prices reflect the comparable retail value',
  cartShippingNote: 'Shipping & taxes calculated at checkout.',
  /** Discount row in the order summary for MELLOW10 on a $49.99 cart (U+2212). */
  discountRowMellow10: '−$5.00',
  giftCardUnsupported: 'Gift cards are not supported by the development mock.',
  checkoutLineCloudAlignStandard: 'CloudAlign Pillow – Standard × 1',
  newsletterMock:
    'Development mock: no email service is connected, so this signup was not recorded.',
  newsletterInvalid: 'Enter a valid email address.',
  newsletterUnreadable: 'We could not read that request. Please try again.',
  newsletterTooLarge: 'That request was too large.',
  /** The cart action's answer (400) to a request it cannot make sense of. */
  cartInvalidRequest:
    'That cart request wasn’t understood. Please refresh the page and try again.',
  invalidDiscount: (code: string) =>
    `“${code.toUpperCase()}” isn’t a valid discount code.`,
  viewAllResults: (term: string) => `View all results for “${term}”`,
} as const;
