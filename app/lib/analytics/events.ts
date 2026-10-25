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
 * and CartAnalytics. Pure: the browser, the consent and the network reach the
 * tracker as functions, so everything here runs in unit tests.
 *
 * Deliberate differences from Hydrogen: `assetVersionId` is left to
 * hydrogen-react (which sends its own version); a product without its id,
 * title, price or variant drops the PRODUCT_VIEW, with a development warning
 * naming the field, instead of being logged and sent anyway (Hydrogen's
 * check returned from a forEach callback; an empty vendor is still sent, as
 * an empty brand); the cart baseline lives in memory, never in localStorage,
 * so the cart id and its key are not persisted.
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

/**
 * The fields of Hydrogen's checks (`validateProducts`) a product cannot be
 * sent without. The vendor is not one: Hydrogen sent a product without one
 * (as `brand: ''`), its check never stopping the event.
 */
const REQUIRED_PRODUCT_FIELDS = [
  'id',
  'title',
  'price',
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

/**
 * Plain functions: they can be handed around without their object. None of
 * them throws: a failure (a consent script whose token readers throw, a send
 * that throws) drops the event and is logged once per tracker.
 */
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

const EVENT_FAILED_MESSAGE = 'An analytics event failed and was dropped';

/**
 * The provider's tracker: the event pipeline behind methods that never
 * throw, as Hydrogen wrapped each subscriber in try/catch. A failure (a
 * consent script whose token readers throw, a send that throws) drops the
 * event and is logged once per tracker, so it never escapes a React effect
 * and the page keeps rendering.
 */
export function createAnalyticsTracker(
  options: AnalyticsTrackerOptions,
): AnalyticsTracker {
  const logFailure = createFailureLogger(EVENT_FAILED_MESSAGE);
  const pipeline = createEventPipeline(options, logFailure);
  const guard =
    <Args extends unknown[]>(method: (...args: Args) => void) =>
    (...args: Args): void => {
      try {
        method(...args);
      } catch (error) {
        logFailure(error);
      }
    };
  return {
    setShop: guard(pipeline.setShop),
    consentChanged: guard(pipeline.consentChanged),
    pageViewed: guard(pipeline.pageViewed),
    productViewed: guard(pipeline.productViewed),
    collectionViewed: guard(pipeline.collectionViewed),
    searchViewed: guard(pipeline.searchViewed),
    cartChanged: guard(pipeline.cartChanged),
  };
}

/** The tracker's methods before they are guarded: these may throw. */
type EventPipeline = AnalyticsTracker;

/**
 * Events wait until the shop data and the visitor's consent are known, then
 * go out in the order they happened, built with the page they happened on
 * and the tracking tokens known when they are sent. Once the visitor has
 * refused, nothing is queued and waiting events are dropped, so no payload
 * is built and neither the browser nor the consent script's token readers
 * are read. A page view carries the page type and resource of the product,
 * collection or search view before it, once (Hydrogen's `viewPayload`), even
 * when that view itself could not be sent.
 */
function createEventPipeline(
  {readConsent, readBrowser, send}: AnalyticsTrackerOptions,
  logFailure: (error: unknown) => void,
): EventPipeline {
  let shop: AnalyticsShop | null = null;
  let pending: readonly PendingEvent[] = [];
  let view: PageViewContext | undefined;
  let cartBaseline: {cart: CartLike | null} | undefined;
  const warnIfIncomplete = createIncompleteProductWarning();

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
      // One event's failure does not cost the events after it.
      try {
        const event = build(buildBasePayload(readyShop, consent, page));
        if (event) send(event);
      } catch (error) {
        logFailure(error);
      }
    }
  };

  const track = (build: EventBuilder) => {
    if (readConsent()?.analyticsAllowed === false) {
      pending = [];
      return;
    }
    pending = [...pending, {build, browser: readBrowser()}].slice(
      -MAX_PENDING_EVENTS,
    );
    flush();
  };

  const trackView = (
    context: PageViewContext | undefined,
    build: ViewBuilder,
  ) =>
    track((base) => {
      view = context;
      return build(base);
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
    productViewed: (data) => {
      warnIfIncomplete(data);
      trackView(productPageContext(data), (base) =>
        buildProductView(base, data),
      );
    },
    collectionViewed: (data) =>
      trackView(
        pageContext(AnalyticsPageType.collection, data.collection.id),
        (base) => buildCollectionView(base, data),
      ),
    searchViewed: (data) =>
      trackView(pageContext(AnalyticsPageType.search), (base) =>
        buildSearchView(base, data),
      ),
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

/**
 * Logs the first failure it is handed (console.error, in development and in
 * production) and ignores the rest: one broken dependency, such as a consent
 * script whose token readers throw, would otherwise log on every event.
 */
export function createFailureLogger(message: string): (error: unknown) => void {
  let logged = false;
  return (error) => {
    if (logged) return;
    logged = true;
    console.error(
      `[analytics] ${message} (later failures are not logged): ${describeError(error)}`,
    );
  };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Development only: names the fields a product view lacks, once per field
 * and tracker, so an incomplete `<Analytics.ProductView>` is not dropped
 * silently. Production builds drop the check with `import.meta.env.DEV`.
 */
function createIncompleteProductWarning(): (data: ProductViewData) => void {
  let warned: ReadonlySet<string> = new Set();
  return ({products}) => {
    if (!import.meta.env.DEV) return;
    const missing = missingViewFields(products).filter(
      (field) => !warned.has(field),
    );
    if (missing.length === 0) return;
    warned = new Set([...warned, ...missing]);
    console.warn(
      `[analytics] No PRODUCT_VIEW is sent: the <Analytics.ProductView> data lacks ${missing.join(', ')}.`,
    );
  };
}

function missingViewFields(products: ProductViewData['products']): string[] {
  if (!Array.isArray(products) || products.length === 0) return ['products'];
  return [...new Set(products.flatMap(missingProductFields))];
}

function missingProductFields(product: AnalyticsProduct): string[] {
  return REQUIRED_PRODUCT_FIELDS.filter((field) => !product[field]);
}

function isCompleteProduct(product: AnalyticsProduct): boolean {
  return missingProductFields(product).length === 0;
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

/** A page view's page type, and its resource when there is one. */
function pageContext(pageType: string, resourceId?: string): PageViewContext {
  return resourceId ? {pageType, resourceId} : {pageType};
}

/** A product page once the view has products (Hydrogen's condition). */
function productPageContext({
  products,
}: ProductViewData): PageViewContext | undefined {
  if (!Array.isArray(products) || products.length === 0) return undefined;
  return pageContext(AnalyticsPageType.product, products[0].id);
}
