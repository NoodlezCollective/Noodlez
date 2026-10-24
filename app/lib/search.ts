import type {
  PredictiveSearchQuery,
  RegularSearchQuery,
} from 'storefrontapi.generated';

/** What shoppers see when the Storefront API call behind a search fails. */
export const SEARCH_UNAVAILABLE_MESSAGE =
  'Search is unavailable right now. Please try again.';

type SearchType = 'predictive' | 'regular';

type ResultWithItems<Type extends SearchType, Items> = {
  type: Type;
  term: string;
  error?: undefined;
  result: {total: number; items: Items};
};

/** A search that could not be completed: no result, only a generic message. */
export type SearchUnavailable<Type extends SearchType = SearchType> = {
  type: Type;
  term: string;
  error: string;
  result: null;
};

export type RegularSearchReturn = ResultWithItems<
  'regular',
  RegularSearchQuery
>;
export type PredictiveSearchReturn = ResultWithItems<
  'predictive',
  NonNullable<PredictiveSearchQuery['predictiveSearch']>
>;

/** Everything the `/search` loader can answer with, by search type. */
export type RegularSearchResponse =
  RegularSearchReturn | SearchUnavailable<'regular'>;
export type PredictiveSearchResponse =
  PredictiveSearchReturn | SearchUnavailable<'predictive'>;

/**
 * The failed-search value. The real cause is logged on the server; the
 * shopper only ever gets {@link SEARCH_UNAVAILABLE_MESSAGE}.
 */
export function searchUnavailable<Type extends SearchType>(
  type: Type,
  term: string,
): SearchUnavailable<Type> {
  return {type, term, error: SEARCH_UNAVAILABLE_MESSAGE, result: null};
}

/**
 * Returns the empty state of a predictive search result to reset the search state.
 */
export function getEmptyPredictiveSearchResult(): PredictiveSearchReturn['result'] {
  return {
    total: 0,
    items: {
      articles: [],
      collections: [],
      products: [],
      pages: [],
      queries: [],
    },
  };
}

/** The result of a regular search with nothing in it (no API call needed). */
export function getEmptyRegularSearchResult(): RegularSearchReturn['result'] {
  return {
    total: 0,
    items: {
      articles: {nodes: []},
      pages: {nodes: []},
      products: {
        nodes: [],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: null,
          endCursor: null,
        },
      },
    },
  };
}

const PREDICTIVE_LIMIT_MIN = 1;
const PREDICTIVE_LIMIT_MAX = 10;

/**
 * The `limit` of a predictive search as an integer between 1 and 10. Anything
 * that is not a number (`abc`, empty, `NaN`) means the default, 10.
 */
export function parseSearchLimit(value: string | null | undefined): number {
  const raw = value?.trim();
  const parsed = raw ? Number(raw) : Number.NaN;
  if (!Number.isFinite(parsed)) return PREDICTIVE_LIMIT_MAX;
  return Math.min(
    PREDICTIVE_LIMIT_MAX,
    Math.max(PREDICTIVE_LIMIT_MIN, Math.trunc(parsed)),
  );
}

/**
 * Whether the product connection has more pages. The search page only holds
 * one page of products (and at most 10 pages and 10 articles), so its total
 * is a lower bound whenever this is true.
 */
export function hasMoreSearchResults(
  items: RegularSearchQuery | null | undefined,
): boolean {
  return items?.products?.pageInfo?.hasNextPage === true;
}

/** "12 results", or "12+ results" when more exist than were fetched. */
export function formatSearchTotal(total: number, hasMore: boolean): string {
  const count = new Intl.NumberFormat('en-US').format(total);
  if (hasMore) return `${count}+ results`;
  return `${count} ${total === 1 ? 'result' : 'results'}`;
}

/**
 * The text a screen reader should hear for the predictive search drawer, which
 * keeps it in a live region: "Searching…", the result count, or the failure.
 */
export function getPredictiveStatusMessage({
  state,
  term,
  total,
  error,
}: {
  state: 'idle' | 'loading' | 'submitting';
  term: string;
  total: number;
  error?: string | null;
}): string {
  if (!term) return '';
  if (state !== 'idle') return 'Searching…';
  if (error) return error;
  return total > 0
    ? `${formatSearchTotal(total, false)} for ${term}`
    : `No results for ${term}`;
}

interface UrlWithTrackingParams {
  /** The base URL to which the tracking parameters will be appended. */
  baseUrl: string;
  /** The trackingParams returned by the Storefront API. */
  trackingParams?: string | null;
  /** Any additional query parameters to be appended to the URL. */
  params?: Record<string, string>;
  /** The search term to be appended to the URL. */
  term: string;
}

/**
 * A utility function that appends tracking parameters to a URL. Tracking parameters are
 * used internally by Shopify to enhance search results and admin dashboards.
 * The term is encoded once, by URLSearchParams.
 * @example
 * ```ts
 * const baseUrl = 'www.example.com';
 * const trackingParams = 'utm_source=shopify&utm_medium=shopify_app&utm_campaign=storefront';
 * const params = { foo: 'bar' };
 * const term = 'search term';
 * const url = urlWithTrackingParams({ baseUrl, trackingParams, params, term });
 * console.log(url);
 * // Output: 'www.example.com?foo=bar&q=search+term&utm_source=shopify&utm_medium=shopify_app&utm_campaign=storefront'
 * ```
 */
export function urlWithTrackingParams({
  baseUrl,
  trackingParams,
  params: extraParams,
  term,
}: UrlWithTrackingParams) {
  let search = new URLSearchParams({
    ...extraParams,
    q: term,
  }).toString();

  if (trackingParams) {
    search = `${search}&${trackingParams}`;
  }

  return `${baseUrl}?${search}`;
}
