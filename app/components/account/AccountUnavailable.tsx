import {Button} from '~/components/ui/Button';
import {UserIcon} from '~/components/ui/Icons';

/**
 * True when both Customer Account API variables are set: `SHOP_ID` and
 * `PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID`, taken from the storefront's
 * Customer Account API settings in the Shopify admin (`.dev.vars` locally,
 * Worker variables in production). An OAuth client needs both, so a partial
 * configuration counts as not configured. Customer accounts are deferred
 * (docs/hydrogen-removal-architecture.md, ADR-D): until the OAuth client is
 * ported, the stub in app/lib/customer-account/stub.server.ts answers the
 * sign-in with the same 503 page even when this returns true.
 */
export function isCustomerAccountConfigured(
  env: Pick<Env, 'SHOP_ID' | 'PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID'>,
): boolean {
  return Boolean(env.SHOP_ID && env.PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID);
}

/**
 * Rendered (with a 503 status) instead of a sign-in flow. The sign-in page
 * shows it when the Customer Account API variables are missing, and also when
 * they are set: the customer-account stub answers the sign-in with a 503 until
 * the OAuth client is ported. It never pretends to sign the shopper in.
 */
export function AccountUnavailable() {
  return (
    <section className="account-unavailable container container--text">
      <div className="account-unavailable__icon" aria-hidden="true">
        <UserIcon size={28} />
      </div>
      <p className="eyebrow">Customer accounts</p>
      <h1>Sign-in isn’t available yet</h1>
      <p className="account-unavailable__lead">
        Customer accounts on this storefront use Shopify’s Customer Account API,
        which hasn’t been connected yet. You can keep browsing and check out as
        a guest in the meantime.
      </p>
      <div className="account-unavailable__actions">
        <Button to="/collections/all">Back to shopping</Button>
        <Button to="/" variant="ghost">
          Go to homepage
        </Button>
      </div>

      <details className="account-unavailable__dev">
        <summary>For developers: enabling customer accounts</summary>
        <ol>
          <li>
            Customer accounts are deferred (see{' '}
            <code>docs/hydrogen-removal-architecture.md</code>, ADR-D): until
            the OAuth client is ported, signing in always shows this page.
          </li>
          <li>
            Set <code>PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID</code>,{' '}
            <code>PUBLIC_CUSTOMER_ACCOUNT_API_URL</code> and{' '}
            <code>SHOP_ID</code> from the storefront’s Customer Account API
            settings in the Shopify admin: in <code>.dev.vars</code> locally, as
            Worker variables in production.
          </li>
          <li>
            Port the OAuth client (ADR-D, option D1) to{' '}
            <code>app/lib/customer-account</code> and register this storefront’s{' '}
            <code>/account/authorize</code> callback URL in the Shopify admin.
          </li>
          <li>
            OAuth needs an https origin: in local development, open the dev
            server through an HTTPS tunnel and register that URL, because
            sign-in does not work on <code>http://localhost</code>.
          </li>
        </ol>
      </details>
    </section>
  );
}
