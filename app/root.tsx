import {Analytics, getShopAnalytics, useNonce} from '@shopify/hydrogen';
import {
  Outlet,
  useRouteError,
  isRouteErrorResponse,
  type ShouldRevalidateFunction,
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from 'react-router';
import type {Route} from './+types/root';
import favicon from '~/assets/favicon.svg';
import {FOOTER_QUERY, HEADER_QUERY} from '~/lib/fragments';
import {SITE_SETTINGS_QUERY, mapSiteSettings} from '~/lib/content/metaobjects';
import {SHOPIFY_RESOURCES} from '~/lib/content/config';
import {isMockStorefrontEnabled} from '~/lib/mock/flag';
import type {HydrogenStorefront} from '~/lib/storefront/hydrogen-compat';
import {DEFAULT_DESCRIPTION, DEFAULT_TITLE} from '~/lib/seo';
import tokenStyles from '~/styles/tokens.css?url';
import resetStyles from '~/styles/reset.css?url';
import appStyles from '~/styles/app.css?url';
import productStyles from '~/styles/product.css?url';
import collectionStyles from '~/styles/collection.css?url';
import cartStyles from '~/styles/cart.css?url';
import accountStyles from '~/styles/account.css?url';
import contentStyles from '~/styles/content.css?url';
import {PageLayout} from './components/PageLayout';
import {ErrorView} from './components/ErrorView';

export type RootLoader = typeof loader;

const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap';

/**
 * This is important to avoid re-fetching root queries on sub-navigations
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formMethod,
  currentUrl,
  nextUrl,
}) => {
  // revalidate when a mutation is performed e.g add to cart, login...
  if (formMethod && formMethod !== 'GET') return true;

  // revalidate when manually revalidating via useRevalidator
  if (currentUrl.toString() === nextUrl.toString()) return true;

  // Defaulting to no revalidation for root loader data to improve performance.
  // When using this feature, you risk your UI getting out of sync with your server.
  // Use with caution. If you are uncomfortable with this optimization, update the
  // line below to `return defaultShouldRevalidate` instead.
  // For more details see: https://remix.run/docs/en/main/route/should-revalidate
  return false;
};

/**
 * The stylesheets are added in the Layout component (not in `links`) to
 * prevent a bug in development HMR updates ("failed to execute 'insertBefore'
 * on 'Node'"). See https://github.com/remix-run/remix/issues/9242
 */
export function links() {
  return [
    {rel: 'preconnect', href: 'https://cdn.shopify.com'},
    {rel: 'preconnect', href: 'https://shop.app'},
    {rel: 'preconnect', href: 'https://fonts.googleapis.com'},
    {
      rel: 'preconnect',
      href: 'https://fonts.gstatic.com',
      crossOrigin: 'anonymous' as const,
    },
    {rel: 'stylesheet', href: FONTS_URL},
    {rel: 'icon', type: 'image/svg+xml', href: favicon},
  ];
}

export const meta: Route.MetaFunction = () => [
  {title: DEFAULT_TITLE},
  {name: 'description', content: DEFAULT_DESCRIPTION},
  {property: 'og:type', content: 'website'},
];

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  const {storefront, env} = args.context;

  return {
    ...deferredData,
    ...criticalData,
    publicStoreDomain: env.PUBLIC_STORE_DOMAIN,
    isMockStorefront: isMockStorefrontEnabled(env),
    shop: getShopAnalytics({
      storefront: storefront as unknown as HydrogenStorefront,
      // getShopAnalytics' own default when no storefront id is configured.
      publicStorefrontId: env.PUBLIC_STOREFRONT_ID ?? '0',
    }),
    consent: {
      checkoutDomain: env.PUBLIC_CHECKOUT_DOMAIN,
      storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN,
      withPrivacyBanner: false,
      // localize the privacy banner
      country: args.context.storefront.i18n.country,
      language: args.context.storefront.i18n.language,
    },
  };
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context}: Route.LoaderArgs) {
  const {storefront} = context;

  const [header, settingsData] = await Promise.all([
    storefront.query(HEADER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        headerMenuHandle: SHOPIFY_RESOURCES.headerMenuHandle,
      },
    }),
    // Global storefront settings (announcement bar, trust badges, savings
    // copy). Optional: defaults apply when the metaobject does not exist yet.
    storefront
      .query(SITE_SETTINGS_QUERY, {cache: storefront.CacheLong()})
      .catch((error: Error) => {
        console.error(error);
        return null;
      }),
  ]);

  return {
    header,
    siteSettings: mapSiteSettings(settingsData?.settings?.nodes?.[0]),
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  const {storefront, customerAccount, cart} = context;

  // defer the footer query (below the fold)
  const footer = storefront
    .query(FOOTER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        footerMenuHandle: SHOPIFY_RESOURCES.footerMenuHandle,
      },
    })
    .catch((error: Error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });

  return {
    // Hydrogen's CartAnalytics awaits this promise without a catch, so a
    // rejected cart query (502 from the Storefront API guard) would surface as
    // an unhandled rejection in the browser; the header and drawer already
    // render their own fallbacks for a null cart.
    cart: cart.get().catch((error: Error) => {
      console.error(error);
      return null;
    }),
    isLoggedIn: customerAccount.isLoggedIn(),
    footer,
  };
}

export function Layout({children}: {children?: React.ReactNode}) {
  const nonce = useNonce();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="theme-color" content="#4c4184" />
        <meta property="og:site_name" content="Mellow" />
        <link rel="stylesheet" href={tokenStyles}></link>
        <link rel="stylesheet" href={resetStyles}></link>
        <link rel="stylesheet" href={appStyles}></link>
        <link rel="stylesheet" href={productStyles}></link>
        <link rel="stylesheet" href={collectionStyles}></link>
        <link rel="stylesheet" href={cartStyles}></link>
        <link rel="stylesheet" href={accountStyles}></link>
        <link rel="stylesheet" href={contentStyles}></link>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  const data = useRouteLoaderData<RootLoader>('root');

  if (!data) {
    return <Outlet />;
  }

  return (
    <Analytics.Provider
      cart={data.cart}
      shop={data.shop}
      consent={data.consent}
    >
      <PageLayout {...data}>
        <Outlet />
      </PageLayout>
    </Analytics.Provider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const rootData = useRouteLoaderData<RootLoader>('root');
  let errorMessage = 'Unknown error';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorMessage = error?.data?.message ?? error.data;
    errorStatus = error.status;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  const view = <ErrorView status={errorStatus} message={errorMessage} />;

  if (rootData) {
    return <PageLayout {...rootData}>{view}</PageLayout>;
  }

  return view;
}
