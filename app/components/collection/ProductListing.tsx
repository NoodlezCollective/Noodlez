import {useEffect, useId, useRef, useState, type ReactNode} from 'react';
import type {
  CollectionFilterFragment,
  ProductCardFragment,
} from 'storefrontapi.generated';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {ProductCard} from '~/components/ProductCard';
import {Button} from '~/components/ui/Button';
import {FilterIcon} from '~/components/ui/Icons';
import {
  clearFilterParams,
  parseAppliedFilters,
  type SortOption,
} from '~/lib/collectionFilters';
import {ActiveFilters, buildFilterChips} from './ActiveFilters';
import {FilterPanel} from './FilterPanel';
import {ProductGridSkeleton} from './ProductGridSkeleton';
import {SortSelect} from './SortSelect';
import {useListingState} from './useListingState';

export type ProductConnection = {
  nodes: ProductCardFragment[];
  pageInfo: {
    hasPreviousPage: boolean;
    hasNextPage: boolean;
    startCursor?: string | null;
    endCursor?: string | null;
  };
};

type ProductListingProps = {
  connection: ProductConnection;
  /** `collection.products.filters`; omit for connections without filters. */
  filters?: CollectionFilterFragment[];
  sortOptions: SortOption[];
  currencyCode?: string;
  /** Overrides the default empty states. */
  emptyState?: ReactNode;
};

const CARD_SIZES = '(min-width: 64em) 30vw, (min-width: 40em) 50vw, 100vw';

function countLabel(count: number, hasNextPage: boolean) {
  const formatted = new Intl.NumberFormat('en-US').format(count);
  const noun = count === 1 && !hasNextPage ? 'product' : 'products';
  return `${formatted}${hasNextPage ? '+' : ''} ${noun}`;
}

/**
 * Toolbar (count + sort), optional filter sidebar / mobile filter sheet,
 * active filter chips, the product grid and "load more" pagination.
 * Shared by collection pages and the shop-all page.
 */
export function ProductListing({
  connection,
  filters,
  sortOptions,
  currencyCode = 'USD',
  emptyState,
}: ProductListingProps) {
  const {params, pathname, isPending} = useListingState();
  const panelId = useId();
  const headingId = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const filterGroups = filters?.filter((filter) => filter.values.length) ?? [];
  const hasFilters = filterGroups.length > 0;
  const applied = parseAppliedFilters(params);
  const clearSearch = clearFilterParams(params).toString();
  const clearHref = `${pathname}${clearSearch ? `?${clearSearch}` : ''}`;
  const chips = hasFilters
    ? buildFilterChips({
        applied,
        filters: filterGroups,
        params,
        pathname,
        currencyCode,
      })
    : [];

  useEffect(() => {
    if (!filtersOpen) return;
    const root = document.documentElement;
    root.classList.add('filter-sheet-open');
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setFiltersOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      root.classList.remove('filter-sheet-open');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [filtersOpen]);

  function closeFilters() {
    setFiltersOpen(false);
    toggleRef.current?.focus();
  }

  const resolvedEmptyState =
    emptyState ??
    (applied.length ? (
      <div className="empty-state">
        <p className="empty-state__title">No products match your filters</p>
        <p>Try removing a filter or clearing them all to see everything.</p>
        <div className="empty-state__actions">
          <Button to={clearHref} preventScrollReset>
            Clear all filters
          </Button>
        </div>
      </div>
    ) : (
      <div className="empty-state">
        <p className="empty-state__title">Nothing here yet</p>
        <p>
          This collection is empty right now. Explore everything else we make
          for better sleep.
        </p>
        <div className="empty-state__actions">
          <Button to="/collections/all">Shop all</Button>
        </div>
      </div>
    ));

  return (
    <div
      className={`collection-layout ${
        hasFilters ? 'collection-layout--with-filters' : ''
      }`.trim()}
    >
      {hasFilters ? (
        <aside
          id={panelId}
          className={`collection-layout__sidebar ${
            filtersOpen ? 'is-open' : ''
          }`.trim()}
          aria-labelledby={headingId}
          role={filtersOpen ? 'dialog' : undefined}
          aria-modal={filtersOpen ? true : undefined}
        >
          <FilterPanel
            filters={filterGroups}
            currencyCode={currencyCode}
            headingId={headingId}
            onClose={closeFilters}
            closeButtonRef={closeButtonRef}
          />
        </aside>
      ) : null}
      <div className="collection-layout__main">
        <PaginatedResourceSection<ProductCardFragment>
          connection={connection}
          resourcesClassName={`product-grid ${isPending ? 'is-loading' : ''}`.trim()}
          ariaLabel="Products"
          loadingFallback={<ProductGridSkeleton count={3} inline />}
          emptyState={resolvedEmptyState}
          toolbar={({count, hasNextPage}) => (
            <>
              <div className="collection-toolbar">
                <p className="collection-toolbar__count" aria-live="polite">
                  {isPending ? 'Updating…' : countLabel(count, hasNextPage)}
                </p>
                <div className="collection-toolbar__actions">
                  {hasFilters ? (
                    <button
                      className="btn btn--outline btn--sm filters-toggle"
                      type="button"
                      aria-expanded={filtersOpen}
                      aria-controls={panelId}
                      onClick={() => setFiltersOpen(true)}
                      ref={toggleRef}
                    >
                      <FilterIcon size={18} />
                      Filters
                      {applied.length ? (
                        <span className="filters-toggle__count">
                          {applied.length}
                          <span className="sr-only"> active</span>
                        </span>
                      ) : null}
                    </button>
                  ) : null}
                  <SortSelect options={sortOptions} />
                </div>
              </div>
              <ActiveFilters chips={chips} clearHref={clearHref} />
            </>
          )}
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
      </div>
    </div>
  );
}
