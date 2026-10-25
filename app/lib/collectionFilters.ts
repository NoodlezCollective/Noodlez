import type {
  ProductCollectionSortKeys,
  ProductFilter,
  ProductSortKeys,
} from '@shopify/hydrogen-react/storefront-api-types';
import {isNonEmptyString, isRecord} from '~/lib/guards';

/**
 * URL conventions shared by the collection, shop-all and search routes.
 *
 * Filters follow Hydrogen's convention: every `FilterValue.input` returned by
 * the Storefront API is a JSON `ProductFilter` with a single key, e.g.
 * `{"variantOption":{"name":"Color","value":"Blue"}}`. The key becomes the
 * URL parameter name and the JSON encoded value becomes its value:
 *
 *   ?filter.variantOption=%7B%22name%22%3A%22Color%22%2C%22value%22%3A%22Blue%22%7D
 *   ?filter.available=true
 *   ?filter.productType=%22Pillow%22
 *   ?filter.price=%7B%22min%22%3A20%2C%22max%22%3A120%7D
 *
 * Several values of the same key are repeated parameters (OR within a group,
 * AND across groups, exactly like the API). Sorting uses `sort_key` and an
 * optional `reverse=true`.
 */
export const FILTER_URL_PREFIX = 'filter.';
export const SORT_KEY_PARAM = 'sort_key';
export const REVERSE_PARAM = 'reverse';
/**
 * Parameters <Pagination> (lib/pagination.tsx) appends; dropped when filters
 * change.
 */
export const PAGINATION_PARAMS = ['cursor', 'direction'] as const;

export type FilterKey = keyof ProductFilter;

const FILTER_KEYS: readonly FilterKey[] = [
  'available',
  'category',
  'price',
  'productMetafield',
  'productType',
  'productVendor',
  'tag',
  'taxonomyMetafield',
  'variantMetafield',
  'variantOption',
];

export type PriceFilter = {min?: number; max?: number};

export type AppliedFilter = {
  key: FilterKey;
  /** URL parameter name (`filter.<key>`). */
  paramName: string;
  /** JSON encoded value exactly as it appears in the URL. */
  paramValue: string;
  /** The parsed value, ready to be sent to the Storefront API. */
  value: unknown;
  filter: ProductFilter;
};

function isFilterKey(key: string): key is FilterKey {
  return (FILTER_KEYS as readonly string[]).includes(key);
}

/**
 * Only numbers and non-blank numeric strings are prices. `Number()` alone
 * would also turn `true`, `[5]` or `"  "` into 1, 5 and 0.
 */
function toNumber(value: unknown): number | undefined {
  if (typeof value === 'string') {
    if (!value.trim()) return undefined;
  } else if (typeof value !== 'number') {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : undefined;
}

/** Builds a `PriceFilter` from raw input values, dropping empty/invalid ones. */
export function toPriceFilter(min: unknown, max: unknown): PriceFilter | null {
  const price: PriceFilter = {};
  const lower = toNumber(min);
  const upper = toNumber(max);
  if (lower !== undefined) price.min = lower;
  if (upper !== undefined) price.max = upper;
  if (
    price.min !== undefined &&
    price.max !== undefined &&
    price.min > price.max
  ) {
    // Swap inverted ranges instead of returning no results.
    [price.min, price.max] = [price.max, price.min];
  }
  return price.min === undefined && price.max === undefined ? null : price;
}

/**
 * Validates a parsed URL value for a given filter key so that malformed URLs
 * never turn into invalid GraphQL variables (which would fail the whole page).
 * Object filters are rebuilt from their known fields, so nothing else the URL
 * carries is forwarded to the Storefront API.
 */
function normalizeFilterValue(key: FilterKey, value: unknown): unknown {
  switch (key) {
    case 'available':
      return typeof value === 'boolean' ? value : undefined;
    case 'productType':
    case 'productVendor':
    case 'tag':
      return isNonEmptyString(value) ? value : undefined;
    case 'price': {
      if (!isRecord(value)) return undefined;
      return toPriceFilter(value.min, value.max) ?? undefined;
    }
    case 'variantOption': {
      if (!isRecord(value)) return undefined;
      const {name, value: optionValue} = value;
      return typeof name === 'string' && typeof optionValue === 'string'
        ? {name, value: optionValue}
        : undefined;
    }
    case 'category': {
      // CategoryFilter { id: String! }
      if (!isRecord(value)) return undefined;
      return isNonEmptyString(value.id) ? {id: value.id} : undefined;
    }
    case 'productMetafield':
    case 'taxonomyMetafield':
    case 'variantMetafield': {
      // MetafieldFilter / TaxonomyMetafieldFilter { namespace, key, value }
      if (!isRecord(value)) return undefined;
      const {namespace, key: metafieldKey, value: metafieldValue} = value;
      return isNonEmptyString(namespace) &&
        isNonEmptyString(metafieldKey) &&
        isNonEmptyString(metafieldValue)
        ? {namespace, key: metafieldKey, value: metafieldValue}
        : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * `FilterValue.input` is a `JSON` scalar: a JSON string on the wire, typed
 * `unknown` by codegen. Accepts both the string and an already parsed object.
 */
export function parseFilterInput(
  input: unknown,
): Record<string, unknown> | null {
  try {
    const parsed: unknown =
      typeof input === 'string' ? JSON.parse(input) : input;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Turns one `FilterValue.input` into its URL parameter. */
export function filterInputToParam(
  input: unknown,
): {name: string; value: string; key: FilterKey} | null {
  const parsed = parseFilterInput(input);
  if (!parsed) return null;
  const [key] = Object.keys(parsed);
  if (!key || !isFilterKey(key)) return null;
  const value = normalizeFilterValue(key, parsed[key]);
  if (value === undefined) return null;
  return {
    key,
    name: `${FILTER_URL_PREFIX}${key}`,
    value: JSON.stringify(value),
  };
}

/** Reads every valid `filter.*` parameter from the URL. */
export function parseAppliedFilters(
  searchParams: URLSearchParams,
): AppliedFilter[] {
  const applied: AppliedFilter[] = [];
  for (const [paramName, paramValue] of searchParams.entries()) {
    if (!paramName.startsWith(FILTER_URL_PREFIX)) continue;
    const key = paramName.slice(FILTER_URL_PREFIX.length);
    if (!isFilterKey(key)) continue;
    let value: unknown;
    try {
      value = normalizeFilterValue(key, JSON.parse(paramValue));
    } catch {
      continue;
    }
    if (value === undefined) continue;
    applied.push({
      key,
      paramName,
      paramValue,
      value,
      filter: {[key]: value} as ProductFilter,
    });
  }
  return applied;
}

/** The `filters` variable for `collection.products(filters: $filters)`. */
export function getProductFilters(
  searchParams: URLSearchParams,
): ProductFilter[] {
  return parseAppliedFilters(searchParams).map((applied) => applied.filter);
}

export function isFilterValueActive(
  searchParams: URLSearchParams,
  input: unknown,
) {
  const param = filterInputToParam(input);
  if (!param) return false;
  return searchParams.getAll(param.name).includes(param.value);
}

export function getPriceFilter(
  searchParams: URLSearchParams,
): PriceFilter | null {
  const applied = parseAppliedFilters(searchParams).find(
    (filter) => filter.key === 'price',
  );
  return applied ? (applied.value as PriceFilter) : null;
}

function withoutPagination(searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams);
  PAGINATION_PARAMS.forEach((param) => next.delete(param));
  return next;
}

/** Removes one applied filter value (all other parameters are preserved). */
export function removeFilterParam(
  searchParams: URLSearchParams,
  applied: Pick<AppliedFilter, 'paramName' | 'paramValue'>,
) {
  const next = withoutPagination(searchParams);
  const remaining = next
    .getAll(applied.paramName)
    .filter((value) => value !== applied.paramValue);
  next.delete(applied.paramName);
  remaining.forEach((value) => next.append(applied.paramName, value));
  return next;
}

/** Drops every filter but keeps the sort order. */
export function clearFilterParams(searchParams: URLSearchParams) {
  const next = withoutPagination(searchParams);
  [...next.keys()]
    .filter((key) => key.startsWith(FILTER_URL_PREFIX))
    .forEach((key) => next.delete(key));
  return next;
}

export function countAppliedFilters(searchParams: URLSearchParams) {
  return parseAppliedFilters(searchParams).length;
}

/* -------------------------------------------------------------------------- */
/* Sorting                                                                     */
/* -------------------------------------------------------------------------- */

export type SortOption<SortKey extends string = string> = {
  /** Stable identifier used as the <option> value. */
  id: string;
  label: string;
  sortKey: SortKey;
  reverse: boolean;
};

/** Sort options for `collection.products` (ProductCollectionSortKeys). */
export const COLLECTION_SORT_OPTIONS: SortOption<ProductCollectionSortKeys>[] =
  [
    {
      id: 'featured',
      label: 'Featured',
      sortKey: 'COLLECTION_DEFAULT',
      reverse: false,
    },
    {
      id: 'best-selling',
      label: 'Best selling',
      sortKey: 'BEST_SELLING',
      reverse: false,
    },
    {
      id: 'price-asc',
      label: 'Price: low to high',
      sortKey: 'PRICE',
      reverse: false,
    },
    {
      id: 'price-desc',
      label: 'Price: high to low',
      sortKey: 'PRICE',
      reverse: true,
    },
    {id: 'newest', label: 'Newest', sortKey: 'CREATED', reverse: true},
    {
      id: 'title',
      label: 'Alphabetically: A–Z',
      sortKey: 'TITLE',
      reverse: false,
    },
  ];

/** Sort options for the root `products` connection (ProductSortKeys). */
export const CATALOG_SORT_OPTIONS: SortOption<ProductSortKeys>[] = [
  {
    id: 'best-selling',
    label: 'Best selling',
    sortKey: 'BEST_SELLING',
    reverse: false,
  },
  {
    id: 'price-asc',
    label: 'Price: low to high',
    sortKey: 'PRICE',
    reverse: false,
  },
  {
    id: 'price-desc',
    label: 'Price: high to low',
    sortKey: 'PRICE',
    reverse: true,
  },
  {id: 'newest', label: 'Newest', sortKey: 'CREATED_AT', reverse: true},
  {id: 'title', label: 'Alphabetically: A–Z', sortKey: 'TITLE', reverse: false},
];

/**
 * Resolves the active sort option from `sort_key` / `reverse`. Unknown values
 * fall back to the first (default) option so the page can never break.
 */
export function getSortOption<SortKey extends string>(
  searchParams: URLSearchParams,
  options: SortOption<SortKey>[],
): SortOption<SortKey> {
  const sortKey = searchParams.get(SORT_KEY_PARAM);
  const reverse = searchParams.get(REVERSE_PARAM) === 'true';
  return (
    options.find(
      (option) => option.sortKey === sortKey && option.reverse === reverse,
    ) ??
    options.find((option) => option.sortKey === sortKey) ??
    options[0]
  );
}

/** `sortKey` / `reverse` query variables for the active sort option. */
export function getSortVariables<SortKey extends string>(
  searchParams: URLSearchParams,
  options: SortOption<SortKey>[],
): {sortKey: SortKey; reverse: boolean} {
  const {sortKey, reverse} = getSortOption(searchParams, options);
  return {sortKey, reverse};
}

/** Applies a sort option to the URL. The default option clears the params. */
export function applySortParams(
  searchParams: URLSearchParams,
  option: SortOption,
  options: SortOption[],
) {
  const next = withoutPagination(searchParams);
  next.delete(SORT_KEY_PARAM);
  next.delete(REVERSE_PARAM);
  if (option.id !== options[0]?.id) {
    next.set(SORT_KEY_PARAM, option.sortKey);
    if (option.reverse) next.set(REVERSE_PARAM, 'true');
  }
  return next;
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

/** "$20" for whole amounts, "$19.50" otherwise (never "$19.5"). */
export function formatPrice(amount: number, currencyCode = 'USD') {
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

export function formatPriceRange(price: PriceFilter, currencyCode = 'USD') {
  const {min, max} = price;
  if (min !== undefined && max !== undefined) {
    return `${formatPrice(min, currencyCode)} – ${formatPrice(max, currencyCode)}`;
  }
  if (min !== undefined) return `From ${formatPrice(min, currencyCode)}`;
  if (max !== undefined) return `Up to ${formatPrice(max, currencyCode)}`;
  return 'Any price';
}

/** Returns the currency symbol ("$") for input prefixes. */
export function currencySymbol(currencyCode = 'USD') {
  return (
    new Intl.NumberFormat('en-US', {style: 'currency', currency: currencyCode})
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currencyCode
  );
}

/**
 * Fragment for `collection.products(...).filters`. Interpolate it into
 * collection queries next to `PRODUCT_CARD_FRAGMENT`.
 */
export const COLLECTION_FILTER_FRAGMENT = `#graphql
  fragment CollectionFilter on Filter {
    id
    label
    type
    presentation
    values {
      id
      label
      count
      input
      swatch {
        color
      }
    }
  }
` as const;
