import {
  getClientBrowserParameters,
  sendShopifyAnalytics,
  type ShopifyAnalytics,
} from '@shopify/hydrogen-react';
import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {useLocation} from 'react-router';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {useNonce} from '~/lib/nonce';
import type {AnalyticsConfig, AnalyticsShop, ConsentConfig} from './config';
import {CustomerPrivacyLoader, readConsentState} from './consent';
import {
  createAnalyticsTracker,
  type AnalyticsTracker,
  type CollectionViewData,
  type ProductViewData,
  type SearchViewData,
} from './events';

/**
 * Replaces Hydrogen's `Analytics.Provider` and `Analytics.*View` (ADR-E1 in
 * docs/hydrogen-removal-architecture.md). The event logic is the tracker in
 * events.ts; this file only connects it to React, React Router and the
 * browser.
 */

type CartData = CartApiQueryFragment | null;

type AnalyticsProviderProps = {
  config: AnalyticsConfig;
  cart: Promise<CartData> | CartData;
  children: ReactNode;
};

/** Null outside an enabled provider: the views then do nothing. */
const AnalyticsContext = createContext<AnalyticsTracker | null>(null);

/**
 * Disabled (the default, and the e2e mock): renders the children and nothing
 * else, so no script, query, cookie or console output. Enabled: sends
 * Shopify's analytics events once the shop data and the visitor's consent
 * are known.
 */
export function AnalyticsProvider({
  config,
  cart,
  children,
}: AnalyticsProviderProps): ReactElement {
  if (!config.enabled) return <>{children}</>;
  return (
    <EnabledAnalytics shop={config.shop} consent={config.consent} cart={cart}>
      {children}
    </EnabledAnalytics>
  );
}

export function AnalyticsProductView({data}: {data: ProductViewData}): null {
  usePublish((tracker) => tracker.productViewed(data));
  return null;
}

export function AnalyticsCollectionView({
  data,
}: {
  data: CollectionViewData;
}): null {
  usePublish((tracker) => tracker.collectionViewed(data));
  return null;
}

export function AnalyticsSearchView({data}: {data: SearchViewData}): null {
  usePublish((tracker) => tracker.searchViewed(data));
  return null;
}

function EnabledAnalytics({
  shop,
  consent,
  cart,
  children,
}: {
  shop: Promise<AnalyticsShop | null>;
  consent: ConsentConfig;
  cart: AnalyticsProviderProps['cart'];
  children: ReactNode;
}) {
  const [tracker] = useState(createBrowserTracker);
  const [hasShop, setHasShop] = useState(false);
  const nonce = useNonce();

  useResolved(shop, (resolved) => {
    if (!resolved) return;
    tracker.setShop(resolved);
    startTransition(() => setHasShop(true));
  });
  useResolved(cart, tracker.cartChanged);

  // The page view publisher comes after the children: their views run first
  // and give the page view its page type (Hydrogen's order). As in Hydrogen,
  // the consent script only loads once there is shop data to send.
  return (
    <AnalyticsContext.Provider value={tracker}>
      {children}
      <PageViewPublisher />
      {hasShop ? (
        <CustomerPrivacyLoader
          config={consent}
          nonce={nonce}
          onReady={tracker.consentChanged}
        />
      ) : null}
    </AnalyticsContext.Provider>
  );
}

function PageViewPublisher(): null {
  usePublish((tracker) => tracker.pageViewed());
  return null;
}

/**
 * Like Hydrogen's AnalyticsView: publishes once per URL (pathname and
 * search) with the latest props. A no-op without an enabled provider.
 */
function usePublish(publish: (tracker: AnalyticsTracker) => void): void {
  const tracker = useContext(AnalyticsContext);
  const {pathname, search} = useLocation();
  const latestPublish = useRef(publish);

  useEffect(() => {
    latestPublish.current = publish;
  });

  useEffect(() => {
    if (tracker) latestPublish.current(tracker);
  }, [tracker, pathname, search]);
}

/** Calls `onResolved` with the value once it resolves (latest value only). */
function useResolved<T>(
  value: Promise<T> | T,
  onResolved: (resolved: T) => void,
): void {
  const latestOnResolved = useRef(onResolved);

  useEffect(() => {
    latestOnResolved.current = onResolved;
  });

  useEffect(() => {
    let active = true;
    Promise.resolve(value).then(
      (resolved) => {
        if (active) latestOnResolved.current(resolved);
      },
      // The root loader turns failed shop and cart queries into null; a
      // promise that still rejects (an aborted stream) just sends nothing.
      () => {},
    );
    return () => {
      active = false;
    };
  }, [value]);
}

function createBrowserTracker(): AnalyticsTracker {
  return createAnalyticsTracker({
    readConsent: readConsentState,
    readBrowser: getClientBrowserParameters,
    send: sendEvent,
  });
}

/** Without a shop domain the events go to monorail-edge (allowed by the CSP). */
function sendEvent(event: ShopifyAnalytics): void {
  // hydrogen-react logs a failed delivery itself before rejecting.
  sendShopifyAnalytics(event).catch(() => {});
}
