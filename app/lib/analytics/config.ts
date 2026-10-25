import type {
  CountryCode,
  CurrencyCode,
  LanguageCode,
} from '@shopify/hydrogen-react/storefront-api-types';
import {isMockStorefrontEnabled} from '~/lib/mock/flag';

/**
 * Analytics and consent configuration (docs/hydrogen-removal-plan.md, Phase
 * 4c; ADR-E1 in docs/hydrogen-removal-architecture.md). Client-safe: the
 * root loader builds the config on the server (shop.server.ts) and the
 * provider (provider.tsx) reads it in the browser.
 */

/** What every Shopify analytics event says about the shop. */
export type AnalyticsShop = {
  /** `gid://shopify/Shop/<id>` */
  shopId: string;
  acceptedLanguage: LanguageCode;
  currency: CurrencyCode;
  /** The Hydrogen sales channel's storefront id (PUBLIC_STOREFRONT_ID). */
  hydrogenSubchannelId: string;
};

/** How the browser sets up Shopify's Customer Privacy API. */
export type ConsentConfig = {
  checkoutDomain: string;
  /** The public Storefront API token, which the browser already holds. */
  storefrontAccessToken: string;
  withPrivacyBanner: false;
  country: CountryCode;
  language: LanguageCode;
};

export type AnalyticsConfig =
  | {enabled: false; shop: null; consent: null}
  | {
      enabled: true;
      /** Resolves to null when the shop data could not be loaded. */
      shop: Promise<AnalyticsShop | null>;
      consent: ConsentConfig;
    };

/** Analytics off: no shop query, no consent script, no events. */
export const DISABLED_ANALYTICS_CONFIG: AnalyticsConfig = Object.freeze({
  enabled: false,
  shop: null,
  consent: null,
});

type AnalyticsEnv = Pick<
  Env,
  'PUBLIC_CHECKOUT_DOMAIN' | 'PUBLIC_STOREFRONT_ID' | 'MOCK_STOREFRONT'
>;

/** The two variables analytics need, once both are set. */
export type AnalyticsSettings = {checkoutDomain: string; storefrontId: string};

/**
 * Owner decision ADR-E1: analytics run only for a store with both
 * PUBLIC_CHECKOUT_DOMAIN and PUBLIC_STOREFRONT_ID set, and never while the
 * development mock serves the Storefront API (the e2e suite). Production
 * builds cannot run the mock, so MOCK_STOREFRONT does not matter there.
 */
export function isAnalyticsEnabled(env: AnalyticsEnv): boolean {
  return getAnalyticsSettings(env) !== null;
}

/** The analytics variables when analytics run (isAnalyticsEnabled), else null. */
export function getAnalyticsSettings(
  env: AnalyticsEnv,
): AnalyticsSettings | null {
  const {
    PUBLIC_CHECKOUT_DOMAIN: checkoutDomain,
    PUBLIC_STOREFRONT_ID: storefrontId,
  } = env;
  if (!isSet(checkoutDomain) || !isSet(storefrontId)) return null;
  if (isMockStorefrontEnabled(env)) return null;
  return {checkoutDomain, storefrontId};
}

/** A variable counts as set when it holds more than whitespace. */
function isSet(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim() !== '';
}
