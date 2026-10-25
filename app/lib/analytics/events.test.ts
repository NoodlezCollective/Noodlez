import type {
  ClientBrowserParameters,
  ShopifyAnalytics,
} from '@shopify/hydrogen-react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {AnalyticsShop} from './config';
import {
  MAX_PENDING_EVENTS,
  buildAddToCart,
  buildBasePayload,
  buildCollectionView,
  buildPageView,
  buildProductView,
  buildSearchView,
  consentStateOf,
  createAnalyticsTracker,
  linesAddedToCart,
  type AnalyticsProduct,
  type AnalyticsTracker,
  type CartLike,
  type CartLineLike,
  type CollectionViewData,
  type ConsentState,
  type CustomerPrivacyLike,
} from './events';

const SHOP: AnalyticsShop = {
  shopId: 'gid://shopify/Shop/55555',
  acceptedLanguage: 'EN',
  currency: 'USD',
  hydrogenSubchannelId: '1000014925',
};

const CONSENTED: ConsentState = {
  analyticsAllowed: true,
  marketingAllowed: true,
  saleOfDataAllowed: true,
};

const DENIED: ConsentState = {
  analyticsAllowed: false,
  marketingAllowed: false,
  saleOfDataAllowed: false,
};

/** What getClientBrowserParameters() reads on `path`. */
function browserAt(
  path: string,
  overrides: Partial<ClientBrowserParameters> = {},
): ClientBrowserParameters {
  return {
    uniqueToken: 'unique-token-1',
    visitToken: 'visit-token-1',
    url: `https://mellow.example${path}`,
    path,
    search: '',
    referrer: 'https://search.example/',
    title: `Mellow ${path}`,
    userAgent: 'Mozilla/5.0 (unit test)',
    navigationType: 'navigate',
    navigationApi: 'PerformanceNavigationTiming',
    ...overrides,
  };
}

const BROWSER = browserAt('/products/cloud-pillow');

/**
 * The keys of Hydrogen 2026.4.7's base payload (`prepareBasePageViewPayload`),
 * except `assetVersionId`, which hydrogen-react fills in with its own version.
 */
const BASE_PAYLOAD_KEYS = [
  'acceptedLanguage',
  'analyticsAllowed',
  'ccpaEnforced',
  'currency',
  'gdprEnforced',
  'hasUserConsent',
  'hydrogenSubchannelId',
  'marketingAllowed',
  'navigationApi',
  'navigationType',
  'path',
  'referrer',
  'saleOfDataAllowed',
  'search',
  'shopId',
  'shopifySalesChannel',
  'title',
  'uniqueToken',
  'url',
  'userAgent',
  'visitToken',
];

const PRODUCT: AnalyticsProduct = {
  id: 'gid://shopify/Product/1',
  title: 'CloudAlign Pillow',
  price: '49.0',
  vendor: 'Mellow',
  variantId: 'gid://shopify/ProductVariant/11',
  variantTitle: 'Queen',
  quantity: 1,
};

/** PRODUCT as Hydrogen's `formatProduct` sends it. */
const FORMATTED_PRODUCT = {
  productGid: 'gid://shopify/Product/1',
  variantGid: 'gid://shopify/ProductVariant/11',
  name: 'CloudAlign Pillow',
  variantName: 'Queen',
  brand: 'Mellow',
  price: '49.0',
  quantity: 1,
};

/** Cart ids carry the cart's secret key. */
const CART_ID = 'gid://shopify/Cart/c1-abc?key=cart-secret';

function cartLine(
  key: string,
  quantity: number,
  merchandise: Partial<CartLineLike['merchandise']> = {},
): CartLineLike {
  return {
    id: `gid://shopify/CartLine/${key}?cart=c1-abc`,
    quantity,
    merchandise: {
      id: `gid://shopify/ProductVariant/${key}`,
      title: 'Queen',
      price: {amount: '49.0'},
      product: {
        id: `gid://shopify/Product/${key}`,
        title: `Pillow ${key}`,
        vendor: 'Mellow',
      },
      ...merchandise,
    },
  };
}

function cartAt(
  updatedAt: string,
  lines: CartLineLike[],
  id: string = CART_ID,
): CartLike {
  return {id, updatedAt, lines: {nodes: lines}};
}

const base = () => buildBasePayload(SHOP, CONSENTED, BROWSER);
const keysOf = (value: object) => Object.keys(value).sort();

describe('buildBasePayload', () => {
  it("has exactly the keys of Hydrogen's base payload, less assetVersionId", () => {
    expect(keysOf(base())).toEqual(BASE_PAYLOAD_KEYS);
  });

  it('tags the event with the Hydrogen sales channel and carries the shop, consent and browser values', () => {
    expect(base()).toEqual({
      shopifySalesChannel: 'hydrogen',
      shopId: 'gid://shopify/Shop/55555',
      acceptedLanguage: 'EN',
      currency: 'USD',
      hydrogenSubchannelId: '1000014925',
      hasUserConsent: true,
      ...BROWSER,
      analyticsAllowed: true,
      marketingAllowed: true,
      saleOfDataAllowed: true,
      ccpaEnforced: false,
      gdprEnforced: false,
    });
  });

  it('leaves assetVersionId out, so hydrogen-react reports its own version', () => {
    expect(base()).not.toHaveProperty('assetVersionId');
  });

  it.each([
    [
      'marketing refused',
      {
        analyticsAllowed: true,
        marketingAllowed: false,
        saleOfDataAllowed: true,
      },
      {hasUserConsent: true, ccpaEnforced: false, gdprEnforced: true},
    ],
    [
      'sale of data refused',
      {
        analyticsAllowed: true,
        marketingAllowed: true,
        saleOfDataAllowed: false,
      },
      {hasUserConsent: true, ccpaEnforced: true, gdprEnforced: false},
    ],
    [
      'everything refused',
      DENIED,
      {hasUserConsent: false, ccpaEnforced: true, gdprEnforced: true},
    ],
  ])('derives the privacy flags with %s', (_label, consent, expected) => {
    expect(buildBasePayload(SHOP, consent, BROWSER)).toMatchObject({
      ...consent,
      ...expected,
    });
  });

  it('copies only the four shop fields', () => {
    const shop = {...SHOP, accessToken: 'not-for-analytics'} as AnalyticsShop;

    expect(buildBasePayload(shop, CONSENTED, BROWSER)).not.toHaveProperty(
      'accessToken',
    );
  });
});

describe('buildPageView', () => {
  it('sends PAGE_VIEW_2 with only the base payload when no view ran before it', () => {
    const event = buildPageView(base());

    expect(event.eventName).toBe('PAGE_VIEW_2');
    expect(event.payload).toEqual(base());
  });

  it('adds the page type and resource of the view that ran before it', () => {
    const event = buildPageView(base(), {
      pageType: 'product',
      resourceId: PRODUCT.id,
    });

    expect(keysOf(event.payload)).toEqual(
      [...BASE_PAYLOAD_KEYS, 'pageType', 'resourceId'].sort(),
    );
    expect(event.payload).toMatchObject({
      pageType: 'product',
      resourceId: PRODUCT.id,
    });
  });

  it('leaves the base payload unchanged', () => {
    const payload = base();
    const before = structuredClone(payload);

    buildPageView(payload, {pageType: 'search'});

    expect(payload).toEqual(before);
  });
});

describe('buildProductView', () => {
  it('sends PRODUCT_VIEW with the product page type, resource and products', () => {
    const event = buildProductView(base(), {products: [PRODUCT]});

    expect(event?.eventName).toBe('PRODUCT_VIEW');
    expect(keysOf(event!.payload)).toEqual(
      [...BASE_PAYLOAD_KEYS, 'pageType', 'products', 'resourceId'].sort(),
    );
    expect(event?.payload).toMatchObject({
      pageType: 'product',
      resourceId: PRODUCT.id,
    });
  });

  it("formats each product with exactly Hydrogen's keys", () => {
    const event = buildProductView(base(), {products: [PRODUCT]});

    expect(event?.payload.products).toStrictEqual([FORMATTED_PRODUCT]);
  });

  it('adds the sku, and the product type as category, when they are known', () => {
    const event = buildProductView(base(), {
      products: [{...PRODUCT, sku: 'CA-Q', productType: 'Pillows'}],
    });

    expect(event?.payload.products).toStrictEqual([
      {...FORMATTED_PRODUCT, category: 'Pillows', sku: 'CA-Q'},
    ]);
  });

  it('counts a missing quantity as one', () => {
    const event = buildProductView(base(), {
      products: [{...PRODUCT, quantity: 0}],
    });

    expect(event?.payload.products?.[0].quantity).toBe(1);
  });

  it('uses the first product as the page resource', () => {
    const second = {...PRODUCT, id: 'gid://shopify/Product/2'};

    const event = buildProductView(base(), {products: [PRODUCT, second]});

    expect(event?.payload.resourceId).toBe(PRODUCT.id);
    expect(event?.payload.products).toHaveLength(2);
  });

  it('returns null without products', () => {
    expect(buildProductView(base(), {products: []})).toBeNull();
  });

  it('sends a product without a vendor with an empty brand, as Hydrogen did', () => {
    const event = buildProductView(base(), {
      products: [{...PRODUCT, vendor: ''}],
    });

    expect(event?.payload.products).toStrictEqual([
      {...FORMATTED_PRODUCT, brand: ''},
    ]);
  });

  it.each(['id', 'title', 'price', 'variantId', 'variantTitle'] as const)(
    'returns null when a product has no %s',
    (field) => {
      expect(
        buildProductView(base(), {products: [{...PRODUCT, [field]: ''}]}),
      ).toBeNull();
    },
  );

  it('returns null when any of the products is incomplete', () => {
    const incomplete = {...PRODUCT, variantId: ''};

    expect(
      buildProductView(base(), {products: [PRODUCT, incomplete]}),
    ).toBeNull();
  });
});

describe('buildCollectionView', () => {
  it('sends COLLECTION_VIEW with the collection as page resource', () => {
    const collection = {id: 'gid://shopify/Collection/7', handle: 'pillows'};

    const event = buildCollectionView(base(), {collection});

    expect(event.eventName).toBe('COLLECTION_VIEW');
    expect(event.payload).toEqual({
      ...base(),
      pageType: 'collection',
      resourceId: 'gid://shopify/Collection/7',
      collectionHandle: 'pillows',
      collectionId: 'gid://shopify/Collection/7',
    });
  });
});

describe('buildSearchView', () => {
  it('sends SEARCH_VIEW with the term as searchString and leaves the results out', () => {
    const event = buildSearchView(base(), {
      searchTerm: 'cool pillow',
      searchResults: {total: 2},
    });

    expect(event.eventName).toBe('SEARCH_VIEW');
    expect(event.payload).toEqual({
      ...base(),
      pageType: 'search',
      searchString: 'cool pillow',
    });
  });

  it('passes the term on unchanged, special characters included', () => {
    const term = `Kissen "groß" 🛏️ <b>&'; DROP TABLE`;

    expect(buildSearchView(base(), {searchTerm: term}).payload).toMatchObject({
      searchString: term,
    });
  });
});

describe('buildAddToCart', () => {
  it('sends ADD_TO_CART with the cart id and the line as product', () => {
    const event = buildAddToCart(base(), CART_ID, cartLine('a', 2));

    expect(event?.eventName).toBe('ADD_TO_CART');
    expect(event?.payload).toStrictEqual({
      ...base(),
      cartId: CART_ID,
      products: [
        {
          productGid: 'gid://shopify/Product/a',
          variantGid: 'gid://shopify/ProductVariant/a',
          name: 'Pillow a',
          variantName: 'Queen',
          brand: 'Mellow',
          price: '49.0',
          // Hydrogen reports the line's quantity, not the difference.
          quantity: 2,
        },
      ],
    });
  });

  it('adds the sku and the product type when the cart query selects them', () => {
    const line = cartLine('a', 1, {
      sku: 'CA-Q',
      product: {
        id: 'gid://shopify/Product/a',
        title: 'Pillow a',
        vendor: 'Mellow',
        productType: 'Pillows',
      },
    });

    const event = buildAddToCart(base(), CART_ID, line);

    expect(event?.payload.products?.[0]).toMatchObject({
      sku: 'CA-Q',
      category: 'Pillows',
    });
  });

  it('sends a line without a vendor with an empty brand', () => {
    const line = cartLine('a', 1, {
      product: {id: 'gid://shopify/Product/a', title: 'Pillow a', vendor: ''},
    });

    const event = buildAddToCart(base(), CART_ID, line);

    expect(event?.payload.products?.[0]).toMatchObject({
      productGid: 'gid://shopify/Product/a',
      brand: '',
    });
  });

  it.each([
    ['product id', {product: {id: '', title: 'Pillow a', vendor: 'Mellow'}}],
    [
      'product title',
      {product: {id: 'gid://shopify/Product/a', title: '', vendor: 'Mellow'}},
    ],
    ['price', {price: {amount: ''}}],
    ['variant id', {id: ''}],
    ['variant title', {title: ''}],
  ])('returns null when the line has no %s', (_label, merchandise) => {
    expect(
      buildAddToCart(base(), CART_ID, cartLine('a', 1, merchandise)),
    ).toBeNull();
  });

  it('returns null for a line that arrived without its merchandise', () => {
    const line = {id: 'gid://shopify/CartLine/a', quantity: 1} as CartLineLike;

    expect(buildAddToCart(base(), CART_ID, line)).toBeNull();
  });

  it('returns null without a cart id or a line id', () => {
    expect(buildAddToCart(base(), '', cartLine('a', 1))).toBeNull();
    expect(
      buildAddToCart(base(), CART_ID, {...cartLine('a', 1), id: ''}),
    ).toBeNull();
  });
});

describe('linesAddedToCart', () => {
  const a1 = cartLine('a', 1);
  const b1 = cartLine('b', 1);

  it('finds the lines a cart gained', () => {
    const added = linesAddedToCart(
      cartAt('2026-10-25T10:00:00Z', [a1]),
      cartAt('2026-10-25T10:01:00Z', [a1, b1]),
    );

    expect(added).toEqual([b1]);
  });

  it('finds lines whose quantity went up', () => {
    const a3 = cartLine('a', 3);

    const added = linesAddedToCart(
      cartAt('2026-10-25T10:00:00Z', [a1, b1]),
      cartAt('2026-10-25T10:01:00Z', [a3, b1]),
    );

    expect(added).toEqual([a3]);
  });

  it('ignores removed lines and lower quantities', () => {
    const added = linesAddedToCart(
      cartAt('2026-10-25T10:00:00Z', [cartLine('a', 3), b1]),
      cartAt('2026-10-25T10:01:00Z', [a1]),
    );

    expect(added).toEqual([]);
  });

  it('counts every line of a cart that did not exist before', () => {
    expect(
      linesAddedToCart(null, cartAt('2026-10-25T10:00:00Z', [a1, b1])),
    ).toEqual([a1, b1]);
  });

  it('counts every line of a replacement cart', () => {
    const other = cartAt(
      '2026-10-25T10:01:00Z',
      [cartLine('c', 1)],
      'gid://shopify/Cart/c2',
    );

    expect(
      linesAddedToCart(cartAt('2026-10-25T10:00:00Z', [a1]), other),
    ).toEqual(other.lines.nodes);
  });

  it('reports nothing while updatedAt stays the same', () => {
    // A re-delivered cart revision is not a new change.
    const added = linesAddedToCart(
      cartAt('2026-10-25T10:00:00Z', [a1]),
      cartAt('2026-10-25T10:00:00Z', [a1, b1]),
    );

    expect(added).toEqual([]);
  });

  it('reports nothing without a next cart or without its updatedAt', () => {
    expect(
      linesAddedToCart(cartAt('2026-10-25T10:00:00Z', [a1]), null),
    ).toEqual([]);
    expect(linesAddedToCart(null, cartAt('', [a1]))).toEqual([]);
  });

  it('leaves both carts unchanged', () => {
    const previous = cartAt('2026-10-25T10:00:00Z', [a1]);
    const next = cartAt('2026-10-25T10:01:00Z', [cartLine('a', 2), b1]);
    const before = structuredClone({previous, next});

    linesAddedToCart(previous, next);

    expect({previous, next}).toEqual(before);
  });

  it('compares large carts line by line', () => {
    const count = 10_000;
    const lines = Array.from({length: count}, (_, i) => cartLine(`l${i}`, 1));
    const grown = lines.map((line, i) =>
      i % 1000 === 0 ? {...line, quantity: 2} : line,
    );

    const added = linesAddedToCart(
      cartAt('2026-10-25T10:00:00Z', lines),
      cartAt('2026-10-25T10:01:00Z', [...grown, cartLine('new', 1)]),
    );

    expect(added).toHaveLength(count / 1000 + 1);
  });
});

describe('consentStateOf', () => {
  const loaded = (overrides: Partial<CustomerPrivacyLike> = {}) => ({
    consentStatus: 'loaded',
    analyticsProcessingAllowed: () => true,
    marketingAllowed: () => false,
    saleOfDataAllowed: () => true,
    currentVisitorConsent: () => ({analytics: 'yes'}),
    ...overrides,
  });

  it('is null until the Customer Privacy API has loaded the consent', () => {
    expect(consentStateOf(undefined)).toBeNull();
    expect(consentStateOf(null)).toBeNull();
    expect(consentStateOf({})).toBeNull();
    expect(consentStateOf(loaded({consentStatus: 'loading'}))).toBeNull();
  });

  it("reads the visitor's consent once it has loaded", () => {
    expect(consentStateOf(loaded())).toEqual({
      analyticsAllowed: true,
      marketingAllowed: false,
      saleOfDataAllowed: true,
    });
  });

  it('refuses analytics when the visitor said no, whatever the region default', () => {
    const privacy = loaded({currentVisitorConsent: () => ({analytics: 'no'})});

    expect(consentStateOf(privacy)?.analyticsAllowed).toBe(false);
  });

  it('refuses what the API cannot answer', () => {
    const privacy = {consentStatus: 'loaded'};

    expect(consentStateOf(privacy)).toEqual(DENIED);
  });

  it('refuses everything when the API throws', () => {
    const privacy = loaded({
      marketingAllowed: () => {
        throw new Error('broken');
      },
    });

    expect(consentStateOf(privacy)).toEqual(DENIED);
  });
});

describe('createAnalyticsTracker', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  /** A tracker on fake browser, consent and network. */
  function setup(initialConsent: ConsentState | null = CONSENTED) {
    let consent = initialConsent;
    let browser = BROWSER;
    const sent: ShopifyAnalytics[] = [];
    const readBrowser = vi.fn(() => browser);
    const readConsent = vi.fn(() => consent);
    const send = vi.fn((event: ShopifyAnalytics) => {
      sent.push(event);
    });
    const tracker = createAnalyticsTracker({readConsent, readBrowser, send});
    return {
      tracker,
      sent,
      readBrowser,
      readConsent,
      send,
      names: () => sent.map((event) => event.eventName),
      setConsent(next: ConsentState | null) {
        consent = next;
      },
      visit(path: string, overrides: Partial<ClientBrowserParameters> = {}) {
        browser = browserAt(path, overrides);
      },
    };
  }

  /** The page-view payload of the n-th event sent. */
  const pagePayload = (sent: ShopifyAnalytics[], index: number) =>
    sent[index].payload as ReturnType<typeof buildPageView>['payload'];

  describe('before the shop data and the consent are ready', () => {
    it('sends nothing', () => {
      const {tracker, sent} = setup(null);

      tracker.setShop(SHOP);
      tracker.pageViewed();

      expect(sent).toEqual([]);
    });

    it('waits for the shop data even when the consent is ready', () => {
      const {tracker, names} = setup();

      tracker.pageViewed();
      expect(names()).toEqual([]);

      tracker.setShop(SHOP);
      expect(names()).toEqual(['PAGE_VIEW_2']);
    });

    it('sends what waited, in order, once both are ready', () => {
      // Arrange
      const {tracker, names, sent, setConsent} = setup(null);
      tracker.productViewed({products: [PRODUCT]});
      tracker.pageViewed();
      tracker.setShop(SHOP);

      // Act
      setConsent(CONSENTED);
      tracker.consentChanged();

      // Assert
      expect(names()).toEqual(['PRODUCT_VIEW', 'PAGE_VIEW_2']);
      expect(pagePayload(sent, 1)).toMatchObject({
        pageType: 'product',
        resourceId: PRODUCT.id,
      });
    });

    it('keeps the page an event was tracked on, with the tokens known when it is sent', () => {
      // Arrange: the consent arrives after a navigation.
      const {tracker, sent, setConsent, visit} = setup(null);
      tracker.setShop(SHOP);
      visit('/collections/pillows');
      tracker.collectionViewed({
        collection: {id: 'gid://shopify/Collection/7', handle: 'pillows'},
      });
      tracker.pageViewed();
      visit('/search', {
        uniqueToken: 'unique-token-2',
        visitToken: 'visit-token-2',
      });

      // Act
      setConsent(CONSENTED);
      tracker.consentChanged();

      // Assert
      expect(sent).toHaveLength(2);
      for (const {payload} of sent) {
        expect(payload).toMatchObject({
          url: 'https://mellow.example/collections/pillows',
          path: '/collections/pillows',
          title: 'Mellow /collections/pillows',
          uniqueToken: 'unique-token-2',
          visitToken: 'visit-token-2',
        });
      }
    });

    it(`keeps at most ${MAX_PENDING_EVENTS} waiting events, dropping the oldest`, () => {
      const {tracker, sent, setConsent, visit} = setup(null);
      tracker.setShop(SHOP);
      for (let page = 0; page < MAX_PENDING_EVENTS + 5; page++) {
        visit(`/pages/${page}`);
        tracker.pageViewed();
      }

      setConsent(CONSENTED);
      tracker.consentChanged();

      expect(sent).toHaveLength(MAX_PENDING_EVENTS);
      expect(pagePayload(sent, 0).path).toBe('/pages/5');
    });

    it('sends the waiting events first when the consent became readable before consentChanged', () => {
      const {tracker, names, setConsent} = setup(null);
      tracker.setShop(SHOP);
      tracker.productViewed({products: [PRODUCT]});

      setConsent(CONSENTED);
      tracker.pageViewed();

      expect(names()).toEqual(['PRODUCT_VIEW', 'PAGE_VIEW_2']);
    });

    it('does not read the browser before anything is tracked', () => {
      const {tracker, readBrowser} = setup();

      tracker.setShop(SHOP);
      tracker.consentChanged();

      expect(readBrowser).not.toHaveBeenCalled();
    });
  });

  describe('without consent', () => {
    it('builds no payload at all, and never reads the browser or its tokens', () => {
      const {tracker, sent, readBrowser} = setup(DENIED);
      tracker.setShop(SHOP);

      tracker.productViewed({products: [PRODUCT]});
      tracker.pageViewed();
      tracker.cartChanged(cartAt('2026-10-25T10:00:00Z', []));
      tracker.cartChanged(cartAt('2026-10-25T10:01:00Z', [cartLine('a', 1)]));

      expect(sent).toEqual([]);
      expect(readBrowser).not.toHaveBeenCalled();
    });

    it('drops what waited as soon as an event finds the consent refused, without reading the browser for that event', () => {
      // Arrange: one page view waits for the consent.
      const {tracker, names, readBrowser, setConsent} = setup(null);
      tracker.setShop(SHOP);
      tracker.pageViewed();
      expect(readBrowser).toHaveBeenCalledTimes(1);

      // Act: the refusal is readable before consentChanged reports it.
      setConsent(DENIED);
      tracker.searchViewed({searchTerm: 'pillow'});
      setConsent(CONSENTED);
      tracker.consentChanged();

      // Assert
      expect(names()).toEqual([]);
      expect(readBrowser).toHaveBeenCalledTimes(1);
    });

    it('drops what waited when the consent turns out refused, and sends later events once allowed', () => {
      // Arrange
      const {tracker, names, setConsent} = setup(null);
      tracker.setShop(SHOP);
      tracker.pageViewed();
      setConsent(DENIED);
      tracker.consentChanged();

      // Act
      setConsent(CONSENTED);
      tracker.consentChanged();
      tracker.searchViewed({searchTerm: 'pillow'});

      // Assert
      expect(names()).toEqual(['SEARCH_VIEW']);
    });
  });

  describe('once ready', () => {
    it('sends every event right away', () => {
      const {tracker, names} = setup();
      tracker.setShop(SHOP);

      tracker.searchViewed({searchTerm: 'pillow'});
      tracker.pageViewed();

      expect(names()).toEqual(['SEARCH_VIEW', 'PAGE_VIEW_2']);
    });

    it('gives a single page view the page type and resource of the view before it', () => {
      // Arrange
      const {tracker, sent} = setup();
      tracker.setShop(SHOP);

      // Act
      tracker.collectionViewed({
        collection: {id: 'gid://shopify/Collection/7', handle: 'pillows'},
      });
      tracker.pageViewed();
      tracker.pageViewed();

      // Assert
      expect(pagePayload(sent, 1)).toMatchObject({
        pageType: 'collection',
        resourceId: 'gid://shopify/Collection/7',
      });
      expect(pagePayload(sent, 2)).not.toHaveProperty('pageType');
      expect(pagePayload(sent, 2)).not.toHaveProperty('resourceId');
    });

    it('marks the page view after a search with the search page type only', () => {
      const {tracker, sent} = setup();
      tracker.setShop(SHOP);

      tracker.searchViewed({searchTerm: 'pillow'});
      tracker.pageViewed();

      expect(pagePayload(sent, 1).pageType).toBe('search');
      expect(pagePayload(sent, 1)).not.toHaveProperty('resourceId');
    });

    it('sends no PRODUCT_VIEW for a product it cannot send, but keeps the product page on the page view after it', () => {
      // Hydrogen's page view had the product page type whenever the view
      // had products.
      const {tracker, names, sent} = setup();
      tracker.setShop(SHOP);

      tracker.productViewed({
        products: [{...PRODUCT, variantId: '', variantTitle: ''}],
      });
      tracker.pageViewed();

      expect(names()).toEqual(['PAGE_VIEW_2']);
      expect(pagePayload(sent, 0)).toMatchObject({
        pageType: 'product',
        resourceId: PRODUCT.id,
      });
    });

    it('sends the product view of a product without a vendor', () => {
      const {tracker, names, sent} = setup();
      tracker.setShop(SHOP);

      tracker.productViewed({products: [{...PRODUCT, vendor: ''}]});
      tracker.pageViewed();

      expect(names()).toEqual(['PRODUCT_VIEW', 'PAGE_VIEW_2']);
      expect(pagePayload(sent, 1).resourceId).toBe(PRODUCT.id);
    });

    it('gives the page view no page type after a product view without products', () => {
      const {tracker, names, sent} = setup();
      tracker.setShop(SHOP);

      tracker.productViewed({products: []});
      tracker.pageViewed();

      expect(names()).toEqual(['PAGE_VIEW_2']);
      expect(pagePayload(sent, 0)).not.toHaveProperty('pageType');
    });

    it('keeps working when its methods are called on their own', () => {
      const {tracker, names} = setup(null);
      const {setShop, pageViewed, consentChanged} = tracker;

      setShop(SHOP);
      pageViewed();
      consentChanged();

      expect(names()).toEqual([]);
    });
  });

  describe('in development', () => {
    /** Everything written to console.warn. */
    const warnings = () =>
      vi
        .mocked(console.warn)
        .mock.calls.map((args) => args.map(String).join(' '));

    it('warns once per missing field, naming it, when a product view cannot be sent', () => {
      // Arrange
      vi.stubEnv('DEV', true);
      const {tracker} = setup();
      tracker.setShop(SHOP);

      // Act
      tracker.productViewed({
        products: [{...PRODUCT, variantId: '', variantTitle: ''}],
      });
      tracker.productViewed({products: [{...PRODUCT, variantId: ''}]});
      tracker.productViewed({products: [{...PRODUCT, title: ''}]});

      // Assert
      expect(warnings()).toHaveLength(2);
      expect(warnings()[0]).toContain('[analytics]');
      expect(warnings()[0]).toContain('Analytics.ProductView');
      expect(warnings()[0]).toContain('variantId');
      expect(warnings()[0]).toContain('variantTitle');
      expect(warnings()[1]).toContain('title');
      expect(warnings()[1]).not.toContain('variantId');
    });

    it('warns about a product view without products', () => {
      vi.stubEnv('DEV', true);
      const {tracker} = setup();

      tracker.productViewed({products: []});

      expect(warnings()).toHaveLength(1);
      expect(warnings()[0]).toContain('products');
    });

    it('warns before the shop data or the consent are known', () => {
      vi.stubEnv('DEV', true);
      const {tracker} = setup(null);

      tracker.productViewed({products: [{...PRODUCT, price: ''}]});

      expect(warnings()).toHaveLength(1);
      expect(warnings()[0]).toContain('price');
    });

    it('does not warn about a product without a vendor, which is sent', () => {
      vi.stubEnv('DEV', true);
      const {tracker} = setup();
      tracker.setShop(SHOP);

      tracker.productViewed({products: [{...PRODUCT, vendor: ''}]});

      expect(console.warn).not.toHaveBeenCalled();
    });

    it('stays silent in production builds', () => {
      vi.stubEnv('DEV', false);
      const {tracker} = setup();
      tracker.setShop(SHOP);

      tracker.productViewed({products: [{...PRODUCT, variantId: ''}]});

      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('failures', () => {
    /** Everything written to console.error. */
    const errors = () =>
      vi
        .mocked(console.error)
        .mock.calls.map((args) => args.map(String).join(' '));

    const failing = (message: string) => () => {
      throw new Error(message);
    };

    it("catches a throwing browser reader (the consent script's token readers), logs it once and recovers once it works", () => {
      // Arrange
      const {tracker, names, readBrowser} = setup();
      tracker.setShop(SHOP);
      readBrowser.mockImplementation(failing('uniqueToken failed'));

      // Act
      expect(() => tracker.pageViewed()).not.toThrow();
      expect(() => tracker.searchViewed({searchTerm: 'pillow'})).not.toThrow();
      readBrowser.mockImplementation(() => BROWSER);
      tracker.pageViewed();

      // Assert
      expect(errors()).toHaveLength(1);
      expect(errors()[0]).toContain('[analytics]');
      expect(errors()[0]).toContain('uniqueToken failed');
      expect(names()).toEqual(['PAGE_VIEW_2']);
    });

    it('catches a send that throws and still sends the events after it', () => {
      // Arrange: two events wait for the consent.
      const {tracker, names, send, setConsent} = setup(null);
      tracker.setShop(SHOP);
      tracker.searchViewed({searchTerm: 'pillow'});
      tracker.pageViewed();
      send.mockImplementationOnce(failing('sendShopifyAnalytics threw'));

      // Act
      setConsent(CONSENTED);
      expect(() => tracker.consentChanged()).not.toThrow();

      // Assert
      expect(names()).toEqual(['PAGE_VIEW_2']);
      expect(errors()).toHaveLength(1);
      expect(errors()[0]).toContain('sendShopifyAnalytics threw');
    });

    it('logs a thrown value that is not an Error as it is', () => {
      const {tracker, send} = setup();
      tracker.setShop(SHOP);
      send.mockImplementation(() => {
        throw 'monorail offline';
      });

      tracker.pageViewed();

      expect(errors()).toHaveLength(1);
      expect(errors()[0]).toContain('monorail offline');
    });

    it('logs only the first failure of a tracker', () => {
      const {tracker, send} = setup();
      tracker.setShop(SHOP);
      send.mockImplementation(failing('offline'));

      tracker.pageViewed();
      tracker.pageViewed();
      tracker.searchViewed({searchTerm: 'pillow'});

      expect(send).toHaveBeenCalledTimes(3);
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['setShop', (tracker: AnalyticsTracker) => tracker.setShop(SHOP)],
      [
        'consentChanged',
        (tracker: AnalyticsTracker) => tracker.consentChanged(),
      ],
      ['pageViewed', (tracker: AnalyticsTracker) => tracker.pageViewed()],
      [
        'productViewed',
        (tracker: AnalyticsTracker) =>
          tracker.productViewed({products: [PRODUCT]}),
      ],
      [
        'collectionViewed',
        (tracker: AnalyticsTracker) =>
          tracker.collectionViewed({
            collection: {id: 'gid://shopify/Collection/7', handle: 'pillows'},
          }),
      ],
      [
        'searchViewed',
        (tracker: AnalyticsTracker) => tracker.searchViewed({searchTerm: 'x'}),
      ],
      [
        'cartChanged',
        (tracker: AnalyticsTracker) =>
          tracker.cartChanged(
            cartAt('2026-10-25T10:01:00Z', [cartLine('a', 1)]),
          ),
      ],
    ])('never throws out of %s', (_name, call) => {
      // Arrange: the shop data, an event waiting for the consent and a cart
      // baseline, so each method reaches a dependency, and every one throws.
      const {tracker, readBrowser, readConsent} = setup(null);
      tracker.setShop(SHOP);
      tracker.pageViewed();
      tracker.cartChanged(cartAt('2026-10-25T10:00:00Z', []));
      readBrowser.mockImplementation(failing('reader failed'));
      readConsent.mockImplementation(failing('consent failed'));

      // Act and assert
      expect(() => call(tracker)).not.toThrow();
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it('survives view data that is not what the types promise', () => {
      const {tracker, names} = setup();
      tracker.setShop(SHOP);

      expect(() =>
        tracker.collectionViewed(undefined as unknown as CollectionViewData),
      ).not.toThrow();
      tracker.pageViewed();

      expect(names()).toEqual(['PAGE_VIEW_2']);
      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('cart changes', () => {
    const t0 = '2026-10-25T10:00:00Z';
    const t1 = '2026-10-25T10:01:00Z';
    const t2 = '2026-10-25T10:02:00Z';

    it('take the first cart as the baseline', () => {
      const {tracker, sent} = setup();
      tracker.setShop(SHOP);

      tracker.cartChanged(cartAt(t0, [cartLine('a', 1)]));

      expect(sent).toEqual([]);
    });

    it('report each line added after the baseline as ADD_TO_CART', () => {
      // Arrange
      const {tracker, sent} = setup();
      tracker.setShop(SHOP);
      tracker.cartChanged(cartAt(t0, [cartLine('a', 1)]));

      // Act
      tracker.cartChanged(cartAt(t1, [cartLine('a', 1), cartLine('b', 1)]));

      // Assert
      expect(sent).toHaveLength(1);
      expect(sent[0].eventName).toBe('ADD_TO_CART');
      expect(sent[0].payload).toMatchObject({
        cartId: CART_ID,
        products: [{productGid: 'gid://shopify/Product/b', quantity: 1}],
      });
    });

    it('report a higher quantity with the new line quantity', () => {
      const {tracker, sent} = setup();
      tracker.setShop(SHOP);
      tracker.cartChanged(cartAt(t0, [cartLine('a', 1)]));

      tracker.cartChanged(cartAt(t1, [cartLine('a', 3)]));

      expect(sent[0].payload).toMatchObject({
        products: [{productGid: 'gid://shopify/Product/a', quantity: 3}],
      });
    });

    it('report nothing for removals and lower quantities', () => {
      const {tracker, sent} = setup();
      tracker.setShop(SHOP);
      tracker.cartChanged(cartAt(t0, [cartLine('a', 3), cartLine('b', 1)]));

      tracker.cartChanged(cartAt(t1, [cartLine('a', 1)]));

      expect(sent).toEqual([]);
    });

    it('skip a missing cart and keep comparing with the last one', () => {
      // Arrange: a failed cart query answers null.
      const {tracker, sent} = setup();
      tracker.setShop(SHOP);
      tracker.cartChanged(cartAt(t0, [cartLine('a', 1)]));
      tracker.cartChanged(null);

      // Act
      tracker.cartChanged(cartAt(t0, [cartLine('a', 1)]));
      tracker.cartChanged(cartAt(t2, [cartLine('a', 1), cartLine('b', 1)]));

      // Assert
      expect(sent).toHaveLength(1);
      expect(sent[0].payload).toMatchObject({
        products: [{productGid: 'gid://shopify/Product/b'}],
      });
    });

    it('report the lines of a cart created after a page without one', () => {
      const {tracker, names} = setup();
      tracker.setShop(SHOP);
      tracker.cartChanged(null);

      tracker.cartChanged(cartAt(t0, [cartLine('a', 2)]));

      expect(names()).toEqual(['ADD_TO_CART']);
    });

    it('wait for the consent like every other event', () => {
      const {tracker, names, setConsent} = setup(null);
      tracker.setShop(SHOP);
      tracker.cartChanged(cartAt(t0, []));
      tracker.cartChanged(cartAt(t1, [cartLine('a', 1)]));
      expect(names()).toEqual([]);

      setConsent(CONSENTED);
      tracker.consentChanged();

      expect(names()).toEqual(['ADD_TO_CART']);
    });

    it('never write the cart id or anything else to browser storage', () => {
      // Arrange: Hydrogen kept `cartLastUpdatedAt` (with the cart id and its
      // key) in localStorage; the tracker must not persist anything.
      const storage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      vi.stubGlobal('localStorage', storage);
      vi.stubGlobal('sessionStorage', storage);
      const {tracker, sent} = setup();
      tracker.setShop(SHOP);

      // Act
      tracker.cartChanged(cartAt(t0, [cartLine('a', 1)]));
      tracker.cartChanged(cartAt(t1, [cartLine('a', 2)]));
      tracker.cartChanged(cartAt(t2, [cartLine('a', 2), cartLine('b', 1)]));

      // Assert
      expect(sent).toHaveLength(2);
      expect(storage.getItem).not.toHaveBeenCalled();
      expect(storage.setItem).not.toHaveBeenCalled();
    });
  });
});
