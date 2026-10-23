import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  createHydrogenRouterContext: vi.fn(),
  handleRequest: vi.fn(),
  storefrontRedirect: vi.fn(),
}));

// `virtual:react-router/server-build` only exists inside the Vite build.
vi.mock('virtual:react-router/server-build', () => ({}));
vi.mock('~/lib/context', () => ({
  createHydrogenRouterContext: mocks.createHydrogenRouterContext,
}));
vi.mock('@shopify/hydrogen', () => ({
  createRequestHandler: () => mocks.handleRequest,
  storefrontRedirect: mocks.storefrontRedirect,
}));

import server from '../../../server';

const ENV = {} as Env;
const EXECUTION_CONTEXT = {} as ExecutionContext;

function fetchPath(path: string) {
  return server.fetch(
    new Request(`https://shop.example${path}`),
    ENV,
    EXECUTION_CONTEXT,
  );
}

const SEGMENTS = (count: number) =>
  '/' + Array.from({length: count}, () => 'a').join('/');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createHydrogenRouterContext.mockResolvedValue({
    session: {isPending: false},
    storefront: {},
  });
  mocks.handleRequest.mockImplementation(async () => new Response('ok'));
  mocks.storefrontRedirect.mockImplementation(
    async ({response}: {response: Response}) => response,
  );
});

describe('server fetch handler: deep paths (react-router 7.16 route matching, GHSA-chx6-hx7r-mcp5)', () => {
  it('answers 404 immediately for a 3,000-segment path, without any further work', async () => {
    const response = await fetchPath(SEGMENTS(3000));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not found');
    expect(mocks.createHydrogenRouterContext).not.toHaveBeenCalled();
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
  const EXPECTED = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  };

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
});

describe('server fetch handler: failures', () => {
  it('turns an unexpected error into a plain 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.handleRequest.mockRejectedValueOnce(new Error('boom'));

    const response = await fetchPath('/');

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('An unexpected error occurred');
  });
});
