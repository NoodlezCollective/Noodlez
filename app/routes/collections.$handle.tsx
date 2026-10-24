import {useLoaderData} from 'react-router';
import type {Route} from './+types/collections.$handle';
import {Analytics} from '@shopify/hydrogen';
import {getPaginationVariables} from '~/lib/pagination';
import {CollectionHeader} from '~/components/collection/CollectionHeader';
import {ProductListing} from '~/components/collection/ProductListing';
import {
  COLLECTION_FILTER_FRAGMENT,
  COLLECTION_SORT_OPTIONS,
  getProductFilters,
  getSortVariables,
} from '~/lib/collectionFilters';
import {PRODUCT_CARD_FRAGMENT} from '~/lib/fragments';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {DEFAULT_DESCRIPTION} from '~/lib/seo';

export const meta: Route.MetaFunction = ({data}) => {
  if (!data?.collection) {
    return [
      {title: 'Collection not found | Mellow'},
      {name: 'robots', content: 'noindex'},
    ];
  }
  const collection = data?.collection;
  const title = `${collection?.seo?.title || collection?.title || 'Collection'} | Mellow`;
  const description =
    collection?.seo?.description ||
    collection?.description ||
    DEFAULT_DESCRIPTION;
  const image = collection?.image?.url;
  return [
    {title},
    {name: 'description', content: description},
    {property: 'og:title', content: title},
    {property: 'og:description', content: description},
    {property: 'og:type', content: 'website'},
    ...(image?.startsWith('https://')
      ? [{property: 'og:image', content: image}]
      : []),
    {
      tagName: 'link',
      rel: 'canonical',
      href: `${data?.origin ?? ''}/collections/${collection?.handle ?? ''}`,
    },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  const criticalData = await loadCriticalData(args);
  return {...criticalData};
}

/**
 * The collection with its (filtered, sorted, paginated) products is the only
 * critical data of this route. Filters and sort order are read from the URL,
 * see app/lib/collectionFilters.ts for the parameter conventions.
 */
async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;

  const url = new URL(request.url);
  const paginationVariables = getPaginationVariables(request, {pageBy: 12});
  const filters = getProductFilters(url.searchParams);
  const {sortKey, reverse} = getSortVariables(
    url.searchParams,
    COLLECTION_SORT_OPTIONS,
  );

  const {collection} = await storefront.query(COLLECTION_QUERY, {
    variables: {handle, filters, sortKey, reverse, ...paginationVariables},
  });

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {status: 404});
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: collection});

  return {collection, origin: new URL(request.url).origin};
}

export default function Collection() {
  const {collection} = useLoaderData<typeof loader>();
  const currencyCode =
    collection.products.nodes[0]?.priceRange.minVariantPrice.currencyCode;

  return (
    <div className="collection-page container">
      <CollectionHeader
        eyebrow="Collection"
        title={collection.title}
        description={collection.description}
        image={collection.image}
      />
      <ProductListing
        connection={collection.products}
        filters={collection.products.filters}
        sortOptions={COLLECTION_SORT_OPTIONS}
        currencyCode={currencyCode}
      />
      <Analytics.CollectionView
        data={{
          collection: {
            id: collection.id,
            handle: collection.handle,
          },
        }}
      />
    </div>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/collection
const COLLECTION_QUERY = `#graphql
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
    $filters: [ProductFilter!]
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      image {
        id
        url
        altText
        width
        height
      }
      seo {
        title
        description
      }
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor,
        filters: $filters,
        sortKey: $sortKey,
        reverse: $reverse
      ) {
        nodes {
          ...ProductCard
        }
        filters {
          ...CollectionFilter
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
  ${COLLECTION_FILTER_FRAGMENT}
` as const;

/** Missing collections render the designed 404 view with this route's meta. */
export {RouteErrorBoundary as ErrorBoundary} from '~/components/ErrorView';
