import type {
  CurrencyCode,
  LanguageCode,
} from '@shopify/hydrogen-react/storefront-api-types';
import type {Storefront} from '~/lib/storefront/client.server';
import {
  DISABLED_ANALYTICS_CONFIG,
  getAnalyticsSettings,
  type AnalyticsConfig,
  type AnalyticsShop,
} from './config';

/**
 * The shop data analytics events carry, and the root loader's analytics
 * config. Replaces Hydrogen's `getShopAnalytics` (h:941-974 in
 * node_modules/@shopify/hydrogen/dist/development/index.js).
 */

/** Hydrogen's SHOP_QUERY, verbatim. */
export const SHOP_ANALYTICS_QUERY = `#graphql
  query ShopData(
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    shop {
      id
    }
    localization {
      country {
        currency {
          isoCode
        }
      }
      language {
        isoCode
      }
    }
  }
` as const;

type ShopData = {
  shop?: {id: string} | null;
  localization?: {
    country: {currency: {isoCode: CurrencyCode}};
    language: {isoCode: LanguageCode};
  } | null;
};

type AnalyticsEnv = Pick<
  Env,
  | 'PUBLIC_CHECKOUT_DOMAIN'
  | 'PUBLIC_STOREFRONT_ID'
  | 'MOCK_STOREFRONT'
  | 'PUBLIC_STOREFRONT_API_TOKEN'
>;

/** How private (Admin-scoped) access tokens start; public tokens never do. */
const PRIVATE_TOKEN_PREFIX = 'shpat_';

/** The shop's id, language and currency (cached with CacheLong). */
export async function getShopAnalytics({
  storefront,
  publicStorefrontId,
}: {
  storefront: Pick<Storefront, 'query' | 'CacheLong'>;
  publicStorefrontId: string;
}): Promise<AnalyticsShop> {
  const {shop, localization} = await storefront.query<ShopData>(
    SHOP_ANALYTICS_QUERY,
    {cache: storefront.CacheLong()},
  );
  if (!shop?.id || !localization) {
    throw new Error('ShopData answered without the shop or its localization');
  }
  return {
    shopId: shop.id,
    acceptedLanguage: localization.language.isoCode,
    currency: localization.country.currency.isoCode,
    hydrogenSubchannelId: publicStorefrontId,
  };
}

/**
 * The root loader's analytics config. Off (no Storefront API call at all)
 * unless the store is configured for analytics (isAnalyticsEnabled). On, the
 * shop query starts without being awaited and resolves to null when it
 * fails, so the page renders and only the analytics events are skipped. The
 * consent config carries the public token, which the browser already has;
 * a private token in PUBLIC_STOREFRONT_API_TOKEN turns analytics off instead
 * of reaching every visitor, with one server log per request.
 */
export function getAnalyticsConfig({
  env,
  storefront,
}: {
  env: AnalyticsEnv;
  storefront: Pick<Storefront, 'query' | 'CacheLong' | 'i18n'>;
}): AnalyticsConfig {
  const settings = getAnalyticsSettings(env);
  if (!settings) return DISABLED_ANALYTICS_CONFIG;
  if (isPrivateToken(env.PUBLIC_STOREFRONT_API_TOKEN)) {
    console.error(
      `[analytics] Analytics are off: PUBLIC_STOREFRONT_API_TOKEN holds a private access token (${PRIVATE_TOKEN_PREFIX}), which must never reach the browser. Set the sales channel's public Storefront API token instead.`,
    );
    return DISABLED_ANALYTICS_CONFIG;
  }

  return {
    enabled: true,
    shop: getShopAnalytics({
      storefront,
      publicStorefrontId: settings.storefrontId,
    }).catch(shopUnavailable),
    consent: {
      storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN,
      country: storefront.i18n.country,
      language: storefront.i18n.language,
    },
  };
}

function isPrivateToken(token: string | undefined): boolean {
  return (token ?? '').trim().startsWith(PRIVATE_TOKEN_PREFIX);
}

function shopUnavailable(error: unknown): null {
  console.error(
    `[analytics] No shop data, so this page sends no analytics events: ${describeFailure(error)}`,
  );
  return null;
}

/** A thrown Response (the Storefront errors guard) logs as its status. */
function describeFailure(error: unknown): string {
  if (error instanceof Response) return `HTTP ${error.status}`;
  if (error instanceof Error) return error.message;
  return String(error);
}
