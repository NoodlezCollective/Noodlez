import * as React from 'react';
import {Pagination} from '~/lib/pagination';
import {useNavigation} from 'react-router';
import {buttonClassName} from '~/components/ui/Button';

type PendingFocus = {direction: 'next' | 'previous'; count: number};

type PaginationToolbarInfo = {
  /** Number of nodes currently rendered (including appended pages). */
  count: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isLoading: boolean;
};

/**
 * <PaginatedResourceSection> encapsulates the previous and next pagination
 * behaviors throughout the application: centered pill "Load previous" /
 * "Load more" buttons with a loading state, an optional toolbar rendered
 * above the resources and an optional empty state.
 */
export function PaginatedResourceSection<NodesType>({
  connection,
  children,
  ariaLabel,
  resourcesClassName,
  toolbar,
  emptyState,
  loadingFallback,
  loadMoreLabel = 'Load more',
  loadPreviousLabel = 'Load previous',
}: {
  connection: React.ComponentProps<typeof Pagination<NodesType>>['connection'];
  children: React.FunctionComponent<{node: NodesType; index: number}>;
  ariaLabel?: string;
  resourcesClassName?: string;
  /** Rendered above the resources with the merged node count. */
  toolbar?: (info: PaginationToolbarInfo) => React.ReactNode;
  /** Rendered instead of the resources when there are no nodes. */
  emptyState?: React.ReactNode;
  /** Appended to the resources while the next/previous page loads. */
  loadingFallback?: React.ReactNode;
  loadMoreLabel?: string;
  loadPreviousLabel?: string;
}) {
  const navigation = useNavigation();
  const resourcesRef = React.useRef<HTMLDivElement>(null);
  const pendingParams = navigation.location
    ? new URLSearchParams(navigation.location.search)
    : null;
  const isPaginating =
    navigation.state === 'loading' && Boolean(pendingParams?.has('cursor'));
  const pendingDirection =
    pendingParams?.get('direction') === 'previous' ? 'previous' : 'next';

  return (
    <Pagination connection={connection}>
      {({
        nodes,
        isLoading,
        PreviousLink,
        NextLink,
        hasNextPage,
        hasPreviousPage,
      }) => {
        const loadingPrevious =
          isLoading && isPaginating && pendingDirection === 'previous';
        const loadingNext =
          isLoading && isPaginating && pendingDirection === 'next';
        const resourcesMarkup = nodes.map((node, index) =>
          children({node, index}),
        );
        const resources = (
          <>
            {loadingPrevious ? loadingFallback : null}
            {resourcesMarkup}
            {loadingNext ? loadingFallback : null}
          </>
        );

        return (
          <div className="paginated-section">
            <PaginationFocus
              count={nodes.length}
              isLoading={isLoading}
              direction={pendingDirection}
              container={resourcesRef}
            />
            {toolbar
              ? toolbar({
                  count: nodes.length,
                  hasNextPage,
                  hasPreviousPage,
                  isLoading,
                })
              : null}
            {hasPreviousPage ? (
              <div className="paginated-section__nav paginated-section__nav--previous">
                <PreviousLink
                  className={buttonClassName({
                    variant: 'outline',
                    loading: loadingPrevious,
                  })}
                  aria-disabled={loadingPrevious || undefined}
                >
                  {loadingPrevious ? (
                    <span className="btn__spinner" aria-hidden="true" />
                  ) : null}
                  <span className="btn__label">
                    {loadingPrevious ? 'Loading…' : loadPreviousLabel}
                  </span>
                </PreviousLink>
              </div>
            ) : null}
            {nodes.length === 0 && emptyState ? (
              emptyState
            ) : resourcesClassName ? (
              <div
                ref={resourcesRef}
                aria-label={ariaLabel}
                aria-busy={loadingNext || loadingPrevious || undefined}
                className={resourcesClassName}
                role={ariaLabel ? 'region' : undefined}
              >
                {resources}
              </div>
            ) : (
              resources
            )}
            {hasNextPage ? (
              <div className="paginated-section__nav paginated-section__nav--next">
                <NextLink
                  className={buttonClassName({
                    variant: 'outline',
                    loading: loadingNext,
                  })}
                  aria-disabled={loadingNext || undefined}
                >
                  {loadingNext ? (
                    <span className="btn__spinner" aria-hidden="true" />
                  ) : null}
                  <span className="btn__label">
                    {loadingNext ? 'Loading…' : loadMoreLabel}
                  </span>
                </NextLink>
              </div>
            ) : null}
          </div>
        );
      }}
    </Pagination>
  );
}

/**
 * After "Load more" / "Load previous" the clicked link unmounts when no further
 * page exists, which drops keyboard focus to <body>. Hand it to the first newly
 * loaded resource instead (the link keeps focus while more pages remain).
 * Hydrogen's pagination links override any `onClick` passed to them, so the
 * pending load is detected from the loading state rather than from the click.
 */
function PaginationFocus({
  count,
  isLoading,
  direction,
  container,
}: {
  count: number;
  isLoading: boolean;
  direction: 'next' | 'previous';
  container: React.RefObject<HTMLDivElement | null>;
}) {
  const pending = React.useRef<PendingFocus | null>(null);
  React.useEffect(() => {
    if (isLoading) {
      pending.current ??= {direction, count};
      return;
    }
    const request = pending.current;
    pending.current = null;
    if (!request || count === request.count) return;
    if (document.activeElement && document.activeElement !== document.body) {
      return;
    }
    const items = container.current?.children;
    if (!items) return;
    const target = items[request.direction === 'next' ? request.count : 0];
    const focusable = target?.querySelector<HTMLElement>(
      'a[href]:not([aria-hidden="true"]):not([tabindex="-1"]), button',
    );
    (focusable ?? (target instanceof HTMLElement ? target : null))?.focus();
  }, [count, isLoading, direction, container]);
  return null;
}
