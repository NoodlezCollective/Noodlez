import {useLoaderData} from 'react-router';
import type {Route} from './+types/collections.all';
import {getPaginationVariables} from '@shopify/hydrogen';
import {CollectionHeader} from '~/components/collection/CollectionHeader';
import {ProductListing} from '~/components/collection/ProductListing';
import {CATALOG_SORT_OPTIONS, getSortVariables} from '~/lib/collectionFilters';
import {PRODUCT_CARD_FRAGMENT} from '~/lib/fragments';

const TITLE = 'Shop All | Mellow';
const DESCRIPTION =
  'Every Mellow pillow, comforter, bath essential and bundle in one place.';

export const meta: Route.MetaFunction = ({data}) => {
  return [
    {title: TITLE},
    {name: 'description', content: DESCRIPTION},
    {property: 'og:title', content: TITLE},
    {property: 'og:description', content: DESCRIPTION},
    {property: 'og:type', content: 'website'},
    {
      tagName: 'link',
      rel: 'canonical',
      href: `${data?.origin ?? ''}/collections/all`,
    },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  const criticalData = await loadCriticalData(args);
  return {...criticalData};
}

/**
 * The whole catalog from the root `products` connection. Root products have
 * no filters, so this page only offers sorting (`sort_key` / `reverse`).
 */
async function loadCriticalData({context, request}: Route.LoaderArgs) {
  const {storefront} = context;
  const url = new URL(request.url);
  const paginationVariables = getPaginationVariables(request, {pageBy: 12});
  const {sortKey, reverse} = getSortVariables(
    url.searchParams,
    CATALOG_SORT_OPTIONS,
  );

  const [{products}] = await Promise.all([
    storefront.query(CATALOG_QUERY, {
      variables: {sortKey, reverse, ...paginationVariables},
    }),
  ]);

  return {origin: new URL(request.url).origin, products};
}

export default function ShopAll() {
  const {products} = useLoaderData<typeof loader>();
  const currencyCode =
    products.nodes[0]?.priceRange.minVariantPrice.currencyCode;

  return (
    <div className="collection-page container">
      <CollectionHeader
        eyebrow="Shop"
        title="Shop All"
        description={DESCRIPTION}
      />
      <ProductListing
        connection={products}
        sortOptions={CATALOG_SORT_OPTIONS}
        currencyCode={currencyCode}
      />
    </div>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/product
const CATALOG_QUERY = `#graphql
  query Catalog(
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
    $sortKey: ProductSortKeys
    $reverse: Boolean
  ) @inContext(country: $country, language: $language) {
    products(
      first: $first,
      last: $last,
      before: $startCursor,
      after: $endCursor,
      sortKey: $sortKey,
      reverse: $reverse
    ) {
      nodes {
        ...ProductCard
      }
      pageInfo {
        hasPreviousPage
        hasNextPage
        startCursor
        endCursor
      }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
` as const;
