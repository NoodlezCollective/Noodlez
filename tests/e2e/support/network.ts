/**
 * Hermetic third-party network.
 *
 * `installNetworkStubs()` is applied to every browser context by the `test`
 * fixture in ./fixtures.ts, so specs do not call it. Every request to an
 * origin other than the app under test is answered locally with an empty 200:
 *
 *   script      -> application/javascript, empty
 *   stylesheet  -> text/css, empty
 *   image       -> 1x1 transparent GIF
 *   everything else (document, fetch, media, font ...) -> text/plain, empty
 *
 * Why: the storefront loads Google Fonts on every page, and, once analytics
 * is configured, Shopify's consent script and analytics endpoints. Stubbing
 * them keeps runs identical offline, on a laptop and in CI, never sends test
 * traffic to third parties, and keeps the console free of network noise.
 *
 * Consequences specs should know about:
 * - Fonts do not load (the app falls back to system fonts), which only makes
 *   layout assertions more deterministic.
 * - Shopify's consent script is still stubbed, but it is only requested when
 *   analytics is configured (PUBLIC_CHECKOUT_DOMAIN and PUBLIC_STOREFRONT_ID
 *   set, mock off), which the mock environment never is. Were it requested,
 *   the empty script would never report `consentStatus: 'loaded'`, so no
 *   analytics event would be sent.
 * - WebSockets (Vite HMR) are not intercepted by Playwright routing and are
 *   unaffected.
 * - Requests to the app origin are never touched, including `/api/...`
 *   proxies and the Vite dev server's module requests.
 */
import type {BrowserContext, Route} from '@playwright/test';

/** 1x1 transparent GIF. */
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

async function fulfillEmpty(route: Route): Promise<void> {
  switch (route.request().resourceType()) {
    case 'script':
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '',
      });
      return;
    case 'stylesheet':
      await route.fulfill({status: 200, contentType: 'text/css', body: ''});
      return;
    case 'image':
      await route.fulfill({
        status: 200,
        contentType: 'image/gif',
        body: TRANSPARENT_GIF,
      });
      return;
    default:
      await route.fulfill({status: 200, contentType: 'text/plain', body: ''});
  }
}

/**
 * Answers every http(s) request whose origin differs from `appOrigin`
 * (for example "http://localhost:3100") with an empty 200 response.
 */
export async function installNetworkStubs(
  context: BrowserContext,
  appOrigin: string,
): Promise<void> {
  await context.route(
    (url) => /^https?:$/.test(url.protocol) && url.origin !== appOrigin,
    fulfillEmpty,
  );
}
