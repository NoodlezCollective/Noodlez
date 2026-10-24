import {cartSetIdDefault, createHydrogenContext} from '@shopify/hydrogen';
import {AppSession, isSecureRequest} from '~/lib/session';
import {CART_QUERY_FRAGMENT} from '~/lib/fragments';
import {guardStorefrontErrors} from '~/lib/storefront-errors';
import type {CartApiQueryFragment} from 'storefrontapi.generated';

// Define the additional context object
const additionalContext = {
  // Additional context for custom properties, CMS clients, 3P SDKs, etc.
  // These will be available as both context.propertyName and context.get(propertyContext)
  // Example of complex objects that could be added:
  // cms: await createCMSClient(env),
  // reviews: await createReviewsClient(env),
} as const;

// Automatically augment HydrogenAdditionalContext with the additional context type
type AdditionalContextType = typeof additionalContext;

declare global {
  interface HydrogenAdditionalContext extends AdditionalContextType {}

  // Augment HydrogenCustomCartFragment with the codegen'd cart fragment type so
  // that context.cart.get() and all cart mutations return the extended cart type.
  interface HydrogenCustomCartFragment extends CartApiQueryFragment {}
}

/**
 * Creates Hydrogen context for React Router 7.9.x
 * Returns HydrogenRouterContextProvider with hybrid access patterns
 * */
export async function createHydrogenRouterContext(
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
) {
  /**
   * Open a cache instance in the worker and a custom session instance.
   */
  if (!env?.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }

  const waitUntil = executionContext.waitUntil.bind(executionContext);
  const [cache, session] = await Promise.all([
    caches.open('hydrogen'),
    AppSession.init(request, [env.SESSION_SECRET]),
  ]);

  const hydrogenContext = createHydrogenContext(
    {
      env,
      request,
      cache,
      waitUntil,
      session,
      // Or detect from URL path based on locale subpath, cookies, or any other strategy
      i18n: {language: 'EN', country: 'US'},
      cart: {
        queryFragment: CART_QUERY_FRAGMENT,
        // The cart id cookie is only ever read on the server (`cartGetIdDefault`
        // parses the request header); no client code touches it. `Secure` is
        // added over https so local http development keeps working.
        setId: cartSetIdDefault({
          httponly: true,
          samesite: 'Lax',
          secure: isSecureRequest(request),
        }),
      },
    },
    additionalContext,
  );

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
    installMockStorefront(hydrogenContext.storefront, request);
  }

  /**
   * Reject (502) when the Storefront API answers with GraphQL errors and no
   * data, instead of handing loaders an object full of `undefined`s. Applied
   * after the mock so development behaves like production. The cart handler
   * shares this storefront object, so cart queries and mutations are covered.
   */
  guardStorefrontErrors(hydrogenContext.storefront);

  return hydrogenContext;
}
