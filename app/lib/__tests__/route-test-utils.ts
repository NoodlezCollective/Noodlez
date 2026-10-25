import {parse, validate} from 'graphql';
import {createElement, type ComponentType} from 'react';
import {renderToString} from 'react-dom/server';
import {
  StaticRouterProvider,
  createStaticHandler,
  createStaticRouter,
} from 'react-router';
import {expect, vi} from 'vitest';
import {getMockSchema} from '~/lib/mock/schema.server';

/**
 * Helpers for exercising route modules (`loader` / `action` / `meta`) directly.
 *
 * Route tests live outside `app/routes`: React Router's `flatRoutes()` treats
 * every `.ts` / `.tsx` file in that folder as a route.
 */

export const ORIGIN = 'https://shop.example';

/** Calls a route function with only the arguments the test cares about. */
export function callRoute<Args, Result>(
  fn: (args: Args) => Result,
  args: Record<string, unknown>,
): Result {
  return fn(args as unknown as Args);
}

/** The `Response` a loader threw (React Router's way of signalling 4xx/5xx). */
export async function thrownResponse(
  promise: Promise<unknown>,
): Promise<Response> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
  throw new Error('Expected the route to throw a Response');
}

/** Minimal cart service: only what the routes under test call. */
export function createFakeCart(
  cartId: string | null = 'gid://shopify/Cart/c1?key=k',
) {
  const result = {
    cart: cartId ? {id: cartId, checkoutUrl: `${ORIGIN}/checkout/c1`} : null,
  };
  return {
    updateDiscountCodes: vi.fn(async (..._args: unknown[]) => result),
    create: vi.fn(async (..._args: unknown[]) => result),
    setCartId: vi.fn(
      (id: string) =>
        new Headers({'Set-Cookie': `cart=${id.split('/').pop()}; Path=/`}),
    ),
  };
}

/**
 * Asserts that a GraphQL document is valid against the real Storefront API
 * schema (the one the development mock executes against). Routes the mock
 * cannot serve (blogs, articles, a store with a subscription policy) still get
 * their documents checked this way.
 */
export function expectValidStorefrontDocument(document: unknown) {
  expect(typeof document).toBe('string');
  const errors = validate(getMockSchema(), parse(document as string));
  expect(errors.map((error) => error.message)).toEqual([]);
}

/** A storefront whose `query` resolves to `data` and records every call. */
export function createFakeStorefront(data: unknown) {
  return {
    query: vi.fn(async (..._args: unknown[]) => data),
    i18n: {language: 'EN', country: 'US'},
    CacheLong: () => ({}),
  };
}

/**
 * Renders a route component to HTML with React Router's static data router, so
 * `useLoaderData`, `<Link>` and friends work without a browser.
 */
export async function renderRoute({
  path,
  url,
  Component,
  loaderData,
}: {
  path: string;
  url: string;
  Component: ComponentType;
  loaderData: unknown;
}) {
  const routes = [{path, Component, loader: () => loaderData}];
  const context = await createStaticHandler(routes).query(new Request(url));
  if (context instanceof Response) {
    throw new Error(
      `Expected a rendered route, got a ${context.status} response`,
    );
  }
  const router = createStaticRouter(routes, context);
  // React separates adjacent text nodes with `<!-- -->`; drop it so assertions
  // can match the text a visitor sees.
  return renderToString(
    createElement(StaticRouterProvider, {router, context}),
  ).replace(/<!-- -->/g, '');
}
