import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  createStorefrontClient,
  type Storefront,
} from './storefront/client.server';
import {guardStorefrontErrors} from './storefront-errors';
import {
  parseSingleFetchPathname,
  storefrontRedirect,
} from './storefront-redirect.server';

/**
 * Expected responses are what Hydrogen 2026.4.7's `storefrontRedirect`
 * returned for the same requests (captured once from the package's
 * development build), except where a test says otherwise: hostile
 * `redirect` / `return_to` values never leave the site, even without
 * server.ts's `withSafeRedirectParams` in front.
 */

const ORIGIN = 'https://shop.example';
const STORE_DOMAIN = 'mellow-test.myshopify.com';
const SHOP_ADMIN = `https://${STORE_DOMAIN}/admin`;
const NO_URL_REDIRECT = {urlRedirects: {edges: []}};

type RedirectStorefront = Pick<Storefront, 'query' | 'getShopifyDomain'>;
type RedirectOptions = {noAdminRedirect?: boolean; matchQueryParams?: boolean};

function urlRedirectTo(target: string) {
  return {urlRedirects: {edges: [{node: {target}}]}};
}

/** A storefront whose `query` resolves to `answer` and records every call. */
function createFakeStorefront(answer: unknown = NO_URL_REDIRECT) {
  const query = vi.fn(async (..._args: unknown[]) => answer);
  const getShopifyDomain = vi.fn(() => `https://${STORE_DOMAIN}`);
  const storefront = {
    query,
    getShopifyDomain,
  } as unknown as RedirectStorefront;
  return {query, getShopifyDomain, storefront};
}

/** Runs storefrontRedirect for `path` after the app answered 404. */
async function redirectFor(
  path: string,
  fake = createFakeStorefront(),
  options: RedirectOptions = {},
) {
  const notFound = new Response('missing', {status: 404});
  const response = await storefrontRedirect({
    storefront: fake.storefront,
    request: new Request(`${ORIGIN}${path}`),
    response: notFound,
    ...options,
  });
  return {response, notFound, ...fake};
}

/** The arguments of one URL redirect lookup for the `path:` search. */
function lookup(search: string) {
  return [
    expect.stringContaining('urlRedirects(first: 1, query: $query)'),
    {variables: {query: search}},
  ];
}

/** Status, headers and body of a response, for a single `toEqual`. */
async function summary(response: Response) {
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: await response.text(),
  };
}

/** A 301 document redirect: no body, no other headers. */
function permanentRedirect(location: string) {
  return {status: 301, headers: {location}, body: ''};
}

/** React Router's single-fetch redirect: a 204 with X-Remix-* headers. */
function singleFetchRedirect(location: string) {
  return {
    status: 204,
    headers: {'x-remix-redirect': location, 'x-remix-status': '301'},
    body: '',
  };
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('parseSingleFetchPathname', () => {
  it.each([
    ['/nope', '/nope', false],
    ['/products/pillow.data', '/products/pillow', true],
    ['/products/a.b.data', '/products/a.b', true],
    ['/_root.data', '/', true],
    ['/collections/_root.data', '/collections/', true],
    ['/collections/_.data', '/collections/', true],
    ['/.data', '/', true],
    ['/data', '/data', false],
    ['/sitemap.xml', '/sitemap.xml', false],
  ])('reads %s as %s (soft navigation: %s)', (raw, pathname, soft) => {
    expect(parseSingleFetchPathname(raw)).toEqual({
      pathname,
      isSoftNavigation: soft,
    });
  });
});

describe('storefrontRedirect: /admin', () => {
  it('sends /admin to the shop admin without a lookup', async () => {
    const {response, query} = await redirectFor('/admin');

    expect(await summary(response)).toEqual(permanentRedirect(SHOP_ADMIN));
    expect(query).not.toHaveBeenCalled();
  });

  it('carries the query string over, minus the redirect parameters', async () => {
    const {response} = await redirectFor(
      '/admin?foo=bar&redirect=%2Fx&return_to=%2Fy&_routes=root',
    );

    expect(await summary(response)).toEqual(
      permanentRedirect(`${SHOP_ADMIN}?foo=bar`),
    );
  });

  it('answers a client-side /admin.data request with a single-fetch redirect', async () => {
    const {response} = await redirectFor('/admin.data');

    expect(await summary(response)).toEqual(singleFetchRedirect(SHOP_ADMIN));
  });

  it('looks /admin up like any other path with noAdminRedirect', async () => {
    const {response, notFound, query} = await redirectFor(
      '/admin',
      createFakeStorefront(),
      {noAdminRedirect: true},
    );

    expect(response).toBe(notFound);
    expect(query.mock.calls).toEqual([lookup('path:/admin')]);
  });

  it('matches /admin exactly; other spellings are looked up', async () => {
    const {response, notFound, query} = await redirectFor('/Admin');

    expect(response).toBe(notFound);
    expect(query.mock.calls).toEqual([lookup('path:/admin')]);
  });
});

describe('storefrontRedirect: URL redirects from the Storefront API', () => {
  it('follows a URL redirect with a 301', async () => {
    const {response, query} = await redirectFor(
      '/old-page',
      createFakeStorefront(urlRedirectTo('/new-page')),
    );

    expect(await summary(response)).toEqual(permanentRedirect('/new-page'));
    expect(query.mock.calls).toEqual([lookup('path:/old-page')]);
  });

  it.each([
    ['/Old-Page', 'path:/old-page'],
    ['/old-page/', 'path:/old-page'],
    ['/OLD-PAGE///', 'path:/old-page'],
    ['/Café/', 'path:/caf%c3%a9'],
    ['/', 'path:'],
  ])(
    'looks %s up as %j (lowercased, no trailing slash)',
    async (path, search) => {
      const {query} = await redirectFor(path);

      expect(query.mock.calls).toEqual([lookup(search)]);
    },
  );

  it('carries the request query over, minus redirect, return_to and _routes', async () => {
    const {response} = await redirectFor(
      '/old-page?utm_source=mail&redirect=%2Fx&return_to=%2Fy&_routes=root',
      createFakeStorefront(urlRedirectTo('/new-page')),
    );

    expect(await summary(response)).toEqual(
      permanentRedirect('/new-page?utm_source=mail'),
    );
  });

  it.each([
    ['/old?utm=1', '/search?q=a+b&utm=1'],
    ['/old', '/search?q=a%20b'],
  ])(
    'merges carried parameters into a target with a query (%s gives %s)',
    async (path, location) => {
      const {response} = await redirectFor(
        path,
        createFakeStorefront(urlRedirectTo('/search?q=a%20b')),
      );

      expect(await summary(response)).toEqual(permanentRedirect(location));
    },
  );

  it('keeps the fragment of the target last', async () => {
    const {response} = await redirectFor(
      '/old?utm=1',
      createFakeStorefront(urlRedirectTo('/new#top')),
    );

    expect(await summary(response)).toEqual(
      permanentRedirect('/new?utm=1#top'),
    );
  });

  it('follows an absolute target the merchant configured', async () => {
    const {response} = await redirectFor(
      '/old?utm=1',
      createFakeStorefront(urlRedirectTo('https://other.example/landing')),
    );

    expect(await summary(response)).toEqual(
      permanentRedirect('https://other.example/landing?utm=1'),
    );
  });

  it('prefers the URL redirect over a redirect parameter', async () => {
    const {response} = await redirectFor(
      '/old?redirect=%2Fcollections%2Fall',
      createFakeStorefront(urlRedirectTo('/new')),
    );

    expect(await summary(response)).toEqual(permanentRedirect('/new'));
  });

  it.each([
    ['/Old?B=2&redirect=%2Fx&c=a%20b', 'path:/old?b=2&c=a+b'],
    ['/Old/?redirect=%2Fx&_routes=root', 'path:/old'],
  ])(
    'matches %s on its query string too with matchQueryParams, then carries nothing over',
    async (path, search) => {
      const {response, query} = await redirectFor(
        path,
        createFakeStorefront(urlRedirectTo('/new')),
        {matchQueryParams: true},
      );

      expect(await summary(response)).toEqual(permanentRedirect('/new'));
      expect(query.mock.calls).toEqual([lookup(search)]);
    },
  );
});

describe('storefrontRedirect: single-fetch (.data) requests', () => {
  it.each([
    ['/old-page.data?_routes=root', 'path:/old-page'],
    ['/_root.data', 'path:'],
    ['/collections/_.data', 'path:/collections'],
  ])(
    'answers %s with a 204 that React Router follows',
    async (path, search) => {
      const {response, query} = await redirectFor(
        path,
        createFakeStorefront(urlRedirectTo('/new-page')),
      );

      expect(await summary(response)).toEqual(singleFetchRedirect('/new-page'));
      expect(query.mock.calls).toEqual([lookup(search)]);
    },
  );
});

describe('storefrontRedirect: redirect parameters', () => {
  it('falls back to a same-origin redirect parameter, carrying the others over', async () => {
    const {response, query} = await redirectFor(
      '/nope?redirect=%2Fcollections%2Fall&utm_source=x',
    );

    expect(await summary(response)).toEqual(
      permanentRedirect('/collections/all?utm_source=x'),
    );
    expect(query.mock.calls).toEqual([lookup('path:/nope')]);
  });

  it.each([
    ['/nope?redirect=%2Fa&return_to=%2Fb', '/b'],
    ['/nope?redirect=%2Fa&return_to=', '/a'],
  ])('prefers a non-empty return_to (%s)', async (path, location) => {
    const {response} = await redirectFor(path);

    expect(await summary(response)).toEqual(permanentRedirect(location));
  });

  it('keeps the query of the target', async () => {
    const {response} = await redirectFor(
      `/nope?redirect=${encodeURIComponent('/collections/all?sort_key=PRICE')}`,
    );

    expect(await summary(response)).toEqual(
      permanentRedirect('/collections/all?sort_key=PRICE'),
    );
  });

  it('answers a .data request with a single-fetch redirect to the target', async () => {
    const {response} = await redirectFor(
      '/nope.data?redirect=%2Fcollections%2Fall',
    );

    expect(await summary(response)).toEqual(
      singleFetchRedirect('/collections/all'),
    );
  });

  it('reduces an absolute same-origin target to its path', async () => {
    const {response} = await redirectFor(
      `/nope?redirect=${encodeURIComponent(`${ORIGIN}/collections/all`)}`,
    );

    expect(await summary(response)).toEqual(
      permanentRedirect('/collections/all'),
    );
  });

  // Hydrogen redirected `/.//evil.example` to `//evil.example`.
  it.each([
    '/.//evil.example',
    '/..//evil.example',
    '/%2e//evil.example',
    '//evil.example',
    '/\\evil.example',
    'https://evil.example/',
    'http:evil.example',
    'javascript:alert(1)',
  ])('keeps the 404 for the hostile value %j', async (value) => {
    for (const param of ['redirect', 'return_to']) {
      const {response, notFound} = await redirectFor(
        `/nope?${param}=${encodeURIComponent(value)}`,
      );

      expect(response).toBe(notFound);
      expect(response.headers.has('location')).toBe(false);
    }
  });
});

describe('storefrontRedirect: nothing to redirect to', () => {
  it('returns the 404 it was given', async () => {
    const {response, notFound} = await redirectFor('/nope?utm_source=x');

    expect(response).toBe(notFound);
  });

  it('answers a plain 404 when it was given none', async () => {
    const {storefront} = createFakeStorefront();

    const response = await storefrontRedirect({
      storefront,
      request: new Request(`${ORIGIN}/nope`),
    });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not Found');
  });

  it('falls through to the redirect parameter when the answer has no urlRedirects', async () => {
    const {response} = await redirectFor(
      '/nope?redirect=%2Fcollections%2Fall',
      createFakeStorefront({}),
    );

    expect(await summary(response)).toEqual(
      permanentRedirect('/collections/all'),
    );
  });
});

describe('storefrontRedirect: Storefront API failures', () => {
  it.each([
    ['a network error', new Error('offline')],
    [
      'the 502 of the Storefront error guard',
      new Response('Storefront API error', {status: 502}),
    ],
  ])(
    'logs %s and returns the 404 without following the parameter',
    async (_label, failure) => {
      const fake = createFakeStorefront();
      fake.query.mockRejectedValueOnce(failure);

      const {response, notFound} = await redirectFor(
        '/Nope?redirect=%2Fcollections%2Fall',
        fake,
      );

      expect(response).toBe(notFound);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith(
        '[storefront-redirect] Failed to fetch redirects from the Storefront API for route /nope',
        failure,
      );
    },
  );

  it('logs an unreadable answer as a failure and returns the 404', async () => {
    const fake = createFakeStorefront();
    fake.query.mockResolvedValueOnce(undefined);

    const {response, notFound} = await redirectFor(
      '/nope?redirect=%2Fcollections%2Fall',
      fake,
    );

    expect(response).toBe(notFound);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});

describe('storefrontRedirect on our Storefront client', () => {
  const API_URL = `https://${STORE_DOMAIN}/api/2026-04/graphql.json`;

  function createClient() {
    // hydrogen-react warns once that servers should use a private token.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    return createStorefrontClient({
      storeDomain: STORE_DOMAIN,
      publicStorefrontToken: 'public-token-placeholder',
      i18n: {language: 'EN', country: 'US'},
      request: new Request(`${ORIGIN}/old`),
      waitUntil: () => {},
    });
  }

  /** Makes the Storefront API answer every call with `body`. */
  function stubStorefrontApi(body: unknown, init: ResponseInit = {}) {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json(body, init),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  async function redirectThrough(storefront: Storefront, path: string) {
    const notFound = new Response('missing', {status: 404});
    const response = await storefrontRedirect({
      storefront,
      request: new Request(`${ORIGIN}${path}`),
      response: notFound,
    });
    return {response, notFound};
  }

  it('looks the path up with the minified Hydrogen query', async () => {
    const fetchMock = stubStorefrontApi({data: urlRedirectTo('/new')});

    const {response} = await redirectThrough(createClient(), '/Old/');

    expect(await summary(response)).toEqual(permanentRedirect('/new'));
    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toBe(API_URL);
    expect(JSON.parse(String(init?.body))).toEqual({
      query:
        'query redirects($query: String) { urlRedirects(first: 1, query: $query) { edges { node { target } } } }',
      variables: {query: 'path:/old'},
    });
  });

  it('returns the 404 when the guarded client rejects an errors-only answer', async () => {
    stubStorefrontApi({
      errors: [{message: 'Throttled', extensions: {code: 'THROTTLED'}}],
    });
    const storefront = createClient();
    guardStorefrontErrors(storefront);

    const {response, notFound} = await redirectThrough(
      storefront,
      '/nope?redirect=%2Fcollections%2Fall',
    );

    expect(response).toBe(notFound);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[storefront-redirect]'),
      expect.any(Response),
    );
  });

  it('returns the 404 when the Storefront API fails with HTTP 500', async () => {
    stubStorefrontApi({}, {status: 500});

    const {response, notFound} = await redirectThrough(createClient(), '/nope');

    expect(response).toBe(notFound);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[storefront-redirect]'),
      expect.objectContaining({name: 'StorefrontApiHttpError', status: 500}),
    );
  });
});
