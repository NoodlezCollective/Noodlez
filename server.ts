import {createRequestHandler} from 'react-router';
import {storefrontRedirect} from '@shopify/hydrogen';
import {createAppRouterContext, type AppRouterContext} from '~/lib/context';
import type {HydrogenStorefront} from '~/lib/storefront/hydrogen-compat';
import {safeRedirectPath} from '~/lib/urls';

/**
 * Real routes have at most four path segments (`/blogs/:blog/:article` splits
 * into four entries, counting the empty one before the leading slash).
 * react-router 7.16 route matching costs CPU in proportion to the number of
 * segments (GHSA-chx6-hx7r-mcp5, fixed in 7.18): a 3,000-segment URL burns
 * about 1.2 s of CPU per request without authentication. Anything this deep
 * cannot be a storefront URL, so it is rejected before any work is done.
 * Remove once react-router is upgraded to 7.18 or later.
 */
const MAX_PATH_SEGMENTS = 16;

/**
 * Tells Shopify's consent script on document responses that the same-origin
 * Storefront API proxy exists (Hydrogen's `_sfapi_proxy` marker).
 */
const STOREFRONT_API_PROXY_TIMING = '_sfapi_proxy;desc=1';

/**
 * React Router's request handler, created once per isolate. The server build
 * is imported on first use, as in React Router's Cloudflare template.
 */
const handleRequest = createRequestHandler(
  () => import('virtual:react-router/server-build'),
  import.meta.env.MODE,
);

/**
 * Runs `update` on the response, or on a mutable copy when its headers are
 * immutable: a response passed straight through from `fetch()` (or built
 * with `Response.redirect()`) cannot be changed in place.
 */
function withMutableHeaders(
  response: Response,
  update: (response: Response) => void,
): Response {
  try {
    update(response);
    return response;
  } catch {
    const copy = new Response(response.body, response);
    update(copy);
    return copy;
  }
}

/**
 * Headers every response should carry. Document responses get them in
 * app/entry.server.tsx; this fills the gaps for resource routes (robots,
 * sitemaps), `*.data` requests, redirects, early 404s and the Storefront API
 * proxy. Values a route already set are kept.
 */
export function ensureSecurityHeaders(response: Response): Response {
  return withMutableHeaders(response, ({headers}) => {
    if (!headers.has('X-Content-Type-Options')) {
      headers.set('X-Content-Type-Options', 'nosniff');
    }
    if (!headers.has('Referrer-Policy')) {
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
  });
}

/**
 * Requests Hydrogen's request handler turned away before routing: a GET or
 * HEAD request with a body is a 400, and a path with empty segments (`//`)
 * is a permanent redirect to the collapsed path. Null for anything else.
 */
export function rejectMalformedRequest(request: Request): Response | null {
  const {method} = request;
  if ((method === 'GET' || method === 'HEAD') && request.body) {
    return new Response(`${method} requests cannot have a body`, {
      status: 400,
    });
  }

  const {pathname} = new URL(request.url);
  if (pathname.includes('//')) {
    return new Response(null, {
      status: 301,
      headers: {Location: pathname.replace(/\/+/g, '/')},
    });
  }

  return null;
}

/**
 * Hydrogen's `storefrontRedirect` follows `?redirect=` / `?return_to=` on a 404
 * when the value looks like a local path, but its check accepts dot-segment
 * forms such as `/.//evil.example`, which it then re-serialises as
 * `//evil.example`: an open redirect. Resolve both parameters to a same-origin
 * path first and drop them when they are not one.
 */
export function withSafeRedirectParams(request: Request): Request {
  const url = new URL(request.url);
  let changed = false;
  for (const key of ['redirect', 'return_to']) {
    const value = url.searchParams.get(key);
    if (value === null) continue;
    const safe = safeRedirectPath(value, url.origin, '');
    if (safe) url.searchParams.set(key, safe);
    else url.searchParams.delete(key);
    changed = true;
  }
  return changed
    ? new Request(url, {method: request.method, headers: request.headers})
    : request;
}

/** Hydrogen's test: a navigation, or a request that accepts HTML. */
function isDocumentRequest(request: Request): boolean {
  return (
    request.headers.get('sec-fetch-dest') === 'document' ||
    Boolean(request.headers.get('accept')?.includes('text/html'))
  );
}

/**
 * What React Router's response still needs: the session cookie when the
 * session changed (appended, so a cart cookie set by the route survives), the
 * headers the Storefront client collected from its subrequests, and the
 * proxy marker on documents.
 */
async function finishResponse(
  request: Request,
  response: Response,
  {session, storefront}: AppRouterContext,
): Promise<Response> {
  const sessionCookie = session.isPending ? await session.commit() : null;
  return withMutableHeaders(response, (target) => {
    if (sessionCookie !== null) {
      target.headers.append('Set-Cookie', sessionCookie);
    }
    storefront.setCollectedSubrequestHeaders(target);
    if (isDocumentRequest(request)) {
      target.headers.append('Server-Timing', STOREFRONT_API_PROXY_TIMING);
    }
  });
}

/**
 * The deep-path guard and the malformed-request rules run before any work;
 * then the router context is built and the request goes either to the
 * Storefront API proxy or to React Router, whose 404s get a Storefront
 * redirect lookup. Security headers are added by the caller.
 */
async function respond(
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
): Promise<Response> {
  if (new URL(request.url).pathname.split('/').length > MAX_PATH_SEGMENTS) {
    return new Response('Not found', {status: 404});
  }

  const rejected = rejectMalformedRequest(request);
  if (rejected) return rejected;

  const context = await createAppRouterContext(request, env, executionContext);
  const {storefront} = context;

  // Same-origin Storefront API proxy for the browser (consent, analytics).
  if (storefront.isStorefrontApiUrl(request)) {
    return storefront.forward(request);
  }

  const response = await finishResponse(
    request,
    await handleRequest(request, context),
    context,
  );

  /**
   * Check for redirects only when there's a 404 from the app.
   * If the redirect doesn't exist, then `storefrontRedirect`
   * will pass through the 404 response.
   */
  if (response.status === 404) {
    return storefrontRedirect({
      request: withSafeRedirectParams(request),
      response,
      storefront: storefront as unknown as HydrogenStorefront,
    });
  }

  return response;
}

/**
 * The Worker's fetch handler (module format).
 */
export default {
  async fetch(
    request: Request,
    env: Env,
    executionContext: ExecutionContext,
  ): Promise<Response> {
    try {
      return ensureSecurityHeaders(
        await respond(request, env, executionContext),
      );
    } catch (error) {
      console.error(error);
      return ensureSecurityHeaders(
        new Response('An unexpected error occurred', {status: 500}),
      );
    }
  },
} satisfies ExportedHandler<Env>;
