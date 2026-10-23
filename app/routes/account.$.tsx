import {data, redirect} from 'react-router';
import type {Route} from './+types/account.$';
import {
  AccountUnavailable,
  isCustomerAccountConfigured,
} from '~/components/account/AccountUnavailable';

// fallback wild card for all unauthenticated routes in account section
export async function loader({context}: Route.LoaderArgs) {
  if (!isCustomerAccountConfigured(context.env)) {
    return data({configured: false as const}, {status: 503});
  }

  await context.customerAccount.handleAuthStatus();

  return redirect('/account');
}

/** Only rendered when customer accounts are not configured (see loader). */
export default function AccountCatchAll() {
  return <AccountUnavailable />;
}
