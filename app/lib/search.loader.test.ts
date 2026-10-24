import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {loader} from '~/routes/search';

type LoaderArgs = Parameters<typeof loader>[0];

const GENERIC_MESSAGE = 'Search is unavailable right now. Please try again.';

/** Raw text of the kind the Storefront API puts in `errors[].message`. */
const INTERNAL_ERROR =
  'Variable "$limit" got invalid value NaN; Int cannot represent non-integer value: NaN [request-id 9f3c]';

const productNode = (id: number) => ({
  __typename: 'Product',
  id: `gid://shopify/Product/${id}`,
  handle: `product-${id}`,
  title: `Product ${id}`,
});

function regularData({
  products = 0,
  pages = 0,
  articles = 0,
  hasNextPage = false,
} = {}) {
  return {
    articles: {
      nodes: Array.from({length: articles}, (_, i) => ({id: `article-${i}`})),
    },
    pages: {nodes: Array.from({length: pages}, (_, i) => ({id: `page-${i}`}))},
    products: {
      nodes: Array.from({length: products}, (_, i) => productNode(i)),
      pageInfo: {
        hasNextPage,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
      },
    },
  };
}

function predictiveData(overrides: Record<string, unknown[]> = {}) {
  return {
    articles: [],
    collections: [],
    pages: [],
    products: [],
    queries: [],
    ...overrides,
  };
}

describe('/search loader', () => {
  const query = vi.fn();

  function load(search: string) {
    const args = {
      request: new Request(`https://mellow.example/search${search}`),
      params: {},
      context: {storefront: {query}},
    } as unknown as LoaderArgs;
    return loader(args);
  }

  beforeEach(() => {
    query.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('regular search', () => {
    it('queries the Storefront API and counts the fetched results', async () => {
      // Arrange
      query.mockResolvedValue(
        regularData({products: 3, pages: 1, articles: 2}),
      );

      // Act
      const result = await load('?q=pillow');

      // Assert
      expect(query).toHaveBeenCalledTimes(1);
      expect(query.mock.calls[0][1].variables).toMatchObject({
        term: 'pillow',
        first: 12,
      });
      expect(result).toMatchObject({
        type: 'regular',
        term: 'pillow',
        result: {total: 6},
      });
    });

    it('trims the term', async () => {
      query.mockResolvedValue(regularData({products: 1}));

      const result = await load('?q=%20%20cool%20pillow%20%20');

      expect(query.mock.calls[0][1].variables.term).toBe('cool pillow');
      expect(result).toMatchObject({term: 'cool pillow'});
    });

    it.each(['', '?q=', '?q=%20%20%20', '?other=1', '?q=%09%0A'])(
      'answers an empty search (%j) without calling the API',
      async (search) => {
        // Act
        const result = await load(search);

        // Assert
        expect(query).not.toHaveBeenCalled();
        expect(result).toEqual({
          type: 'regular',
          term: '',
          result: {
            total: 0,
            items: {
              articles: {nodes: []},
              pages: {nodes: []},
              products: {
                totalCount: 0,
                nodes: [],
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: false,
                  startCursor: null,
                  endCursor: null,
                },
              },
            },
          },
        });
      },
    );

    it('passes the pagination cursor through', async () => {
      query.mockResolvedValue(regularData({products: 1}));

      await load('?q=pillow&cursor=abc&direction=next');

      expect(query.mock.calls[0][1].variables).toMatchObject({
        term: 'pillow',
        first: 12,
        endCursor: 'abc',
      });
    });

    describe('when the Storefront API fails', () => {
      it('answers 503 with a generic message instead of the raw error', async () => {
        // Arrange
        query.mockRejectedValue(new Error(INTERNAL_ERROR));

        // Act
        const result = await load('?q=pillow');

        // Assert
        expect(result).toMatchObject({
          init: {status: 503},
          data: {
            type: 'regular',
            term: 'pillow',
            error: GENERIC_MESSAGE,
            result: null,
          },
        });
        expect(JSON.stringify(result)).not.toContain('Variable');
        expect(JSON.stringify(result)).not.toContain('request-id');
      });

      it('logs the real error on the server', async () => {
        const failure = new Error(INTERNAL_ERROR);
        query.mockRejectedValue(failure);

        await load('?q=pillow');

        expect(console.error).toHaveBeenCalled();
        const logged = vi.mocked(console.error).mock.calls.flat();
        expect(logged).toContain(failure);
      });

      it('treats GraphQL errors in the response the same way', async () => {
        // Arrange
        query.mockResolvedValue({
          ...regularData({products: 2}),
          errors: [{message: INTERNAL_ERROR}],
        });

        // Act
        const result = await load('?q=pillow');

        // Assert
        expect(result).toMatchObject({
          init: {status: 503},
          data: {error: GENERIC_MESSAGE, result: null},
        });
        expect(JSON.stringify(result)).not.toContain('Variable');
        expect(console.error).toHaveBeenCalled();
      });

      it('keeps the term so the form can be retried', async () => {
        query.mockRejectedValue(new Error('boom'));

        const result = await load('?q=cooling%20comforter');

        expect(result).toMatchObject({data: {term: 'cooling comforter'}});
      });
    });
  });

  describe('predictive search', () => {
    const variablesOfCall = () => query.mock.calls[0][1].variables;

    it('queries with the term, the limit and the EACH scope', async () => {
      query.mockResolvedValue({predictiveSearch: predictiveData()});

      await load('?q=pillow&predictive=1&limit=5');

      expect(variablesOfCall()).toEqual({
        limit: 5,
        limitScope: 'EACH',
        term: 'pillow',
      });
    });

    it.each([
      ['', 10],
      ['&limit=', 10],
      ['&limit=abc', 10],
      ['&limit=NaN', 10],
      ['&limit=Infinity', 10],
      ['&limit=7abc', 10],
      ['&limit=0', 1],
      ['&limit=-5', 1],
      ['&limit=3.7', 3],
      ['&limit=10', 10],
      ['&limit=11', 10],
      ['&limit=100000', 10],
      ['&limit=1e9', 10],
    ])('turns the limit parameter %j into %d', async (suffix, expected) => {
      query.mockResolvedValue({predictiveSearch: predictiveData()});

      await load(`?q=a&predictive=1${suffix}`);

      expect(variablesOfCall().limit).toBe(expected);
      expect(Number.isInteger(variablesOfCall().limit)).toBe(true);
    });

    it('counts the listed results but not the query suggestions', async () => {
      // Query suggestions only feed the <datalist>, so they are not announced.
      query.mockResolvedValue({
        predictiveSearch: predictiveData({
          products: [productNode(1), productNode(2)],
          collections: [{id: 'c'}],
          queries: [{text: 'pillow case'}],
        }),
      });

      const result = await load('?q=pillow&predictive=1');

      expect(result).toMatchObject({
        type: 'predictive',
        term: 'pillow',
        result: {total: 3},
      });
    });

    it.each(['?predictive=1', '?q=&predictive=1', '?q=%20&predictive=1'])(
      'answers an empty search (%j) without calling the API',
      async (search) => {
        const result = await load(search);

        expect(query).not.toHaveBeenCalled();
        expect(result).toMatchObject({
          type: 'predictive',
          term: '',
          result: {total: 0},
        });
      },
    );

    describe('when the Storefront API fails', () => {
      it('answers 503 with a generic message instead of the raw error', async () => {
        // Arrange: this is what /search?q=a&predictive=1&limit=abc used to leak.
        query.mockRejectedValue(new Error(INTERNAL_ERROR));

        // Act
        const result = await load('?q=a&predictive=1&limit=3');

        // Assert
        expect(result).toMatchObject({
          init: {status: 503},
          data: {
            type: 'predictive',
            term: 'a',
            error: GENERIC_MESSAGE,
            result: null,
          },
        });
        expect(JSON.stringify(result)).not.toContain('Variable');
        expect(console.error).toHaveBeenCalled();
      });

      it('treats GraphQL errors in the response the same way', async () => {
        query.mockResolvedValue({
          predictiveSearch: predictiveData(),
          errors: [{message: INTERNAL_ERROR}],
        });

        const result = await load('?q=a&predictive=1');

        expect(result).toMatchObject({
          init: {status: 503},
          data: {error: GENERIC_MESSAGE, result: null},
        });
        expect(JSON.stringify(result)).not.toContain('Variable');
      });

      it('treats a missing predictiveSearch payload the same way', async () => {
        query.mockResolvedValue({predictiveSearch: null});

        const result = await load('?q=a&predictive=1');

        expect(result).toMatchObject({
          init: {status: 503},
          data: {error: GENERIC_MESSAGE, result: null},
        });
      });
    });
  });
});
