// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://mellow.example/"}
import {act, StrictMode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {
  Outlet,
  RouterProvider,
  createBrowserRouter,
  useLoaderData,
  type RouteObject,
  type ShouldRevalidateFunction,
} from 'react-router';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {AnalyticsConfig, AnalyticsShop, ConsentConfig} from './config';
import type {AnalyticsProduct} from './events';

/**
 * The analytics provider and the consent loader in a DOM (jsdom), inside a
 * React Router data router wired the way app/root.tsx wires them. The network
 * is `fetch`: hydrogen-react's sendShopifyAnalytics posts every event as one
 * Monorail batch. Shopify's consent script is simulated on `window.Shopify`
 * (loadConsentApi). Deterministic: promises settle inside act(), no timers.
 */

// Tells React that updates are flushed with act().
Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});

type AppModules = {
  analytics: typeof import('./index');
  consentScript: typeof import('./consent-script');
  nonce: typeof import('~/lib/nonce');
};
type CartData = CartApiQueryFragment | null;
type RootData = {analytics: AnalyticsConfig; cart: Promise<CartData>};
type MonorailEvent = {schema_id: string; payload: Record<string, unknown>};
/** What a script element carried at the moment it was inserted. */
type InsertedScript = {
  src: string;
  id: string;
  async: boolean;
  nonce: string | null;
  /** Whether window.Shopify.customerPrivacy.config was set by then. */
  configured: boolean;
};
type ConsoleCall = {level: 'error' | 'warn'; message: string};
type ShopifyGlobal = {
  country?: string;
  locale?: string;
  customerPrivacy?: Record<string, unknown> & {
    config?: Record<string, unknown>;
  };
};

const NONCE = '0123456789abcdef0123456789abcdef';
const MONORAIL_URL =
  'https://monorail-edge.shopifysvc.com/unstable/produce_batch';
const TREKKIE_PAGE_VIEW_SCHEMA = /^trekkie_storefront_page_view\//;
/**
 * act() rounds that let loaders, the shop data and React updates settle;
 * each round drains the microtask queue, as React waits a task in act().
 */
const SETTLE_ROUNDS = 5;
const SCRIPT_LOAD_FAILED_LOG =
  '[analytics] Unable to load the Customer Privacy API, so no analytics events are sent.';

const SHOP: AnalyticsShop = {
  shopId: 'gid://shopify/Shop/55555',
  acceptedLanguage: 'EN',
  currency: 'USD',
  hydrogenSubchannelId: '1000014925',
};
const CONSENT: ConsentConfig = {
  storefrontAccessToken: 'public-token-placeholder-0000000',
  country: 'US',
  language: 'EN',
};
const DISABLED: AnalyticsConfig = {enabled: false, shop: null, consent: null};
const PILLOW: AnalyticsProduct = {
  id: 'gid://shopify/Product/9',
  title: 'Cloud Pillow',
  price: '49.0',
  vendor: '{AppName}',
  variantId: 'gid://shopify/ProductVariant/99',
  variantTitle: 'Queen',
  quantity: 1,
};

/** What the root loader answers: fresh objects on every call, like a server. */
const server = {
  analytics: (): AnalyticsConfig => ({
    enabled: true,
    shop: Promise.resolve(SHOP),
    consent: {...CONSENT},
  }),
  cart: null as CartData,
  /** Root loader runs after hydration (navigation, revalidation). */
  loads: 0,
};

let modules: AppModules;
let container: HTMLElement;
let root: Root;
let routers: Array<ReturnType<typeof createBrowserRouter>>;
let fetchMock: ReturnType<typeof stubMonorail>;
let insertedScripts: InsertedScript[];
let consoleCalls: ConsoleCall[];

function cartWith(updatedAt: string, keys: readonly string[]): CartData {
  const lines = keys.map((key) => ({
    id: `gid://shopify/CartLine/${key}?cart=c1`,
    quantity: 1,
    merchandise: {
      id: `gid://shopify/ProductVariant/${key}`,
      title: 'Queen',
      price: {amount: '49.0'},
      product: {
        id: `gid://shopify/Product/${key}`,
        title: `Pillow ${key}`,
        vendor: '{AppName}',
      },
    },
  }));
  return {
    id: 'gid://shopify/Cart/c1?key=secret',
    updatedAt,
    lines: {nodes: lines},
  } as unknown as CartApiQueryFragment;
}

function rootData(): RootData {
  return {analytics: server.analytics(), cart: Promise.resolve(server.cart)};
}

/** app/root.tsx's rule: the root data reloads on mutations and revalidate(). */
const shouldRevalidateRoot: ShouldRevalidateFunction = ({
  formMethod,
  currentUrl,
  nextUrl,
}) =>
  Boolean(formMethod && formMethod !== 'GET') ||
  currentUrl.toString() === nextUrl.toString();

function createRoutes({
  Analytics,
  AnalyticsProvider,
}: AppModules['analytics']): RouteObject[] {
  function RootLayout() {
    const data = useLoaderData() as RootData;
    return (
      <AnalyticsProvider config={data.analytics} cart={data.cart}>
        <main>
          <Outlet />
        </main>
      </AnalyticsProvider>
    );
  }
  function ProductPage() {
    return (
      <>
        <p>Cloud Pillow</p>
        <Analytics.ProductView data={{products: [PILLOW]}} />
      </>
    );
  }
  function CollectionPage() {
    return (
      <>
        <p>Pillows</p>
        <Analytics.CollectionView
          data={{
            collection: {id: 'gid://shopify/Collection/7', handle: 'pillows'},
          }}
        />
      </>
    );
  }
  return [
    {
      id: 'root',
      path: '/',
      Component: RootLayout,
      loader: () => {
        server.loads += 1;
        return rootData();
      },
      shouldRevalidate: shouldRevalidateRoot,
      children: [
        {index: true, Component: () => <p>Home</p>},
        {path: 'products/:handle', Component: ProductPage},
        {path: 'collections/:handle', Component: CollectionPage},
      ],
    },
  ];
}

/** Lets pending promises and React updates settle, without timers. */
async function settle() {
  for (let round = 0; round < SETTLE_ROUNDS; round += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/** Hydrates `path` with the root data the server rendered it with. */
async function mount(path: string, {strict = false} = {}) {
  window.history.replaceState(null, '', path);
  const router = createBrowserRouter(createRoutes(modules.analytics), {
    hydrationData: {loaderData: {root: rootData()}},
  });
  routers.push(router);
  const tree = (
    <modules.nonce.NonceProvider value={NONCE}>
      <RouterProvider router={router} />
    </modules.nonce.NonceProvider>
  );
  await act(async () => {
    root.render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  });
  await settle();
  return router;
}

async function remount(path: string) {
  await act(async () => root.unmount());
  root = createRoot(container);
  return mount(path);
}

async function navigate(
  router: ReturnType<typeof createBrowserRouter>,
  path: string,
) {
  await act(async () => {
    await router.navigate(path, {replace: true});
  });
  await settle();
}

function shopifyGlobal(): ShopifyGlobal | undefined {
  return (window as Window & {Shopify?: ShopifyGlobal}).Shopify;
}

/**
 * What Shopify's consent script does once it has the visitor's consent; its
 * token readers are what getTrackingValues() reads.
 */
function loadConsentApi({analytics = true} = {}) {
  let tokens = {unique: 'unique-token-1', visit: 'visit-token-1'};
  let readTokens = () => tokens;
  const privacy = shopifyGlobal()?.customerPrivacy;
  if (!privacy) throw new Error('The loader did not configure the API');
  Object.assign(privacy, {
    consentStatus: 'loaded',
    analyticsProcessingAllowed: () => analytics,
    marketingAllowed: () => true,
    saleOfDataAllowed: () => true,
    currentVisitorConsent: () => ({analytics: analytics ? 'yes' : 'no'}),
    __internal: {
      uniqueToken: () => readTokens().unique,
      visitToken: () => readTokens().visit,
    },
  });
  return {
    setTokens(next: {unique: string; visit: string}) {
      tokens = next;
    },
    breakTokenReaders(message: string) {
      readTokens = () => {
        throw new Error(message);
      };
    },
  };
}

async function dispatchConsentEvent(
  name: 'consentTrackingApiLoaded' | 'visitorConsentCollected',
) {
  await act(async () => {
    document.dispatchEvent(new Event(name));
  });
  await settle();
}

async function finishLoadingScript(outcome: 'load' | 'error') {
  const script = document.getElementById(
    modules.consentScript.CONSENT_SCRIPT_ID,
  );
  if (!script) throw new Error('No consent script was inserted');
  await act(async () => {
    script.dispatchEvent(new Event(outcome));
  });
  await settle();
}

/** The script loads and the visitor's consent (to everything) arrives. */
async function giveConsent() {
  await finishLoadingScript('load');
  const api = loadConsentApi();
  await dispatchConsentEvent('consentTrackingApiLoaded');
  return api;
}

function stubMonorail() {
  const mock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({result: [{status: 200}]})),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

/** The Monorail events of every batch sent, checking where each went. */
function monorailBatches(): MonorailEvent[][] {
  return fetchMock.mock.calls.map(([input, init]) => {
    expect(String(input)).toBe(MONORAIL_URL);
    const {events} = JSON.parse(String(init?.body)) as {
      events: MonorailEvent[];
    };
    return events;
  });
}

/**
 * The batches sent, one string per event: Trekkie page views as
 * `page_view <pageType> <resourceType>`, the other events by name.
 */
function sentBatches(): string[][] {
  return monorailBatches().map((events) =>
    events.map(({schema_id: schemaId, payload}) =>
      TREKKIE_PAGE_VIEW_SCHEMA.test(schemaId)
        ? `page_view ${String(payload.pageType ?? '-')} ${String(payload.resourceType ?? '-')}`
        : String(payload.event_name),
    ),
  );
}

/** The page URL each event of each batch reports. */
function sentUrls(): string[][] {
  return monorailBatches().map((events) =>
    events.map(({payload}) => String(payload.url ?? payload.event_source_url)),
  );
}

/** Takes the console output so far, which the after-each check then allows. */
function takeConsole(): ConsoleCall[] {
  const calls = consoleCalls;
  consoleCalls = [];
  return calls;
}

/**
 * Fails the test on console output it did not take: React and React Router
 * warnings, or analytics logs nobody expected.
 */
function failOnUnexpectedConsoleOutput() {
  if (consoleCalls.length === 0) return;
  throw new Error(
    `Unexpected console output: ${JSON.stringify(consoleCalls, null, 2)}`,
  );
}

beforeEach(async () => {
  // A fresh module graph per test: the consent script is a page singleton.
  vi.resetModules();
  const [analytics, consentScript, nonce] = await Promise.all([
    import('./index'),
    import('./consent-script'),
    import('~/lib/nonce'),
  ]);
  modules = {analytics, consentScript, nonce};

  server.analytics = () => ({
    enabled: true,
    shop: Promise.resolve(SHOP),
    consent: {...CONSENT},
  });
  server.cart = null;
  server.loads = 0;
  routers = [];
  insertedScripts = [];
  consoleCalls = [];
  delete (window as Window & {Shopify?: ShopifyGlobal}).Shopify;
  document.body.replaceChildren();

  fetchMock = stubMonorail();
  for (const level of ['error', 'warn'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      consoleCalls.push({level, message: args.map(String).join(' ')});
    });
  }
  const appendChild = document.body.appendChild.bind(document.body);
  vi.spyOn(document.body, 'appendChild').mockImplementation(
    <T extends Node>(node: T): T => {
      if (node instanceof HTMLScriptElement) {
        insertedScripts.push({
          src: node.src,
          id: node.id,
          async: node.async,
          nonce: node.getAttribute('nonce'),
          configured: shopifyGlobal()?.customerPrivacy?.config !== undefined,
        });
      }
      return appendChild(node);
    },
  );
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  for (const router of routers) router.dispose();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  failOnUnexpectedConsoleOutput();
});

describe('AnalyticsProvider with analytics off', () => {
  it('renders exactly its children and loads, sets up and sends nothing', async () => {
    // Arrange: the default for every store, and the e2e mock.
    server.analytics = () => DISABLED;

    // Act
    await mount('/products/pillow');
    await dispatchConsentEvent('consentTrackingApiLoaded');

    // Assert
    expect(container.innerHTML).toBe('<main><p>Cloud Pillow</p></main>');
    expect(insertedScripts).toEqual([]);
    expect(document.querySelector('script')).toBeNull();
    expect('Shopify' in window).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('AnalyticsProvider with analytics on', () => {
  it('loads the consent script once the shop data is known: configured first, with the CSP nonce set before insertion', async () => {
    // Act
    await mount('/products/pillow');

    // Assert
    expect(insertedScripts).toEqual([
      {
        src: modules.consentScript.CONSENT_API_URL,
        id: 'customer-privacy-api',
        async: true,
        nonce: NONCE,
        configured: true,
      },
    ]);
    expect(shopifyGlobal()?.customerPrivacy?.config).toEqual({
      isHeadless: true,
      asyncConsent: true,
      asyncVisitorState: true,
      consentDomain: 'mellow.example',
      storefrontAccessToken: CONSENT.storefrontAccessToken,
    });
    expect(shopifyGlobal()?.country).toBe('US');
    expect(shopifyGlobal()?.locale).toBe('en');
    expect(container.innerHTML).toBe('<main><p>Cloud Pillow</p></main>');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends nothing until the consent API reports the consent loaded', async () => {
    // Arrange
    await mount('/products/pillow');

    // Act: the script loads and announces itself before it has the consent.
    await finishLoadingScript('load');
    await dispatchConsentEvent('consentTrackingApiLoaded');

    // Assert
    expect(fetchMock).not.toHaveBeenCalled();
    loadConsentApi();
    await dispatchConsentEvent('consentTrackingApiLoaded');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends nothing when the visitor refused analytics', async () => {
    await mount('/products/pillow');
    await finishLoadingScript('load');

    loadConsentApi({analytics: false});
    await dispatchConsentEvent('consentTrackingApiLoaded');
    await dispatchConsentEvent('visitorConsentCollected');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the product view before the page view, which carries the product page type and resource', async () => {
    // Arrange
    await mount('/products/pillow');

    // Act
    await giveConsent();

    // Assert: the page view publisher renders after the children.
    expect(sentBatches()).toEqual([
      ['product_page_rendered'],
      ['page_view product product', 'page_rendered'],
    ]);
    const [, [trekkiePageView]] = monorailBatches();
    expect(trekkiePageView.payload).toMatchObject({
      pageType: 'product',
      resourceType: 'product',
      resourceId: 9,
    });
  });

  it('sends both views again, with the new URL, after a search-param navigation', async () => {
    // Arrange
    const router = await mount('/products/pillow');
    await giveConsent();
    fetchMock.mockClear();

    // Act: selecting a variant changes the search params only.
    await navigate(router, '/products/pillow?Color=Blue');

    // Assert
    const url = 'https://mellow.example/products/pillow?Color=Blue';
    expect(sentBatches()).toEqual([
      ['product_page_rendered'],
      ['page_view product product', 'page_rendered'],
    ]);
    expect(sentUrls()).toEqual([[url], [url, url]]);
  });

  it("sends a client navigation's collection view before its page view, then a plain page view at home", async () => {
    // Arrange
    const router = await mount('/products/pillow');
    await giveConsent();
    fetchMock.mockClear();

    // Act
    await navigate(router, '/collections/pillows');
    const atCollection = sentBatches();
    fetchMock.mockClear();
    await navigate(router, '/');

    // Assert
    expect(atCollection).toEqual([
      ['collection_page_rendered'],
      ['page_view collection collection', 'page_rendered'],
    ]);
    expect(sentBatches()).toEqual([['page_view - -', 'page_rendered']]);
  });

  it('sends one batch however often the consent events repeat', async () => {
    // Arrange: the home page has one page view.
    await mount('/');
    await finishLoadingScript('load');
    loadConsentApi();

    // Act
    for (let repeat = 0; repeat < 3; repeat += 1) {
      await dispatchConsentEvent('consentTrackingApiLoaded');
      await dispatchConsentEvent('visitorConsentCollected');
    }

    // Assert
    expect(sentBatches()).toEqual([['page_view - -', 'page_rendered']]);
    expect(server.loads).toBe(0);
  });

  it('revalidates the root data exactly once when a consent change brings new tracking tokens', async () => {
    // Arrange
    await mount('/');
    const api = await giveConsent();
    expect(server.loads).toBe(0);

    // Act: new tokens, then the same ones again.
    api.setTokens({unique: 'unique-token-2', visit: 'visit-token-2'});
    await dispatchConsentEvent('visitorConsentCollected');
    await dispatchConsentEvent('visitorConsentCollected');

    // Assert: one reload, which sends no event of its own.
    expect(server.loads).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a line added to the cart by a revalidation as ADD_TO_CART', async () => {
    // Arrange
    server.cart = cartWith('2026-10-25T10:00:00Z', ['1']);
    const router = await mount('/');
    await giveConsent();
    fetchMock.mockClear();

    // Act: an add-to-cart action revalidates the root data.
    server.cart = cartWith('2026-10-25T10:01:00Z', ['1', '2']);
    await act(async () => {
      await router.revalidate();
    });
    await settle();

    // Assert
    expect(sentBatches()).toEqual([['product_added_to_cart']]);
    const [[added]] = monorailBatches();
    expect(String(added.payload.products)).toContain('Pillow 2');
    expect(String(added.payload.products)).not.toContain('Pillow 1');
  });

  it("keeps the page rendered when the consent script's token readers throw", async () => {
    // Arrange
    const router = await mount('/products/pillow');
    await finishLoadingScript('load');
    loadConsentApi().breakTokenReaders('uniqueToken failed');

    // Act: the consent arrives (twice), then a navigation publishes views.
    await dispatchConsentEvent('consentTrackingApiLoaded');
    await dispatchConsentEvent('visitorConsentCollected');
    await navigate(router, '/collections/pillows');

    // Assert: no error boundary, nothing sent, one log per failing part.
    expect(container.innerHTML).toBe('<main><p>Pillows</p></main>');
    expect(fetchMock).not.toHaveBeenCalled();
    const logged = takeConsole();
    expect(logged).toHaveLength(2);
    for (const {level, message} of logged) {
      expect(level).toBe('error');
      expect(message).toMatch(/^\[analytics\] .*uniqueToken failed/);
    }
  });

  it('keeps the page rendered when window.Shopify cannot be configured', async () => {
    // Arrange: another script left a frozen window.Shopify behind.
    Object.assign(window, {Shopify: Object.freeze({})});

    // Act
    await mount('/products/pillow');

    // Assert
    expect(container.innerHTML).toBe('<main><p>Cloud Pillow</p></main>');
    const logged = takeConsole();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({level: 'error'});
    expect(logged[0].message).toMatch(
      /^\[analytics\] The Customer Privacy API failed/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs once and sends nothing when the consent script cannot load, and never inserts it again', async () => {
    // Arrange
    await mount('/');

    // Act
    await finishLoadingScript('error');
    await remount('/');

    // Assert
    expect(takeConsole()).toEqual([
      {level: 'error', message: SCRIPT_LOAD_FAILED_LOG},
    ]);
    expect(insertedScripts).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('inserts the consent script once across remounts, and the remounted page still sends its views', async () => {
    // Arrange
    await mount('/');
    await giveConsent();
    fetchMock.mockClear();

    // Act
    await remount('/products/pillow');
    await dispatchConsentEvent('consentTrackingApiLoaded');

    // Assert
    expect(insertedScripts).toHaveLength(1);
    expect(document.querySelectorAll('script')).toHaveLength(1);
    expect(sentBatches()).toEqual([
      ['product_page_rendered'],
      ['page_view product product', 'page_rendered'],
    ]);
  });

  it('inserts the consent script once under StrictMode, which runs every effect twice, without React warnings', async () => {
    // Act
    await mount('/products/pillow', {strict: true});
    await giveConsent();

    // Assert: development's double effects publish each view twice.
    expect(insertedScripts).toHaveLength(1);
    expect(sentBatches()).toEqual([
      ['product_page_rendered'],
      ['page_view product product', 'page_rendered'],
      ['product_page_rendered'],
      ['page_view product product', 'page_rendered'],
    ]);
  });
});
