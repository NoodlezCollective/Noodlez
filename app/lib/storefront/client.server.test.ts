import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';
import {guardStorefrontErrors} from '~/lib/storefront-errors';
import {
  CacheCustom,
  CacheLong,
  CacheNone,
  CacheShort,
  createCacheKey,
} from './cache.server';
import {
  STOREFRONT_API_VERSION,
  StorefrontApiHttpError,
  createStorefrontClient,
  type CreateStorefrontClientOptions,
  type Storefront,
  type StorefrontErrors,
} from './client.server';

const STORE_DOMAIN = 'mellow-test.myshopify.com';
const PUBLIC_TOKEN = 'public-token-placeholder';
const PRIVATE_TOKEN = 'private-token-placeholder';
const STOREFRONT_ID = '1000099999';
const ORIGIN = 'https://shop.example';
const API_URL = `https://${STORE_DOMAIN}/api/2026-04/graphql.json`;
const BUYER_IP = '203.0.113.7';
const RAY_ID = '8f1c2a3b4c5d6e7f-AMS';
const PROXY_BODY = '{"query":"{ shop { name } }"}';

// Plain strings: codegen plucks template literals that start with the
// graphql marker, test files included.
const SHOP_QUERY = 'query Shop { shop { name } }';
const LOCALIZED_QUERY = [
  '#graphql',
  '  query Header($country: CountryCode, $language: LanguageCode)',
  '  @inContext(country: $country, language: $language) {',
  '    shop { name } # the header',
  '  }',
].join('\n');
const CART_MUTATION = 'mutation CartCreate { cartCreate { cart { id } } }';
const TYPED_QUERY = 'query TypedShop($handle: String!) { shop { name } }';

declare global {
  // What codegen generates for a document, keyed by its source string.
  interface StorefrontQueries {
    'query TypedShop($handle: String!) { shop { name } }': {
      return: {shop: {name: string}};
      variables: {handle: string};
    };
  }
}

type FetchArgs = [input: RequestInfo | URL, init?: RequestInit];

/** Makes the Storefront API answer every call with `body` (HTTP 200 unless set). */
function stubFetch(
  body: unknown = {data: {shop: {name: 'Mellow'}}},
  init: ResponseInit = {},
) {
  const fetchMock = vi.fn(
    async (..._args: FetchArgs) =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status: 200,
        headers: {'content-type': 'application/json'},
        ...init,
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

type SentBody = {query: string; variables: Record<string, unknown>};

/**
 * What the client sent on the nth Storefront API call. `body` is the parsed
 * JSON of query()/mutate() calls; forward() streams its body instead.
 */
function sent(fetchMock: ReturnType<typeof stubFetch>, call = 0) {
  const [input, init] = fetchMock.mock.calls[call];
  const rawBody = typeof init?.body === 'string' ? init.body : '';
  return {
    url: String(input),
    method: init?.method,
    headers: new Headers(init?.headers),
    rawBody,
    body: (rawBody ? JSON.parse(rawBody) : {}) as SentBody,
  };
}

function createRequest(
  headers: HeadersInit = {'cf-ray': RAY_ID, 'CF-Connecting-IP': BUYER_IP},
) {
  return new Request(`${ORIGIN}/products/pillow`, {headers});
}

function createClient(overrides: Partial<CreateStorefrontClientOptions> = {}) {
  const pending: Promise<unknown>[] = [];
  const storefront = createStorefrontClient({
    storeDomain: STORE_DOMAIN,
    publicStorefrontToken: PUBLIC_TOKEN,
    i18n: {language: 'EN', country: 'US'},
    request: createRequest(),
    waitUntil: (promise) => {
      pending.push(promise);
    },
    ...overrides,
  });
  return {
    storefront,
    async flush() {
      await Promise.all(pending.splice(0));
    },
  };
}

/** A Cache API stand-in that keeps bodies and headers, like the real one. */
function createMemoryCache() {
  const entries = new Map<
    string,
    {body: string; headers: Record<string, string>}
  >();
  const match = vi.fn(async (request: Request) => {
    const entry = entries.get(request.url);
    return entry
      ? new Response(entry.body, {headers: entry.headers})
      : undefined;
  });
  const put = vi.fn(async (request: Request, response: Response) => {
    entries.set(request.url, {
      body: await response.text(),
      headers: Object.fromEntries(response.headers),
    });
  });
  return {cache: {match, put} as unknown as Cache, match, put, entries};
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  // hydrogen-react warns once that a private token is recommended on servers.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('STOREFRONT_API_VERSION', () => {
  it('is the version hydrogen-react 2026.4 targets', () => {
    expect(STOREFRONT_API_VERSION).toBe('2026-04');
  });
});

describe('requests', () => {
  it('posts the minified document and variables as JSON to the Storefront API', async () => {
    // Arrange
    const fetchMock = stubFetch();
    const {storefront} = createClient();

    // Act
    await storefront.query(LOCALIZED_QUERY, {variables: {first: 3}});

    // Assert
    const request = sent(fetchMock);
    expect(request.url).toBe(API_URL);
    expect(request.method).toBe('POST');
    expect(request.body.query).toBe(
      'query Header($country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) { shop { name } }',
    );
    expect(request.body.variables).toEqual({
      first: 3,
      country: 'US',
      language: 'EN',
    });
  });

  it('sends an empty variables object when there are none', async () => {
    const fetchMock = stubFetch();
    const {storefront} = createClient();

    await storefront.query(SHOP_QUERY);

    expect(sent(fetchMock).body).toEqual({query: SHOP_QUERY, variables: {}});
  });

  it('uses the API version from the client options and from each call', async () => {
    const fetchMock = stubFetch();
    const {storefront} = createClient({storefrontApiVersion: '2026-07'});

    await storefront.query(SHOP_QUERY);
    await storefront.mutate(CART_MUTATION, {storefrontApiVersion: 'unstable'});

    expect(sent(fetchMock, 0).url).toBe(
      `https://${STORE_DOMAIN}/api/2026-07/graphql.json`,
    );
    expect(sent(fetchMock, 1).url).toBe(
      `https://${STORE_DOMAIN}/api/unstable/graphql.json`,
    );
  });
});

describe('i18n', () => {
  it('injects $country and $language from i18n when the document declares them', async () => {
    const fetchMock = stubFetch();
    const {storefront} = createClient({i18n: {language: 'DE', country: 'AT'}});

    await storefront.query(LOCALIZED_QUERY);

    expect(sent(fetchMock).body.variables).toEqual({
      country: 'AT',
      language: 'DE',
    });
  });

  it('keeps the values the caller passed', async () => {
    const fetchMock = stubFetch();
    const {storefront} = createClient();

    await storefront.query(LOCALIZED_QUERY, {variables: {country: 'CA'}});

    expect(sent(fetchMock).body.variables).toEqual({
      country: 'CA',
      language: 'EN',
    });
  });

  it('injects them into mutations too', async () => {
    const fetchMock = stubFetch();
    const {storefront} = createClient();

    await storefront.mutate(
      'mutation CartCreate($country: CountryCode = ZZ, $language: LanguageCode) @inContext(country: $country, language: $language) { cartCreate { cart { id } } }',
    );

    expect(sent(fetchMock).body.variables).toEqual({
      country: 'US',
      language: 'EN',
    });
  });

  it('adds nothing the document does not declare', async () => {
    const fetchMock = stubFetch();
    const {storefront} = createClient();

    await storefront.query(
      'query Shop($countryCode: CountryCode) { shop { name } }',
      {
        variables: {countryCode: 'FR'},
      },
    );

    expect(sent(fetchMock).body.variables).toEqual({countryCode: 'FR'});
  });
});

describe('headers', () => {
  it('sends the public token headers by default', async () => {
    const fetchMock = stubFetch();
    const {storefront} = createClient({storefrontId: STOREFRONT_ID});

    await storefront.query(SHOP_QUERY);

    expect(Object.fromEntries(sent(fetchMock).headers)).toEqual({
      accept: 'application/json',
      'content-type': 'application/json',
      'custom-storefront-request-group-id': RAY_ID,
      'shopify-storefront-id': STOREFRONT_ID,
      'x-sdk-variant': 'hydrogen-react',
      'x-sdk-variant-source': 'react',
      'x-sdk-version': '2026-04',
      'x-shopify-client-ip': BUYER_IP,
      'x-shopify-storefront-access-token': PUBLIC_TOKEN,
    });
  });

  it('uses the private token with the buyer IP when one is configured', async () => {
    const fetchMock = stubFetch();
    const {storefront} = createClient({privateStorefrontToken: PRIVATE_TOKEN});

    await storefront.query(SHOP_QUERY);

    const {headers} = sent(fetchMock);
    expect(headers.get('Shopify-Storefront-Private-Token')).toBe(PRIVATE_TOKEN);
    expect(headers.get('Shopify-Storefront-Buyer-IP')).toBe(BUYER_IP);
    expect(headers.get('X-Shopify-Client-IP')).toBe(BUYER_IP);
    expect(headers.has('X-Shopify-Storefront-Access-Token')).toBe(false);
  });

  it('leaves out unknown values and generates one request group id per request', async () => {
    // Arrange
    const uuid = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('11111111-1111-4111-8111-111111111111');
    const fetchMock = stubFetch();
    const {storefront} = createClient({request: createRequest({})});

    // Act
    await storefront.query(SHOP_QUERY);
    await storefront.mutate(CART_MUTATION);

    // Assert
    for (const call of [0, 1]) {
      const {headers} = sent(fetchMock, call);
      expect(headers.get('Custom-Storefront-Request-Group-ID')).toBe(
        '11111111-1111-4111-8111-111111111111',
      );
      expect(headers.has('X-Shopify-Client-IP')).toBe(false);
      expect(headers.has('Shopify-Storefront-Id')).toBe(false);
    }
    expect(uuid).toHaveBeenCalledTimes(1);
  });

  it('lets per-call headers override the defaults', async () => {
    const fetchMock = stubFetch();
    const {storefront} = createClient();

    await storefront.query(SHOP_QUERY, {
      headers: {Accept: 'application/graphql-response+json', 'X-Debug': '1'},
    });

    const {headers} = sent(fetchMock);
    expect(headers.get('accept')).toBe('application/graphql-response+json');
    expect(headers.get('x-debug')).toBe('1');
    expect(headers.get('x-shopify-storefront-access-token')).toBe(PUBLIC_TOKEN);
  });
});

describe('document checks', () => {
  it('query() refuses a mutation before fetching', async () => {
    const fetchMock = stubFetch();
    const {storefront} = createClient();

    await expect(storefront.query(CART_MUTATION)).rejects.toThrow(
      '[storefront.query] Can only execute queries',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mutate() refuses a query before fetching', async () => {
    const fetchMock = stubFetch();
    const {storefront} = createClient();

    await expect(storefront.mutate(SHOP_QUERY)).rejects.toThrow(
      '[storefront.mutate] Can only execute mutations',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      'query',
      (storefront: Storefront) => storefront.query('{ shop { name } }'),
    ],
    [
      'mutate',
      (storefront: Storefront) => storefront.mutate('{ shop { name } }'),
    ],
  ])('%s() refuses the anonymous { shop } shorthand', async (_method, call) => {
    const fetchMock = stubFetch();
    const {storefront} = createClient();

    await expect(call(storefront)).rejects.toThrow(/Can only execute/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('HTTP errors', () => {
  it('throws StorefrontApiHttpError and logs only the operation, status and request id', async () => {
    // Arrange
    stubFetch('upstream failure for shopper@example.com', {
      status: 500,
      headers: {'x-request-id': 'req-42'},
    });
    const {storefront} = createClient();

    // Act
    const error = await rejection(
      storefront.query('query Products($email: String) { shop { name } }', {
        variables: {email: 'shopper@example.com'},
      }),
    );

    // Assert
    expect(error).toBeInstanceOf(StorefrontApiHttpError);
    expect(error).toMatchObject({
      name: 'StorefrontApiHttpError',
      status: 500,
      requestId: 'req-42',
      operationName: 'Products',
    });
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      '[storefront] Products failed: HTTP 500 (request id req-42)',
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      'shopper@example.com',
    );
    expect(String((error as Error).message)).not.toContain(
      'shopper@example.com',
    );
  });

  it('logs "none" without a request id, for mutations too', async () => {
    stubFetch('', {status: 503});
    const {storefront} = createClient();

    const error = await rejection(storefront.mutate(CART_MUTATION));

    expect(error).toMatchObject({
      status: 503,
      requestId: null,
      operationName: 'CartCreate',
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[storefront] CartCreate failed: HTTP 503 (request id none)',
    );
  });
});

describe('results', () => {
  const PARTIAL = {
    data: {shop: {name: 'Mellow'}, menu: null},
    errors: [
      {
        message: 'Menu for shopper@example.com failed',
        extensions: {code: 'INTERNAL_SERVER_ERROR'},
        path: ['menu'],
      },
    ],
  };
  const HEADER_DOCUMENT =
    'query Header { shop { name } menu(handle: "main") { id } }';

  it('returns the data fields, without an errors key', async () => {
    stubFetch({data: {shop: {name: 'Mellow'}}});
    const {storefront} = createClient();

    const result = await storefront.query(SHOP_QUERY);

    expect(result).toEqual({shop: {name: 'Mellow'}});
    expect(Object.keys(result)).toEqual(['shop']);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('returns partial data next to its errors and logs them', async () => {
    stubFetch(PARTIAL);
    const {storefront} = createClient();

    const result = await storefront.query(HEADER_DOCUMENT);

    expect(result).toEqual({...PARTIAL.data, errors: PARTIAL.errors});
    expect(consoleError).toHaveBeenCalledTimes(1);
    const logged = String(consoleError.mock.calls[0][0]);
    expect(logged).toContain(
      '[storefront] Header returned partial data: 1 error(s) [INTERNAL_SERVER_ERROR]',
    );
    // Development builds add the messages, which help when debugging.
    expect(logged).toContain('Menu for shopper@example.com failed');
  });

  it('logs only the error count and codes outside development', async () => {
    vi.stubEnv('DEV', false);
    stubFetch(PARTIAL);
    const {storefront} = createClient();

    await storefront.query(HEADER_DOCUMENT);

    expect(consoleError).toHaveBeenCalledWith(
      '[storefront] Header returned partial data: 1 error(s) [INTERNAL_SERVER_ERROR]',
    );
  });

  it('logs errors without codes as a plain count', async () => {
    vi.stubEnv('DEV', false);
    stubFetch({
      data: {shop: {name: 'Mellow'}},
      errors: [{message: 'a'}, {message: 'b'}],
    });
    const {storefront} = createClient();

    await storefront.query(SHOP_QUERY);

    expect(consoleError).toHaveBeenCalledWith(
      '[storefront] Shop returned partial data: 2 error(s)',
    );
  });

  it('returns errors without data as {errors} and leaves logging to guardStorefrontErrors', async () => {
    const errors = [{message: 'Throttled', extensions: {code: 'THROTTLED'}}];
    stubFetch({errors});
    const {storefront} = createClient();

    expect(await storefront.query(SHOP_QUERY)).toEqual({errors});
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('treats data: null like no data', async () => {
    stubFetch({data: null, errors: [{message: 'Throttled'}]});
    const {storefront} = createClient();

    expect(await storefront.query(SHOP_QUERY)).toEqual({
      errors: [{message: 'Throttled'}],
    });
  });

  it('wraps a single error object in a list (Hydrogen parity)', async () => {
    stubFetch({errors: {message: 'Throttled'}});
    const {storefront} = createClient();

    expect(await storefront.query(SHOP_QUERY)).toEqual({
      errors: [{message: 'Throttled'}],
    });
  });

  it('drops an empty errors list', async () => {
    stubFetch({data: {shop: {name: 'Mellow'}}, errors: []});
    const {storefront} = createClient();

    expect(Object.keys(await storefront.query(SHOP_QUERY))).toEqual(['shop']);
  });

  it.each([
    ['not JSON', '<html>Bad gateway</html>'],
    ['null', 'null'],
    ['a list', '[1,2]'],
    ['data that is not an object', '{"data":"shop"}'],
  ])(
    'turns a 2xx body that is %s into an errors-only result',
    async (_name, body) => {
      stubFetch(body);
      const {storefront} = createClient();

      expect(await storefront.query(SHOP_QUERY)).toEqual({
        errors: [
          {
            message: 'The Storefront API returned an unreadable response',
            extensions: {code: 'UNREADABLE_RESPONSE'},
          },
        ],
      });
    },
  );

  it('strips __proto__ keys from responses', async () => {
    stubFetch(
      '{"data":{"shop":{"name":"Mellow","__proto__":{"polluted":true}}}}',
    );
    const {storefront} = createClient();

    const {shop} = await storefront.query(SHOP_QUERY);

    expect(Object.hasOwn(shop, '__proto__')).toBe(false);
    expect(
      (Object.assign({}, shop) as {polluted?: boolean}).polluted,
    ).toBeUndefined();
  });
});

describe('fetch', () => {
  it('is looked up on globalThis at call time', async () => {
    const {storefront} = createClient();
    const fetchMock = stubFetch();

    await storefront.query(SHOP_QUERY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('caching', () => {
  it('caches queries with CacheDefault and serves repeats from the cache', async () => {
    // Arrange
    const memory = createMemoryCache();
    const fetchMock = stubFetch();
    const client = createClient({cache: memory.cache});

    // Act
    await client.storefront.query(SHOP_QUERY);
    await client.flush();
    const repeat = await client.storefront.query(SHOP_QUERY);

    // Assert
    expect(repeat).toEqual({shop: {name: 'Mellow'}});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [entry] = memory.entries.values();
    expect(entry.headers['cache-control']).toBe('public, max-age=86400');
    expect(entry.headers['x-storefront-cache-max-age']).toBe('1');
  });

  it.each([
    ['CacheShort', CacheShort(), 'public, max-age=10', '1'],
    ['CacheLong', CacheLong(), 'public, max-age=86400', '3600'],
    [
      'CacheCustom',
      CacheCustom({maxAge: 60, staleWhileRevalidate: 60}),
      'public, max-age=120',
      '60',
    ],
  ])(
    'passes the %s option through',
    async (_name, cache, cacheControl, maxAge) => {
      const memory = createMemoryCache();
      stubFetch();
      const client = createClient({cache: memory.cache});

      await client.storefront.query(SHOP_QUERY, {cache});
      await client.flush();

      const [entry] = memory.entries.values();
      expect(entry.headers['cache-control']).toBe(cacheControl);
      expect(entry.headers['x-storefront-cache-max-age']).toBe(maxAge);
    },
  );

  it.each([
    ['the public token', {}, PUBLIC_TOKEN],
    [
      'the private token',
      {privateStorefrontToken: PRIVATE_TOKEN},
      PRIVATE_TOKEN,
    ],
  ])(
    'keys entries on the API URL, %s and the body',
    async (_name, overrides, token) => {
      const memory = createMemoryCache();
      const fetchMock = stubFetch();
      const client = createClient({cache: memory.cache, ...overrides});

      await client.storefront.query(SHOP_QUERY);
      await client.flush();

      const key = await createCacheKey(ORIGIN, [
        API_URL,
        token,
        sent(fetchMock).rawBody,
      ]);
      expect([...memory.entries.keys()]).toEqual([key.url]);
    },
  );

  it('stores different variables separately', async () => {
    const memory = createMemoryCache();
    const fetchMock = stubFetch();
    const client = createClient({cache: memory.cache});
    const document =
      'query Product($handle: String!) { product(handle: $handle) { id } }';

    await client.storefront.query(document, {variables: {handle: 'pillow'}});
    await client.storefront.query(document, {variables: {handle: 'duvet'}});
    await client.flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(memory.entries.size).toBe(2);
  });

  it('never caches CacheNone queries', async () => {
    const memory = createMemoryCache();
    const fetchMock = stubFetch();
    const client = createClient({cache: memory.cache});

    await client.storefront.query(SHOP_QUERY, {cache: CacheNone()});
    await client.storefront.query(SHOP_QUERY, {cache: CacheNone()});
    await client.flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(memory.match).not.toHaveBeenCalled();
    expect(memory.put).not.toHaveBeenCalled();
  });

  it('never caches mutations', async () => {
    const memory = createMemoryCache();
    const fetchMock = stubFetch({
      data: {cartCreate: {cart: {id: 'gid://shopify/Cart/c1'}}},
    });
    const client = createClient({cache: memory.cache});

    await client.storefront.mutate(CART_MUTATION);
    await client.storefront.mutate(CART_MUTATION);
    await client.flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(memory.match).not.toHaveBeenCalled();
    expect(memory.put).not.toHaveBeenCalled();
  });

  it('never caches results with errors', async () => {
    const memory = createMemoryCache();
    stubFetch({
      data: {shop: {name: 'Mellow'}},
      errors: [{message: 'menu failed'}],
    });
    const client = createClient({cache: memory.cache});

    await client.storefront.query(SHOP_QUERY);
    await client.flush();

    expect(memory.put).not.toHaveBeenCalled();
  });

  it('stores only the GraphQL body, never Storefront API headers such as Set-Cookie', async () => {
    const memory = createMemoryCache();
    stubFetch(
      {data: {shop: {name: 'Mellow'}}},
      {
        headers: {
          'content-type': 'application/json',
          'set-cookie': '_shopify_y=abc; Path=/',
          'server-timing': 'processing;dur=12',
        },
      },
    );
    const client = createClient({cache: memory.cache});

    await client.storefront.query(SHOP_QUERY);
    await client.flush();

    const [entry] = memory.entries.values();
    expect(JSON.parse(entry.body)).toEqual({data: {shop: {name: 'Mellow'}}});
    expect(Object.keys(entry.headers)).not.toContain('set-cookie');
    expect(Object.keys(entry.headers)).not.toContain('server-timing');
  });

  it('fetches every time without a cache instance', async () => {
    const fetchMock = stubFetch();
    const {storefront} = createClient();

    await storefront.query(SHOP_QUERY);
    await storefront.query(SHOP_QUERY);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('client shape', () => {
  it('has own, writable query and mutate that do not depend on `this`', async () => {
    stubFetch();
    const {storefront} = createClient();

    for (const method of ['query', 'mutate'] as const) {
      expect(Object.getOwnPropertyDescriptor(storefront, method)).toMatchObject(
        {
          writable: true,
        },
      );
    }
    const {query} = storefront;
    expect(await query(SHOP_QUERY)).toEqual({shop: {name: 'Mellow'}});
  });

  it('works under guardStorefrontErrors, which reassigns query and mutate', async () => {
    stubFetch({errors: [{message: 'Throttled'}]});
    const {storefront} = createClient();
    guardStorefrontErrors(
      storefront as unknown as Parameters<typeof guardStorefrontErrors>[0],
    );

    const thrown = await rejection(storefront.mutate(CART_MUTATION));

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(502);
  });

  it('exposes the shop domain, API URL, public token headers, i18n and cache strategies', () => {
    const {storefront} = createClient({privateStorefrontToken: PRIVATE_TOKEN});

    expect(storefront.getShopifyDomain()).toBe(`https://${STORE_DOMAIN}`);
    expect(storefront.getApiUrl()).toBe(API_URL);
    expect(storefront.getApiUrl({storefrontApiVersion: 'unstable'})).toBe(
      `https://${STORE_DOMAIN}/api/unstable/graphql.json`,
    );
    expect(storefront.getPublicTokenHeaders()).toMatchObject({
      'content-type': 'application/json',
      'X-Shopify-Storefront-Access-Token': PUBLIC_TOKEN,
    });
    expect(storefront.i18n).toEqual({language: 'EN', country: 'US'});
    expect(Object.isFrozen(storefront.i18n)).toBe(true);
    expect(storefront.CacheNone).toBe(CacheNone);
    expect(storefront.CacheShort).toBe(CacheShort);
    expect(storefront.CacheLong).toBe(CacheLong);
    expect(storefront.CacheCustom).toBe(CacheCustom);
  });

  it('leaves responses alone in setCollectedSubrequestHeaders until analytics ships (Phase 4c)', () => {
    const {storefront} = createClient({trackingEnabled: true});
    const response = new Response('ok', {headers: {'Set-Cookie': 'session=1'}});

    storefront.setCollectedSubrequestHeaders(response);

    expect(response.headers.getSetCookie()).toEqual(['session=1']);
  });
});

describe('types', () => {
  it('types results and variables by document once codegen fills StorefrontQueries', async () => {
    stubFetch();
    const {storefront} = createClient();

    const result = await storefront.query(TYPED_QUERY, {
      variables: {handle: 'pillow'},
    });
    // @ts-expect-error The generated variables are required.
    await storefront.query(TYPED_QUERY);

    expect(result).toEqual({shop: {name: 'Mellow'}});
    expectTypeOf(result.shop.name).toEqualTypeOf<string>();
    expectTypeOf(result.errors).toEqualTypeOf<StorefrontErrors['errors']>();
  });
});

describe('isStorefrontApiUrl', () => {
  it.each([
    '/api/2026-04/graphql.json',
    '/api/unstable/graphql.json',
    '/api/2025-01/graphql.json?operation=consent',
  ])('is true for %s', (path) => {
    const {storefront} = createClient();

    expect(storefront.isStorefrontApiUrl(new Request(`${ORIGIN}${path}`))).toBe(
      true,
    );
  });

  it.each([
    '/api/2026-04/graphql.jsonx',
    '/api/2026-04/graphql.json/',
    '/api/graphql.json',
    '/api/26-04/graphql.json',
    '/api/2026-4/graphql.json',
    '/api/latest/graphql.json',
    '/shop/api/2026-04/graphql.json',
    '/api/mcp',
    '/',
  ])('is false for %s', (path) => {
    const {storefront} = createClient();

    expect(storefront.isStorefrontApiUrl(new Request(`${ORIGIN}${path}`))).toBe(
      false,
    );
  });
});

describe('forward', () => {
  const ALLOWED_HEADERS = {
    accept: 'application/json',
    'accept-encoding': 'gzip',
    'accept-language': 'en-GB',
    'access-control-request-headers': 'content-type',
    'access-control-request-method': 'POST',
    'content-length': String(PROXY_BODY.length),
    'content-type': 'application/json',
    cookie: '_shopify_y=abc',
    origin: ORIGIN,
    referer: `${ORIGIN}/products/pillow`,
    'shopify-storefront-consent-management': '1',
    'user-agent': 'Mozilla/5.0',
    'x-shopify-storefront-access-token': 'token-from-the-browser',
    'x-shopify-uniquetoken': 'unique-token',
    'x-shopify-visittoken': 'visit-token',
  };

  function proxyRequest(
    path = '/api/2026-04/graphql.json',
    headers: Record<string, string> = ALLOWED_HEADERS,
  ) {
    return new Request(`${ORIGIN}${path}`, {
      method: 'POST',
      body: PROXY_BODY,
      headers: {
        ...headers,
        authorization: 'Bearer not-for-shopify',
        'cf-ray': RAY_ID,
        'CF-Connecting-IP': BUYER_IP,
        'shopify-storefront-private-token': 'smuggled',
        'x-custom': 'dropped',
      },
    });
  }

  it('forwards only the allowlisted headers plus our IP, storefront id, group id and x-forwarded-for', async () => {
    // Arrange
    const fetchMock = stubFetch();
    const request = proxyRequest();
    const {storefront} = createClient({storefrontId: STOREFRONT_ID, request});

    // Act
    await storefront.forward(request);

    // Assert
    expect(Object.fromEntries(sent(fetchMock).headers)).toEqual({
      ...ALLOWED_HEADERS,
      'custom-storefront-request-group-id': RAY_ID,
      'shopify-storefront-id': STOREFRONT_ID,
      'x-forwarded-for': BUYER_IP,
      'x-shopify-client-ip': BUYER_IP,
    });
  });

  it('never adds a server token, even with a private token configured', async () => {
    const fetchMock = stubFetch();
    const {storefront} = createClient({privateStorefrontToken: PRIVATE_TOKEN});

    await storefront.forward(proxyRequest('/api/2026-04/graphql.json', {}));

    const {headers} = sent(fetchMock);
    expect(headers.has('shopify-storefront-private-token')).toBe(false);
    expect(headers.has('shopify-storefront-buyer-ip')).toBe(false);
    expect(headers.has('x-shopify-storefront-access-token')).toBe(false);
  });

  it('takes the API version from the path and streams the method and body', async () => {
    const fetchMock = stubFetch();
    const {storefront} = createClient();

    await storefront.forward(proxyRequest('/api/unstable/graphql.json'));

    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toBe(
      `https://${STORE_DOMAIN}/api/unstable/graphql.json`,
    );
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(ReadableStream);
    expect(await new Response(init?.body).text()).toBe(PROXY_BODY);
  });

  it('returns the Storefront API response as a mutable copy without server-timing', async () => {
    stubFetch(
      {errors: [{message: 'Forbidden'}]},
      {
        status: 403,
        headers: {
          'content-type': 'application/json',
          'server-timing': 'processing;dur=12',
          'x-request-id': 'req-1',
        },
      },
    );
    const {storefront} = createClient();

    const response = await storefront.forward(proxyRequest());

    expect(response.status).toBe(403);
    expect(response.headers.has('server-timing')).toBe(false);
    expect(response.headers.get('x-request-id')).toBe('req-1');
    expect(await response.json()).toEqual({errors: [{message: 'Forbidden'}]});
    expect(() =>
      response.headers.set('X-Content-Type-Options', 'nosniff'),
    ).not.toThrow();
  });

  it('adds no IP headers when the buyer IP is unknown', async () => {
    const fetchMock = stubFetch();
    const {storefront} = createClient({
      request: createRequest({'cf-ray': RAY_ID}),
    });

    await storefront.forward(new Request(`${ORIGIN}/api/2026-04/graphql.json`));

    const {headers} = sent(fetchMock);
    expect(headers.has('x-forwarded-for')).toBe(false);
    expect(headers.has('x-shopify-client-ip')).toBe(false);
    expect(sent(fetchMock).method).toBe('GET');
  });
});
