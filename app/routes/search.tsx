import {useEffect, useRef} from 'react';
import {data, useLoaderData, useNavigation} from 'react-router';
import type {Route} from './+types/search';
import {Analytics} from '@shopify/hydrogen';
import {getPaginationVariables} from '~/lib/pagination';
import {SearchForm} from '~/components/SearchForm';
import {SearchResults} from '~/components/SearchResults';
import {Button} from '~/components/ui/Button';
import {SearchIcon} from '~/components/ui/Icons';
import {PRODUCT_CARD_FRAGMENT} from '~/lib/fragments';
import {
  type RegularSearchReturn,
  type PredictiveSearchReturn,
  formatSearchTotal,
  getEmptyPredictiveSearchResult,
  getEmptyRegularSearchResult,
  parseSearchLimit,
  searchUnavailable,
} from '~/lib/search';
import type {
  RegularSearchQuery,
  PredictiveSearchQuery,
} from 'storefrontapi.generated';

export const meta: Route.MetaFunction = ({data}) => {
  const term = data?.type === 'regular' ? data.term : '';
  const title = term
    ? `Search results for “${term}” | Mellow`
    : 'Search | Mellow';
  return [
    {title},
    {
      name: 'description',
      content:
        'Search Mellow pillows, comforters, bath essentials and bundles.',
    },
    {name: 'robots', content: 'noindex'},
  ];
};

/** The trimmed `q` search parameter. */
function readTerm(url: URL) {
  return String(url.searchParams.get('q') || '').trim();
}

export async function loader({request, context}: Route.LoaderArgs) {
  const url = new URL(request.url);
  const type = url.searchParams.has('predictive') ? 'predictive' : 'regular';

  try {
    return type === 'predictive'
      ? await predictiveSearch({request, context})
      : await regularSearch({request, context});
  } catch (error) {
    // The real cause (often a raw GraphQL message) stays in the server log;
    // the shopper gets a generic message and a 503.
    console.error(`[search] ${type} search failed`, error);
    return data(searchUnavailable(type, readTerm(url)), {status: 503});
  }
}

const SEARCH_INPUT_ID = 'search-page-input';

/**
 * Renders the /search route
 */
export default function SearchPage() {
  const response = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const refocusInput = useRef(false);

  // The form is keyed by the term, so a new search replaces its input; hand
  // keyboard focus back to the field once the results have loaded.
  useEffect(() => {
    if (navigation.state !== 'idle' || !refocusInput.current) return;
    refocusInput.current = false;
    document.getElementById(SEARCH_INPUT_ID)?.focus();
  }, [navigation.state]);

  if (response.type === 'predictive') return null;

  const {term, result, error} = response;
  const total = result?.total ?? 0;
  const hasResults = Boolean(term) && total > 0;

  return (
    <div className="search-page container">
      <header className="page-header page-header--center search-header">
        <p className="eyebrow page-header__eyebrow">Search</p>
        <h1>Search</h1>
        {/* Keyed by the term so the input follows the URL (chips, Back). */}
        <SearchForm
          key={term}
          action="/search"
          className="search-form"
          onSubmit={() => {
            refocusInput.current = true;
          }}
        >
          {({inputRef}) => (
            <div className="search-form__field">
              <label className="sr-only" htmlFor={SEARCH_INPUT_ID}>
                Search products, pages and articles
              </label>
              <SearchIcon className="search-form__icon" size={22} />
              <input
                id={SEARCH_INPUT_ID}
                defaultValue={term}
                name="q"
                placeholder="Search pillows, comforters, bundles…"
                ref={inputRef}
                type="search"
                autoComplete="off"
              />
              <Button type="submit">Search</Button>
            </div>
          )}
        </SearchForm>
      </header>

      {error ? (
        <p className="search-error" role="alert">
          {error}
        </p>
      ) : null}

      {hasResults ? (
        <p className="search-summary" aria-live="polite">
          {formatSearchTotal(total, false)} for <q>{term}</q>
        </p>
      ) : null}

      {error ? null : !hasResults ? (
        <SearchResults.Empty term={term} />
      ) : (
        <SearchResults result={result} term={term}>
          {({articles, pages, products, term}) => (
            <div className="search-results">
              <SearchResults.Products products={products} term={term} />
              {pages?.nodes.length || articles?.nodes.length ? (
                <div className="search-results__secondary">
                  <SearchResults.Pages pages={pages} term={term} />
                  <SearchResults.Articles articles={articles} term={term} />
                </div>
              ) : null}
            </div>
          )}
        </SearchResults>
      )}
      {term && result ? (
        <Analytics.SearchView
          data={{searchTerm: term, searchResults: result}}
        />
      ) : null}
    </div>
  );
}

/**
 * Regular search query and fragments
 * (adjust as needed)
 */
const SEARCH_PRODUCT_FRAGMENT = `#graphql
  fragment SearchProduct on Product {
    __typename
    ...ProductCard
    publishedAt
    trackingParameters
  }
` as const;

const SEARCH_PAGE_FRAGMENT = `#graphql
  fragment SearchPage on Page {
     __typename
     handle
    id
    title
    trackingParameters
  }
` as const;

const SEARCH_ARTICLE_FRAGMENT = `#graphql
  fragment SearchArticle on Article {
    __typename
    handle
    id
    title
    trackingParameters
    blog {
      handle
    }
  }
` as const;

const PAGE_INFO_FRAGMENT = `#graphql
  fragment PageInfoFragment on PageInfo {
    hasNextPage
    hasPreviousPage
    startCursor
    endCursor
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/search
export const SEARCH_QUERY = `#graphql
  query RegularSearch(
    $country: CountryCode
    $endCursor: String
    $first: Int
    $language: LanguageCode
    $last: Int
    $term: String!
    $startCursor: String
  ) @inContext(country: $country, language: $language) {
    articles: search(
      query: $term,
      types: [ARTICLE],
      first: 10,
    ) {
      nodes {
        ...on Article {
          ...SearchArticle
        }
      }
    }
    pages: search(
      query: $term,
      types: [PAGE],
      first: 10,
    ) {
      nodes {
        ...on Page {
          ...SearchPage
        }
      }
    }
    products: search(
      after: $endCursor,
      before: $startCursor,
      first: $first,
      last: $last,
      query: $term,
      sortKey: RELEVANCE,
      types: [PRODUCT],
      unavailableProducts: HIDE,
    ) {
      totalCount
      nodes {
        ...on Product {
          ...SearchProduct
        }
      }
      pageInfo {
        ...PageInfoFragment
      }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
  ${SEARCH_PRODUCT_FRAGMENT}
  ${SEARCH_PAGE_FRAGMENT}
  ${SEARCH_ARTICLE_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
` as const;

/**
 * Regular search fetcher
 */
async function regularSearch({
  request,
  context,
}: Pick<
  Route.LoaderArgs,
  'request' | 'context'
>): Promise<RegularSearchReturn> {
  const {storefront} = context;
  const url = new URL(request.url);
  const variables = getPaginationVariables(request, {pageBy: 12});
  const term = readTerm(url);

  // Nothing to look for: no API call, and no empty search sent to analytics.
  if (!term) {
    return {type: 'regular', term, result: getEmptyRegularSearchResult()};
  }

  // Search articles, pages, and products for the `q` term
  const {
    errors,
    ...items
  }: {errors?: Array<{message: string}>} & RegularSearchQuery =
    await storefront.query(SEARCH_QUERY, {
      variables: {...variables, term},
    });

  if (errors?.length) {
    throw new Error(
      `Shopify API errors: ${errors.map(({message}: {message: string}) => message).join(', ')}`,
    );
  }

  // Products are paginated, so count them from the connection's totalCount
  // (every page reports the same number); pages and articles are fetched whole.
  const total =
    (items.products?.totalCount ?? items.products?.nodes.length ?? 0) +
    (items.pages?.nodes.length ?? 0) +
    (items.articles?.nodes.length ?? 0);

  return {type: 'regular', term, result: {total, items}};
}

/**
 * Predictive search query and fragments
 * (adjust as needed)
 */
const PREDICTIVE_SEARCH_ARTICLE_FRAGMENT = `#graphql
  fragment PredictiveArticle on Article {
    __typename
    id
    title
    handle
    blog {
      handle
    }
    image {
      url
      altText
      width
      height
    }
    trackingParameters
  }
` as const;

const PREDICTIVE_SEARCH_COLLECTION_FRAGMENT = `#graphql
  fragment PredictiveCollection on Collection {
    __typename
    id
    title
    handle
    image {
      url
      altText
      width
      height
    }
    trackingParameters
  }
` as const;

const PREDICTIVE_SEARCH_PAGE_FRAGMENT = `#graphql
  fragment PredictivePage on Page {
    __typename
    id
    title
    handle
    trackingParameters
  }
` as const;

const PREDICTIVE_SEARCH_PRODUCT_FRAGMENT = `#graphql
  fragment PredictiveProduct on Product {
    __typename
    id
    title
    handle
    trackingParameters
    selectedOrFirstAvailableVariant(
      selectedOptions: []
      ignoreUnknownOptions: true
      caseInsensitiveMatch: true
    ) {
      id
      image {
        url
        altText
        width
        height
      }
      price {
        amount
        currencyCode
      }
      compareAtPrice {
        amount
        currencyCode
      }
    }
  }
` as const;

const PREDICTIVE_SEARCH_QUERY_FRAGMENT = `#graphql
  fragment PredictiveQuery on SearchQuerySuggestion {
    __typename
    text
    trackingParameters
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/predictiveSearch
const PREDICTIVE_SEARCH_QUERY = `#graphql
  query PredictiveSearch(
    $country: CountryCode
    $language: LanguageCode
    $limit: Int!
    $limitScope: PredictiveSearchLimitScope!
    $term: String!
    $types: [PredictiveSearchType!]
  ) @inContext(country: $country, language: $language) {
    predictiveSearch(
      limit: $limit,
      limitScope: $limitScope,
      query: $term,
      types: $types,
    ) {
      articles {
        ...PredictiveArticle
      }
      collections {
        ...PredictiveCollection
      }
      pages {
        ...PredictivePage
      }
      products {
        ...PredictiveProduct
      }
      queries {
        ...PredictiveQuery
      }
    }
  }
  ${PREDICTIVE_SEARCH_ARTICLE_FRAGMENT}
  ${PREDICTIVE_SEARCH_COLLECTION_FRAGMENT}
  ${PREDICTIVE_SEARCH_PAGE_FRAGMENT}
  ${PREDICTIVE_SEARCH_PRODUCT_FRAGMENT}
  ${PREDICTIVE_SEARCH_QUERY_FRAGMENT}
` as const;

/**
 * Predictive search fetcher
 */
async function predictiveSearch({
  request,
  context,
}: Pick<
  Route.ActionArgs,
  'request' | 'context'
>): Promise<PredictiveSearchReturn> {
  const {storefront} = context;
  const url = new URL(request.url);
  const term = readTerm(url);
  const limit = parseSearchLimit(url.searchParams.get('limit'));
  const type = 'predictive';

  if (!term) return {type, term, result: getEmptyPredictiveSearchResult()};

  // Predictively search articles, collections, pages, products, and queries (suggestions)
  const {
    predictiveSearch: items,
    errors,
  }: PredictiveSearchQuery & {errors?: Array<{message: string}>} =
    await storefront.query(PREDICTIVE_SEARCH_QUERY, {
      variables: {
        // customize search options as needed
        limit,
        limitScope: 'EACH',
        term,
      },
    });

  if (errors) {
    throw new Error(
      `Shopify API errors: ${errors.map(({message}: {message: string}) => message).join(', ')}`,
    );
  }

  if (!items) {
    throw new Error('No predictive search data returned from Shopify API');
  }

  // Query suggestions only feed the <datalist>; they are not listed results,
  // so they do not count towards what the live region announces.
  const total = Object.entries(items).reduce(
    (acc: number, [key, item]) =>
      key === 'queries' ? acc : acc + (item as Array<unknown>).length,
    0,
  );

  return {type, term, result: {items, total}};
}
