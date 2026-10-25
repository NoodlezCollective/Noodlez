import {
  cartGetIdDefault,
  cartSetIdDefault,
  createCartHandler,
  createCustomerAccountClient,
  type CustomerAccount,
  type HydrogenCart,
  type HydrogenCartCustom,
} from '@shopify/hydrogen';
import {RouterContextProvider} from 'react-router';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {CART_DISCOUNT_CODES_UPDATE_MUTATION} from '~/lib/cart/queries';
import {CART_QUERY_FRAGMENT} from '~/lib/fragments';
import {AppSession, isSecureRequest} from '~/lib/session';
import {
  createStorefrontClient,
  type I18n,
  type Storefront,
} from '~/lib/storefront/client.server';
import type {HydrogenStorefront} from '~/lib/storefront/hydrogen-compat';
import {guardStorefrontErrors} from '~/lib/storefront-errors';

declare global {
  // Augment HydrogenCustomCartFragment with the codegen'd cart fragment type so
  // that context.cart.get() and all cart mutations return the extended cart type.
  interface HydrogenCustomCartFragment extends CartApiQueryFragment {}
}

type WaitUntil = (promise: Promise<unknown>) => void;

/** Hydrogen's discount-code update, replaced in this phase (D-8). */
type LegacyCartMethods = {
  updateDiscountCodes: HydrogenCart['updateDiscountCodes'];
};
type CartOptionalInput = Parameters<
  LegacyCartMethods['updateDiscountCodes']
>[1];
type CartMutationResult = Awaited<
  ReturnType<LegacyCartMethods['updateDiscountCodes']>
>;

/**
 * Hydrogen's cart handler running on our Storefront client, until Phase 3 of
 * docs/hydrogen-removal-plan.md replaces it with our own cart service.
 */
export type AppCart = HydrogenCartCustom<LegacyCartMethods>;
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
 * development mock and the error guard installed on it, plus Hydrogen's
 * customer-account client and cart handler running on that client.
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
  const cart = createLegacyCart(request, storefront, customerAccount);

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
   * after the mock so development behaves like production. The cart handler
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

/**
 * Hydrogen's cart handler on our client. It calls `storefront.query` and
 * `storefront.mutate` through the object at call time, so the mock and the
 * guard installed afterwards apply to every cart operation.
 */
function createLegacyCart(
  request: Request,
  storefront: Storefront,
  customerAccount: AppCustomerAccount,
): AppCart {
  const cart: AppCart = createCartHandler<LegacyCartMethods>({
    storefront: storefront as unknown as HydrogenStorefront,
    customerAccount,
    getCartId: cartGetIdDefault(request.headers),
    // The cart id cookie is only ever read on the server (`cartGetIdDefault`
    // parses the request header); no client code touches it. `Secure` is
    // added over https so local http development keeps working.
    setCartId: cartSetIdDefault({
      httponly: true,
      samesite: 'Lax',
      secure: isSecureRequest(request),
    }),
    cartQueryFragment: CART_QUERY_FRAGMENT,
    customMethods: {
      updateDiscountCodes: (discountCodes, optionalParams) =>
        updateDiscountCodes(cart, storefront, discountCodes, optionalParams),
    },
  });
  return cart;
}

/**
 * Hydrogen's `updateDiscountCodes` without the `@defer` its mutation uses,
 * which our JSON-only client cannot read (D-8). With a cart, the deduplicated
 * codes replace the cart's; without one, a new cart is created with them.
 * `visitorConsent` is not supported (no caller passes it).
 */
async function updateDiscountCodes(
  cart: AppCart,
  storefront: Storefront,
  discountCodes: string[],
  optionalParams?: CartOptionalInput,
): Promise<CartMutationResult> {
  const codes = [...new Set(discountCodes)];
  const cartId = optionalParams?.cartId ?? cart.getCartId();
  if (!cartId) return cart.create({discountCodes: codes}, optionalParams);

  const {cartDiscountCodesUpdate, errors} = await storefront.mutate(
    CART_DISCOUNT_CODES_UPDATE_MUTATION,
    {
      variables: {
        cartId,
        discountCodes: codes,
        country: optionalParams?.country,
        language: optionalParams?.language,
      },
    },
  );
  // Hydrogen's result shape (`formatAPIResult`), typed the way Hydrogen types
  // its own cart mutations although they only select the minimal cart fields.
  return {
    ...cartDiscountCodesUpdate,
    ...(errors ? {errors} : {}),
  } as CartMutationResult;
}
