import {isMockStorefrontEnabled} from '~/lib/mock/flag';

export type NewsletterStatus =
  'subscribed' | 'invalid' | 'not_configured' | 'error' | 'mock';

export type NewsletterResult = {
  ok: boolean;
  status: NewsletterStatus;
  message: string;
};

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
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
          source,
          storefront: env.PUBLIC_STORE_DOMAIN,
          timestamp: new Date().toISOString(),
        }),
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
