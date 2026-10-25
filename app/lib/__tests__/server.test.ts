import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createStorefrontClient} from '~/lib/storefront/client.server';

const mocks = vi.hoisted(() => ({
  createAppRouterContext: vi.fn(),
  handleRequest: vi.fn(),
  storefrontRedirect: vi.fn(),
  /** What server.ts passed to React Router's `createRequestHandler`. */
  requestHandlerArgs: [] as unknown[][],
}));

// `virtual:react-router/server-build` only exists inside the Vite build.
vi.mock('virtual:react-router/server-build', () => ({
  routes: {root: {id: 'root'}},
}));
vi.mock('~/lib/context', () => ({
  createAppRouterContext: mocks.createAppRouterContext,
}));
vi.mock('react-router', () => ({
  createRequestHandler: (...args: unknown[]) => {
    mocks.requestHandlerArgs.push(args);
    return mocks.handleRequest;
  },
}));
vi.mock('~/lib/storefront-redirect.server', () => ({
  storefrontRedirect: mocks.storefrontRedirect,
}));

import server, {
  ensureSecurityHeaders,
  rejectMalformedRequest,
  withSafeRedirectParams,
} from '../../../server';

const ENV = {} as Env;
const EXECUTION_CONTEXT = {} as ExecutionContext;
const ORIGIN = 'https://shop.example';
const SESSION_COOKIE = 'session=s3ss10n; Path=/; HttpOnly; SameSite=Lax';
const CART_COOKIE = 'cart=c1-abc; Path=/; HttpOnly; SameSite=Lax';
const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

function fetchPath(path: string, init?: RequestInit) {
  return server.fetch(
    new Request(`${ORIGIN}${path}`, init),
    ENV,
    EXECUTION_CONTEXT,
  );
}

const SEGMENTS = (count: number) =>
  '/' + Array.from({length: count}, () => 'a').join('/');

/**
 * What server.ts reads from the router context. `isStorefrontApiUrl` is the
 * real client's, so the proxy cases below exercise the real path rule.
 */
function createFakeContext() {
  const {isStorefrontApiUrl} = createStorefrontClient({
    storeDomain: 'mellow-test.myshopify.com',
    publicStorefrontToken: 'public-token-placeholder',
    i18n: {language: 'EN', country: 'US'},
    request: new Request(`${ORIGIN}/`),
    waitUntil: () => {},
  });
  return {
    session: {
      isPending: false,
      commit: vi.fn(async () => SESSION_COOKIE),
    },
    storefront: {
      isStorefrontApiUrl,
      forward: vi.fn(async (_request: Request) =>
        Response.json({data: {shop: {name: 'Mellow'}}}),
      ),
      setCollectedSubrequestHeaders: vi.fn((_response: Response) => {}),
    },
  };
}

let context: ReturnType<typeof createFakeContext>;

beforeEach(() => {
  vi.clearAllMocks();
  // hydrogen-react warns once that servers should use a private token.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  context = createFakeContext();
  mocks.createAppRouterContext.mockResolvedValue(context);
  mocks.handleRequest.mockImplementation(async () => new Response('ok'));
  mocks.storefrontRedirect.mockImplementation(
    async ({response}: {response: Response}) => response,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('server fetch handler: deep paths (react-router 7.16 route matching, GHSA-chx6-hx7r-mcp5)', () => {
  it('answers 404 immediately for a 3,000-segment path, without any further work', async () => {
    const response = await fetchPath(SEGMENTS(3000));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not found');
    expect(mocks.createAppRouterContext).not.toHaveBeenCalled();
    expect(mocks.handleRequest).not.toHaveBeenCalled();
    expect(mocks.storefrontRedirect).not.toHaveBeenCalled();
  });

  it('allows 15 segments and rejects 16', async () => {
    // `split('/')` counts the empty entry before the leading slash: 15 segments -> 16 entries.
    expect((await fetchPath(SEGMENTS(15))).status).toBe(200);
    expect((await fetchPath(SEGMENTS(16))).status).toBe(404);
  });

  it('handles every real route shape normally', async () => {
    const paths = [
      '/',
      '/products/cloudalign-pillow',
      '/collections/all',
      '/blogs/journal/sleep-better',
      '/account/orders/abc',
      '/sitemap/articles/1.xml',
      '/policies/privacy-policy',
    ];

    const statuses = [];
    for (const path of paths) statuses.push((await fetchPath(path)).status);

    expect(statuses).toEqual(paths.map(() => 200));
    expect(mocks.handleRequest).toHaveBeenCalledTimes(paths.length);
  });

  it('counts only literal slashes, so encoded slashes stay in one segment', async () => {
    const response = await fetchPath('/' + 'a%2F'.repeat(100) + 'a');
    expect(response.status).toBe(200);
  });
});

describe('server fetch handler: security headers on every response', () => {
  const EXPECTED = SECURITY_HEADERS;

  it('adds them to the early 404', async () => {
    const response = await fetchPath(SEGMENTS(40));
    expect(Object.fromEntries(response.headers)).toMatchObject(EXPECTED);
  });

  it('adds them to responses that bypass entry.server (resource routes, data requests)', async () => {
    mocks.handleRequest.mockResolvedValueOnce(
      new Response('User-agent: *', {headers: {'Content-Type': 'text/plain'}}),
    );
    const response = await fetchPath('/robots.txt');
    expect(Object.fromEntries(response.headers)).toMatchObject(EXPECTED);
  });

  it('adds them to a Storefront redirect', async () => {
    mocks.handleRequest.mockResolvedValueOnce(
      new Response('missing', {status: 404}),
    );
    mocks.storefrontRedirect.mockResolvedValueOnce(
      new Response(null, {status: 301, headers: {Location: '/new'}}),
    );
    const response = await fetchPath('/old');
    expect(response.status).toBe(301);
    expect(Object.fromEntries(response.headers)).toMatchObject(EXPECTED);
  });

  it('keeps values a route (or entry.server) already set', async () => {
    mocks.handleRequest.mockResolvedValueOnce(
      new Response('x', {headers: {'Referrer-Policy': 'no-referrer'}}),
    );
    const response = await fetchPath('/');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('serves a mutable copy when the response headers are immutable', async () => {
    // `Response.redirect()` (like a response returned by `fetch()` on Oxygen)
    // has immutable headers.
    const immutable = Response.redirect('https://shop.example/elsewhere', 302);
    expect(() => immutable.headers.set('X-Test', '1')).toThrow(TypeError);
    mocks.handleRequest.mockResolvedValueOnce(immutable);

    const response = await fetchPath('/go');

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(
      'https://shop.example/elsewhere',
    );
    expect(Object.fromEntries(response.headers)).toMatchObject(EXPECTED);
  });

  it('returns the same response when its headers can be changed', () => {
    const response = new Response('x');

    expect(ensureSecurityHeaders(response)).toBe(response);
    expect(Object.fromEntries(response.headers)).toMatchObject(EXPECTED);
  });

  it('sends no powered-by header (Hydrogen added one)', async () => {
    const response = await fetchPath('/', {headers: {accept: 'text/html'}});

    expect(response.headers.has('powered-by')).toBe(false);
  });
});

describe('server fetch handler: React Router', () => {
  it('creates the request handler once, from the lazily imported server build', async () => {
    await fetchPath('/');
    await fetchPath('/collections/all');

    expect(mocks.requestHandlerArgs).toHaveLength(1);
    const [build, mode] = mocks.requestHandlerArgs[0];
    expect(mode).toBe(import.meta.env.MODE);
    expect(build).toBeTypeOf('function');
    expect(await (build as () => Promise<unknown>)()).toMatchObject({
      routes: {root: {id: 'root'}},
    });
  });

  it('builds the context from the request, env and execution context and hands it over', async () => {
    const request = new Request(`${ORIGIN}/products/cloudalign-pillow`);

    await server.fetch(request, ENV, EXECUTION_CONTEXT);

    expect(mocks.createAppRouterContext).toHaveBeenCalledWith(
      request,
      ENV,
      EXECUTION_CONTEXT,
    );
    expect(mocks.handleRequest).toHaveBeenCalledWith(request, context);
  });
});

describe('server fetch handler: malformed requests (Hydrogen parity)', () => {
  /**
   * The Fetch API refuses to build a GET or HEAD `Request` with a body, but a
   * client can still send one, so the handler gets a look-alike.
   */
  function requestWithBody(method: string): Request {
    return {
      method,
      url: `${ORIGIN}/products/cloudalign-pillow`,
      headers: new Headers(),
      body: new ReadableStream(),
    } as unknown as Request;
  }

  it.each(['GET', 'HEAD'])(
    'answers 400 to a %s request with a body, before any other work',
    async (method) => {
      const response = await server.fetch(
        requestWithBody(method),
        ENV,
        EXECUTION_CONTEXT,
      );

      expect(response.status).toBe(400);
      expect(await response.text()).toBe(
        `${method} requests cannot have a body`,
      );
      expect(Object.fromEntries(response.headers)).toMatchObject(
        SECURITY_HEADERS,
      );
      expect(mocks.createAppRouterContext).not.toHaveBeenCalled();
      expect(mocks.handleRequest).not.toHaveBeenCalled();
    },
  );

  it('lets bodies on other methods and body-less GETs through', async () => {
    const post = new Request(`${ORIGIN}/cart`, {method: 'POST', body: 'x=1'});

    expect(rejectMalformedRequest(post)).toBeNull();
    expect(rejectMalformedRequest(new Request(`${ORIGIN}/cart`))).toBeNull();
    expect((await server.fetch(post, ENV, EXECUTION_CONTEXT)).status).toBe(200);
  });

  it.each([
    ['//collections/all', '/collections/all'],
    ['/collections//all', '/collections/all'],
    ['///products///cloudalign-pillow//', '/products/cloudalign-pillow/'],
    // Hydrogen redirects to the path alone.
    ['//search?q=pillow', '/search'],
  ])(
    'redirects %s permanently to %s, before any other work',
    async (path, location) => {
      const response = await fetchPath(path);

      expect(response.status).toBe(301);
      expect(response.headers.get('Location')).toBe(location);
      expect(Object.fromEntries(response.headers)).toMatchObject(
        SECURITY_HEADERS,
      );
      expect(mocks.createAppRouterContext).not.toHaveBeenCalled();
      expect(mocks.handleRequest).not.toHaveBeenCalled();
    },
  );

  it('only checks the path: slashes in the query or encoded ones are fine', () => {
    for (const path of ['/search?q=a//b', '/a%2F%2Fb', '/products/a/b']) {
      expect(rejectMalformedRequest(new Request(`${ORIGIN}${path}`))).toBe(
        null,
      );
    }
  });
});

describe('server fetch handler: Storefront API proxy', () => {
  const QUERY = JSON.stringify({query: '{ shop { name } }'});

  it.each(['/api/2026-04/graphql.json', '/api/unstable/graphql.json'])(
    'forwards %s to the Storefront API, with the security headers',
    async (path) => {
      const request = new Request(`${ORIGIN}${path}`, {
        method: 'POST',
        body: QUERY,
        headers: {'content-type': 'application/json'},
      });

      const response = await server.fetch(request, ENV, EXECUTION_CONTEXT);

      expect(context.storefront.forward).toHaveBeenCalledWith(request);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({data: {shop: {name: 'Mellow'}}});
      expect(Object.fromEntries(response.headers)).toMatchObject(
        SECURITY_HEADERS,
      );
      expect(mocks.handleRequest).not.toHaveBeenCalled();
      expect(context.session.commit).not.toHaveBeenCalled();
    },
  );

  it.each([
    '/api/2026-04/graphql.jsonx',
    // Hydrogen also proxied its MCP endpoint; that proxy is not ported.
    '/api/mcp',
  ])('leaves %s to React Router', async (path) => {
    const response = await fetchPath(path, {method: 'POST', body: QUERY});

    expect(response.status).toBe(200);
    expect(context.storefront.forward).not.toHaveBeenCalled();
    expect(mocks.handleRequest).toHaveBeenCalledTimes(1);
  });
});

describe('server fetch handler: session cookie, subrequest headers, Server-Timing', () => {
  it('appends the session cookie next to a cookie the route set (D-10)', async () => {
    context.session.isPending = true;
    mocks.handleRequest.mockResolvedValueOnce(
      new Response('ok', {headers: {'Set-Cookie': CART_COOKIE}}),
    );

    const response = await fetchPath('/cart', {method: 'POST', body: 'x=1'});

    expect(context.session.commit).toHaveBeenCalledTimes(1);
    expect(response.headers.getSetCookie()).toEqual([
      CART_COOKIE,
      SESSION_COOKIE,
    ]);
  });

  it('commits nothing when the session is unchanged', async () => {
    const response = await fetchPath('/');

    expect(context.session.commit).not.toHaveBeenCalled();
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('adds the session cookie to a mutable copy of an immutable response', async () => {
    context.session.isPending = true;
    mocks.handleRequest.mockResolvedValueOnce(
      Response.redirect(`${ORIGIN}/account`, 302),
    );

    const response = await fetchPath('/account/login');

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(`${ORIGIN}/account`);
    expect(response.headers.getSetCookie()).toEqual([SESSION_COOKIE]);
    expect(Object.fromEntries(response.headers)).toMatchObject(
      SECURITY_HEADERS,
    );
  });

  it('lets the storefront add the headers it collected from subrequests', async () => {
    const routeResponse = new Response('ok');
    mocks.handleRequest.mockResolvedValueOnce(routeResponse);
    context.storefront.setCollectedSubrequestHeaders.mockImplementationOnce(
      (response: Response) => {
        response.headers.append('Set-Cookie', '_shopify_y=abc; Path=/');
      },
    );

    const response = await fetchPath('/');

    expect(
      context.storefront.setCollectedSubrequestHeaders,
    ).toHaveBeenCalledWith(routeResponse);
    expect(response.headers.getSetCookie()).toEqual(['_shopify_y=abc; Path=/']);
  });

  it.each<Record<string, string>>([
    {'sec-fetch-dest': 'document'},
    {accept: 'text/html,application/xhtml+xml,*/*;q=0.8'},
  ])(
    'tells document requests that the Storefront API proxy exists (%o)',
    async (headers) => {
      const response = await fetchPath('/', {headers});

      expect(response.headers.get('Server-Timing')).toBe('_sfapi_proxy;desc=1');
    },
  );

  it.each<Record<string, string>>([
    {},
    {'sec-fetch-dest': 'empty', accept: '*/*'},
    {accept: 'application/json'},
  ])('adds no Server-Timing to other requests (%o)', async (headers) => {
    const response = await fetchPath('/_root.data', {headers});

    expect(response.headers.has('Server-Timing')).toBe(false);
  });

  it('appends to a Server-Timing header the response already has', async () => {
    mocks.handleRequest.mockResolvedValueOnce(
      new Response('ok', {headers: {'Server-Timing': 'render;dur=5'}}),
    );

    const response = await fetchPath('/', {
      headers: {'sec-fetch-dest': 'document'},
    });

    expect(response.headers.get('Server-Timing')).toBe(
      'render;dur=5, _sfapi_proxy;desc=1',
    );
  });
});

describe('server fetch handler: Storefront redirects', () => {
  it('hands storefrontRedirect the 404, the storefront and the request with safe parameters', async () => {
    const notFound = new Response('missing', {status: 404});
    mocks.handleRequest.mockResolvedValueOnce(notFound);

    await fetchPath('/old?redirect=%2F%2Fevil.example&utm_source=x');

    expect(mocks.storefrontRedirect).toHaveBeenCalledTimes(1);
    const [{request, response, storefront}] =
      mocks.storefrontRedirect.mock.calls[0];
    expect(response).toBe(notFound);
    expect(storefront).toBe(context.storefront);
    expect(new URL(request.url).search).toBe('?utm_source=x');
  });

  it.each([200, 302, 500])(
    'does not look for a redirect on a %s',
    async (status) => {
      mocks.handleRequest.mockResolvedValueOnce(
        new Response(null, {status, headers: {Location: '/x'}}),
      );

      expect((await fetchPath('/page')).status).toBe(status);
      expect(mocks.storefrontRedirect).not.toHaveBeenCalled();
    },
  );
});

describe('server fetch handler: failures', () => {
  it('turns an unexpected error into a plain 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.handleRequest.mockRejectedValueOnce(new Error('boom'));

    const response = await fetchPath('/');

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('An unexpected error occurred');
  });

  it('turns a context that cannot be built (no SESSION_SECRET) into a plain 500', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const failure = new Error('SESSION_SECRET environment variable is not set');
    mocks.createAppRouterContext.mockRejectedValueOnce(failure);

    const response = await fetchPath('/');

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('An unexpected error occurred');
    expect(Object.fromEntries(response.headers)).toMatchObject(
      SECURITY_HEADERS,
    );
    expect(consoleError).toHaveBeenCalledWith(failure);
  });

  it('turns a failed Storefront API proxy request into a plain 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    context.storefront.forward.mockRejectedValueOnce(new Error('offline'));

    const response = await fetchPath('/api/2026-04/graphql.json', {
      method: 'POST',
      body: '{}',
    });

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('An unexpected error occurred');
  });
});

describe('withSafeRedirectParams (404 redirect parameters handed to storefrontRedirect)', () => {
  const origin = 'https://shop.example';

  it('leaves requests without redirect parameters untouched', () => {
    const request = new Request(`${origin}/nope?utm_source=x`);
    expect(withSafeRedirectParams(request)).toBe(request);
  });

  it('keeps same-origin paths (normalised) in both parameters', () => {
    const request = new Request(
      `${origin}/nope?redirect=/collections/all&return_to=${encodeURIComponent(
        `${origin}/products?x=1`,
      )}`,
    );
    const url = new URL(withSafeRedirectParams(request).url);
    expect(url.searchParams.get('redirect')).toBe('/collections/all');
    expect(url.searchParams.get('return_to')).toBe('/products?x=1');
  });

  it.each([
    '/.//evil.example',
    '/..//evil.example',
    '/%2e//evil.example',
    '//evil.example',
    '/\\evil.example',
    'https://evil.example/',
    'javascript:alert(1)',
  ])('drops the hostile value %s', (value) => {
    const request = new Request(
      `${origin}/nope?redirect=${encodeURIComponent(value)}&return_to=${encodeURIComponent(value)}&keep=1`,
    );
    const url = new URL(withSafeRedirectParams(request).url);
    expect(url.searchParams.has('redirect')).toBe(false);
    expect(url.searchParams.has('return_to')).toBe(false);
    expect(url.searchParams.get('keep')).toBe('1');
  });
});
