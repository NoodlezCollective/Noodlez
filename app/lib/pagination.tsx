import {flattenConnection} from '@shopify/hydrogen-react';
import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ForwardRefExoticComponent,
  type ReactNode,
  type RefAttributes,
} from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useNavigation,
  type LinkProps,
} from 'react-router';
import {
  assertPageInfo,
  buildPaginationState,
  buildPaginationUrls,
  getPaginationCleanup,
  getParamsWithoutPagination,
  isPreviousDirection,
  mergePaginatedNodes,
  resolveVisiblePageInfo,
  type PageInfo,
  type PaginationUrl,
} from './pagination-variables';

/**
 * Cursor pagination for Storefront connections: "Load more" appends the next
 * page to the nodes already shown and "Load previous" prepends the previous
 * one, by carrying the shown nodes and cursors in the history entry's location
 * state. Ported from Hydrogen's `<Pagination>`; the logic lives in
 * ./pagination-variables.ts, this module only wires it to React Router.
 */

export {getPaginationVariables} from './pagination-variables';
export type {PageInfo, PaginationVariables} from './pagination-variables';

export type Connection<N> =
  | {nodes: N[]; pageInfo: PageInfo}
  | {edges: Array<{node: N}>; pageInfo: PageInfo};

export type PaginationLinkProps = Omit<LinkProps, 'to' | 'state' | 'replace'>;

type PaginationLink = ForwardRefExoticComponent<
  PaginationLinkProps & RefAttributes<HTMLAnchorElement>
>;

export interface PaginationRenderProps<N> {
  /** The nodes to render: every page loaded so far, in order. */
  nodes: N[];
  /** True from a click on a pagination link until the navigation settles. */
  isLoading: boolean;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextPageUrl: string;
  previousPageUrl: string;
  /** The location state the links carry; pass it along to build your own. */
  state: unknown;
  /** Renders nothing when there is no next page. */
  NextLink: PaginationLink;
  /** Renders nothing when there is no previous page. */
  PreviousLink: PaginationLink;
}

export interface PaginationProps<N> {
  /** A paginated Storefront result whose `pageInfo` selects both cursors and both flags. */
  connection: Connection<N>;
  children: (props: PaginationRenderProps<N>) => ReactNode;
  /** Keeps the URL parameters of several lists on one page apart. */
  namespace?: string;
}

/**
 * True once a <Pagination> has mounted in the browser. Until then, the server
 * render and the hydration render ignore the nodes carried in `location.state`
 * so they match the server HTML (a reload restores that state from history).
 * Replaces Hydrogen's `window.__hydrogenHydrated`.
 */
let hasHydrated = false;

function createPaginationLink({
  isVisible,
  to,
  state,
  onClick,
}: {
  isVisible: boolean;
  to: string;
  state: unknown;
  onClick: () => void;
}): PaginationLink {
  return forwardRef<HTMLAnchorElement, PaginationLinkProps>(
    function PaginationAnchor(props, ref) {
      if (!isVisible) return null;

      return (
        <Link
          preventScrollReset
          {...props}
          to={to}
          state={state}
          replace
          ref={ref}
          onClick={onClick}
        />
      );
    },
  );
}

/**
 * Replaces the URL without the pagination parameters when the path or another
 * parameter changes while a navigation is pending: the pages loaded so far no
 * longer belong to the new list.
 */
function useDropStalePaginationParams({
  pathname,
  search,
  locationState,
}: {
  pathname: string;
  search: string;
  locationState: unknown;
}): void {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const lastUrl = useRef<PaginationUrl>({
    pathname,
    params: getParamsWithoutPagination(search, locationState),
  });

  useEffect(() => {
    const cleaned = getPaginationCleanup({
      previous: lastUrl.current,
      pathname,
      search,
      locationState,
      isNavigating: navigation.state !== 'idle',
    });
    if (!cleaned) return;

    lastUrl.current = cleaned;
    void navigate(`${cleaned.pathname}?${cleaned.params}`, {
      replace: true,
      preventScrollReset: true,
      state: {nodes: undefined, pageInfo: undefined},
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the committed URL changes, reading the navigation state of that render; depending on it would also fire when a later navigation starts
  }, [pathname, search, locationState]);
}

function usePaginationView<N>(connection: Connection<N>, namespace: string) {
  assertPageInfo(connection.pageInfo);
  const {pathname, search, state: locationState} = useLocation();
  useDropStalePaginationParams({pathname, search, locationState});
  useEffect(() => {
    hasHydrated = true;
  }, []);

  const isPrevious = isPreviousDirection(search, namespace);
  const {startCursor, endCursor, hasNextPage, hasPreviousPage} =
    connection.pageInfo;

  const nodes = useMemo(
    () =>
      mergePaginatedNodes({
        fresh: flattenConnection(connection) as N[],
        locationState,
        namespace,
        isPrevious,
        isHydrated: hasHydrated,
      }),
    [connection, locationState, namespace, isPrevious],
  );
  const pageInfo = useMemo(
    () =>
      resolveVisiblePageInfo({
        connectionInfo: {startCursor, endCursor, hasNextPage, hasPreviousPage},
        locationState,
        namespace,
        isPrevious,
        isHydrated: hasHydrated,
      }),
    [
      startCursor,
      endCursor,
      hasNextPage,
      hasPreviousPage,
      locationState,
      namespace,
      isPrevious,
    ],
  );
  const {previousPageUrl, nextPageUrl} = useMemo(
    () => buildPaginationUrls(search, pageInfo, namespace),
    [search, pageInfo, namespace],
  );
  const state = useMemo(
    () => buildPaginationState({locationState, namespace, nodes, pageInfo}),
    [locationState, namespace, nodes, pageInfo],
  );

  return {nodes, pageInfo, previousPageUrl, nextPageUrl, state};
}

export function Pagination<N>({
  connection,
  children,
  namespace = '',
}: PaginationProps<N>): ReactNode {
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();
  const {nodes, pageInfo, previousPageUrl, nextPageUrl, state} =
    usePaginationView(connection, namespace);
  const {hasNextPage, hasPreviousPage} = pageInfo;

  useEffect(() => {
    if (navigation.state === 'idle') setIsLoading(false);
  }, [navigation.state]);

  const NextLink = useMemo(
    () =>
      createPaginationLink({
        isVisible: hasNextPage,
        to: nextPageUrl,
        state,
        onClick: () => setIsLoading(true),
      }),
    [hasNextPage, nextPageUrl, state],
  );
  const PreviousLink = useMemo(
    () =>
      createPaginationLink({
        isVisible: hasPreviousPage,
        to: previousPageUrl,
        state,
        onClick: () => setIsLoading(true),
      }),
    [hasPreviousPage, previousPageUrl, state],
  );

  return children({
    nodes,
    isLoading,
    hasNextPage,
    hasPreviousPage,
    nextPageUrl,
    previousPageUrl,
    state,
    NextLink,
    PreviousLink,
  });
}
