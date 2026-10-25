/**
 * Shopify's Customer Privacy API script (consent-tracking-api v0.2, as
 * Hydrogen 2026.4.7 loaded it), inserted at most once per page. Browser
 * only: call it from an effect.
 *
 * Replaces hydrogen-react's loadScript, which appended the element first and
 * set its attributes afterwards: the fetch had started by then, so the CSP
 * nonce never applied (the script loaded only because the CSP lists
 * https://cdn.shopify.com). Here every attribute, the nonce included, is set
 * before the element is inserted.
 */

export const CONSENT_API_URL =
  'https://cdn.shopify.com/shopifycloud/consent-tracking-api/v0.2/consent-tracking-api.js';

export const CONSENT_SCRIPT_ID = 'customer-privacy-api';

/** How the one insertion of the script ended. */
export type ConsentScriptOutcome = 'loaded' | 'failed';

const LOAD_FAILED_MESSAGE =
  '[analytics] Unable to load the Customer Privacy API, so no analytics events are sent.';

/** The page's one insertion; never retried, as with hydrogen-react. */
let insertion: Promise<ConsentScriptOutcome> | undefined;

/**
 * Inserts the script on the first call and answers every call with the
 * outcome of that one insertion, so remounted loaders never insert it again.
 * A failed load is logged once.
 */
export function loadConsentScript(
  nonce: string | undefined,
): Promise<ConsentScriptOutcome> {
  insertion ??= insertConsentScript(nonce);
  return insertion;
}

function insertConsentScript(
  nonce: string | undefined,
): Promise<ConsentScriptOutcome> {
  const script = document.createElement('script');
  script.src = CONSENT_API_URL;
  script.async = true;
  script.id = CONSENT_SCRIPT_ID;
  if (nonce) script.setAttribute('nonce', nonce);
  const outcome = new Promise<ConsentScriptOutcome>((resolve) => {
    // The first of `load` and `error` decides; a later one is ignored.
    let settled = false;
    const settle = (result: ConsentScriptOutcome) => {
      if (settled) return;
      settled = true;
      if (result === 'failed') console.error(LOAD_FAILED_MESSAGE);
      resolve(result);
    };
    script.addEventListener('load', () => settle('loaded'));
    script.addEventListener('error', () => settle('failed'));
  });
  document.body.appendChild(script);
  return outcome;
}
