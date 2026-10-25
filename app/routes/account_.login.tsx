import {data} from 'react-router';
import type {Route} from './+types/account_.login';
import {
  AccountUnavailable,
  isCustomerAccountConfigured,
} from '~/components/account/AccountUnavailable';

export const meta: Route.MetaFunction = () => {
  return [{title: 'Sign in | Mellow'}, {name: 'robots', content: 'noindex'}];
};

export async function loader({request, context}: Route.LoaderArgs) {
  // Without the Customer Account API configuration there is nothing to sign
  // in to: explain the situation instead of faking a sign-in.
  if (!isCustomerAccountConfigured(context.env)) {
    return data({configured: false as const}, {status: 503});
  }

  const url = new URL(request.url);
  const acrValues = url.searchParams.get('acr_values') || undefined;
  const loginHint = url.searchParams.get('login_hint') || undefined;
  const loginHintMode = url.searchParams.get('login_hint_mode') || undefined;
  const locale = url.searchParams.get('locale') || undefined;

  return context.customerAccount.login({
    countryCode: context.storefront.i18n.country,
    acrValues,
    loginHint,
    loginHintMode,
    locale,
  });
}

/** Only rendered when customer accounts are not configured (see loader). */
export default function Login() {
  return <AccountUnavailable />;
}
