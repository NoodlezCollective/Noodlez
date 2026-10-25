import {useEffect, useRef, useState, type RefObject} from 'react';
import {Link} from 'react-router';
import type {CollectionFilterFragment} from 'storefrontapi.generated';
import {CloseIcon} from '~/components/ui/Icons';
import {
  filterInputToParam,
  formatPriceRange,
  removeFilterParam,
  type AppliedFilter,
  type PriceFilter,
} from '~/lib/collectionFilters';

export type FilterChip = {
  id: string;
  label: string;
  /** URL that removes this filter. */
  href: string;
};

function fallbackLabel(applied: AppliedFilter) {
  const {key, value} = applied;
  if (key === 'available') return value ? 'In stock' : 'Out of stock';
  if (key === 'variantOption') return (value as {value: string}).value;
  if (typeof value === 'string') return value;
  return key;
}

/** Turns the applied URL filters into labelled, removable chips. */
export function buildFilterChips({
  applied,
  filters,
  params,
  pathname,
  currencyCode,
}: {
  applied: AppliedFilter[];
  filters: CollectionFilterFragment[];
  params: URLSearchParams;
  pathname: string;
  currencyCode?: string;
}): FilterChip[] {
  const labels = new Map<string, string>();
  for (const filter of filters) {
    if (filter.type === 'PRICE_RANGE') continue;
    for (const value of filter.values) {
      const param = filterInputToParam(value.input);
      if (param) labels.set(`${param.name}=${param.value}`, value.label);
    }
  }

  return applied.map((filter) => {
    const search = removeFilterParam(params, filter).toString();
    const label =
      filter.key === 'price'
        ? formatPriceRange(filter.value as PriceFilter, currencyCode)
        : (labels.get(`${filter.paramName}=${filter.paramValue}`) ??
          fallbackLabel(filter));
    return {
      id: `${filter.paramName}=${filter.paramValue}`,
      label,
      href: `${pathname}${search ? `?${search}` : ''}`,
    };
  });
}

/** What the shopper just activated; focus is restored once the chips update. */
type PendingFocus = {kind: 'chip'; id: string; index: number} | {kind: 'all'};

export function ActiveFilters({
  chips,
  clearHref,
  fallbackFocusRef,
}: {
  chips: FilterChip[];
  clearHref: string;
  /** Receives focus when the last chip is gone and no chip or control is left. */
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<PendingFocus | null>(null);
  const chipKey = chips.map((chip) => chip.id).join('\n');

  // Removing a chip unmounts the focused link, which would drop focus to
  // <body>. Once the chip is gone, focus the next chip, else "Clear all", else
  // (nothing left) the fallback, e.g. the result count.
  useEffect(() => {
    if (!pending) return;
    const ids = chipKey ? chipKey.split('\n') : [];
    if (pending.kind === 'chip' ? ids.includes(pending.id) : ids.length) return;
    setPending(null);
    const active = document.activeElement;
    if (active && active !== document.body) return; // the shopper moved on
    const root = rootRef.current;
    const nextChip =
      pending.kind === 'chip'
        ? root?.querySelectorAll<HTMLElement>('.chip')[pending.index]
        : null;
    (
      nextChip ??
      root?.querySelector<HTMLElement>('.active-filters__clear') ??
      fallbackFocusRef?.current
    )?.focus();
  }, [chipKey, pending, fallbackFocusRef]);

  if (!chips.length) return null;
  return (
    <div className="active-filters" ref={rootRef}>
      <ul className="active-filters__list" aria-label="Active filters">
        {chips.map((chip, index) => (
          <li key={chip.id}>
            <Link
              className="chip"
              to={chip.href}
              preventScrollReset
              aria-label={`Remove filter: ${chip.label}`}
              onClick={() => setPending({kind: 'chip', id: chip.id, index})}
            >
              <span>{chip.label}</span>
              <CloseIcon size={14} />
            </Link>
          </li>
        ))}
      </ul>
      <Link
        className="active-filters__clear link"
        to={clearHref}
        preventScrollReset
        onClick={() => setPending({kind: 'all'})}
      >
        Clear all
      </Link>
    </div>
  );
}
