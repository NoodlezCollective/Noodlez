import {
  AnalyticsEventName,
  AnalyticsPageType,
  ShopifySalesChannel,
  type ClientBrowserParameters,
  type ShopifyAddToCart,
  type ShopifyAnalytics,
  type ShopifyAnalyticsProduct,
  type ShopifyPageView,
  type ShopifyPageViewPayload,
} from '@shopify/hydrogen-react';
import type {AnalyticsShop} from './config';

/**
 * Shopify analytics events, ported from Hydrogen 2026.4.7's ShopifyAnalytics
 * and CartAnalytics (node_modules/@shopify/hydrogen/dist/development/index.js,
 * h:375-590 and h:596-693). Pure: the browser, the consent and the network
 * reach the tracker as functions, so everything here runs in unit tests.
 *
 * Deliberate differences from Hydrogen: `assetVersionId` is left to
 * hydrogen-react (which sends its own version); incomplete products drop the
 * event instead of being logged and sent anyway (Hydrogen's check returned
 * from a forEach callback); the cart baseline lives in memory, never in
 * localStorage, so the cart id and its key are not persisted.
 */

/** One product of an `Analytics.ProductView` (Hydrogen's prop shape). */
export type AnalyticsProduct = {
  id: string;
  title: string;
  price: string;
  vendor: string;
  variantId: string;
  variantTitle: string;
  quantity: number;
  sku?: string;
  productType?: string;
};

export type ProductViewData = {products: AnalyticsProduct[]};
export type CollectionViewData = {collection: {id: string; handle: string}};
export type SearchViewData = {searchTerm: string; searchResults?: unknown};

/** The visitor's choices, as the Customer Privacy API reports them. */
export type ConsentState = {
  analyticsAllowed: boolean;
  marketingAllowed: boolean;
  saleOfDataAllowed: boolean;
};

/** What a product, collection or search view tells the page view after it. */
export type PageViewContext = {pageType?: string; resourceId?: string};

/** The cart line fields analytics read (the app's CartLine fragment). */
export type CartLineLike = {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    sku?: string | null;
    price: {amount: string};
    product: {
      id: string;
      title: string;
      vendor: string;
      productType?: string | null;
    };
  };
};

/** The cart fields analytics read (the app's CartApiQuery fragment). */
export type CartLike = {
  id: string;
  updatedAt: string;
  lines: {nodes: ReadonlyArray<CartLineLike>};
};

/**
 * hydrogen-react's page-view payload plus the privacy flags its Monorail
 * schemas read (`ccpaEnforced`, `gdprEnforced`), as Hydrogen sends them.
 */
export type AnalyticsBasePayload = ShopifyPageViewPayload & {
  ccpaEnforced: boolean;
  gdprEnforced: boolean;
};

/** The parts of `window.Shopify.customerPrivacy` the consent is read from. */
export type CustomerPrivacyLike = {
  consentStatus?: string;
  analyticsProcessingAllowed?: () => boolean;
  marketingAllowed?: () => boolean;
  saleOfDataAllowed?: () => boolean;
  currentVisitorConsent?: () => {analytics?: string} | undefined;
};

/** Hydrogen's checks (`validateProducts`): every field must be non-empty. */
const REQUIRED_PRODUCT_FIELDS = [
  'id',
  'title',
  'price',
  'vendor',
  'variantId',
  'variantTitle',
] as const;

/** `consentStatus` once the Customer Privacy API has the visitor's consent. */
const CONSENT_LOADED = 'loaded';
/** `currentVisitorConsent().analytics` when the visitor refused analytics. */
const VISITOR_REFUSED = 'no';

const CONSENT_REFUSED: ConsentState = Object.freeze({
  analyticsAllowed: false,
  marketingAllowed: false,
  saleOfDataAllowed: false,
});

/**
 * The fields every event shares (Hydrogen's `prepareBasePageViewPayload`):
 * the Hydrogen sales channel, the shop, the browser and the consent.
 */
export function buildBasePayload(
  shop: AnalyticsShop,
  consent: ConsentState,
  browser: ClientBrowserParameters,
): AnalyticsBasePayload {
  const {analyticsAllowed, marketingAllowed, saleOfDataAllowed} = consent;
  return {
    shopifySalesChannel: ShopifySalesChannel.hydrogen,
    shopId: shop.shopId,
    acceptedLanguage: shop.acceptedLanguage,
    currency: shop.currency,
    hydrogenSubchannelId: shop.hydrogenSubchannelId,
    hasUserConsent: analyticsAllowed,
    ...browser,
    analyticsAllowed,
    marketingAllowed,
    saleOfDataAllowed,
    ccpaEnforced: !saleOfDataAllowed,
    gdprEnforced: !(marketingAllowed && analyticsAllowed),
  };
}

/** PAGE_VIEW_2, with the page type and resource of the view before it. */
export function buildPageView(
  base: ShopifyPageViewPayload,
  view: PageViewContext = {},
): ShopifyPageView {
  return {
    eventName: AnalyticsEventName.PAGE_VIEW_2,
    payload: {...base, ...view},
  };
}

/** PRODUCT_VIEW, or null when a product is missing a required field. */
export function buildProductView(
  base: ShopifyPageViewPayload,
  {products}: ProductViewData,
): ShopifyPageView | null {
  if (!Array.isArray(products) || products.length === 0) return null;
  if (!products.every(isCompleteProduct)) return null;
  return {
    eventName: AnalyticsEventName.PRODUCT_VIEW,
    payload: {
      ...base,
      pageType: AnalyticsPageType.product,
      resourceId: products[0].id,
      products: products.map(formatProduct),
    },
  };
}

export function buildCollectionView(
  base: ShopifyPageViewPayload,
  {collection}: CollectionViewData,
): ShopifyPageView {
  return {
    eventName: AnalyticsEventName.COLLECTION_VIEW,
    payload: {
      ...base,
      pageType: AnalyticsPageType.collection,
      resourceId: collection.id,
      collectionHandle: collection.handle,
      collectionId: collection.id,
    },
  };
}

/** SEARCH_VIEW; the results are not part of Shopify's payload. */
export function buildSearchView(
  base: ShopifyPageViewPayload,
  {searchTerm}: SearchViewData,
): ShopifyPageView {
  return {
    eventName: AnalyticsEventName.SEARCH_VIEW,
    payload: {
      ...base,
      pageType: AnalyticsPageType.search,
      searchString: searchTerm,
    },
  };
}

/**
 * ADD_TO_CART for one line (Hydrogen's `sendCartAnalytics`), with the line's
 * quantity, or null when the line is missing a required field.
 */
export function buildAddToCart(
  base: ShopifyPageViewPayload,
  cartId: string,
  line: CartLineLike,
): ShopifyAddToCart | null {
  const product = productOfLine(line);
  if (!cartId || !line.id || !isCompleteProduct(product)) return null;
  return {
    eventName: AnalyticsEventName.ADD_TO_CART,
    payload: {...base, cartId, products: [formatProduct(product)]},
  };
}

/**
 * The lines of `next` that are new or have a higher quantity than in
 * `previous` (Hydrogen's CartAnalytics diff). Nothing changed while the cart
 * keeps its id and `updatedAt`; without a previous cart every line is new.
 */
export function linesAddedToCart(
  previous: CartLike | null,
  next: CartLike | null,
): CartLineLike[] {
  if (!next?.updatedAt) return [];
  if (previous?.id === next.id && previous.updatedAt === next.updatedAt) {
    return [];
  }
  const previousQuantities = new Map(
    linesOf(previous).map((line) => [line.id, line.quantity]),
  );
  return linesOf(next).filter((line) => {
    const previousQuantity = previousQuantities.get(line.id);
    return previousQuantity === undefined || previousQuantity < line.quantity;
  });
}

/**
 * The visitor's consent, or null until the Customer Privacy API has loaded
 * it. Analytics count as refused when the visitor said no, whatever the
 * region default (Hydrogen's `hasAnalyticsConsent`); an API that throws or
 * cannot answer refuses everything.
 */
export function consentStateOf(
  privacy: CustomerPrivacyLike | null | undefined,
): ConsentState | null {
  if (privacy?.consentStatus !== CONSENT_LOADED) return null;
  try {
    const refused =
      privacy.currentVisitorConsent?.()?.analytics === VISITOR_REFUSED;
    return {
      analyticsAllowed:
        !refused && privacy.analyticsProcessingAllowed?.() === true,
      marketingAllowed: privacy.marketingAllowed?.() === true,
      saleOfDataAllowed: privacy.saleOfDataAllowed?.() === true,
    };
  } catch {
    return CONSENT_REFUSED;
  }
}

/** Events waiting for the shop data and the consent; older ones are dropped. */
export const MAX_PENDING_EVENTS = 50;

export type AnalyticsTrackerOptions = {
  /** The consent, or null while the Customer Privacy API has not loaded it. */
  readConsent: () => ConsentState | null;
  /** hydrogen-react's getClientBrowserParameters in the browser. */
  readBrowser: () => ClientBrowserParameters;
  /** hydrogen-react's sendShopifyAnalytics in the browser. */
  send: (event: ShopifyAnalytics) => void;
};

/** Plain functions: they can be handed around without their object. */
export type AnalyticsTracker = {
  setShop: (shop: AnalyticsShop) => void;
  /** The Customer Privacy API is ready, or the visitor changed the consent. */
  consentChanged: () => void;
  pageViewed: () => void;
  productViewed: (data: ProductViewData) => void;
  collectionViewed: (data: CollectionViewData) => void;
  searchViewed: (data: SearchViewData) => void;
  /** Every cart the page receives; the first one is the baseline. */
  cartChanged: (cart: CartLike | null) => void;
};

type EventBuilder = (base: ShopifyPageViewPayload) => ShopifyAnalytics | null;
type ViewBuilder = (base: ShopifyPageViewPayload) => ShopifyPageView | null;
type PendingEvent = {build: EventBuilder; browser: ClientBrowserParameters};

/**
 * The provider's event pipeline. Events wait until the shop data and the
 * visitor's consent are known, then go out in the order they happened, built
 * with the page they happened on and the tracking tokens known when they are
 * sent. Without consent no payload is built and waiting events are dropped.
 * A page view carries the page type and resource of the product, collection
 * or search view before it, once (Hydrogen's `viewPayload`).
 */
export function createAnalyticsTracker({
  readConsent,
  readBrowser,
  send,
}: AnalyticsTrackerOptions): AnalyticsTracker {
  let shop: AnalyticsShop | null = null;
  let pending: readonly PendingEvent[] = [];
  let view: PageViewContext | undefined;
  let cartBaseline: {cart: CartLike | null} | undefined;

  const flush = () => {
    const readyShop = shop;
    if (!readyShop || pending.length === 0) return;
    const consent = readConsent();
    if (!consent) return;
    const events = pending;
    pending = [];
    if (!consent.analyticsAllowed) return;
    const {uniqueToken, visitToken} = readBrowser();
    for (const {build, browser} of events) {
      const page = {...browser, uniqueToken, visitToken};
      const event = build(buildBasePayload(readyShop, consent, page));
      if (event) send(event);
    }
  };

  const track = (build: EventBuilder) => {
    pending = [...pending, {build, browser: readBrowser()}].slice(
      -MAX_PENDING_EVENTS,
    );
    flush();
  };

  const trackView = (build: ViewBuilder) =>
    track((base) => {
      const event = build(base);
      if (event) view = viewContextOf(event.payload);
      return event;
    });

  return {
    setShop: (next) => {
      shop = next;
      flush();
    },
    consentChanged: flush,
    pageViewed: () =>
      track((base) => {
        const event = buildPageView(base, view);
        view = undefined;
        return event;
      }),
    productViewed: (data) => trackView((base) => buildProductView(base, data)),
    collectionViewed: (data) =>
      trackView((base) => buildCollectionView(base, data)),
    searchViewed: (data) => trackView((base) => buildSearchView(base, data)),
    cartChanged: (cart) => {
      if (!cartBaseline) {
        cartBaseline = {cart};
        return;
      }
      // A failed cart query answers null: keep comparing with the last cart.
      if (!cart) return;
      const added = linesAddedToCart(cartBaseline.cart, cart);
      cartBaseline = {cart};
      for (const line of added) {
        track((base) => buildAddToCart(base, cart.id, line));
      }
    },
  };
}

function isCompleteProduct(product: AnalyticsProduct): boolean {
  return REQUIRED_PRODUCT_FIELDS.every((field) => Boolean(product[field]));
}

/** Hydrogen's `formatProduct`, without keys for unknown values. */
function formatProduct(product: AnalyticsProduct): ShopifyAnalyticsProduct {
  return {
    productGid: product.id,
    variantGid: product.variantId,
    name: product.title,
    variantName: product.variantTitle,
    brand: product.vendor,
    price: product.price,
    quantity: product.quantity || 1,
    ...(product.productType ? {category: product.productType} : {}),
    ...(product.sku ? {sku: product.sku} : {}),
  };
}

/** A cart line as a product; missing fields stay empty and fail the check. */
function productOfLine({
  quantity,
  merchandise,
}: CartLineLike): AnalyticsProduct {
  const product = merchandise?.product;
  return {
    id: product?.id ?? '',
    title: product?.title ?? '',
    price: merchandise?.price?.amount ?? '',
    vendor: product?.vendor ?? '',
    variantId: merchandise?.id ?? '',
    variantTitle: merchandise?.title ?? '',
    quantity,
    sku: merchandise?.sku ?? undefined,
    productType: product?.productType ?? undefined,
  };
}

function linesOf(cart: CartLike | null): ReadonlyArray<CartLineLike> {
  return cart?.lines?.nodes ?? [];
}

/** Views always set a page type; search views have no resource. */
function viewContextOf({
  pageType,
  resourceId,
}: ShopifyPageViewPayload): PageViewContext {
  return resourceId ? {pageType, resourceId} : {pageType};
}
