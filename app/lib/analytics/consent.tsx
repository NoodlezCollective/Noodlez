import {getTrackingValues} from '@shopify/hydrogen-react';
import {useEffect, useRef, useState} from 'react';
import {useRevalidator} from 'react-router';
import type {ConsentConfig} from './config';
import {loadConsentScript, type ConsentScriptOutcome} from './consent-script';
import {
  consentStateOf,
  createFailureLogger,
  type ConsentState,
  type CustomerPrivacyLike,
} from './events';

/**
 * Shopify's Customer Privacy API in the browser, set up the way Hydrogen
 * 2026.4.7's useCustomerPrivacy did, without the privacy banner. Only rendered
 * when analytics are enabled; the reading of the consent is in events.ts
 * (consentStateOf), the script in consent-script.ts.
 */

export {CONSENT_API_URL} from './consent-script';

/** Dispatched on `document` by the Customer Privacy API. */
const CONSENT_API_LOADED_EVENT = 'consentTrackingApiLoaded';
const VISITOR_CONSENT_COLLECTED_EVENT = 'visitorConsentCollected';
const CONSENT_API_FAILED_MESSAGE = 'The Customer Privacy API failed';

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
type ScriptStatus = ConsentScriptOutcome | 'loading';

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
 * revalidated so server-side Storefront API calls use the new tokens. A
 * failing API (token readers that throw) is logged once and never reaches
 * React, so the page keeps rendering.
 */
export function CustomerPrivacyLoader({
  config,
  nonce,
  onReady,
}: CustomerPrivacyLoaderProps): null {
  const {revalidate} = useRevalidator();
  const callbacks = useRef({onReady, revalidate});
  const trackingTokens = useRef<TrackingTokens | null>(null);
  const [logFailure] = useState(() =>
    createFailureLogger(CONSENT_API_FAILED_MESSAGE),
  );
  const {storefrontAccessToken, country, language} = config;

  useEffect(() => {
    callbacks.current = {onReady, revalidate};
  });

  // Runs before the script is inserted (effects run in order), which reads
  // this config when it starts.
  useEffect(() => {
    try {
      configureCustomerPrivacy({storefrontAccessToken, country, language});
    } catch (error) {
      logFailure(error);
    }
  }, [storefrontAccessToken, country, language, logFailure]);

  const status = useConsentScript(nonce);

  useEffect(() => {
    const handleConsent = () => {
      try {
        if (!readConsentState()) return;
        const latest = readTrackingTokens();
        const previous = trackingTokens.current;
        trackingTokens.current = latest;
        if (previous && tokensChanged(previous, latest)) {
          callbacks.current.revalidate().catch(warnRevalidationFailed);
        }
        callbacks.current.onReady();
      } catch (error) {
        logFailure(error);
      }
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
  }, [status, logFailure]);

  return null;
}

/**
 * The consent script's status. consent-script.ts inserts it once per page
 * with the nonce already set, and logs a failed load once.
 */
function useConsentScript(nonce: string | undefined): ScriptStatus {
  const [status, setStatus] = useState<ScriptStatus>('loading');

  useEffect(() => {
    let active = true;
    void loadConsentScript(nonce).then((outcome) => {
      if (active) setStatus(outcome);
    });
    return () => {
      active = false;
    };
  }, [nonce]);

  return status;
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
