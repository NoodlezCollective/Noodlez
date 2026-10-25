import {RouterContextProvider} from 'react-router';
import {isAnalyticsEnabled} from '~/lib/analytics/config';
import {createCartService, type CartService} from '~/lib/cart/cart.server';
import {createCustomerAccountStub} from '~/lib/customer-account/stub.server';
import type {CustomerAccount} from '~/lib/customer-account/types';
import {AppSession, isSecureRequest} from '~/lib/session';
import {
  createStorefrontClient,
  type I18n,
  type Storefront,
} from '~/lib/storefront/client.server';
import {guardStorefrontErrors} from '~/lib/storefront-errors';

type WaitUntil = (promise: Promise<unknown>) => void;

/** Our cart service (app/lib/cart/cart.server.ts) on the Storefront client. */
export type AppCart = CartService;
/**
 * Our customer-account stub (app/lib/customer-account/stub.server.ts):
 * customer accounts are deferred (docs/hydrogen-removal-architecture.md,
 * ADR-D).
 */
export type AppCustomerAccount = CustomerAccount;

/** The per-request services every loader, action and entry.server receive. */
export interface AppContextServices {
  storefront: Storefront;
  cart: AppCart;
  customerAccount: AppCustomerAccount;
  env: Env;
  session: AppSession;
  waitUntil: WaitUntil;
}

/** The router context: React Router's provider carrying our services. */
export type AppRouterContext = RouterContextProvider & AppContextServices;

declare module 'react-router' {
  // Route modules read `context.storefront` & co. Middleware is on, so the
  // context is a RouterContextProvider; AppLoadContext is kept in step.
  interface RouterContextProvider extends AppContextServices {}
  interface AppLoadContext extends AppContextServices {}
}

/** The Cache API cache that Storefront API query results are kept in. */
const STOREFRONT_CACHE_NAME = 'storefront';

/**
 * The storefront serves a single locale; queries receive it as `$country` /
 * `$language` (`@inContext`). Detect it from a URL prefix or a cookie here if
 * the store ever adds markets.
 */
const LOCALE = {language: 'EN', country: 'US'} as const satisfies I18n;

/**
 * Builds the router context for one request: our Storefront client, with the
 * development mock and the error guard installed on it, the customer-account
 * stub, and our cart service running on that client.
 */
export async function createAppRouterContext(
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
): Promise<AppRouterContext> {
  if (!env?.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }

  const waitUntil = executionContext.waitUntil.bind(executionContext);
  const [cache, session] = await Promise.all([
    openStorefrontCache(),
    AppSession.init(request, [env.SESSION_SECRET]),
  ]);

  const storefront = createStorefront(request, env, cache, waitUntil);
  // Signed out whether or not the Customer Account API variables are set:
  // the account routes end on the 503 sign-in page until the OAuth client is
  // ported, and the cart never attaches a buyer.
  const customerAccount = createCustomerAccountStub({
    session,
    request,
    language: LOCALE.language,
  });
  // The cart id cookie is only ever read on the server (from the request's
  // Cookie header); no client code touches it. `Secure` is added over https
  // so local http development keeps working.
  const cart = createCartService({
    storefront,
    customerAccount,
    requestHeaders: request.headers,
    secureCookie: isSecureRequest(request),
  });

  /**
   * Development only: serve Mellow demo data instead of calling Shopify.
   * `import.meta.env.DEV` is replaced at build time, so production bundles
   * never include the mock module. The guard is spelled out here instead of
   * calling isMockStorefrontEnabled (app/lib/mock/flag.ts) on purpose: the
   * bundler can only drop the dynamic import below when the condition is a
   * literal `DEV` test. See app/lib/mock/README.md.
   */
  if (import.meta.env.DEV && env.MOCK_STOREFRONT === 'true') {
    const {installMockStorefront} = await import('~/lib/mock/install.server');
    installMockStorefront(storefront, request);
  }

  /**
   * Reject (502) when the Storefront API answers with GraphQL errors and no
   * data, instead of handing loaders an object full of `undefined`s. Applied
   * after the mock so development behaves like production. The cart service
   * shares this storefront object, so cart queries and mutations are covered.
   */
  guardStorefrontErrors(storefront);

  const services: AppContextServices = {
    storefront,
    cart,
    customerAccount,
    env,
    session,
    waitUntil,
  };
  return Object.assign(new RouterContextProvider(), services);
}

/**
 * The Cache API cache, or undefined when it cannot be opened: queries then
 * bypass it (`withCache` treats a missing cache as BYPASS) instead of the
 * failure taking every request down. Logged once for the request.
 */
async function openStorefrontCache(): Promise<Cache | undefined> {
  try {
    return await caches.open(STOREFRONT_CACHE_NAME);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(
      `[storefront-cache] Could not open the "${STOREFRONT_CACHE_NAME}" cache, so queries bypass it: ${reason}`,
    );
    return undefined;
  }
}

function createStorefront(
  request: Request,
  env: Env,
  cache: Cache | undefined,
  waitUntil: WaitUntil,
): Storefront {
  return createStorefrontClient({
    storeDomain: env.PUBLIC_STORE_DOMAIN,
    publicStorefrontToken: env.PUBLIC_STOREFRONT_API_TOKEN,
    privateStorefrontToken: env.PRIVATE_STOREFRONT_API_TOKEN,
    storefrontId: env.PUBLIC_STOREFRONT_ID,
    i18n: LOCALE,
    request,
    cache,
    waitUntil,
    // Shopify's cookies and visitor tokens go to the Storefront API, and its
    // Set-Cookie headers come back, only while analytics is on (D-9).
    trackingEnabled: isAnalyticsEnabled(env),
  });
}
