import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createAppRouterContext} from './context';

const ENV = {
  SESSION_SECRET: 'test-secret',
  PUBLIC_STORE_DOMAIN: 'mellow-test.myshopify.com',
  PUBLIC_STOREFRONT_API_TOKEN: 'a'.repeat(32),
  PUBLIC_STOREFRONT_ID: '1',
  PUBLIC_CHECKOUT_DOMAIN: 'mellow-test.myshopify.com',
} as unknown as Env;

const EXECUTION_CONTEXT = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

function createContext(url = 'https://shop.example/', env: Env = ENV) {
  return createAppRouterContext(new Request(url), env, EXECUTION_CONTEXT);
}

/**
 * Makes the Storefront API answer every request with `body` (HTTP 200) and
 * the `setCookies` values as Set-Cookie headers.
 */
function stubStorefrontApi(body: unknown, setCookies: readonly string[] = []) {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: [
          ['content-type', 'application/json'],
          ...setCookies.map((value): [string, string] => ['set-cookie', value]),
        ],
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

beforeEach(() => {
  vi.stubGlobal('caches', {
    open: async () => ({
      match: async () => undefined,
      put: async () => {},
      delete: async () => false,
    }),
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('cart id cookie', () => {
  const CART_ID = 'gid://shopify/Cart/c1-abc?key=k';

  it('is HttpOnly and SameSite=Lax, and Secure over https', async () => {
    const context = await createContext('https://shop.example/');

    const cookie = context.cart.setCartId(CART_ID).get('Set-Cookie');

    expect(cookie).toMatch(/^cart=c1-abc/);
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
  });

  it('is not Secure over plain http, so local development keeps working', async () => {
    const context = await createContext('http://localhost:3000/');

    const cookie = context.cart.setCartId(CART_ID).get('Set-Cookie');

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Secure');
  });

  it('is still read back from the request by the cart service', async () => {
    const context = await createAppRouterContext(
      new Request('https://shop.example/', {headers: {Cookie: 'cart=c1-abc'}}),
      ENV,
      EXECUTION_CONTEXT,
    );

    expect(context.cart.getCartId()).toBe('gid://shopify/Cart/c1-abc');
  });
});

describe('Storefront API errors', () => {
  const OPERATION = 'query Shop { shop { name } }';

  it('rejects with a 502 Response when the API answers errors and no data', async () => {
    stubStorefrontApi({errors: [{message: 'Throttled'}]});
    const context = await createContext();

    const thrown = await rejection(context.storefront.query(OPERATION));

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(502);
  });

  it('rejects mutations the same way', async () => {
    stubStorefrontApi({errors: [{message: 'Throttled'}]});
    const context = await createContext();

    const thrown = await rejection(
      context.storefront.mutate('mutation M { cartCreate { cart { id } } }'),
    );

    expect((thrown as Response).status).toBe(502);
  });

  it('covers the cart service, which shares the storefront client', async () => {
    stubStorefrontApi({errors: [{message: 'Throttled'}]});
    // `cart.get()` only queries the API when the request carries a cart id.
    const context = await createAppRouterContext(
      new Request('https://shop.example/', {headers: {Cookie: 'cart=c1-abc'}}),
      ENV,
      EXECUTION_CONTEXT,
    );

    const thrown = await rejection(context.cart.get());

    expect((thrown as Response).status).toBe(502);
  });

  it('returns partial data together with errors, so pages can still render', async () => {
    stubStorefrontApi({
      data: {shop: {name: 'Mellow'}},
      errors: [{message: 'menu failed'}],
    });
    const context = await createContext();

    const result = await context.storefront.query(OPERATION);

    expect(result.shop).toEqual({name: 'Mellow'});
    expect(result.errors).toHaveLength(1);
  });

  it('returns ordinary results untouched', async () => {
    stubStorefrontApi({data: {shop: {name: 'Mellow'}}});
    const context = await createContext();

    expect(await context.storefront.query(OPERATION)).toEqual({
      shop: {name: 'Mellow'},
    });
  });
});

describe('Storefront cache', () => {
  const OPERATION = 'query Shop { shop { name } }';

  it.each([
    [
      'caches.open rejects',
      {
        open: async () => {
          throw new Error('Cache API unavailable');
        },
      },
      'Cache API unavailable',
    ],
    ['the Cache API is missing', undefined, 'open'],
  ])(
    'serves requests without the cache when %s, and logs that once',
    async (_name, cachesStub, logged) => {
      // Arrange
      vi.stubGlobal('caches', cachesStub);
      const fetchMock = stubStorefrontApi({data: {shop: {name: 'Mellow'}}});

      // Act
      const context = await createContext();
      const first = await context.storefront.query(OPERATION);
      const second = await context.storefront.query(OPERATION);

      // Assert: both queries reach the API, as with the cache bypassed.
      expect(first).toEqual({shop: {name: 'Mellow'}});
      expect(second).toEqual({shop: {name: 'Mellow'}});
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(String(vi.mocked(console.error).mock.calls[0][0])).toContain(
        logged,
      );
    },
  );
});

describe('tracking cookies and visitor tokens (D-9)', () => {
  const OPERATION = 'query Shop { shop { name } }';
  const TOKEN_HEADERS = [
    'X-Shopify-UniqueToken',
    'X-Shopify-VisitToken',
    'Shopify-Storefront-Y',
    'Shopify-Storefront-S',
  ];

  function createContextWithCookie(env: Env) {
    return createAppRouterContext(
      new Request('https://shop.example/', {
        headers: {cookie: '_shopify_y=y1; session=s'},
      }),
      env,
      EXECUTION_CONTEXT,
    );
  }

  it('reach the Storefront API, without our session cookie, once analytics is configured and the mock is off', async () => {
    // Arrange: ENV sets PUBLIC_CHECKOUT_DOMAIN and PUBLIC_STOREFRONT_ID.
    const fetchMock = stubStorefrontApi({data: {shop: {name: 'Mellow'}}}, [
      '_shopify_y=y2; Path=/',
    ]);
    const context = await createContextWithCookie(ENV);
    const page = new Response('page');

    // Act
    await context.storefront.query(OPERATION);
    context.storefront.setCollectedSubrequestHeaders(page);

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('cookie')).toBe('_shopify_y=y1');
    expect(headers.get('X-Shopify-UniqueToken')).toBe('y1');
    expect(page.headers.getSetCookie()).toEqual(['_shopify_y=y2; Path=/']);
  });

  it('stay in the browser while PUBLIC_STOREFRONT_ID is unset', async () => {
    // Arrange
    const fetchMock = stubStorefrontApi({data: {shop: {name: 'Mellow'}}}, [
      '_shopify_y=y2; Path=/',
    ]);
    const context = await createContextWithCookie({
      ...ENV,
      PUBLIC_STOREFRONT_ID: undefined,
    });
    const page = new Response('page', {headers: {'Set-Cookie': 'session=1'}});

    // Act
    await context.storefront.query(OPERATION);
    context.storefront.setCollectedSubrequestHeaders(page);

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.has('cookie')).toBe(false);
    for (const name of TOKEN_HEADERS) {
      expect(headers.has(name)).toBe(false);
    }
    expect(page.headers.getSetCookie()).toEqual(['session=1']);
  });
});

describe('development mock', () => {
  const MOCK_ENV = {...ENV, MOCK_STOREFRONT: 'true'} as unknown as Env;

  it('serves demo data', async () => {
    const context = await createContext('http://localhost:3000/', MOCK_ENV);

    const result = await context.storefront.query(
      'query Shop { shop { name } }',
    );

    expect(result).toEqual({shop: {name: 'Mellow'}});
  });

  it('answers {errors} like the live API, which the guard turns into a 502', async () => {
    const context = await createContext('http://localhost:3000/', MOCK_ENV);

    // Fails GraphQL validation: no data at all, exactly the live failure mode.
    const thrown = await rejection(
      context.storefront.query('query Bad { thisFieldDoesNotExist }'),
    );

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(502);
  });

  it('logs the operation name the way the client reads it', async () => {
    const context = await createContext('http://localhost:3000/', MOCK_ENV);

    await rejection(
      context.storefront.query(
        '# query Fake { shop { name } }\nquery Bad { thisFieldDoesNotExist }',
      ),
    );

    const logged = vi
      .mocked(console.error)
      .mock.calls.map(([message]) => String(message));
    expect(logged).toContainEqual(
      expect.stringMatching(/^\[mock-storefront\] Bad: /),
    );
    expect(logged.join('\n')).not.toContain('Fake');
  });

  it('guards cart mutations too', async () => {
    const context = await createContext('http://localhost:3000/', MOCK_ENV);

    const thrown = await rejection(
      context.cart.create({
        lines: [
          {
            merchandiseId: 'gid://shopify/ProductVariant/cloudalign-pillow-1',
            quantity: Number.NaN,
          },
        ],
      }),
    );

    expect((thrown as Response).status).toBe(502);
  });
});
