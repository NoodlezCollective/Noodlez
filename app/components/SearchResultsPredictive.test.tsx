import {renderToStaticMarkup} from 'react-dom/server';
import {StaticRouter} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {SearchResultsPredictive} from './SearchResultsPredictive';

const mocks = vi.hoisted(() => ({
  asideClose: vi.fn(),
  fetcher: {} as Record<string, unknown>,
}));

vi.mock('react-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router')>();
  return {...original, useFetcher: () => mocks.fetcher};
});

vi.mock('./Aside', () => ({
  useAside: () => ({type: 'search', open: vi.fn(), close: mocks.asideClose}),
}));

type RenderArgs = Parameters<
  Parameters<typeof SearchResultsPredictive>[0]['children']
>[0];

/** Renders the drawer results and hands back what the render prop received. */
function render(children?: (args: RenderArgs) => React.ReactNode) {
  let received: RenderArgs | undefined;
  const html = renderToStaticMarkup(
    <StaticRouter location="/">
      <SearchResultsPredictive>
        {(args) => {
          received = args;
          return children ? children(args) : null;
        }}
      </SearchResultsPredictive>
    </StaticRouter>,
  );
  if (!received) throw new Error('the render prop was not called');
  return {html, args: received};
}

const emptyItems = {
  articles: [],
  collections: [],
  pages: [],
  products: [],
  queries: [],
};

function fetcherState(overrides: Record<string, unknown> = {}) {
  return {
    state: 'idle',
    data: undefined,
    formData: undefined,
    reset: vi.fn(),
    submit: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mocks.asideClose.mockReset();
  mocks.fetcher = fetcherState();
});

describe('SearchResultsPredictive', () => {
  describe('live region', () => {
    it('is a polite, atomic, visually hidden region that starts empty', () => {
      const {html} = render();

      expect(html).toContain(
        '<div class="sr-only" aria-live="polite" aria-atomic="true"></div>',
      );
    });

    it('announces "Searching…" while a search for a term is loading', () => {
      mocks.fetcher = fetcherState({
        state: 'loading',
        formData: new URLSearchParams({q: 'pillow'}),
      });

      const {html} = render();

      expect(html).toContain('aria-atomic="true">Searching…</div>');
    });

    it('stays quiet while loading an empty term', () => {
      mocks.fetcher = fetcherState({
        state: 'loading',
        formData: new URLSearchParams({q: ''}),
      });

      const {html} = render();

      expect(html).toContain('aria-atomic="true"></div>');
    });

    it('renders the drawer content next to the region, not inside it', () => {
      const {html} = render(() => <p id="content">content</p>);

      expect(html).toMatch(/<\/div><p id="content">content<\/p>$/);
    });
  });

  describe('closeSearch', () => {
    it('clears the input, forgets the term and the old results, then closes', () => {
      // Arrange: a search for "pillow" is in flight, so the term is known.
      mocks.fetcher = fetcherState({
        state: 'loading',
        formData: new URLSearchParams({q: 'pillow'}),
      });
      const {args} = render();
      const input = {value: 'pillow', blur: vi.fn()};
      args.inputRef.current = input as unknown as HTMLInputElement;
      expect(args.term.current).toBe('pillow');

      // Act
      args.closeSearch();

      // Assert
      expect(input.value).toBe('');
      expect(input.blur).toHaveBeenCalled();
      expect(args.term.current).toBe('');
      expect(mocks.fetcher.reset).toHaveBeenCalledTimes(1);
      expect(mocks.asideClose).toHaveBeenCalledTimes(1);
    });

    it('works before the input has been captured', () => {
      const {args} = render();

      expect(() => args.closeSearch()).not.toThrow();
      expect(mocks.asideClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('render prop arguments', () => {
    it('passes the empty result until a search has run', () => {
      const {args} = render();

      expect(args.total).toBe(0);
      expect(args.items).toEqual(emptyItems);
      expect(args.state).toBe('idle');
    });

    it('passes the fetched result', () => {
      const items = {
        ...emptyItems,
        pages: [{id: 'p', title: 'FAQ', handle: 'faq'}],
      };
      mocks.fetcher = fetcherState({
        data: {type: 'predictive', term: 'faq', result: {total: 1, items}},
      });

      const {args} = render();

      expect(args.total).toBe(1);
      expect(args.items).toBe(items);
    });

    it('treats a failed search as an empty result', () => {
      mocks.fetcher = fetcherState({
        data: {
          type: 'predictive',
          term: 'faq',
          result: null,
          error: 'Search is unavailable right now. Please try again.',
        },
      });

      const {args} = render();

      expect(args.total).toBe(0);
      expect(args.items).toEqual(emptyItems);
    });
  });
});

describe('SearchResultsPredictive result groups', () => {
  const term = (current: string) => ({current});
  const closeSearch = vi.fn();
  const markup = (node: React.ReactNode) =>
    renderToStaticMarkup(<StaticRouter location="/">{node}</StaticRouter>);

  it('titles each group with an h4 (the drawer heading is above it)', () => {
    const html = markup(
      <>
        <SearchResultsPredictive.Products
          term={term('pillow')}
          closeSearch={closeSearch}
          products={
            [
              {
                id: 'p1',
                handle: 'cloudalign',
                title: 'CloudAlign',
                trackingParameters: null,
              },
            ] as never
          }
        />
        <SearchResultsPredictive.Pages
          term={term('pillow')}
          closeSearch={closeSearch}
          pages={
            [
              {id: 'pg', handle: 'faq', title: 'FAQ', trackingParameters: null},
            ] as never
          }
        />
      </>,
    );

    expect(html.match(/<h4 /g)).toHaveLength(2);
    expect(html).not.toContain('<h5');
    expect(html).toContain('>Products</h4>');
    expect(html).toContain('>Pages</h4>');
  });

  it('encodes the search term once in result links', () => {
    const html = markup(
      <SearchResultsPredictive.Products
        term={term('a&b c')}
        closeSearch={closeSearch}
        products={
          [
            {
              id: 'p1',
              handle: 'cloudalign',
              title: 'CloudAlign',
              trackingParameters: 'utm_source=shopify',
            },
          ] as never
        }
      />,
    );

    expect(html).toContain(
      'href="/products/cloudalign?q=a%26b+c&amp;utm_source=shopify"',
    );
    expect(html).not.toContain('%25');
  });

  it('renders nothing for a group without results', () => {
    const html = markup(
      <SearchResultsPredictive.Collections
        term={term('x')}
        closeSearch={closeSearch}
        collections={[]}
      />,
    );

    expect(html).toBe('');
  });

  it('links articles through their blog, with a thumbnail when there is one', () => {
    const html = markup(
      <SearchResultsPredictive.Articles
        term={term('sleep tips')}
        closeSearch={closeSearch}
        articles={
          [
            {
              id: 'a1',
              handle: 'cooler-nights',
              title: 'Cooler nights',
              trackingParameters: null,
              blog: {handle: 'news'},
              image: {
                url: 'https://cdn.example/a.jpg',
                altText: 'A bed',
                width: 400,
                height: 300,
              },
            },
            {
              id: 'a2',
              handle: 'no-image',
              title: 'No image',
              trackingParameters: null,
              blog: {handle: 'news'},
              image: null,
            },
          ] as never
        }
      />,
    );

    expect(html).toContain('>Articles</h4>');
    expect(html).toContain('href="/blogs/news/cooler-nights?q=sleep+tips"');
    expect(html).toContain('href="/blogs/news/no-image?q=sleep+tips"');
    expect(html).toContain('https://cdn.example/a.jpg');
    expect(html).toContain('>Article</span>');
  });

  it('links collections by handle', () => {
    const html = markup(
      <SearchResultsPredictive.Collections
        term={term('bath')}
        closeSearch={closeSearch}
        collections={
          [
            {
              id: 'c1',
              handle: 'bath',
              title: 'Bath',
              trackingParameters: 'utm_source=shopify',
              image: null,
            },
          ] as never
        }
      />,
    );

    expect(html).toContain('>Collections</h4>');
    expect(html).toContain(
      'href="/collections/bath?q=bath&amp;utm_source=shopify"',
    );
    expect(html).toContain('>Collection</span>');
  });

  it('shows the price of the first available variant on product results', () => {
    const html = markup(
      <SearchResultsPredictive.Products
        term={term('pillow')}
        closeSearch={closeSearch}
        products={
          [
            {
              id: 'p1',
              handle: 'cloudalign',
              title: 'CloudAlign',
              trackingParameters: null,
              selectedOrFirstAvailableVariant: {
                id: 'v1',
                image: null,
                price: {amount: '59.0', currencyCode: 'USD'},
                compareAtPrice: {amount: '79.0', currencyCode: 'USD'},
              },
            },
            {
              id: 'p2',
              handle: 'sold-out',
              title: 'Sold out',
              trackingParameters: null,
              selectedOrFirstAvailableVariant: null,
            },
          ] as never
        }
      />,
    );

    expect(html).toContain('CloudAlign');
    expect(html).toContain('$59');
    expect(html).toContain('$79');
    expect(html).toContain('Sold out');
  });

  describe('Queries', () => {
    it('offers the suggestions as a datalist for the search input', () => {
      const html = markup(
        <SearchResultsPredictive.Queries
          queriesDatalistId="suggestions"
          queries={[{text: 'pillow case'}, null, {text: 'pillow top'}] as never}
        />,
      );

      expect(html).toBe(
        '<datalist id="suggestions"><option value="pillow case"></option><option value="pillow top"></option></datalist>',
      );
    });

    it('renders nothing without suggestions', () => {
      const html = markup(
        <SearchResultsPredictive.Queries queriesDatalistId="s" queries={[]} />,
      );

      expect(html).toBe('');
    });
  });

  describe('Empty', () => {
    it('renders nothing without a term', () => {
      expect(markup(<SearchResultsPredictive.Empty term={term('')} />)).toBe(
        '',
      );
    });

    it('says there are no results for the term', () => {
      const html = markup(<SearchResultsPredictive.Empty term={term('zzz')} />);

      expect(html).toContain('No results for <q>zzz</q>');
    });

    it('reports a failed search instead of "no results"', () => {
      mocks.fetcher = fetcherState({
        data: {
          type: 'predictive',
          term: 'zzz',
          result: null,
          error: 'Search is unavailable right now. Please try again.',
        },
      });

      const html = markup(<SearchResultsPredictive.Empty term={term('zzz')} />);

      expect(html).toContain(
        'Search is unavailable right now. Please try again.',
      );
      expect(html).not.toContain('No results');
    });
  });
});
