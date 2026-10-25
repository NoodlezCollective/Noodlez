import {Link, useLoaderData} from 'react-router';
import {Money} from '@shopify/hydrogen-react';
import type {Route} from './+types/dev.mock-checkout';
import {CartForm} from '~/lib/cart/CartForm';
import {isMockStorefrontEnabled} from '~/lib/mock/flag';
import {Button} from '~/components/ui/Button';

export const meta: Route.MetaFunction = () => [
  {title: 'Development checkout | Mellow'},
  {name: 'robots', content: 'noindex'},
];

/**
 * Stand-in for Shopify checkout while the development mock is active.
 * Real checkout happens on Shopify's checkout domain once a store is linked.
 */
export async function loader({context}: Route.LoaderArgs) {
  if (!isMockStorefrontEnabled(context.env)) {
    throw new Response('Not Found', {status: 404});
  }
  const cart = await context.cart.get();
  return {cart};
}

export default function MockCheckout() {
  const {cart} = useLoaderData<typeof loader>();
  const lines = cart?.lines?.nodes ?? [];

  return (
    <div className="container container--text section">
      <p className="eyebrow">Development mock</p>
      <h1>Checkout is not available in mock mode</h1>
      <p style={{marginTop: '1rem'}}>
        This storefront is running with <code>MOCK_STOREFRONT=true</code>, so
        the cart below lives in memory and no order can be placed. To use
        Shopify checkout, link a store: copy the storefront settings of its
        Hydrogen sales channel in the Shopify admin into <code>.dev.vars</code>{' '}
        and remove the flag.
      </p>

      {lines.length ? (
        <div className="stack" style={{marginTop: '2rem'}}>
          <ul className="stack" aria-label="Cart lines">
            {lines.map((line) => (
              <li
                key={line.id}
                style={{display: 'flex', justifyContent: 'space-between'}}
              >
                <span>
                  {line.merchandise.product.title}
                  {line.merchandise.title !== 'Default Title'
                    ? ` – ${line.merchandise.title}`
                    : ''}{' '}
                  × {line.quantity}
                </span>
                <Money as="span" data={line.cost.totalAmount} />
              </li>
            ))}
          </ul>
          <p style={{display: 'flex', justifyContent: 'space-between'}}>
            <strong>Total</strong>
            {cart?.cost?.totalAmount ? (
              <strong>
                <Money as="span" data={cart.cost.totalAmount} />
              </strong>
            ) : null}
          </p>
          <div style={{display: 'flex', gap: '0.75rem', flexWrap: 'wrap'}}>
            <Button to="/cart" variant="outline">
              Back to cart
            </Button>
            <CartForm
              route="/cart"
              action={CartForm.ACTIONS.LinesRemove}
              inputs={{lineIds: lines.map((line) => line.id)}}
            >
              <input type="hidden" name="redirectTo" value="/collections/all" />
              <Button type="submit" variant="ghost">
                Clear cart and keep shopping
              </Button>
            </CartForm>
          </div>
        </div>
      ) : (
        <p style={{marginTop: '2rem'}}>
          Your cart is empty.{' '}
          <Link className="link" to="/collections/all">
            Continue shopping
          </Link>
          .
        </p>
      )}
    </div>
  );
}
