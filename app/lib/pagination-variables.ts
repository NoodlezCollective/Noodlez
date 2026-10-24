import {isRecord} from '~/lib/guards';

/**
 * The pure half of cursor pagination: loader variables, link URLs and the
 * bookkeeping `<Pagination>` (./pagination.tsx) needs to append and prepend
 * pages. Ported from Hydrogen's `getPaginationVariables` and `usePagination`.
 */

/** Items per page when a loader does not choose a page size. */
export const DEFAULT_PAGE_SIZE = 20;

const CURSOR_PARAM = 'cursor';
const DIRECTION_PARAM = 'direction';
const PREVIOUS_DIRECTION = 'previous';
const NEXT_DIRECTION = 'next';
const PAGINATION_GUIDE_URL =
  'https://shopify.dev/docs/custom-storefronts/hydrogen/data-fetching/pagination#setup-the-paginated-query';

/** Page info fields a query must select for `<Pagination>` to work. */
const REQUIRED_PAGE_INFO_FIELDS = [
  'startCursor',
  'endCursor',
  'hasNextPage',
  'hasPreviousPage',
] as const;

export type PaginationVariables =
  | {first: number; endCursor: string | null}
  | {last: number; startCursor: string | null};

export type PageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | null;
  endCursor?: string | null;
};

/** A pathname and its search parameters without the leading `?`. */
export type PaginationUrl = {pathname: string; params: string};

type PageDirection = typeof PREVIOUS_DIRECTION | typeof NEXT_DIRECTION;

/** What a previous page left in `location.state.pagination[namespace]`. */
type CarriedEntry = {nodes: unknown[] | undefined; pageInfo: Partial<PageInfo>};

function paginationParamNames(namespace: string) {
  const prefix = namespace ? `${namespace}_` : '';
  return {
    cursor: `${prefix}${CURSOR_PARAM}`,
    direction: `${prefix}${DIRECTION_PARAM}`,
  };
}

/** True when the search string asks for the page before the cursor. */
export function isPreviousDirection(search: string, namespace = ''): boolean {
  const {direction} = paginationParamNames(namespace);
  return new URLSearchParams(search).get(direction) === PREVIOUS_DIRECTION;
}

/**
 * The `first`/`after` or `last`/`before` variables for a paginated Storefront
 * query, read from the request's `cursor` and `direction` parameters (prefixed
 * with `<namespace>_` when several lists share a page).
 */
export function getPaginationVariables(
  request: Request,
  options?: {pageBy: number; namespace?: string},
): PaginationVariables {
  if (typeof request?.url === 'undefined') {
    throw new Error(
      'getPaginationVariables must be called with the Request object passed to your loader function',
    );
  }
  const pageBy = options?.pageBy ?? DEFAULT_PAGE_SIZE;
  const namespace = options?.namespace ?? '';
  const {search} = new URL(request.url);
  const cursor = new URLSearchParams(search).get(
    paginationParamNames(namespace).cursor,
  );

  return isPreviousDirection(search, namespace)
    ? {last: pageBy, startCursor: cursor}
    : {first: pageBy, endCursor: cursor};
}

function carriedNamespaces(state: unknown): string[] {
  return isRecord(state) && isRecord(state.pagination)
    ? Object.keys(state.pagination)
    : [];
}

/**
 * `search` without the cursor and direction of every namespace that carries
 * pagination state in `state` (the location state): what stays when the user
 * changes a filter and the loaded pages no longer apply.
 */
export function getParamsWithoutPagination(
  search: string,
  state: unknown,
): string {
  const params = new URLSearchParams(search);
  for (const namespace of carriedNamespaces(state)) {
    const names = paginationParamNames(namespace);
    params.delete(names.cursor);
    params.delete(names.direction);
  }
  return params.toString();
}

function pageUrl(
  search: string,
  namespace: string,
  direction: PageDirection,
  cursor: string | null | undefined,
): string {
  const names = paginationParamNames(namespace);
  const params = new URLSearchParams(search);
  // Direction before cursor: `?q=a&direction=next&cursor=…` (tests/e2e/search.spec.ts).
  params.set(names.direction, direction);
  if (cursor) params.set(names.cursor, cursor);
  return `?${params.toString()}`;
}

/** The "Load previous" and "Load more" URLs for the page being shown. */
export function buildPaginationUrls(
  search: string,
  info: Pick<PageInfo, 'startCursor' | 'endCursor'>,
  namespace = '',
): {previousPageUrl: string; nextPageUrl: string} {
  return {
    previousPageUrl: pageUrl(
      search,
      namespace,
      PREVIOUS_DIRECTION,
      info.startCursor,
    ),
    nextPageUrl: pageUrl(search, namespace, NEXT_DIRECTION, info.endCursor),
  };
}

function missingPageInfoError(property: string): Error {
  return new Error(
    `The Pagination component requires \`${property}\` to be a part of your query. See the guide on how to setup your query to include \`${property}\`: ${PAGINATION_GUIDE_URL}`,
  );
}

/** Throws a descriptive error when the query left out a page info field. */
export function assertPageInfo(
  pageInfo: Partial<PageInfo> | null | undefined,
): void {
  if (!pageInfo) throw missingPageInfoError('pageInfo');
  for (const field of REQUIRED_PAGE_INFO_FIELDS) {
    if (typeof pageInfo[field] === 'undefined') {
      throw missingPageInfoError(`pageInfo.${field}`);
    }
  }
}

/** History state is written by `<Pagination>` itself; read it defensively anyway. */
function readCarriedEntry(state: unknown, namespace: string): CarriedEntry {
  const entry =
    isRecord(state) && isRecord(state.pagination)
      ? state.pagination[namespace]
      : undefined;
  if (!isRecord(entry)) return {nodes: undefined, pageInfo: {}};

  return {
    nodes: Array.isArray(entry.nodes) ? entry.nodes : undefined,
    pageInfo: isRecord(entry.pageInfo)
      ? (entry.pageInfo as Partial<PageInfo>)
      : {},
  };
}

/**
 * The nodes to show: the fetched page, with the nodes carried over in the
 * location state appended ("Load more") or prepended ("Load previous"). While
 * the page hydrates only the fetched page is shown, as the server rendered it.
 */
export function mergePaginatedNodes<N>({
  fresh,
  locationState,
  namespace = '',
  isPrevious,
  isHydrated,
}: {
  fresh: N[];
  locationState: unknown;
  namespace?: string;
  isPrevious: boolean;
  isHydrated: boolean;
}): N[] {
  const {nodes} = readCarriedEntry(locationState, namespace);
  if (!isHydrated || !nodes) return fresh;

  const carried = nodes as N[];
  return isPrevious ? [...fresh, ...carried] : [...carried, ...fresh];
}

function carriedOr<T>(carried: T | undefined, fresh: T): T {
  return carried === undefined ? fresh : carried;
}

/**
 * The page info for the merged nodes. Page info carried in the location state
 * describes the pages already shown; the fetched page only moves the edge it
 * extends (the end after "Load more", the start after "Load previous").
 */
export function resolveVisiblePageInfo({
  connectionInfo,
  locationState,
  namespace = '',
  isPrevious,
  isHydrated,
}: {
  connectionInfo: PageInfo;
  locationState: unknown;
  namespace?: string;
  isPrevious: boolean;
  isHydrated: boolean;
}): PageInfo {
  const {nodes, pageInfo} = readCarriedEntry(locationState, namespace);
  const carried: Partial<PageInfo> = isHydrated ? pageInfo : {};
  const shown: PageInfo = {
    startCursor: carriedOr(carried.startCursor, connectionInfo.startCursor),
    endCursor: carriedOr(carried.endCursor, connectionInfo.endCursor),
    hasPreviousPage: carriedOr(
      carried.hasPreviousPage,
      connectionInfo.hasPreviousPage,
    ),
    hasNextPage: carriedOr(carried.hasNextPage, connectionInfo.hasNextPage),
  };
  if (!nodes) return shown;

  return isPrevious
    ? {
        ...shown,
        startCursor: connectionInfo.startCursor,
        hasPreviousPage: connectionInfo.hasPreviousPage,
      }
    : {
        ...shown,
        endCursor: connectionInfo.endCursor,
        hasNextPage: connectionInfo.hasNextPage,
      };
}

/**
 * The location state the pagination links carry: the current location state
 * with this namespace's entry set to the nodes and page info being shown.
 */
export function buildPaginationState<N>({
  locationState,
  namespace = '',
  nodes,
  pageInfo,
}: {
  locationState: unknown;
  namespace?: string;
  nodes: N[];
  pageInfo: PageInfo;
}): Record<string, unknown> {
  const state = isRecord(locationState) ? locationState : {};
  const pagination = isRecord(state.pagination) ? state.pagination : {};

  return {
    ...state,
    pagination: {
      ...pagination,
      [namespace]: {
        pageInfo: {
          startCursor: pageInfo.startCursor,
          endCursor: pageInfo.endCursor,
          hasPreviousPage: pageInfo.hasPreviousPage,
          hasNextPage: pageInfo.hasNextPage,
        },
        nodes,
      },
    },
  };
}

/**
 * The URL to replace the current entry with once the path or a non-pagination
 * parameter changes while a navigation is pending (the loaded pages no longer
 * apply), or `null` when nothing needs cleaning. `previous` is the last URL
 * that was cleaned or seen on mount.
 */
export function getPaginationCleanup({
  previous,
  pathname,
  search,
  locationState,
  isNavigating,
}: {
  previous: PaginationUrl;
  pathname: string;
  search: string;
  locationState: unknown;
  isNavigating: boolean;
}): PaginationUrl | null {
  if (!isNavigating) return null;

  const params = getParamsWithoutPagination(search, locationState);
  const hasChanged =
    pathname !== previous.pathname || params !== previous.params;
  return hasChanged ? {pathname, params} : null;
}
