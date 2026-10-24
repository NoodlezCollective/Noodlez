import {isMockStorefrontEnabled} from '~/lib/mock/flag';

export type NewsletterStatus =
  'subscribed' | 'invalid' | 'not_configured' | 'error' | 'mock';

export type NewsletterResult = {
  ok: boolean;
  status: NewsletterStatus;
  message: string;
};

/** Longest address RFC 5321 allows. Anything longer is rejected unread. */
const MAX_EMAIL_LENGTH = 254;
/** Label recorded when the form did not send a usable `source`. */
const DEFAULT_SOURCE = 'storefront';
const MAX_SOURCE_LENGTH = 32;
const SOURCE_PATTERN = /^[a-z0-9_-]+$/;
/** The signup request must not hold a worker open for a slow webhook. */
const WEBHOOK_TIMEOUT_MS = 5000;
/** A signup form posts a few hundred bytes; anything bigger is not a signup. */
export const MAX_NEWSLETTER_BODY_BYTES = 8 * 1024;

/**
 * Sanity check for a signup address (the browser's `type="email"` input and
 * the mail provider do the strict validation). Every step is a bounded string
 * operation: no regular expression is ever run against unbounded user input,
 * so hostile payloads cannot burn CPU through backtracking.
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string' || email.length > MAX_EMAIL_LENGTH) {
    return false;
  }
  const value = email.trim();
  const at = value.indexOf('@');
  // Exactly one "@" with something in front of it.
  if (at < 1 || at !== value.lastIndexOf('@')) return false;
  if (/\s/.test(value)) return false;

  // Control characters are never valid. The other characters are legal in
  // theory but only ever turn up in payloads aimed at whoever opens the
  // subscriber list downstream (spreadsheet formulas such as `=cmd|…`, markup).
  const local = value.slice(0, at);
  for (const char of local) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return false;
  }
  if (/[<>"\\,;:()[\]|]/.test(local) || /^[=+\-@]/.test(local)) {
    return false;
  }

  const domain = value.slice(at + 1);
  const lastDot = domain.lastIndexOf('.');
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
    return false;
  }
  // A dot with a label before it and a top-level domain of 2+ characters.
  return lastDot > 0 && domain.length - lastDot - 1 >= 2;
}

/**
 * The signup `source` ("footer", "homepage", …) is attacker-controlled form
 * data that ends up in the webhook payload: only short lower-case slugs pass.
 */
export function normalizeNewsletterSource(source: string): string {
  return typeof source === 'string' &&
    source.length <= MAX_SOURCE_LENGTH &&
    SOURCE_PATTERN.test(source)
    ? source
    : DEFAULT_SOURCE;
}

const HTTP_STATUS_BY_RESULT: Record<NewsletterStatus, number> = {
  subscribed: 200,
  mock: 200,
  invalid: 400,
  error: 502,
  not_configured: 503,
};

/** HTTP status the `/newsletter` action answers with for a result. */
export function getNewsletterHttpStatus({
  status,
}: Pick<NewsletterResult, 'status'>): number {
  return HTTP_STATUS_BY_RESULT[status];
}

/**
 * Newsletter signups are forwarded to NEWSLETTER_WEBHOOK_URL (Shopify Flow,
 * Klaviyo, Zapier …) as JSON. Shopify's Storefront API has no public
 * marketing-subscription mutation, so without a configured webhook the form
 * reports that the integration is not connected rather than faking success.
 */
export async function subscribeToNewsletter({
  email,
  source,
  env,
}: {
  email: string;
  source: string;
  env: Env;
}): Promise<NewsletterResult> {
  if (!isValidEmail(email)) {
    return {
      ok: false,
      status: 'invalid',
      message: 'Enter a valid email address.',
    };
  }

  if (env.NEWSLETTER_WEBHOOK_URL) {
    try {
      const response = await fetch(env.NEWSLETTER_WEBHOOK_URL, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          email: email.trim(),
          source: normalizeNewsletterSource(source),
          storefront: env.PUBLIC_STORE_DOMAIN,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`Newsletter webhook responded with ${response.status}`);
      }
      return {
        ok: true,
        status: 'subscribed',
        message: "You're on the list. Welcome to Mellow.",
      };
    } catch (error) {
      console.error('[newsletter] webhook failed', error);
      return {
        ok: false,
        status: 'error',
        message: 'We could not sign you up right now. Please try again.',
      };
    }
  }

  if (isMockStorefrontEnabled(env)) {
    return {
      ok: true,
      status: 'mock',
      message:
        'Development mock: no email service is connected, so this signup was not recorded.',
    };
  }

  return {
    ok: false,
    status: 'not_configured',
    message: 'Newsletter signup is not connected yet. Please check back soon.',
  };
}
