import type {CartLineUpdateInput} from '@shopify/hydrogen-react/storefront-api-types';
import type {CartLayout, LineItemChildrenMap} from '~/components/CartMain';
import {CartForm, type OptimisticCartLine} from '@shopify/hydrogen';
import {Image, Money} from '@shopify/hydrogen-react';
import {useVariantUrl} from '~/lib/variants';
import {Link} from 'react-router';
import {Price} from '~/components/ui/Price';
import {MinusIcon, PlusIcon, TrashIcon} from '~/components/ui/Icons';
import {useAside} from './Aside';
import type {CartApiQueryFragment} from 'storefrontapi.generated';

export type CartLine = OptimisticCartLine<CartApiQueryFragment>;

/**
 * A single line item in the cart: product image, title, selected options,
 * unit price, quantity stepper, remove button and line total.
 * If the line is a parent line that has child components (like warranties or
 * gift wrapping), they are rendered nested below the parent line.
 */
export function CartLineItem({
  layout,
  line,
  childrenMap,
  onRemove,
}: {
  layout: CartLayout;
  line: CartLine;
  childrenMap: LineItemChildrenMap;
  /** Called when the shopper activates "remove" (lets the cart restore focus). */
  onRemove?: (lineId: string) => void;
}) {
  const {id, merchandise, isOptimistic} = line;
  const {product, title, image, selectedOptions} = merchandise;
  const lineItemUrl = useVariantUrl(product.handle, selectedOptions);
  const {close} = useAside();
  const lineItemChildren = childrenMap[id];
  const childrenLabelId = `cart-line-children-${id}`;
  const options = selectedOptions.filter(
    (option) => option.value !== 'Default Title',
  );
  const closeIfAside = () => {
    if (layout === 'aside') close();
  };

  return (
    <li
      key={id}
      className={`cart-line ${isOptimistic ? 'is-optimistic' : ''}`.trim()}
    >
      <Link
        className="cart-line__media"
        prefetch="intent"
        to={lineItemUrl}
        onClick={closeIfAside}
        tabIndex={-1}
        aria-hidden="true"
      >
        {image ? (
          <Image
            alt={image.altText || title}
            aspectRatio="1/1"
            data={image}
            height={96}
            loading="lazy"
            width={96}
            sizes="96px"
          />
        ) : null}
      </Link>

      <div className="cart-line__body">
        <div className="cart-line__header">
          <div className="cart-line__heading">
            <Link
              className="cart-line__title"
              prefetch="intent"
              to={lineItemUrl}
              onClick={closeIfAside}
            >
              {product.title}
            </Link>
            {options.length ? (
              <p className="cart-line__options">
                {options.map((option, index) => (
                  <span key={option.name}>
                    {index > 0 ? ' · ' : ''}
                    {option.name}: {option.value}
                  </span>
                ))}
              </p>
            ) : null}
          </div>
          {line.cost?.totalAmount ? (
            <Money className="cart-line__total" data={line.cost.totalAmount} />
          ) : null}
        </div>

        <Price
          className="cart-line__price"
          price={line.cost?.amountPerQuantity}
          compareAtPrice={line.cost?.compareAtAmountPerQuantity}
          size="sm"
        />

        <div className="cart-line__actions">
          <CartLineQuantity line={line} />
          <CartLineRemoveButton
            lineIds={[id]}
            disabled={!!isOptimistic}
            productTitle={product.title}
            onRemove={() => onRemove?.(id)}
          />
        </div>
      </div>

      {lineItemChildren ? (
        <div className="cart-line__children-wrap">
          <p id={childrenLabelId} className="sr-only">
            Line items with {product.title}
          </p>
          <ul aria-labelledby={childrenLabelId} className="cart-line__children">
            {lineItemChildren.map((childLine) => (
              <CartLineItem
                childrenMap={childrenMap}
                key={childLine.id}
                line={childLine}
                layout={layout}
                onRemove={onRemove}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Provides the controls to update the quantity of a line item in the cart.
 * These controls are disabled when the line item is new, and the server
 * hasn't yet responded that it was successfully added to the cart.
 */
function CartLineQuantity({line}: {line: CartLine}) {
  if (!line || typeof line?.quantity === 'undefined') return null;
  const {id: lineId, quantity, isOptimistic} = line;
  const prevQuantity = Number(Math.max(0, quantity - 1).toFixed(0));
  const nextQuantity = Number((quantity + 1).toFixed(0));
  // Removing is the trash button's job; "decrease" stops at 1. It is
  // `aria-disabled` rather than `disabled` so the focused button keeps focus
  // when it reaches 1 (a disabled button drops focus to <body>).
  const atMinimum = quantity <= 1;

  return (
    <div className="qty" role="group" aria-label="Quantity">
      <CartLineUpdateButton lines={[{id: lineId, quantity: prevQuantity}]}>
        <button
          aria-label="Decrease quantity"
          aria-disabled={atMinimum || undefined}
          className="qty__btn"
          disabled={!!isOptimistic}
          name="decrease-quantity"
          onClick={(event) => {
            if (atMinimum) event.preventDefault();
          }}
          type="submit"
          value={prevQuantity}
        >
          <MinusIcon size={16} />
        </button>
      </CartLineUpdateButton>
      <span className="qty__value">
        <span className="sr-only">Quantity </span>
        {quantity}
      </span>
      <CartLineUpdateButton lines={[{id: lineId, quantity: nextQuantity}]}>
        <button
          aria-label="Increase quantity"
          className="qty__btn"
          disabled={!!isOptimistic}
          name="increase-quantity"
          type="submit"
          value={nextQuantity}
        >
          <PlusIcon size={16} />
        </button>
      </CartLineUpdateButton>
    </div>
  );
}

/**
 * A button that removes a line item from the cart. It is disabled
 * when the line item is new, and the server hasn't yet responded
 * that it was successfully added to the cart.
 */
function CartLineRemoveButton({
  lineIds,
  disabled,
  productTitle,
  onRemove,
}: {
  lineIds: string[];
  disabled: boolean;
  productTitle: string;
  onRemove?: () => void;
}) {
  return (
    <CartForm
      fetcherKey={getUpdateKey(lineIds)}
      route="/cart"
      action={CartForm.ACTIONS.LinesRemove}
      inputs={{lineIds}}
    >
      <button
        aria-label={`Remove ${productTitle} from cart`}
        className="icon-btn cart-line__remove"
        disabled={disabled}
        onClick={onRemove}
        type="submit"
      >
        <TrashIcon size={20} />
      </button>
    </CartForm>
  );
}

function CartLineUpdateButton({
  children,
  lines,
}: {
  children: React.ReactNode;
  lines: CartLineUpdateInput[];
}) {
  const lineIds = lines.map((line) => line.id);

  return (
    <CartForm
      fetcherKey={getUpdateKey(lineIds)}
      route="/cart"
      action={CartForm.ACTIONS.LinesUpdate}
      inputs={{lines}}
    >
      {children}
    </CartForm>
  );
}

/**
 * Returns a unique key for the update action. This is used to make sure actions modifying the same line
 * items are not run concurrently, but cancel each other. For example, if the user clicks "Increase quantity"
 * and "Decrease quantity" in rapid succession, the actions will cancel each other and only the last one will run.
 * @param lineIds - line ids affected by the update
 * @returns
 */
function getUpdateKey(lineIds: string[]) {
  return [CartForm.ACTIONS.LinesUpdate, ...lineIds].join('-');
}
