import {Link} from 'react-router';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {ProductCard} from '~/components/ProductCard';
import {ProductGridSkeleton} from '~/components/collection/ProductGridSkeleton';
import {Button} from '~/components/ui/Button';
import {ArrowRightIcon} from '~/components/ui/Icons';
import {urlWithTrackingParams, type RegularSearchReturn} from '~/lib/search';

type SearchItems = RegularSearchReturn['result']['items'];
type PartialSearchResult<ItemType extends keyof SearchItems> = Pick<
  SearchItems,
  ItemType
> &
  Pick<RegularSearchReturn, 'term'>;

type SearchProductNode = SearchItems['products']['nodes'][number];

type SearchResultsProps = RegularSearchReturn & {
  children: (args: SearchItems & {term: string}) => React.ReactNode;
};

const CARD_SIZES = '(min-width: 64em) 30vw, (min-width: 40em) 50vw, 100vw';

/** Search terms suggested on the empty state. */
const SUGGESTED_TERMS = [
  'pillow',
  'cooling comforter',
  'body pillow',
  'bundle',
];

export function SearchResults({
  term,
  result,
  children,
}: Omit<SearchResultsProps, 'error' | 'type'>) {
  if (!result?.total) {
    return null;
  }

  return children({...result.items, term});
}

SearchResults.Articles = SearchResultsArticles;
SearchResults.Pages = SearchResultsPages;
SearchResults.Products = SearchResultsProducts;
SearchResults.Empty = SearchResultsEmpty;

function SearchResultsArticles({
  term,
  articles,
}: PartialSearchResult<'articles'>) {
  if (!articles?.nodes.length) {
    return null;
  }

  return (
    <section
      className="search-section"
      aria-labelledby="search-articles-heading"
    >
      <h2
        id="search-articles-heading"
        className="eyebrow search-section__title"
      >
        Articles
      </h2>
      <ul className="search-links">
        {articles.nodes.map((article) => {
          const articleUrl = urlWithTrackingParams({
            baseUrl: `/blogs/${article.blog.handle}/${article.handle}`,
            trackingParams: article.trackingParameters,
            term,
          });

          return (
            <li key={article.id}>
              <Link className="search-link" prefetch="intent" to={articleUrl}>
                <span>{article.title}</span>
                <ArrowRightIcon size={16} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SearchResultsPages({term, pages}: PartialSearchResult<'pages'>) {
  if (!pages?.nodes.length) {
    return null;
  }

  return (
    <section className="search-section" aria-labelledby="search-pages-heading">
      <h2 id="search-pages-heading" className="eyebrow search-section__title">
        Pages
      </h2>
      <ul className="search-links">
        {pages.nodes.map((page) => {
          const pageUrl = urlWithTrackingParams({
            baseUrl: `/pages/${page.handle}`,
            trackingParams: page.trackingParameters,
            term,
          });

          return (
            <li key={page.id}>
              <Link className="search-link" prefetch="intent" to={pageUrl}>
                <span>{page.title}</span>
                <ArrowRightIcon size={16} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SearchResultsProducts({products}: PartialSearchResult<'products'>) {
  if (!products?.nodes.length) {
    return null;
  }

  return (
    <section
      className="search-section"
      aria-labelledby="search-products-heading"
    >
      <h2
        id="search-products-heading"
        className="eyebrow search-section__title"
      >
        Products
      </h2>
      <PaginatedResourceSection<SearchProductNode>
        connection={products}
        resourcesClassName="product-grid"
        ariaLabel="Product results"
        loadingFallback={<ProductGridSkeleton count={3} inline />}
      >
        {({node: product, index}) => (
          <ProductCard
            key={product.id}
            product={product}
            loading={index < 6 ? 'eager' : 'lazy'}
            sizes={CARD_SIZES}
          />
        )}
      </PaginatedResourceSection>
    </section>
  );
}

function SearchResultsEmpty({term}: {term?: string}) {
  return (
    <div className="empty-state search-empty">
      <p className="empty-state__title">
        {term ? (
          <>
            No results for <q>{term}</q>
          </>
        ) : (
          'What are you looking for?'
        )}
      </p>
      <p>
        {term
          ? 'Check the spelling or try a broader term. You can also browse everything we make for better sleep.'
          : 'Search by product, fabric or feeling. Popular searches:'}
      </p>
      <ul className="search-empty__suggestions" aria-label="Suggested searches">
        {SUGGESTED_TERMS.map((suggestion) => (
          <li key={suggestion}>
            <Link
              className="chip chip--link"
              to={`/search?q=${encodeURIComponent(suggestion)}`}
            >
              {suggestion}
            </Link>
          </li>
        ))}
      </ul>
      <div className="empty-state__actions">
        <Button to="/collections/all">Shop all products</Button>
        <Button to="/collections" variant="outline">
          Browse collections
        </Button>
      </div>
    </div>
  );
}
