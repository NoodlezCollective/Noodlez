import {getTrackingValues, useLoadScript} from '@shopify/hydrogen-react';
import {useEffect, useRef} from 'react';
import {useRevalidator} from 'react-router';
import type {ConsentConfig} from './config';
import {
  consentStateOf,
  type ConsentState,
  type CustomerPrivacyLike,
} from './events';

/**
 * Shopify's Customer Privacy API in the browser, set up the way Hydrogen
 * 2026.4.7's useCustomerPrivacy did (h:108-298 in
 * node_modules/@shopify/hydrogen/dist/development/index.js), without the
 * privacy banner (`withPrivacyBanner: false`). Only rendered when analytics
 * are enabled; the reading of the consent is in events.ts (consentStateOf).
 */

export const CONSENT_API_URL =
  'https://cdn.shopify.com/shopifycloud/consent-tracking-api/v0.2/consent-tracking-api.js';

const CONSENT_SCRIPT_ID = 'customer-privacy-api';
/** Dispatched on `document` by the Customer Privacy API. */
const CONSENT_API_LOADED_EVENT = 'consentTrackingApiLoaded';
const VISITOR_CONSENT_COLLECTED_EVENT = 'visitorConsentCollected';

type CustomerPrivacyGlobal = CustomerPrivacyLike & {
  config?: Record<string, unknown>;
};
type ShopifyGlobal = {
  country?: string;
  locale?: string;
  customerPrivacy?: CustomerPrivacyGlobal;
};
/** `window.Shopify`, typed here instead of on the global Window. */
type ShopifyWindow = Window & {Shopify?: ShopifyGlobal};

type TrackingTokens = {uniqueToken: string; visitToken: string};

/** The visitor's consent; null on the server and until the API loaded it. */
export function readConsentState(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  return consentStateOf((window as ShopifyWindow).Shopify?.customerPrivacy);
}

type CustomerPrivacyLoaderProps = {
  config: ConsentConfig;
  nonce?: string;
  /** The consent is ready, or the visitor changed it. May run repeatedly. */
  onReady: () => void;
};

/**
 * Configures the API for a headless storefront, loads its script with the
 * CSP nonce and reports when the consent is ready. When the visitor's
 * tracking tokens change after a consent change, the route data is
 * revalidated so server-side Storefront API calls use the new tokens.
 */
export function CustomerPrivacyLoader({
  config,
  nonce,
  onReady,
}: CustomerPrivacyLoaderProps): null {
  const {revalidate} = useRevalidator();
  const callbacks = useRef({onReady, revalidate});
  const trackingTokens = useRef<TrackingTokens | null>(null);
  const {storefrontAccessToken, country, language} = config;

  useEffect(() => {
    callbacks.current = {onReady, revalidate};
  });

  // Runs before the script loads (effects run in order), which reads this
  // config when it starts.
  useEffect(() => {
    configureCustomerPrivacy({storefrontAccessToken, country, language});
  }, [storefrontAccessToken, country, language]);

  const status = useLoadScript(CONSENT_API_URL, {
    attributes: scriptAttributes(nonce),
  });

  useEffect(() => {
    if (status !== 'error') return;
    console.error(
      '[analytics] Unable to load the Customer Privacy API, so no analytics events are sent.',
    );
  }, [status]);

  useEffect(() => {
    const handleConsent = () => {
      if (!readConsentState()) return;
      const latest = readTrackingTokens();
      const previous = trackingTokens.current;
      trackingTokens.current = latest;
      if (previous && tokensChanged(previous, latest)) {
        callbacks.current.revalidate().catch(warnRevalidationFailed);
      }
      callbacks.current.onReady();
    };

    handleConsent();
    document.addEventListener(CONSENT_API_LOADED_EVENT, handleConsent);
    document.addEventListener(VISITOR_CONSENT_COLLECTED_EVENT, handleConsent);
    return () => {
      document.removeEventListener(CONSENT_API_LOADED_EVENT, handleConsent);
      document.removeEventListener(
        VISITOR_CONSENT_COLLECTED_EVENT,
        handleConsent,
      );
    };
  }, [status]);

  return null;
}

/**
 * Hydrogen's headless config. Consent requests go to this origin's
 * Storefront API proxy (server.ts), so they carry the site's cookies.
 */
function configureCustomerPrivacy({
  storefrontAccessToken,
  country,
  language,
}: Pick<ConsentConfig, 'storefrontAccessToken' | 'country' | 'language'>) {
  const shopifyWindow = window as ShopifyWindow;
  const shopify = (shopifyWindow.Shopify ??= {});
  const privacy = (shopify.customerPrivacy ??= {});
  privacy.config = {
    ...privacy.config,
    isHeadless: true,
    asyncConsent: true,
    asyncVisitorState: true,
    consentDomain: window.location.host,
    storefrontAccessToken,
  };
  shopify.country = country;
  shopify.locale = language.toLowerCase();
}

function scriptAttributes(nonce: string | undefined): Record<string, string> {
  return nonce ? {id: CONSENT_SCRIPT_ID, nonce} : {id: CONSENT_SCRIPT_ID};
}

function readTrackingTokens(): TrackingTokens {
  const {uniqueToken, visitToken} = getTrackingValues();
  return {uniqueToken, visitToken};
}

function tokensChanged(previous: TrackingTokens, latest: TrackingTokens) {
  return (
    previous.uniqueToken !== latest.uniqueToken ||
    previous.visitToken !== latest.visitToken
  );
}

function warnRevalidationFailed() {
  console.warn('[analytics] Revalidating after a consent change failed.');
}
