import type {RegularSearchQuery} from 'storefrontapi.generated';
import {describe, expect, it} from 'vitest';
import {
  SEARCH_UNAVAILABLE_MESSAGE,
  formatSearchTotal,
  getEmptyPredictiveSearchResult,
  getEmptyRegularSearchResult,
  getPredictiveStatusMessage,
  parseSearchLimit,
  searchUnavailable,
  urlWithTrackingParams,
} from './search';

/** Reads the query string of a relative URL the way React Router will. */
function queryOf(url: string) {
  return new URL(url, 'https://mellow.example').searchParams;
}

describe('urlWithTrackingParams', () => {
  it('puts the term in the q parameter', () => {
    const url = urlWithTrackingParams({
      baseUrl: '/products/cloudalign',
      term: 'pillow',
    });

    expect(url).toBe('/products/cloudalign?q=pillow');
  });

  it('encodes the term exactly once', () => {
    // Arrange
    const term = 'cool pillow';

    // Act
    const url = urlWithTrackingParams({baseUrl: '/products/x', term});

    // Assert: "cool%2520pillow" was the double-encoded form.
    expect(url).not.toContain('%25');
    expect(url).toMatch(/^\/products\/x\?q=cool(\+|%20)pillow$/);
    expect(queryOf(url).get('q')).toBe('cool pillow');
  });

  it.each([
    'cool pillow',
    'a&b',
    'a=b',
    '100% cotton',
    '50%25 off',
    'c++ & "quotes"',
    'café 😴',
    '東京',
    'x#y?z',
    '/slash\\back',
    'line\nbreak',
    '+plus+',
  ])('round-trips the term %j through the query string', (term) => {
    const url = urlWithTrackingParams({baseUrl: '/pages/faq', term});

    expect(queryOf(url).get('q')).toBe(term);
    expect([...queryOf(url).keys()]).toEqual(['q']);
  });

  it('keeps extra parameters next to the term', () => {
    const url = urlWithTrackingParams({
      baseUrl: '/blogs/news/post',
      term: 'sleep',
      params: {foo: 'bar', 'a b': 'c&d'},
    });

    const params = queryOf(url);
    expect(params.get('foo')).toBe('bar');
    expect(params.get('a b')).toBe('c&d');
    expect(params.get('q')).toBe('sleep');
  });

  it('appends Shopify tracking parameters after the term', () => {
    const url = urlWithTrackingParams({
      baseUrl: '/products/x',
      term: 'cool pillow',
      trackingParams: 'utm_source=shopify&utm_medium=shopify_app',
    });

    const params = queryOf(url);
    expect(params.get('q')).toBe('cool pillow');
    expect(params.get('utm_source')).toBe('shopify');
    expect(params.get('utm_medium')).toBe('shopify_app');
    expect(url.endsWith('&utm_source=shopify&utm_medium=shopify_app')).toBe(
      true,
    );
  });

  it.each([null, undefined, ''])(
    'adds nothing when the tracking parameters are %j',
    (trackingParams) => {
      const url = urlWithTrackingParams({
        baseUrl: '/products/x',
        term: 'a',
        trackingParams,
      });

      expect(url).toBe('/products/x?q=a');
    },
  );

  it('still produces a URL for an empty term', () => {
    expect(urlWithTrackingParams({baseUrl: '/products/x', term: ''})).toBe(
      '/products/x?q=',
    );
  });
});

describe('getEmptyPredictiveSearchResult', () => {
  it('has no results of any kind', () => {
    expect(getEmptyPredictiveSearchResult()).toEqual({
      total: 0,
      items: {
        articles: [],
        collections: [],
        products: [],
        pages: [],
        queries: [],
      },
    });
  });

  it('returns a fresh object every time, so callers cannot share state', () => {
    const first = getEmptyPredictiveSearchResult();
    const second = getEmptyPredictiveSearchResult();

    expect(first).not.toBe(second);
    expect(first.items.products).not.toBe(second.items.products);
  });
});

describe('getEmptyRegularSearchResult', () => {
  it('has no results and no further pages', () => {
    expect(getEmptyRegularSearchResult()).toEqual({
      total: 0,
      items: {
        articles: {nodes: []},
        pages: {nodes: []},
        products: {
          nodes: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
        },
      },
    });
  });

  it('returns a fresh object every time', () => {
    const first = getEmptyRegularSearchResult();
    const second = getEmptyRegularSearchResult();

    expect(first).not.toBe(second);
    expect(first.items.products.nodes).not.toBe(second.items.products.nodes);
  });
});

describe('parseSearchLimit', () => {
  it.each([
    ['5', 5],
    ['1', 1],
    ['10', 10],
    [' 7 ', 7],
    ['5.9', 5],
    ['5.2', 5],
    ['1e1', 10],
  ])('reads %j as %d', (value, expected) => {
    expect(parseSearchLimit(value)).toBe(expected);
  });

  it.each([
    ['11', 10],
    ['100', 10],
    ['1000000000000', 10],
    ['1e3', 10],
    ['0', 1],
    ['0.5', 1],
    ['-1', 1],
    ['-100', 1],
  ])('clamps %j to %d', (value, expected) => {
    expect(parseSearchLimit(value)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    '',
    '   ',
    'abc',
    'NaN',
    'Infinity',
    '-Infinity',
    '7abc',
    '--5',
    '{"a":1}',
    '[]',
  ])('uses the default of 10 for %j', (value) => {
    expect(parseSearchLimit(value)).toBe(10);
  });

  it.each([
    '3.99999',
    '-0',
    '1e-7',
    '9.9999999999',
    '10.0000001',
    '0x7',
    '1e308',
    '4e-324',
    String(Number.MAX_SAFE_INTEGER),
    String(Number.MIN_SAFE_INTEGER),
  ])('yields an integer between 1 and 10 for %j', (sample) => {
    const limit = parseSearchLimit(sample);

    expect(Number.isInteger(limit)).toBe(true);
    expect(limit).toBeGreaterThanOrEqual(1);
    expect(limit).toBeLessThanOrEqual(10);
  });
});

describe('searchUnavailable', () => {
  it('describes a failed search with a generic message and no result', () => {
    expect(searchUnavailable('regular', 'pillow')).toEqual({
      type: 'regular',
      term: 'pillow',
      error: 'Search is unavailable right now. Please try again.',
      result: null,
    });
    expect(searchUnavailable('predictive', '')).toMatchObject({
      type: 'predictive',
      result: null,
    });
  });

  it('uses the message shown to shoppers', () => {
    expect(SEARCH_UNAVAILABLE_MESSAGE).toBe(
      'Search is unavailable right now. Please try again.',
    );
  });
});

describe('formatSearchTotal', () => {
  it.each([
    [0, false, '0 results'],
    [1, false, '1 result'],
    [2, false, '2 results'],
    [12, false, '12 results'],
    [1234, false, '1,234 results'],
  ])('shows the exact count for %d (%s)', (total, hasMore, expected) => {
    expect(formatSearchTotal(total, hasMore)).toBe(expected);
  });

  it.each([
    [12, '12+ results'],
    [1, '1+ results'],
    [1234, '1,234+ results'],
  ])('shows %d as a lower bound when more pages exist', (total, expected) => {
    expect(formatSearchTotal(total, true)).toBe(expected);
  });
});

describe('getPredictiveStatusMessage', () => {
  const base = {state: 'idle' as const, term: 'pillow', total: 3, error: null};

  it('announces that a search is running', () => {
    expect(getPredictiveStatusMessage({...base, state: 'loading'})).toBe(
      'Searching…',
    );
    expect(getPredictiveStatusMessage({...base, state: 'submitting'})).toBe(
      'Searching…',
    );
  });

  it('announces the number of results for the term', () => {
    expect(getPredictiveStatusMessage(base)).toBe('3 results for pillow');
    expect(getPredictiveStatusMessage({...base, total: 1})).toBe(
      '1 result for pillow',
    );
  });

  it('announces when nothing matched', () => {
    expect(getPredictiveStatusMessage({...base, total: 0})).toBe(
      'No results for pillow',
    );
  });

  it('announces a failed search with the generic message', () => {
    expect(
      getPredictiveStatusMessage({
        ...base,
        total: 0,
        error: SEARCH_UNAVAILABLE_MESSAGE,
      }),
    ).toBe(SEARCH_UNAVAILABLE_MESSAGE);
  });

  it('says nothing without a term, whatever else is stale', () => {
    expect(getPredictiveStatusMessage({...base, term: ''})).toBe('');
    expect(
      getPredictiveStatusMessage({...base, term: '', state: 'loading'}),
    ).toBe('');
    expect(
      getPredictiveStatusMessage({
        ...base,
        term: '',
        total: 0,
        error: SEARCH_UNAVAILABLE_MESSAGE,
      }),
    ).toBe('');
  });

  it('prefers "Searching…" over a stale error while a new search runs', () => {
    expect(
      getPredictiveStatusMessage({
        ...base,
        state: 'loading',
        error: SEARCH_UNAVAILABLE_MESSAGE,
      }),
    ).toBe('Searching…');
  });
});
