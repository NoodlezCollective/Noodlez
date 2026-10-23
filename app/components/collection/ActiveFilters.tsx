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

export function ActiveFilters({
  chips,
  clearHref,
}: {
  chips: FilterChip[];
  clearHref: string;
}) {
  if (!chips.length) return null;
  return (
    <div className="active-filters">
      <ul className="active-filters__list" aria-label="Active filters">
        {chips.map((chip) => (
          <li key={chip.id}>
            <Link
              className="chip"
              to={chip.href}
              preventScrollReset
              aria-label={`Remove filter: ${chip.label}`}
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
      >
        Clear all
      </Link>
    </div>
  );
}
