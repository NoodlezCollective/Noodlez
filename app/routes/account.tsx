import {
  data as remixData,
  Form,
  NavLink,
  Outlet,
  redirect,
  useLoaderData,
} from 'react-router';
import type {Route} from './+types/account';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';
import {isCustomerAccountConfigured} from '~/components/account/AccountUnavailable';

export function shouldRevalidate() {
  return true;
}

export const meta: Route.MetaFunction = () => {
  return [{title: 'My account | {AppName}'}];
};

export async function loader({context}: Route.LoaderArgs) {
  const {customerAccount} = context;

  // Without the Customer Account API configuration the login route explains
  // what is missing (503) instead of attempting a sign-in.
  if (!isCustomerAccountConfigured(context.env)) {
    throw redirect('/account/login');
  }

  const {data, errors} = await customerAccount.query(CUSTOMER_DETAILS_QUERY, {
    variables: {
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    throw new Error('Customer not found');
  }

  return remixData(
    {customer: data.customer},
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
  );
}

export default function AccountLayout() {
  const {customer} = useLoaderData<typeof loader>();

  const heading = customer
    ? customer.firstName
      ? `Welcome, ${customer.firstName}`
      : `Welcome to your account.`
    : 'Account Details';

  return (
    <div className="account">
      <header className="account-header">
        <div className="container">
          <p className="eyebrow">My account</p>
          <h1 className="account-header__title">{heading}</h1>
          <AccountMenu />
        </div>
      </header>
      <div className="container account-content">
        <Outlet context={{customer}} />
      </div>
    </div>
  );
}

const ACCOUNT_LINKS = [
  {to: '/account/orders', label: 'Orders'},
  {to: '/account/profile', label: 'Profile'},
  {to: '/account/addresses', label: 'Addresses'},
];

function AccountMenu() {
  return (
    <nav className="account-tabs" aria-label="Account">
      {ACCOUNT_LINKS.map((link) => (
        <NavLink
          className={({isActive, isPending}) =>
            `account-tab ${isActive ? 'is-active' : ''} ${
              isPending ? 'is-pending' : ''
            }`.trim()
          }
          key={link.to}
          prefetch="intent"
          to={link.to}
        >
          {link.label}
        </NavLink>
      ))}
      <Logout />
    </nav>
  );
}

function Logout() {
  return (
    <Form
      className="account-tabs__logout"
      method="POST"
      action="/account/logout"
    >
      <button className="account-tab account-tab--button" type="submit">
        Sign out
      </button>
    </Form>
  );
}
