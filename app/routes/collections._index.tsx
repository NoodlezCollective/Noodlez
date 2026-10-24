import {useLoaderData} from 'react-router';
import type {Route} from './+types/collections._index';
import {getPaginationVariables} from '@shopify/hydrogen';
import type {CollectionFragment} from 'storefrontapi.generated';
import {CollectionCard} from '~/components/collection/CollectionCard';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {Button} from '~/components/ui/Button';

const TITLE = 'Collections | Mellow';
const DESCRIPTION =
  'Browse Mellow by category: ergonomic pillows, adaptive comforters, plush bath essentials and money-saving bundles.';

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
      href: `${data?.origin ?? ''}/collections`,
    },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  const criticalData = await loadCriticalData(args);
  return {...criticalData};
}

async function loadCriticalData({context, request}: Route.LoaderArgs) {
  const paginationVariables = getPaginationVariables(request, {pageBy: 12});

  const {collections} = await context.storefront.query(COLLECTIONS_QUERY, {
    variables: paginationVariables,
  });

  return {origin: new URL(request.url).origin, collections};
}

export default function Collections() {
  const {collections} = useLoaderData<typeof loader>();

  return (
    <div className="collections-page container">
      <header className="page-header page-header--center collections-header">
        <p className="eyebrow page-header__eyebrow">Browse</p>
        <h1>Collections</h1>
        <p className="page-header__description">
          Find your perfect sleep setup: pillows, comforters, bath essentials
          and bundles, all designed to make sleep effortless.
        </p>
        <div className="collections-header__actions">
          <Button to="/collections/all" variant="outline">
            Shop all products
          </Button>
        </div>
      </header>
      <PaginatedResourceSection<CollectionFragment>
        connection={collections}
        resourcesClassName="collection-grid"
        ariaLabel="Collections"
        emptyState={
          <div className="empty-state">
            <p className="empty-state__title">No collections yet</p>
            <p>Browse every product while we organise the shelves.</p>
            <div className="empty-state__actions">
              <Button to="/collections/all">Shop all</Button>
            </div>
          </div>
        }
      >
        {({node: collection, index}) => (
          <CollectionCard
            key={collection.id}
            collection={collection}
            loading={index < 6 ? 'eager' : 'lazy'}
          />
        )}
      </PaginatedResourceSection>
    </div>
  );
}

const COLLECTIONS_QUERY = `#graphql
  fragment Collection on Collection {
    id
    title
    handle
    description
    image {
      id
      url
      altText
      width
      height
    }
  }
  query StoreCollections(
    $country: CountryCode
    $endCursor: String
    $first: Int
    $language: LanguageCode
    $last: Int
    $startCursor: String
  ) @inContext(country: $country, language: $language) {
    collections(
      first: $first,
      last: $last,
      before: $startCursor,
      after: $endCursor
    ) {
      nodes {
        ...Collection
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
` as const;
