import * as serverBuild from 'virtual:react-router/server-build';
import {createRequestHandler, storefrontRedirect} from '@shopify/hydrogen';
import {createHydrogenRouterContext} from '~/lib/context';

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
 * Headers every response should carry. Document responses get them in
 * app/entry.server.tsx; this fills the gaps for resource routes (robots,
 * sitemaps), `*.data` requests, redirects and early 404s.
 */
function ensureSecurityHeaders(response: Response) {
  const apply = (headers: Headers) => {
    if (!headers.has('X-Content-Type-Options')) {
      headers.set('X-Content-Type-Options', 'nosniff');
    }
    if (!headers.has('Referrer-Policy')) {
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
  };

  try {
    apply(response.headers);
    return response;
  } catch {
    // A response passed straight through from `fetch()` has immutable
    // headers; serve a mutable copy rather than failing the request.
    const copy = new Response(response.body, response);
    apply(copy.headers);
    return copy;
  }
}

/**
 * Export a fetch handler in module format.
 */
export default {
  async fetch(
    request: Request,
    env: Env,
    executionContext: ExecutionContext,
  ): Promise<Response> {
    try {
      if (new URL(request.url).pathname.split('/').length > MAX_PATH_SEGMENTS) {
        return ensureSecurityHeaders(new Response('Not found', {status: 404}));
      }

      const hydrogenContext = await createHydrogenRouterContext(
        request,
        env,
        executionContext,
      );

      /**
       * Create a Hydrogen request handler that internally
       * delegates to React Router for routing and rendering.
       */
      const handleRequest = createRequestHandler({
        build: serverBuild,
        mode: process.env.NODE_ENV,
        getLoadContext: () => hydrogenContext,
      });

      const response = await handleRequest(request);

      if (hydrogenContext.session.isPending) {
        response.headers.set(
          'Set-Cookie',
          await hydrogenContext.session.commit(),
        );
      }

      if (response.status === 404) {
        /**
         * Check for redirects only when there's a 404 from the app.
         * If the redirect doesn't exist, then `storefrontRedirect`
         * will pass through the 404 response.
         */
        return ensureSecurityHeaders(
          await storefrontRedirect({
            request,
            response,
            storefront: hydrogenContext.storefront,
          }),
        );
      }

      return ensureSecurityHeaders(response);
    } catch (error) {
      console.error(error);
      return new Response('An unexpected error occurred', {status: 500});
    }
  },
};
