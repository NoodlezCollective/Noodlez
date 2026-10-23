import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import {Price} from '~/components/ui/Price';

type MoneyLike = Pick<MoneyV2, 'amount' | 'currencyCode'>;

/**
 * Thin wrapper around the shared <Price> component. Keeps the historical
 * `price` / `compareAtPrice` props so the PDP and cart line items can share it.
 */
export function ProductPrice({
  price,
  compareAtPrice,
  size = 'md',
  className,
}: {
  price?: MoneyLike | null;
  compareAtPrice?: MoneyLike | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  if (!price) {
    return (
      <div
        aria-label="Price"
        className={`price price--${size} ${className ?? ''}`.trim()}
        role="group"
      >
        <span>&nbsp;</span>
      </div>
    );
  }
  return (
    <Price
      price={price}
      compareAtPrice={compareAtPrice}
      size={size}
      className={className}
    />
  );
}
