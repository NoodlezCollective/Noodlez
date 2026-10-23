import {useOptimisticCart} from '@shopify/hydrogen';
import {useId} from 'react';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';
import {CartLineItem, type CartLine} from '~/components/CartLineItem';
import {Button} from '~/components/ui/Button';
import {CartSummary} from './CartSummary';

export type CartLayout = 'page' | 'aside';

export type CartMainProps = {
  cart: CartApiQueryFragment | null;
  layout: CartLayout;
};

export type LineItemChildrenMap = {[parentId: string]: CartLine[]};
/** Returns a map of all line items and their children. */
function getLineItemChildrenMap(lines: CartLine[]): LineItemChildrenMap {
  const children: LineItemChildrenMap = {};
  for (const line of lines) {
    if ('parentRelationship' in line && line.parentRelationship?.parent) {
      const parentId = line.parentRelationship.parent.id;
      if (!children[parentId]) children[parentId] = [];
      children[parentId].push(line);
    }
    if ('lineComponents' in line) {
      const lineChildren = getLineItemChildrenMap(line.lineComponents);
      for (const [parentId, childIds] of Object.entries(lineChildren)) {
        if (!children[parentId]) children[parentId] = [];
        children[parentId].push(...childIds);
      }
    }
  }
  return children;
}

export function formatItemCount(count: number) {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

/**
 * The main cart component that displays the cart items and summary.
 * It is used by both the /cart route and the cart aside dialog.
 */
export function CartMain({layout, cart: originalCart}: CartMainProps) {
  // The useOptimisticCart hook applies pending actions to the cart
  // so the user immediately sees feedback when they modify the cart.
  const cart = useOptimisticCart(originalCart);
  const linesId = useId();

  const lines = cart?.lines?.nodes ?? [];
  const hasLines = lines.length > 0;
  const count = cart?.totalQuantity ?? 0;
  const childrenMap = getLineItemChildrenMap(lines);

  return (
    <section
      className={`cart cart--${layout}`}
      aria-label={layout === 'page' ? 'Cart' : 'Cart contents'}
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {hasLines
          ? `${formatItemCount(count)} in your cart.`
          : 'Your cart is empty.'}
      </p>

      {hasLines ? (
        <>
          <div className="cart__lines">
            <h2 id={linesId} className="sr-only">
              Items in your cart
            </h2>
            <ul className="cart-lines" aria-labelledby={linesId}>
              {lines.map((line) => {
                // we do not render non-parent lines at the root of the cart
                if (
                  'parentRelationship' in line &&
                  line.parentRelationship?.parent
                ) {
                  return null;
                }
                return (
                  <CartLineItem
                    key={line.id}
                    line={line}
                    layout={layout}
                    childrenMap={childrenMap}
                  />
                );
              })}
            </ul>
          </div>
          <CartSummary cart={cart} layout={layout} />
        </>
      ) : (
        <CartEmpty layout={layout} />
      )}
    </section>
  );
}

function CartEmpty({layout}: {layout: CartLayout}) {
  const {close} = useAside();
  return (
    <div className="cart__empty">
      <div className="empty-state">
        <h2 className="empty-state__title">Your cart is empty</h2>
        <p>
          Looks like you haven&rsquo;t added anything yet. Let&rsquo;s get you
          started on better sleep.
        </p>
        <div className="empty-state__actions">
          <Button to="/collections/all" onClick={close} prefetch="viewport">
            Shop best sellers
          </Button>
          {layout === 'aside' ? (
            <Button variant="ghost" type="button" onClick={close}>
              Continue shopping
            </Button>
          ) : (
            <Button variant="ghost" to="/">
              Continue shopping
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
