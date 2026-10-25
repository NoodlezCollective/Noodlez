import {useEffect, useId, useRef, useState} from 'react';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';
import {CartLineItem, type CartLine} from '~/components/CartLineItem';
import {Button} from '~/components/ui/Button';
import {useOptimisticCart} from '~/lib/cart/useOptimisticCart';
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

/** Lines are rendered at the root of the cart unless they belong to a parent line. */
function isRootLine(line: CartLine) {
  return !('parentRelationship' in line && line.parentRelationship?.parent);
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
  const sectionRef = useRef<HTMLElement>(null);
  // The line the shopper just removed and where it sat in the list.
  const [removed, setRemoved] = useState<{id: string; index: number} | null>(
    null,
  );

  const lines = cart?.lines?.nodes ?? [];
  const hasLines = lines.length > 0;
  const count = cart?.totalQuantity ?? 0;
  const childrenMap = getLineItemChildrenMap(lines);
  const rootLineIds = lines.filter(isRootLine).map((line) => line.id);
  const rootLineKey = rootLineIds.join('\n');

  // The focused "remove" button disappears with its line, which would drop
  // focus to <body>. Once the line is gone (removal is optimistic), move focus
  // to the "remove" button of the line that took its place, the one before it
  // when the last line was removed, or the heading of the empty cart.
  useEffect(() => {
    if (!removed || rootLineKey.split('\n').includes(removed.id)) return;
    setRemoved(null);
    const active = document.activeElement;
    if (active && active !== document.body) return; // the shopper moved on
    const section = sectionRef.current;
    const buttons = section?.querySelectorAll<HTMLElement>(
      '.cart-lines > .cart-line > .cart-line__body .cart-line__remove',
    );
    const target = buttons?.length
      ? buttons[Math.min(removed.index, buttons.length - 1)]
      : section?.querySelector<HTMLElement>('.cart__empty .empty-state__title');
    target?.focus();
  }, [removed, rootLineKey]);

  const handleRemove = (lineId: string) => {
    const index = rootLineIds.indexOf(lineId);
    if (index !== -1) setRemoved({id: lineId, index});
  };

  return (
    <section
      ref={sectionRef}
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
                if (!isRootLine(line)) return null;
                return (
                  <CartLineItem
                    key={line.id}
                    line={line}
                    layout={layout}
                    childrenMap={childrenMap}
                    onRemove={handleRemove}
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
        {/* Focus lands here when the last line is removed. */}
        <h2 className="empty-state__title" tabIndex={-1}>
          Your cart is empty
        </h2>
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
