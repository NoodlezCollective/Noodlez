import {useId} from 'react';
import {Money} from '@shopify/hydrogen-react';
import type {MoneyV2} from '@shopify/hydrogen-react/storefront-api-types';
import type {PackTier} from '~/lib/content/types';

type MoneyLike = Pick<MoneyV2, 'amount' | 'currencyCode'>;

function multiply(money: MoneyLike, quantity: number): MoneyLike {
  return {
    amount: (Number(money.amount) * quantity).toFixed(2),
    currencyCode: money.currencyCode,
  };
}

/**
 * Quantity tiers ("Single", "Pair · Most popular", "Family pack") as a radio
 * group that sets the quantity added to the cart. Each tier shows its total
 * and the comparable retail total, so a shopper sees the whole saving of a
 * pair at a glance instead of multiplying unit prices.
 */
export function PackTiers({
  tiers,
  value,
  onChange,
  price,
  compareAtPrice,
  className,
}: {
  tiers: PackTier[];
  value: number;
  onChange: (quantity: number) => void;
  price?: MoneyLike | null;
  compareAtPrice?: MoneyLike | null;
  className?: string;
}) {
  const id = useId();
  if (tiers.length < 2 || !price) return null;
  const hasCompare =
    Boolean(compareAtPrice) &&
    Number(compareAtPrice?.amount) > Number(price.amount);

  return (
    <fieldset className={`pack-tiers ${className ?? ''}`.trim()}>
      <legend className="pack-tiers__legend">Choose your pack</legend>
      <div className="pack-tiers__list">
        {tiers.map((tier) => {
          const inputId = `${id}-${tier.quantity}`;
          const selected = tier.quantity === value;
          return (
            <label
              className={`pack-tier ${selected ? 'is-selected' : ''}`.trim()}
              htmlFor={inputId}
              key={tier.quantity}
            >
              <input
                className="pack-tier__input"
                id={inputId}
                type="radio"
                name={`${id}-pack`}
                value={tier.quantity}
                checked={selected}
                onChange={() => onChange(tier.quantity)}
              />
              <span className="pack-tier__body">
                <span className="pack-tier__label">{tier.label}</span>
                {tier.note ? (
                  <span className="pack-tier__note">{tier.note}</span>
                ) : null}
              </span>
              <span className="pack-tier__price">
                <Money
                  as="span"
                  className="pack-tier__total"
                  data={multiply(price, tier.quantity)}
                />
                {hasCompare && compareAtPrice ? (
                  <s className="pack-tier__compare">
                    <span className="sr-only">Comparable value </span>
                    <Money
                      as="span"
                      data={multiply(compareAtPrice, tier.quantity)}
                      withoutTrailingZeros
                    />
                  </s>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
