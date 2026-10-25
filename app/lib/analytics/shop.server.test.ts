import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {expectValidStorefrontDocument} from '~/lib/__tests__/route-test-utils';
import {CacheLong} from '~/lib/storefront/cache.server';
import {createStorefrontClient} from '~/lib/storefront/client.server';
import {getOperationName} from '~/lib/storefront/graphql';
import {DISABLED_ANALYTICS_CONFIG} from './config';
import {
  SHOP_ANALYTICS_QUERY,
  getAnalyticsConfig,
  getShopAnalytics,
} from './shop.server';

/** What the Storefront API answers to the ShopData query. */
const SHOP_DATA = {
  shop: {id: 'gid://shopify/Shop/55555'},
  localization: {
    country: {currency: {isoCode: 'EUR'}},
    language: {isoCode: 'DE'},
  },
};

const STOREFRONT_ID = '1000014925';
const PUBLIC_TOKEN = 'public-token-placeholder-0000000';

/** A store with analytics configured, as the Worker's env holds it. */
const CONFIGURED_ENV = {
  PUBLIC_CHECKOUT_DOMAIN: 'checkout.mellow.example',
  PUBLIC_STOREFRONT_ID: STOREFRONT_ID,
  PUBLIC_STOREFRONT_API_TOKEN: PUBLIC_TOKEN,
};

type ConfigArgs = Parameters<typeof getAnalyticsConfig>[0];

/** A storefront whose `query` answers `SHOP_DATA` and records every call. */
function createFakeStorefront() {
  const query = vi.fn(
    async (..._args: unknown[]): Promise<unknown> => SHOP_DATA,
  );
  const cacheLong = vi.fn(CacheLong);
  const storefront = {
    query,
    CacheLong: cacheLong,
    i18n: {language: 'EN', country: 'US'},
  } as unknown as ConfigArgs['storefront'];
  return {storefront, query, cacheLong};
}

/** Everything written to console.error. */
function loggedErrors(): string {
  return vi.mocked(console.error).mock.calls.flat().map(String).join('\n');
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SHOP_ANALYTICS_QUERY', () => {
  it("is Hydrogen's ShopData query, valid against the Storefront API schema", () => {
    expect(getOperationName(SHOP_ANALYTICS_QUERY)).toBe('ShopData');
    expectValidStorefrontDocument(SHOP_ANALYTICS_QUERY);
  });

  it("runs in the storefront's country and language", () => {
    expect(SHOP_ANALYTICS_QUERY).toContain(
      '@inContext(country: $country, language: $language)',
    );
  });
});

describe('getShopAnalytics', () => {
  it('runs the ShopData query with the CacheLong strategy', async () => {
    // Arrange
    const {storefront, query, cacheLong} = createFakeStorefront();

    // Act
    await getShopAnalytics({storefront, publicStorefrontId: STOREFRONT_ID});

    // Assert
    expect(cacheLong).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(SHOP_ANALYTICS_QUERY, {
      cache: CacheLong(),
    });
  });

  it('returns the shop id, language and currency with the storefront id', async () => {
    const {storefront} = createFakeStorefront();

    const shop = await getShopAnalytics({
      storefront,
      publicStorefrontId: STOREFRONT_ID,
    });

    expect(shop).toEqual({
      shopId: 'gid://shopify/Shop/55555',
      acceptedLanguage: 'DE',
      currency: 'EUR',
      hydrogenSubchannelId: STOREFRONT_ID,
    });
  });

  it('passes a failed query on', async () => {
    const {storefront, query} = createFakeStorefront();
    const failure = new Response('Storefront API error', {status: 502});
    query.mockRejectedValueOnce(failure);

    await expect(
      getShopAnalytics({storefront, publicStorefrontId: STOREFRONT_ID}),
    ).rejects.toBe(failure);
  });

  it.each([
    ['the shop', {...SHOP_DATA, shop: null}],
    ['the localization', {...SHOP_DATA, localization: null}],
  ])('rejects an answer without %s', async (_label, answer) => {
    const {storefront, query} = createFakeStorefront();
    query.mockResolvedValueOnce(answer);

    await expect(
      getShopAnalytics({storefront, publicStorefrontId: STOREFRONT_ID}),
    ).rejects.toThrow('ShopData');
  });

  it("sends the query through the Storefront client in the storefront's locale", async () => {
    // Arrange: the real client, with the Storefront API stubbed.
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json({data: SHOP_DATA}),
    );
    vi.stubGlobal('fetch', fetchMock);
    const storefront = createStorefrontClient({
      storeDomain: 'mellow-test.myshopify.com',
      publicStorefrontToken: PUBLIC_TOKEN,
      i18n: {language: 'EN', country: 'US'},
      request: new Request('https://shop.example/'),
      waitUntil: () => {},
    });

    // Act
    const shop = await getShopAnalytics({
      storefront,
      publicStorefrontId: STOREFRONT_ID,
    });

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      query: string;
      variables: Record<string, unknown>;
    };
    expect(body.query).toContain('query ShopData(');
    expect(body.variables).toEqual({country: 'US', language: 'EN'});
    expect(shop.shopId).toBe('gid://shopify/Shop/55555');
  });
});

describe('getAnalyticsConfig', () => {
  it('returns the disabled shape without any Storefront API call when analytics are off', () => {
    // Arrange: the variables are unset (the default for every store).
    const {storefront, query, cacheLong} = createFakeStorefront();

    // Act
    const config = getAnalyticsConfig({
      env: {PUBLIC_STOREFRONT_API_TOKEN: PUBLIC_TOKEN},
      storefront,
    });

    // Assert
    expect(config).toBe(DISABLED_ANALYTICS_CONFIG);
    expect(query).not.toHaveBeenCalled();
    expect(cacheLong).not.toHaveBeenCalled();
  });

  it('stays off, without a query, while the development mock is on', () => {
    vi.stubEnv('DEV', true);
    const {storefront, query} = createFakeStorefront();

    const config = getAnalyticsConfig({
      env: {...CONFIGURED_ENV, MOCK_STOREFRONT: 'true'},
      storefront,
    });

    expect(config).toEqual({enabled: false, shop: null, consent: null});
    expect(query).not.toHaveBeenCalled();
  });

  it("turns on for a configured store, with the storefront's consent settings", async () => {
    // Arrange
    const {storefront} = createFakeStorefront();

    // Act
    const config = getAnalyticsConfig({env: CONFIGURED_ENV, storefront});

    // Assert
    expect(config.enabled).toBe(true);
    expect(config.consent).toEqual({
      storefrontAccessToken: PUBLIC_TOKEN,
      country: 'US',
      language: 'EN',
    });
    await expect(config.shop).resolves.toEqual({
      shopId: 'gid://shopify/Shop/55555',
      acceptedLanguage: 'DE',
      currency: 'EUR',
      hydrogenSubchannelId: STOREFRONT_ID,
    });
  });

  it('serialises only the consent settings the browser reads', () => {
    // Arrange: the root loader sends this object to every page.
    const {storefront} = createFakeStorefront();

    // Act
    const config = getAnalyticsConfig({env: CONFIGURED_ENV, storefront});

    // Assert: no checkout domain or privacy-banner flag, which nothing reads.
    expect(Object.keys(config.consent ?? {}).sort()).toEqual([
      'country',
      'language',
      'storefrontAccessToken',
    ]);
  });

  it('starts the shop query without waiting for it', () => {
    const {storefront, query} = createFakeStorefront();

    getAnalyticsConfig({env: CONFIGURED_ENV, storefront});

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('never hands the private Storefront API token to the browser', () => {
    const {storefront} = createFakeStorefront();
    const env = {
      ...CONFIGURED_ENV,
      PRIVATE_STOREFRONT_API_TOKEN: 'shpat_private_token_never_public',
    };

    const config = getAnalyticsConfig({env, storefront});

    expect(config.consent?.storefrontAccessToken).toBe(PUBLIC_TOKEN);
    expect(JSON.stringify(config.consent)).not.toContain('shpat_');
  });

  describe('when PUBLIC_STOREFRONT_API_TOKEN holds a private token', () => {
    const PRIVATE_TOKEN = 'shpat_private-token-placeholder-not-real';

    it.each([
      ['a private token', PRIVATE_TOKEN],
      ['a private token with stray whitespace', `  ${PRIVATE_TOKEN}\n`],
    ])(
      'refuses analytics for %s, without a shop query, and logs that once',
      (_label, token) => {
        // Arrange
        const {storefront, query} = createFakeStorefront();
        const env = {...CONFIGURED_ENV, PUBLIC_STOREFRONT_API_TOKEN: token};

        // Act
        const config = getAnalyticsConfig({env, storefront});

        // Assert
        expect(config).toBe(DISABLED_ANALYTICS_CONFIG);
        expect(query).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(loggedErrors()).toContain('[analytics]');
        expect(loggedErrors()).toContain('PUBLIC_STOREFRONT_API_TOKEN');
      },
    );

    it('never logs the token itself', () => {
      const {storefront} = createFakeStorefront();
      const env = {
        ...CONFIGURED_ENV,
        PUBLIC_STOREFRONT_API_TOKEN: PRIVATE_TOKEN,
      };

      getAnalyticsConfig({env, storefront});

      expect(loggedErrors()).not.toContain(PRIVATE_TOKEN);
    });

    it('logs once for every request it refuses', () => {
      const {storefront} = createFakeStorefront();
      const env = {
        ...CONFIGURED_ENV,
        PUBLIC_STOREFRONT_API_TOKEN: PRIVATE_TOKEN,
      };

      getAnalyticsConfig({env, storefront});
      getAnalyticsConfig({env, storefront});

      expect(console.error).toHaveBeenCalledTimes(2);
    });

    it('stays silent while analytics are not configured anyway', () => {
      // Without analytics, no token reaches the browser at all.
      const {storefront} = createFakeStorefront();

      const config = getAnalyticsConfig({
        env: {PUBLIC_STOREFRONT_API_TOKEN: PRIVATE_TOKEN},
        storefront,
      });

      expect(config).toBe(DISABLED_ANALYTICS_CONFIG);
      expect(console.error).not.toHaveBeenCalled();
    });

    it('does not mistake a missing token for a private one, nor throw', () => {
      // Arrange: a Worker whose PUBLIC_STOREFRONT_API_TOKEN is unset.
      const {storefront} = createFakeStorefront();
      const env = {
        PUBLIC_CHECKOUT_DOMAIN: CONFIGURED_ENV.PUBLIC_CHECKOUT_DOMAIN,
        PUBLIC_STOREFRONT_ID: STOREFRONT_ID,
      } as unknown as ConfigArgs['env'];

      // Act
      const config = getAnalyticsConfig({env, storefront});

      // Assert
      expect(config.enabled).toBe(true);
      expect(console.error).not.toHaveBeenCalled();
    });

    it('keeps analytics on for a public token that merely contains the prefix', () => {
      const {storefront} = createFakeStorefront();
      const env = {
        ...CONFIGURED_ENV,
        PUBLIC_STOREFRONT_API_TOKEN: 'public-shpat_-lookalike-000000000',
      };

      expect(getAnalyticsConfig({env, storefront}).enabled).toBe(true);
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('when the shop data cannot be loaded', () => {
    it.each([
      [
        'a 502 from the errors guard',
        new Response('Storefront API error', {status: 502}),
        'HTTP 502',
      ],
      [
        'an error',
        new Error('Storefront API timed out'),
        'Storefront API timed out',
      ],
      ['anything else', 'offline', 'offline'],
    ])(
      'resolves the shop to null and logs %s',
      async (_label, failure, logged) => {
        // Arrange
        const {storefront, query} = createFakeStorefront();
        query.mockRejectedValueOnce(failure);

        // Act
        const config = getAnalyticsConfig({env: CONFIGURED_ENV, storefront});

        // Assert
        await expect(config.shop).resolves.toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(loggedErrors()).toContain('[analytics]');
        expect(loggedErrors()).toContain(logged);
      },
    );

    it('keeps the consent settings, so the page still renders', async () => {
      const {storefront, query} = createFakeStorefront();
      query.mockRejectedValueOnce(new Error('down'));

      const config = getAnalyticsConfig({env: CONFIGURED_ENV, storefront});

      await config.shop;
      expect(config.enabled).toBe(true);
      expect(config.consent?.storefrontAccessToken).toBe(PUBLIC_TOKEN);
    });
  });
});
