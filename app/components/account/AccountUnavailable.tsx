import {Button} from '~/components/ui/Button';
import {UserIcon} from '~/components/ui/Icons';

/**
 * True when the Customer Account API has been configured for this storefront.
 * Both variables are provided by `npx shopify hydrogen env pull` once the
 * storefront is linked to a Shopify store.
 */
export function isCustomerAccountConfigured(
  env: Pick<Env, 'SHOP_ID' | 'PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID'>,
): boolean {
  return Boolean(env.SHOP_ID || env.PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID);
}

/**
 * Rendered (with a 503 status) instead of the sign-in flow when the Customer
 * Account API is not configured. It never pretends to sign the shopper in.
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
            Link the storefront to your Shopify store:{' '}
            <code>npx shopify hydrogen link</code>.
          </li>
          <li>
            Pull the environment variables with{' '}
            <code>npx shopify hydrogen env pull</code>. This adds{' '}
            <code>PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID</code>,{' '}
            <code>PUBLIC_CUSTOMER_ACCOUNT_API_URL</code> and{' '}
            <code>SHOP_ID</code> to <code>.env</code>.
          </li>
          <li>
            Turn on the Customer Account API for the Hydrogen storefront in the
            Shopify admin and register this storefront’s{' '}
            <code>/account/authorize</code> callback URL.
          </li>
          <li>
            In local development run{' '}
            <code>npx shopify hydrogen dev --customer-account-push</code> and
            open the tunnel URL it prints; OAuth does not work on localhost.
          </li>
        </ol>
      </details>
    </section>
  );
}
