import {Money} from '@shopify/hydrogen-react';
import type {MoneyV2} from '@shopify/hydrogen-react/storefront-api-types';

type MoneyLike = Pick<MoneyV2, 'amount' | 'currencyCode'>;

export function isDiscounted(
  price?: MoneyLike | null,
  compareAtPrice?: MoneyLike | null,
) {
  if (!price || !compareAtPrice) return false;
  return Number(compareAtPrice.amount) > Number(price.amount);
}

/**
 * Current price with an optional struck-through compare-at price.
 * Compare-at prices drop trailing zeros ("$100") to match the reference design.
 */
export function Price({
  price,
  compareAtPrice,
  size = 'md',
  className,
  showFrom,
}: {
  price?: MoneyLike | null;
  compareAtPrice?: MoneyLike | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Prefix with "From" for ranged prices. */
  showFrom?: boolean;
}) {
  if (!price) return null;
  const onSale = isDiscounted(price, compareAtPrice);
  return (
    <div
      className={`price price--${size} ${onSale ? 'price--sale' : ''} ${
        className ?? ''
      }`.trim()}
      aria-label="Price"
      role="group"
    >
      {showFrom ? <span className="price__from">From</span> : null}
      <Money className="price__current" data={price} />
      {onSale && compareAtPrice ? (
        <s className="price__compare">
          <span className="sr-only">Regular price </span>
          <Money data={compareAtPrice} withoutTrailingZeros />
        </s>
      ) : null}
    </div>
  );
}
