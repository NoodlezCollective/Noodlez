import {
  createCustomerAccountClient,
  type CustomerAccount,
} from '@shopify/hydrogen';
import {RouterContextProvider} from 'react-router';
import {createCartService, type CartService} from '~/lib/cart/cart.server';
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
/** Hydrogen's customer-account client, until Phase 5's stub. */
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
 * development mock and the error guard installed on it, Hydrogen's
 * customer-account client, and our cart service running on that client.
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
    caches.open(STOREFRONT_CACHE_NAME),
    AppSession.init(request, [env.SESSION_SECRET]),
  ]);

  const storefront = createStorefront(request, env, cache, waitUntil);
  const customerAccount = createCustomerAccount(
    request,
    env,
    session,
    waitUntil,
  );
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

function createStorefront(
  request: Request,
  env: Env,
  cache: Cache,
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
  });
}

/**
 * Unset ids become empty strings: Hydrogen's client treats both alike (not
 * logged in, invalid credentials), and the account routes show the
 * "not configured" page before calling it.
 */
function createCustomerAccount(
  request: Request,
  env: Env,
  session: AppSession,
  waitUntil: WaitUntil,
): AppCustomerAccount {
  return createCustomerAccountClient({
    session,
    request,
    waitUntil,
    customerAccountId: env.PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID ?? '',
    shopId: env.SHOP_ID ?? '',
    language: LOCALE.language,
  });
}
