import {useId} from 'react';
import {Money} from '@shopify/hydrogen-react';
import type {ProductAddon} from '~/lib/content/types';
import {PlusIcon} from '~/components/ui/Icons';

/**
 * One-click companion product inside the buy box ("+ Cooling Pillowcase,
 * $9.99"). Ticking it adds the item in the same add-to-cart submit, so the
 * protective layer is a convenience rather than an upsell detour.
 */
export function AddonOffer({
  addon,
  checked,
  onChange,
  className,
}: {
  addon: ProductAddon;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  const id = useId();
  if (!addon.availableForSale) return null;
  return (
    <label
      className={`addon ${checked ? 'is-selected' : ''} ${className ?? ''}`.trim()}
      htmlFor={id}
    >
      <input
        className="addon__input"
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="addon__check" aria-hidden="true">
        <PlusIcon size={14} />
      </span>
      {addon.image ? (
        <img
          className="addon__image"
          src={addon.image.url}
          alt=""
          width={56}
          height={56}
          loading="lazy"
        />
      ) : null}
      <span className="addon__body">
        <span className="addon__title">
          Add {addon.title}{' '}
          <Money as="span" className="addon__price" data={addon.price} />
        </span>
        {addon.note ? <span className="addon__note">{addon.note}</span> : null}
      </span>
    </label>
  );
}
