import {Link, useFetcher, type Fetcher} from 'react-router';
import {Image} from '@shopify/hydrogen-react';
import React, {useRef, useEffect, useId} from 'react';
import {
  getEmptyPredictiveSearchResult,
  getPredictiveStatusMessage,
  urlWithTrackingParams,
  type PredictiveSearchResponse,
  type PredictiveSearchReturn,
} from '~/lib/search';
import {Price} from '~/components/ui/Price';
import {useAside} from './Aside';

type PredictiveSearchItems = PredictiveSearchReturn['result']['items'];

type UsePredictiveSearchReturn = {
  term: React.MutableRefObject<string>;
  total: number;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  items: PredictiveSearchItems;
  fetcher: ReturnType<typeof useFetcher<PredictiveSearchResponse>>;
};

type SearchResultsPredictiveArgs = Pick<
  UsePredictiveSearchReturn,
  'term' | 'total' | 'inputRef' | 'items'
> & {
  state: Fetcher['state'];
  closeSearch: () => void;
};

type PartialPredictiveSearchResult<
  ItemType extends keyof PredictiveSearchItems,
  ExtraProps extends keyof SearchResultsPredictiveArgs = 'term' | 'closeSearch',
> = Pick<PredictiveSearchItems, ItemType> &
  Pick<SearchResultsPredictiveArgs, ExtraProps>;

type SearchResultsPredictiveProps = {
  children: (args: SearchResultsPredictiveArgs) => React.ReactNode;
};

type ThumbnailImage = {
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
};

/**
 * Component that renders predictive search results
 */
export function SearchResultsPredictive({
  children,
}: SearchResultsPredictiveProps) {
  const aside = useAside();
  const {term, inputRef, fetcher, total, items} = usePredictiveSearch();

  /*
   * Utility that resets the search input
   */
  function resetInput() {
    if (inputRef.current) {
      inputRef.current.blur();
      inputRef.current.value = '';
    }
  }

  /**
   * Utility that resets the search input and closes the search aside. The
   * fetcher is reset as well: otherwise the cleared input would show the
   * previous search's results again the next time the drawer opens.
   */
  function closeSearch() {
    resetInput();
    term.current = '';
    fetcher.reset();
    aside.close();
  }

  return (
    <>
      {/* Screen readers: "Searching…", then the count (or the failure). */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {getPredictiveStatusMessage({
          state: fetcher.state,
          term: term.current,
          total,
          error: fetcher.data?.error,
        })}
      </div>
      {children({
        items,
        closeSearch,
        inputRef,
        state: fetcher.state,
        term,
        total,
      })}
    </>
  );
}

SearchResultsPredictive.Articles = SearchResultsPredictiveArticles;
SearchResultsPredictive.Collections = SearchResultsPredictiveCollections;
SearchResultsPredictive.Pages = SearchResultsPredictivePages;
SearchResultsPredictive.Products = SearchResultsPredictiveProducts;
SearchResultsPredictive.Queries = SearchResultsPredictiveQueries;
SearchResultsPredictive.Empty = SearchResultsPredictiveEmpty;

/** 56px rounded thumbnail with a lavender placeholder. */
function ResultThumbnail({
  image,
  alt,
}: {
  image?: ThumbnailImage | null;
  alt: string;
}) {
  return (
    <span className="predictive-search-result-item__media" aria-hidden="true">
      {image?.url ? (
        <Image
          alt={alt}
          data={image}
          aspectRatio="1/1"
          width={56}
          height={56}
          sizes="56px"
          loading="lazy"
        />
      ) : null}
    </span>
  );
}

function ResultGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section className="predictive-search-result" aria-labelledby={id}>
      <h4 id={id} className="eyebrow predictive-search-result__heading">
        {title}
      </h4>
      <ul className="predictive-search-result__list">{children}</ul>
    </section>
  );
}

function SearchResultsPredictiveArticles({
  term,
  articles,
  closeSearch,
}: PartialPredictiveSearchResult<'articles'>) {
  if (!articles.length) return null;

  return (
    <ResultGroup title="Articles">
      {articles.map((article) => {
        const articleUrl = urlWithTrackingParams({
          baseUrl: `/blogs/${article.blog.handle}/${article.handle}`,
          trackingParams: article.trackingParameters,
          term: term.current ?? '',
        });

        return (
          <li className="predictive-search-result-item" key={article.id}>
            <Link
              className="predictive-search-result-item__link"
              onClick={closeSearch}
              to={articleUrl}
            >
              <ResultThumbnail image={article.image} alt="" />
              <span className="predictive-search-result-item__body">
                <span className="predictive-search-result-item__title">
                  {article.title}
                </span>
                <span className="predictive-search-result-item__meta">
                  Article
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ResultGroup>
  );
}

function SearchResultsPredictiveCollections({
  term,
  collections,
  closeSearch,
}: PartialPredictiveSearchResult<'collections'>) {
  if (!collections.length) return null;

  return (
    <ResultGroup title="Collections">
      {collections.map((collection) => {
        const collectionUrl = urlWithTrackingParams({
          baseUrl: `/collections/${collection.handle}`,
          trackingParams: collection.trackingParameters,
          term: term.current,
        });

        return (
          <li className="predictive-search-result-item" key={collection.id}>
            <Link
              className="predictive-search-result-item__link"
              onClick={closeSearch}
              to={collectionUrl}
            >
              <ResultThumbnail image={collection.image} alt="" />
              <span className="predictive-search-result-item__body">
                <span className="predictive-search-result-item__title">
                  {collection.title}
                </span>
                <span className="predictive-search-result-item__meta">
                  Collection
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ResultGroup>
  );
}

function SearchResultsPredictivePages({
  term,
  pages,
  closeSearch,
}: PartialPredictiveSearchResult<'pages'>) {
  if (!pages.length) return null;

  return (
    <ResultGroup title="Pages">
      {pages.map((page) => {
        const pageUrl = urlWithTrackingParams({
          baseUrl: `/pages/${page.handle}`,
          trackingParams: page.trackingParameters,
          term: term.current,
        });

        return (
          <li className="predictive-search-result-item" key={page.id}>
            <Link
              className="predictive-search-result-item__link predictive-search-result-item__link--text"
              onClick={closeSearch}
              to={pageUrl}
            >
              <span className="predictive-search-result-item__body">
                <span className="predictive-search-result-item__title">
                  {page.title}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ResultGroup>
  );
}

function SearchResultsPredictiveProducts({
  term,
  products,
  closeSearch,
}: PartialPredictiveSearchResult<'products'>) {
  if (!products.length) return null;

  return (
    <ResultGroup title="Products">
      {products.map((product) => {
        const productUrl = urlWithTrackingParams({
          baseUrl: `/products/${product.handle}`,
          trackingParams: product.trackingParameters,
          term: term.current,
        });

        const variant = product?.selectedOrFirstAvailableVariant;
        return (
          <li className="predictive-search-result-item" key={product.id}>
            <Link
              className="predictive-search-result-item__link"
              to={productUrl}
              onClick={closeSearch}
            >
              <ResultThumbnail image={variant?.image} alt="" />
              <span className="predictive-search-result-item__body">
                <span className="predictive-search-result-item__title">
                  {product.title}
                </span>
                {variant?.price ? (
                  <Price
                    size="sm"
                    price={variant.price}
                    compareAtPrice={variant.compareAtPrice}
                  />
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ResultGroup>
  );
}

function SearchResultsPredictiveQueries({
  queries,
  queriesDatalistId,
}: PartialPredictiveSearchResult<'queries', never> & {
  queriesDatalistId: string;
}) {
  if (!queries.length) return null;

  return (
    <datalist id={queriesDatalistId}>
      {queries.map((suggestion) => {
        if (!suggestion) return null;

        return <option key={suggestion.text} value={suggestion.text} />;
      })}
    </datalist>
  );
}

function SearchResultsPredictiveEmpty({
  term,
}: {
  term: React.MutableRefObject<string>;
}) {
  // Same fetcher as the form and the results (shared by key).
  const fetcher = useFetcher<PredictiveSearchResponse>({key: 'search'});

  if (!term.current) {
    return null;
  }

  // A failed search is not "no results".
  if (fetcher.data?.error) {
    return (
      <div className="predictive-search__empty">
        <p className="predictive-search__status">{fetcher.data.error}</p>
      </div>
    );
  }

  return (
    <div className="predictive-search__empty">
      <p className="predictive-search__status">
        No results for <q>{term.current}</q>
      </p>
      <p className="predictive-search__hint">
        Try a different spelling or search for “pillow”, “comforter” or
        “bundle”.
      </p>
    </div>
  );
}

/**
 * Hook that returns the predictive search results and fetcher and input ref.
 * @example
 * '''ts
 * const { items, total, inputRef, term, fetcher } = usePredictiveSearch();
 * '''
 **/
function usePredictiveSearch(): UsePredictiveSearchReturn {
  const fetcher = useFetcher<PredictiveSearchResponse>({key: 'search'});
  const term = useRef<string>('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (fetcher?.state === 'loading') {
    term.current = String(fetcher.formData?.get('q') || '');
  }

  // capture the search input element as a ref
  useEffect(() => {
    if (!inputRef.current) {
      inputRef.current = document.querySelector(
        '.predictive-search input[type="search"]',
      );
    }
  }, []);

  const {items, total} =
    fetcher?.data?.result ?? getEmptyPredictiveSearchResult();

  return {items, total, inputRef, term, fetcher};
}
