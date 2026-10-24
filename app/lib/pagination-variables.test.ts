import {describe, expect, it} from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  assertPageInfo,
  buildPaginationState,
  buildPaginationUrls,
  getPaginationCleanup,
  getPaginationVariables,
  getParamsWithoutPagination,
  isPreviousDirection,
  mergePaginatedNodes,
  resolveVisiblePageInfo,
  type PageInfo,
} from './pagination-variables';

const ORIGIN = 'https://shop.example';

function requestFor(pathAndQuery: string) {
  return new Request(`${ORIGIN}${pathAndQuery}`);
}

/** `location.state` as a `<Pagination>` leaves it behind for `namespace`. */
function carrying(entry: unknown, namespace = '') {
  return {pagination: {[namespace]: entry}};
}

describe('getPaginationVariables', () => {
  it('pages forward from the start, 20 at a time, when nothing is configured', () => {
    // Act
    const variables = getPaginationVariables(requestFor('/collections/all'));

    // Assert
    expect(DEFAULT_PAGE_SIZE).toBe(20);
    expect(variables).toEqual({first: 20, endCursor: null});
  });

  it('uses the requested page size', () => {
    expect(getPaginationVariables(requestFor('/'), {pageBy: 12})).toEqual({
      first: 12,
      endCursor: null,
    });
  });

  it('falls back to the default page size when the options only name a namespace', () => {
    const options = {namespace: 'reviews'} as never;

    expect(getPaginationVariables(requestFor('/'), options)).toEqual({
      first: 20,
      endCursor: null,
    });
  });

  it('pages forward after the cursor', () => {
    const request = requestFor('/?direction=next&cursor=abc');

    expect(getPaginationVariables(request, {pageBy: 12})).toEqual({
      first: 12,
      endCursor: 'abc',
    });
  });

  it('treats a cursor without a direction as forward', () => {
    expect(
      getPaginationVariables(requestFor('/?cursor=abc'), {pageBy: 12}),
    ).toEqual({first: 12, endCursor: 'abc'});
  });

  it('pages backward before the cursor', () => {
    const request = requestFor('/?direction=previous&cursor=abc');

    expect(getPaginationVariables(request, {pageBy: 12})).toEqual({
      last: 12,
      startCursor: 'abc',
    });
  });

  it('pages backward from the end when the cursor is missing', () => {
    expect(
      getPaginationVariables(requestFor('/?direction=previous'), {pageBy: 8}),
    ).toEqual({last: 8, startCursor: null});
  });

  it('treats any other direction as forward', () => {
    const request = requestFor('/?direction=sideways&cursor=abc');

    expect(getPaginationVariables(request, {pageBy: 12})).toEqual({
      first: 12,
      endCursor: 'abc',
    });
  });

  it('reads the namespaced parameters and ignores the plain ones', () => {
    const request = requestFor(
      '/?reviews_direction=previous&reviews_cursor=r1&direction=next&cursor=plain',
    );

    expect(
      getPaginationVariables(request, {pageBy: 5, namespace: 'reviews'}),
    ).toEqual({last: 5, startCursor: 'r1'});
  });

  it('ignores the namespaced parameters when no namespace is given', () => {
    const request = requestFor(
      '/?reviews_direction=previous&reviews_cursor=r1',
    );

    expect(getPaginationVariables(request)).toEqual({
      first: 20,
      endCursor: null,
    });
  });

  it('keeps unrelated parameters out of the variables', () => {
    const request = requestFor('/search?q=pillow&sort=asc&cursor=abc');

    expect(getPaginationVariables(request, {pageBy: 12})).toStrictEqual({
      first: 12,
      endCursor: 'abc',
    });
  });

  it.each([undefined, null, {}, `${ORIGIN}/collections`])(
    'throws a descriptive error when it is given %j instead of the loader request',
    (notARequest) => {
      expect(() => getPaginationVariables(notARequest as never)).toThrow(
        'getPaginationVariables must be called with the Request object passed to your loader function',
      );
    },
  );
});

describe('isPreviousDirection', () => {
  it.each([
    ['?direction=previous&cursor=a', '', true],
    ['direction=previous', '', true],
    ['?direction=next&cursor=a', '', false],
    ['?cursor=a', '', false],
    ['', '', false],
    ['?direction=previous', 'reviews', false],
    ['?reviews_direction=previous', 'reviews', true],
    ['?reviews_direction=previous', '', false],
  ])('reads %j for namespace %j as %s', (search, namespace, expected) => {
    expect(isPreviousDirection(search, namespace)).toBe(expected);
  });

  it('reads the plain parameter when no namespace is given', () => {
    expect(isPreviousDirection('?direction=previous')).toBe(true);
  });
});

describe('getParamsWithoutPagination', () => {
  it('drops cursor and direction when the page carries pagination state', () => {
    const search = '?q=a&direction=next&cursor=abc&sort=asc';

    expect(getParamsWithoutPagination(search, carrying({}))).toBe(
      'q=a&sort=asc',
    );
  });

  it('only drops the namespaces that carry state', () => {
    const search =
      '?cursor=a&direction=next&reviews_cursor=b&reviews_direction=previous';

    expect(getParamsWithoutPagination(search, carrying({}, 'reviews'))).toBe(
      'cursor=a&direction=next',
    );
  });

  it('drops the parameters of several namespaces at once', () => {
    const state = {pagination: {'': {}, reviews: {}}};
    const search = '?cursor=a&reviews_cursor=b&q=x&reviews_direction=next';

    expect(getParamsWithoutPagination(search, state)).toBe('q=x');
  });

  it('accepts a search string without the leading question mark', () => {
    expect(getParamsWithoutPagination('q=a&cursor=abc', carrying({}))).toBe(
      'q=a',
    );
  });

  it.each([
    undefined,
    null,
    'text',
    5,
    [],
    {},
    {pagination: null},
    {pagination: 'text'},
  ])('leaves the parameters alone when the location state is %j', (state) => {
    expect(getParamsWithoutPagination('?q=a&cursor=abc', state)).toBe(
      'q=a&cursor=abc',
    );
  });
});

describe('buildPaginationUrls', () => {
  const info = {startCursor: 'START', endCursor: 'END'};

  it('sets the direction first and the cursor second', () => {
    expect(buildPaginationUrls('?q=a', info)).toEqual({
      previousPageUrl: '?q=a&direction=previous&cursor=START',
      nextPageUrl: '?q=a&direction=next&cursor=END',
    });
  });

  it('builds the links for a page without any parameters', () => {
    expect(buildPaginationUrls('', info)).toEqual({
      previousPageUrl: '?direction=previous&cursor=START',
      nextPageUrl: '?direction=next&cursor=END',
    });
  });

  it('replaces the pagination parameters of the current page where they are', () => {
    const urls = buildPaginationUrls('?direction=next&cursor=OLD&q=a', info);

    expect(urls).toEqual({
      previousPageUrl: '?direction=previous&cursor=START&q=a',
      nextPageUrl: '?direction=next&cursor=END&q=a',
    });
  });

  it('keeps every other parameter in order, repeated ones included', () => {
    const search = '?filter.tag=%22a%22&filter.tag=%22b%22&sort_key=PRICE';

    expect(buildPaginationUrls(search, info).nextPageUrl).toBe(
      '?filter.tag=%22a%22&filter.tag=%22b%22&sort_key=PRICE&direction=next&cursor=END',
    );
  });

  it('leaves the cursor out when the page has none', () => {
    expect(
      buildPaginationUrls('?q=a', {startCursor: null, endCursor: undefined}),
    ).toEqual({
      previousPageUrl: '?q=a&direction=previous',
      nextPageUrl: '?q=a&direction=next',
    });
  });

  it('prefixes both parameters with the namespace', () => {
    expect(buildPaginationUrls('?q=a', info, 'reviews')).toEqual({
      previousPageUrl: '?q=a&reviews_direction=previous&reviews_cursor=START',
      nextPageUrl: '?q=a&reviews_direction=next&reviews_cursor=END',
    });
  });

  it('leaves the parameters of other namespaces untouched', () => {
    const urls = buildPaginationUrls(
      '?cursor=P&direction=next',
      info,
      'reviews',
    );

    expect(urls.nextPageUrl).toBe(
      '?cursor=P&direction=next&reviews_direction=next&reviews_cursor=END',
    );
  });

  it('encodes cursors so they survive a round trip', () => {
    // Arrange: base64 cursors contain the characters a query string reserves.
    const cursor = 'ab+cd/ef==';

    // Act
    const {nextPageUrl} = buildPaginationUrls('', {endCursor: cursor});

    // Assert
    expect(nextPageUrl).toBe('?direction=next&cursor=ab%2Bcd%2Fef%3D%3D');
    expect(new URLSearchParams(nextPageUrl).get('cursor')).toBe(cursor);
  });
});

describe('assertPageInfo', () => {
  const complete = {
    hasNextPage: true,
    hasPreviousPage: false,
    startCursor: 'a',
    endCursor: 'b',
  };

  it('accepts complete page info, null cursors included', () => {
    expect(() => assertPageInfo(complete)).not.toThrow();
    expect(() =>
      assertPageInfo({...complete, startCursor: null, endCursor: null}),
    ).not.toThrow();
  });

  it.each([undefined, null])('names pageInfo itself when it is %s', (value) => {
    expect(() => assertPageInfo(value)).toThrow(
      'The Pagination component requires `pageInfo` to be a part of your query.',
    );
  });

  it.each(['startCursor', 'endCursor', 'hasNextPage', 'hasPreviousPage'])(
    'names pageInfo.%s when the query leaves it out',
    (field) => {
      expect(() => assertPageInfo({...complete, [field]: undefined})).toThrow(
        `The Pagination component requires \`pageInfo.${field}\` to be a part of your query. See the guide on how to setup your query to include \`pageInfo.${field}\`: https://shopify.dev/docs/custom-storefronts/hydrogen/data-fetching/pagination#setup-the-paginated-query`,
      );
    },
  );

  it('reports the first missing field in the order the query documents them', () => {
    expect(() => assertPageInfo({hasNextPage: true})).toThrow(
      'requires `pageInfo.startCursor`',
    );
  });
});

describe('mergePaginatedNodes', () => {
  const firstPage = [{id: 1}, {id: 2}];
  const secondPage = [{id: 3}, {id: 4}];
  const merge = (
    overrides: Partial<Parameters<typeof mergePaginatedNodes>[0]>,
  ) =>
    mergePaginatedNodes({
      fresh: secondPage,
      locationState: carrying({nodes: firstPage}),
      namespace: '',
      isPrevious: false,
      isHydrated: true,
      ...overrides,
    });

  it('appends the fetched page to the carried nodes for "Load more"', () => {
    expect(merge({})).toEqual([{id: 1}, {id: 2}, {id: 3}, {id: 4}]);
  });

  it('prepends the fetched page to the carried nodes for "Load previous"', () => {
    const result = merge({
      fresh: firstPage,
      locationState: carrying({nodes: secondPage}),
      isPrevious: true,
    });

    expect(result).toEqual([{id: 1}, {id: 2}, {id: 3}, {id: 4}]);
  });

  it('shows only the fetched page while the page is hydrating', () => {
    expect(merge({isHydrated: false})).toBe(secondPage);
  });

  it.each([
    ['no location state', undefined],
    ['a location state without pagination', {from: 'elsewhere'}],
    ['an entry without nodes', carrying({pageInfo: {}})],
    ['nodes that are not a list', carrying({nodes: 'oops'})],
    ['the entry of another namespace', carrying({nodes: firstPage}, 'reviews')],
  ])('shows only the fetched page with %s', (_label, locationState) => {
    expect(merge({locationState})).toBe(secondPage);
  });

  it('merges the carried nodes of its own namespace', () => {
    const locationState = {
      pagination: {'': {nodes: [{id: 'plain'}]}, reviews: {nodes: firstPage}},
    };

    expect(merge({locationState, namespace: 'reviews'})).toEqual([
      {id: 1},
      {id: 2},
      {id: 3},
      {id: 4},
    ]);
  });

  it('leaves the arrays it was given alone', () => {
    const fresh = Object.freeze([...secondPage]) as typeof secondPage;
    const carried = Object.freeze([...firstPage]);

    const result = merge({fresh, locationState: carrying({nodes: carried})});

    expect(result).not.toBe(fresh);
    expect(fresh).toEqual(secondPage);
    expect(carried).toEqual(firstPage);
  });
});

describe('resolveVisiblePageInfo', () => {
  const connectionInfo: PageInfo = {
    startCursor: 'fetched-start',
    endCursor: 'fetched-end',
    hasPreviousPage: true,
    hasNextPage: true,
  };
  // Opposite flags make it obvious which source a field came from.
  const carriedInfo: PageInfo = {
    startCursor: 'carried-start',
    endCursor: 'carried-end',
    hasPreviousPage: false,
    hasNextPage: false,
  };
  const resolve = (
    overrides: Partial<Parameters<typeof resolveVisiblePageInfo>[0]>,
  ) =>
    resolveVisiblePageInfo({
      connectionInfo,
      locationState: carrying({nodes: [], pageInfo: carriedInfo}),
      namespace: '',
      isPrevious: false,
      isHydrated: true,
      ...overrides,
    });

  it('shows the fetched page info when nothing was carried', () => {
    expect(resolve({locationState: undefined})).toEqual(connectionInfo);
  });

  it('keeps the start of the first page and takes the end of the loaded one after "Load more"', () => {
    expect(resolve({})).toEqual({
      startCursor: 'carried-start',
      hasPreviousPage: false,
      endCursor: 'fetched-end',
      hasNextPage: true,
    });
  });

  it('keeps the end of the carried pages and takes the start of the loaded one after "Load previous"', () => {
    expect(resolve({isPrevious: true})).toEqual({
      startCursor: 'fetched-start',
      hasPreviousPage: true,
      endCursor: 'carried-end',
      hasNextPage: false,
    });
  });

  it('shows the fetched page info while the page is hydrating, whatever the history entry carries', () => {
    expect(resolve({isHydrated: false})).toEqual(connectionInfo);
    expect(resolve({isHydrated: false, isPrevious: true})).toEqual(
      connectionInfo,
    );
  });

  it('falls back to the fetched values for fields the history entry lacks', () => {
    const locationState = carrying({nodes: [], pageInfo: {}});

    expect(resolve({locationState})).toEqual(connectionInfo);
    expect(resolve({locationState, isPrevious: true})).toEqual(connectionInfo);
  });

  it('keeps a null cursor the history entry carries on purpose', () => {
    const locationState = carrying({
      nodes: [],
      pageInfo: {...carriedInfo, startCursor: null},
    });

    expect(resolve({locationState}).startCursor).toBeNull();
  });

  it('uses the carried page info as it is when the entry carries no nodes', () => {
    const locationState = carrying({pageInfo: carriedInfo});

    expect(resolve({locationState})).toEqual(carriedInfo);
  });

  it('reads only the entry of its own namespace', () => {
    const locationState = carrying(
      {nodes: [], pageInfo: carriedInfo},
      'reviews',
    );

    expect(resolve({locationState})).toEqual(connectionInfo);
    expect(resolve({locationState, namespace: 'reviews'}).startCursor).toBe(
      'carried-start',
    );
  });

  it.each([null, 'text', 5, []])(
    'ignores a history entry that is %j',
    (entry) => {
      expect(resolve({locationState: carrying(entry)})).toEqual(connectionInfo);
    },
  );

  it('returns only the four page info fields', () => {
    const withExtras = {...connectionInfo, __typename: 'PageInfo'} as PageInfo;

    const result = resolve({connectionInfo: withExtras, locationState: null});

    expect(Object.keys(result).sort()).toEqual([
      'endCursor',
      'hasNextPage',
      'hasPreviousPage',
      'startCursor',
    ]);
  });
});

describe('buildPaginationState', () => {
  const nodes = [{id: 1}];
  const pageInfo: PageInfo = {
    startCursor: 's',
    endCursor: 'e',
    hasNextPage: true,
    hasPreviousPage: false,
  };

  it('stores the visible nodes and page info under the namespace', () => {
    expect(
      buildPaginationState({
        locationState: undefined,
        namespace: '',
        nodes,
        pageInfo,
      }),
    ).toEqual({pagination: {'': {nodes, pageInfo}}});
  });

  it('keeps the rest of the location state and the other namespaces', () => {
    const reviews = {nodes: [{id: 'r'}], pageInfo};
    const locationState = {from: 'cart', pagination: {reviews}};

    const state = buildPaginationState({
      locationState,
      namespace: '',
      nodes,
      pageInfo,
    });

    expect(state).toEqual({
      from: 'cart',
      pagination: {reviews, '': {nodes, pageInfo}},
    });
  });

  it('replaces its own earlier entry', () => {
    const locationState = carrying({nodes: [{id: 0}], pageInfo: {}});

    const state = buildPaginationState({
      locationState,
      namespace: '',
      nodes,
      pageInfo,
    });

    expect(state).toEqual({pagination: {'': {nodes, pageInfo}}});
  });

  it('does not modify the location state it was given', () => {
    const locationState = Object.freeze({
      pagination: Object.freeze({reviews: Object.freeze({nodes: []})}),
    });

    const state = buildPaginationState({
      locationState,
      namespace: '',
      nodes,
      pageInfo,
    });

    expect(state).not.toBe(locationState);
    expect(locationState).toEqual({pagination: {reviews: {nodes: []}}});
  });

  it.each([null, undefined, 'text', 5, []])(
    'starts afresh when the location state is %j',
    (locationState) => {
      expect(
        buildPaginationState({locationState, namespace: 'q', nodes, pageInfo}),
      ).toEqual({pagination: {q: {nodes, pageInfo}}});
    },
  );

  it('stores only the four page info fields', () => {
    const withExtras = {...pageInfo, __typename: 'PageInfo'} as PageInfo;

    const state = buildPaginationState({
      locationState: undefined,
      namespace: '',
      nodes,
      pageInfo: withExtras,
    });

    expect(state.pagination).toEqual({'': {nodes, pageInfo}});
  });
});

describe('getPaginationCleanup', () => {
  const previous = {pathname: '/collections/all', params: 'sort_key=PRICE'};
  const withState = carrying({nodes: [], pageInfo: {}});
  const cleanup = (
    overrides: Partial<Parameters<typeof getPaginationCleanup>[0]>,
  ) =>
    getPaginationCleanup({
      previous,
      pathname: '/collections/all',
      search: '?sort_key=TITLE&direction=next&cursor=abc',
      locationState: withState,
      isNavigating: true,
      ...overrides,
    });

  it('returns the URL without pagination parameters when another parameter changed during a navigation', () => {
    expect(cleanup({})).toEqual({
      pathname: '/collections/all',
      params: 'sort_key=TITLE',
    });
  });

  it('returns the new path when the path changed during a navigation', () => {
    const result = cleanup({
      pathname: '/collections/pillows',
      search: '?sort_key=PRICE&direction=next&cursor=abc',
    });

    expect(result).toEqual({
      pathname: '/collections/pillows',
      params: 'sort_key=PRICE',
    });
  });

  it('does nothing on the initial load or while no navigation is pending', () => {
    expect(cleanup({isNavigating: false})).toBeNull();
  });

  it('does nothing while the path and the other parameters are unchanged', () => {
    const result = cleanup({
      search: '?sort_key=PRICE&direction=previous&cursor=zzz',
    });

    expect(result).toBeNull();
  });
});
