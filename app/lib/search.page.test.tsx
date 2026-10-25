import type {ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {
  StaticRouterProvider,
  createStaticHandler,
  createStaticRouter,
} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import SearchPage, {loader, meta} from '~/routes/search';

// Only the search page's own logic is under test: swap the product grid and
// the analytics component for stand-ins.
const {searchView} = vi.hoisted(() => ({searchView: vi.fn()}));

vi.mock('~/lib/analytics', async (importOriginal) => {
  const original = await importOriginal<typeof import('~/lib/analytics')>();
  return {
    ...original,
    Analytics: {
      ...original.Analytics,
      SearchView: (props: unknown) => {
        searchView(props);
        return null;
      },
    },
  };
});

vi.mock('~/components/PaginatedResourceSection', () => ({
  PaginatedResourceSection: ({
    connection,
    children: Card,
  }: {
    connection: {nodes: Array<{id: string}>};
    children: (args: {node: {id: string}; index: number}) => ReactNode;
  }) => (
    <div data-testid="grid">
      {connection.nodes.map((node, index) => (
        <div key={node.id}>{Card({node, index})}</div>
      ))}
    </div>
  ),
}));

vi.mock('~/components/ProductCard', () => ({
  ProductCard: ({product}: {product: {title: string}}) => (
    <article>{product.title}</article>
  ),
}));

const GENERIC_MESSAGE = 'Search is unavailable right now. Please try again.';

function productNodes(count: number) {
  return Array.from({length: count}, (_, i) => ({
    __typename: 'Product',
    id: `gid://shopify/Product/${i}`,
    handle: `product-${i}`,
    title: `Product ${i}`,
    trackingParameters: null,
  }));
}

function regularData({
  products = 0,
  pages = 0,
  articles = 0,
  hasNextPage = false,
  totalProducts,
}: {
  products?: number;
  pages?: number;
  articles?: number;
  hasNextPage?: boolean;
  /** Defaults to `products`: the whole result fits on one page. */
  totalProducts?: number;
} = {}) {
  return {
    articles: {
      nodes: Array.from({length: articles}, (_, i) => ({
        id: `a${i}`,
        handle: `article-${i}`,
        title: `Article ${i}`,
        trackingParameters: null,
        blog: {handle: 'news'},
      })),
    },
    pages: {
      nodes: Array.from({length: pages}, (_, i) => ({
        id: `p${i}`,
        handle: `page-${i}`,
        title: `Page ${i}`,
        trackingParameters: null,
      })),
    },
    products: {
      totalCount: totalProducts ?? products,
      nodes: productNodes(products),
      pageInfo: {
        hasNextPage,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
      },
    },
  };
}

describe('/search page', () => {
  const query = vi.fn();

  /** Runs the real loader, then renders the page the way the server does. */
  async function visit(search: string) {
    const routes = [
      {
        id: 'routes/search',
        path: '/search',
        loader: ({request}: {request: Request}) =>
          loader({
            request,
            params: {},
            context: {storefront: {query}},
          } as unknown as Parameters<typeof loader>[0]),
        Component: SearchPage,
      },
    ];
    const handler = createStaticHandler(routes);
    const context = await handler.query(
      new Request(`https://mellow.example/search${search}`),
    );
    if (context instanceof Response) throw new Error('unexpected redirect');
    const router = createStaticRouter(handler.dataRoutes, context);
    const html = renderToStaticMarkup(
      <StaticRouterProvider
        router={router}
        context={context}
        hydrate={false}
      />,
    );
    return {html, status: context.statusCode};
  }

  beforeEach(() => {
    query.mockReset();
    searchView.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('without a search term', () => {
    it.each(['', '?q=', '?q=%20%20'])(
      'shows the prompt for %j without calling the API or analytics',
      async (search) => {
        // Act
        const {html, status} = await visit(search);

        // Assert
        expect(status).toBe(200);
        expect(html).toContain('What are you looking for?');
        expect(html).not.toContain('No results');
        expect(query).not.toHaveBeenCalled();
        expect(searchView).not.toHaveBeenCalled();
      },
    );
  });

  describe('with results', () => {
    it('shows the exact count when every result was fetched', async () => {
      // Arrange
      query.mockResolvedValue(
        regularData({products: 3, pages: 1, articles: 1}),
      );

      // Act
      const {html} = await visit('?q=pillow');

      // Assert
      expect(html).toContain('5 results');
      expect(html).not.toContain('5+ results');
      expect(html).toContain('<q>pillow</q>');
    });

    it('uses the singular for a single result', async () => {
      query.mockResolvedValue(regularData({products: 1}));

      const {html} = await visit('?q=pillow');

      expect(html).toContain('1 result');
      expect(html).not.toContain('1 results');
    });

    it('counts every matching product from totalCount, not just the fetched page', async () => {
      // Arrange: one page of 12 products out of 13 plus a page.
      query.mockResolvedValue(
        regularData({
          products: 12,
          pages: 1,
          hasNextPage: true,
          totalProducts: 13,
        }),
      );

      // Act
      const {html} = await visit('?q=a');

      // Assert
      expect(html).toContain('14 results');
      expect(html).not.toContain('+ results');
    });

    it('renders the products and the term in the search field', async () => {
      query.mockResolvedValue(regularData({products: 2}));

      const {html} = await visit('?q=cool%20pillow');

      expect(html).toContain('Product 0');
      expect(html).toContain('Product 1');
      expect(html).toContain('value="cool pillow"');
    });

    it('sends the search to analytics once', async () => {
      query.mockResolvedValue(regularData({products: 2}));

      await visit('?q=pillow');

      expect(searchView).toHaveBeenCalledTimes(1);
      expect(searchView.mock.calls[0][0]).toMatchObject({
        data: {searchTerm: 'pillow', searchResults: {total: 2}},
      });
    });
  });

  describe('with no matches', () => {
    it('says so, and still reports the search to analytics', async () => {
      query.mockResolvedValue(regularData());

      const {html, status} = await visit('?q=zzz');

      expect(status).toBe(200);
      expect(html).toContain('No results for');
      expect(html).not.toContain('search-summary');
      expect(searchView).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the Storefront API fails', () => {
    beforeEach(() => {
      query.mockRejectedValue(
        new Error('Variable "$term" got invalid value; request-id 9f3c'),
      );
    });

    it('answers 503', async () => {
      const {status} = await visit('?q=pillow');

      expect(status).toBe(503);
    });

    it('shows only the generic message, as an alert', async () => {
      const {html} = await visit('?q=pillow');

      expect(html).toContain(`role="alert">${GENERIC_MESSAGE}<`);
      expect(html).not.toContain('Variable');
      expect(html).not.toContain('request-id');
    });

    it('does not claim there are no results, and keeps the term to retry', async () => {
      const {html} = await visit('?q=pillow');

      expect(html).not.toContain('No results');
      expect(html).not.toContain('search-summary');
      expect(html).toContain('value="pillow"');
    });

    it('does not report a search that never happened to analytics', async () => {
      await visit('?q=pillow');

      expect(searchView).not.toHaveBeenCalled();
    });
  });

  it('renders nothing for a predictive search response', async () => {
    query.mockResolvedValue({
      predictiveSearch: {
        articles: [],
        collections: [],
        pages: [],
        products: [],
        queries: [],
      },
    });

    const {html} = await visit('?q=pillow&predictive=1');

    expect(html).toBe('');
  });
});

describe('/search meta', () => {
  type MetaArgs = Parameters<typeof meta>[0];
  const metaFor = (data: unknown) =>
    meta({data} as unknown as MetaArgs) as Array<Record<string, string>>;

  it('puts the term in the title and keeps search pages out of the index', () => {
    const tags = metaFor({type: 'regular', term: 'cool pillow'});

    expect(tags[0].title).toBe('Search results for “cool pillow” | Mellow');
    expect(tags).toContainEqual({name: 'robots', content: 'noindex'});
  });

  it.each([
    ['without a term', {type: 'regular', term: ''}],
    ['for a predictive response', {type: 'predictive', term: 'pillow'}],
    ['without data', undefined],
  ])('uses the plain title %s', (_label, data) => {
    expect(metaFor(data)[0].title).toBe('Search | Mellow');
  });
});
