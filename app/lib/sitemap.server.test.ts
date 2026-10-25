import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  expectValidStorefrontDocument,
  thrownResponse,
} from './__tests__/route-test-utils';
import {getSitemap, getSitemapIndex, type SitemapType} from './sitemap.server';
import {
  createStorefrontClient,
  type Storefront,
} from './storefront/client.server';
import {isQueryDocument} from './storefront/graphql';

/**
 * The expected XML below is what Hydrogen 2026.4.7's `getSitemapIndex` /
 * `getSitemap` returned for the same input (captured once from the package's
 * development build; the port must not change a byte). Blank lines included:
 * they come from Hydrogen's templates.
 */

const ORIGIN = 'https://shop.example';
const STORE_DOMAIN = 'mellow-test.myshopify.com';
const XML_HEADERS = {
  'content-type': 'application/xml',
  'cache-control': 'max-age=86400',
};
const ALL_TYPES: SitemapType[] = [
  'products',
  'collections',
  'pages',
  'blogs',
  'articles',
  'metaObjects',
];
const ALL_TYPE_COUNTS = {
  products: 2,
  pages: 1,
  collections: 1,
  metaObjects: 1,
  articles: 1,
  blogs: 1,
};
const PILLOW = {handle: 'cloudalign-pillow', updatedAt: '2026-09-01T00:00:00Z'};
const MASK = {handle: 'sleep-mask', updatedAt: '2026-09-02T10:30:00Z'};

type GetLink = Parameters<typeof getSitemap>[0]['getLink'];
type SitemapItem = {handle: string; updatedAt: string; type?: string};

/** A storefront whose `query` resolves to `answer` and records every call. */
function createFakeStorefront(answer?: unknown) {
  const query = vi.fn(async (..._args: unknown[]) => answer);
  return {query, storefront: {query} as unknown as Pick<Storefront, 'query'>};
}

/** The sitemap index answer for the given page counts. */
function pageCounts(counts: Partial<Record<SitemapType, number>>) {
  return Object.fromEntries(
    Object.entries(counts).map(([type, count]) => [
      type,
      {pagesCount: {count}},
    ]),
  );
}

/** A child sitemap answer listing `items`. */
function sitemapItems(items: SitemapItem[]) {
  return {sitemap: {resources: {items}}};
}

/** Hydrogen's documented link shape, with a locale prefix for alternates. */
const linkTo: GetLink = ({type, baseUrl, handle, locale}) =>
  `${baseUrl}${locale ? `/${locale.toLowerCase()}` : ''}/${type}/${handle}`;

function indexRequest(url = `${ORIGIN}/sitemap.xml`) {
  return new Request(url);
}

function pageRequest(type: string, page: string) {
  return new Request(`${ORIGIN}/sitemap/${type}/${page}.xml`);
}

/** Locations written to a sitemap XML document. */
function locs(xml: string) {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getSitemapIndex', () => {
  it("writes Hydrogen's sitemap index byte for byte, every type by default", async () => {
    const {storefront} = createFakeStorefront(pageCounts(ALL_TYPE_COUNTS));

    const response = await getSitemapIndex({
      storefront,
      request: indexRequest(),
    });

    expect(await response.text()).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <sitemap><loc>https://shop.example/sitemap/products/1.xml</loc></sitemap>',
        '  <sitemap><loc>https://shop.example/sitemap/products/2.xml</loc></sitemap>',
        '',
        '  <sitemap><loc>https://shop.example/sitemap/pages/1.xml</loc></sitemap>',
        '',
        '  <sitemap><loc>https://shop.example/sitemap/collections/1.xml</loc></sitemap>',
        '',
        '  <sitemap><loc>https://shop.example/sitemap/metaObjects/1.xml</loc></sitemap>',
        '',
        '  <sitemap><loc>https://shop.example/sitemap/articles/1.xml</loc></sitemap>',
        '',
        '  <sitemap><loc>https://shop.example/sitemap/blogs/1.xml</loc></sitemap>',
        '',
        '</sitemapindex>',
      ].join('\n'),
    );
  });

  it('lists only the requested types, in order, keeping the separator of a type without pages', async () => {
    const {storefront} = createFakeStorefront(
      pageCounts({products: 1, pages: 0, blogs: 1}),
    );

    const response = await getSitemapIndex({
      storefront,
      request: indexRequest(),
      types: ['products', 'pages', 'blogs'],
    });

    expect(await response.text()).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <sitemap><loc>https://shop.example/sitemap/products/1.xml</loc></sitemap>',
        '',
        '',
        '  <sitemap><loc>https://shop.example/sitemap/blogs/1.xml</loc></sitemap>',
        '',
        '</sitemapindex>',
      ].join('\n'),
    );
  });

  it('appends custom child sitemaps, with or without a leading slash', async () => {
    const {storefront} = createFakeStorefront(pageCounts(ALL_TYPE_COUNTS));

    const response = await getSitemapIndex({
      storefront,
      request: indexRequest(),
      types: ['blogs'],
      customChildSitemaps: ['/sitemap-custom.xml', 'extra/sitemap.xml'],
    });

    expect(await response.text()).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <sitemap><loc>https://shop.example/sitemap/blogs/1.xml</loc></sitemap>',
        '  <sitemap><loc>https://shop.example/sitemap-custom.xml</loc></sitemap>',
        '  <sitemap><loc>https://shop.example/extra/sitemap.xml</loc></sitemap>',
        '</sitemapindex>',
      ].join('\n'),
    );
  });

  it('lists only the custom child sitemaps when no types are requested', async () => {
    const {storefront} = createFakeStorefront(pageCounts(ALL_TYPE_COUNTS));

    const response = await getSitemapIndex({
      storefront,
      request: indexRequest(),
      types: [],
      customChildSitemaps: ['a.xml'],
    });

    expect(await response.text()).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <sitemap><loc>https://shop.example/a.xml</loc></sitemap>',
        '</sitemapindex>',
      ].join('\n'),
    );
  });

  it('builds every location from the request origin alone', async () => {
    const {storefront} = createFakeStorefront(pageCounts(ALL_TYPE_COUNTS));

    const response = await getSitemapIndex({
      storefront,
      request: indexRequest('http://localhost:3000/nested/sitemap.xml?x=1'),
      types: ['pages'],
    });

    expect(await response.text()).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <sitemap><loc>http://localhost:3000/sitemap/pages/1.xml</loc></sitemap>',
        '',
        '</sitemapindex>',
      ].join('\n'),
    );
  });

  it('lists one child sitemap per page, even for a large catalog', async () => {
    const {storefront} = createFakeStorefront(pageCounts({products: 5000}));

    const response = await getSitemapIndex({
      storefront,
      request: indexRequest(),
      types: ['products'],
    });

    const urls = locs(await response.text());
    expect(urls).toHaveLength(5000);
    expect(urls.at(0)).toBe(`${ORIGIN}/sitemap/products/1.xml`);
    expect(urls.at(-1)).toBe(`${ORIGIN}/sitemap/products/5000.xml`);
  });

  it('sends one sitemap index query, without variables', async () => {
    const {query, storefront} = createFakeStorefront(
      pageCounts(ALL_TYPE_COUNTS),
    );

    await getSitemapIndex({storefront, request: indexRequest()});

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]).toHaveLength(1);
    const [document] = query.mock.calls[0];
    expect(document).toEqual(expect.stringContaining('query SitemapIndex {'));
    for (const [alias, type] of [
      ['products', 'PRODUCT'],
      ['collections', 'COLLECTION'],
      ['articles', 'ARTICLE'],
      ['pages', 'PAGE'],
      ['blogs', 'BLOG'],
      ['metaObjects', 'METAOBJECT'],
    ]) {
      expect(document).toContain(`${alias}: sitemap(type: ${type})`);
    }
  });

  it('answers 200 with XML that may be cached for a day', async () => {
    const {storefront} = createFakeStorefront(pageCounts(ALL_TYPE_COUNTS));

    const response = await getSitemapIndex({
      storefront,
      request: indexRequest(),
    });

    expect(response.status).toBe(200);
    expect(Object.fromEntries(response.headers)).toEqual(XML_HEADERS);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])(
    'throws a 404 and warns when the Storefront API answers %s',
    async (_label, answer) => {
      const {storefront} = createFakeStorefront(answer);

      const response = await thrownResponse(
        getSitemapIndex({storefront, request: indexRequest()}),
      );

      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Sitemap index not found.');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^\[sitemap\] /));
    },
  );

  it('rejects when a requested type is missing from the answer', async () => {
    const {storefront} = createFakeStorefront(pageCounts({products: 1}));

    await expect(
      getSitemapIndex({
        storefront,
        request: indexRequest(),
        types: ['products', 'blogs'],
      }),
    ).rejects.toThrow(
      '[sitemap] No data found for type blogs. Check types passed to `getSitemapIndex`',
    );
  });

  it('rejects the same way when a type comes back without a page count', async () => {
    const {storefront} = createFakeStorefront({blogs: {pagesCount: null}});

    await expect(
      getSitemapIndex({
        storefront,
        request: indexRequest(),
        types: ['blogs'],
      }),
    ).rejects.toThrow('[sitemap] No data found for type blogs.');
  });
});

describe('getSitemap', () => {
  it("writes Hydrogen's URL entries byte for byte", async () => {
    const {storefront} = createFakeStorefront(sitemapItems([PILLOW, MASK]));

    const response = await getSitemap({
      storefront,
      request: pageRequest('products', '1'),
      params: {type: 'products', page: '1'},
      getLink: linkTo,
    });

    expect(await response.text()).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"><url>',
        '  <loc>https://shop.example/products/cloudalign-pillow</loc>',
        '  <lastmod>2026-09-01T00:00:00Z</lastmod>',
        '  <changefreq>weekly</changefreq>',
        '',
        '</url>',
        '<url>',
        '  <loc>https://shop.example/products/sleep-mask</loc>',
        '  <lastmod>2026-09-02T10:30:00Z</lastmod>',
        '  <changefreq>weekly</changefreq>',
        '',
        '</url></urlset>',
      ].join('\n'),
    );
  });

  it('adds an alternate link for every locale, built by getLink', async () => {
    const {storefront} = createFakeStorefront(sitemapItems([PILLOW, MASK]));
    const getLink = vi.fn(linkTo);

    const response = await getSitemap({
      storefront,
      request: pageRequest('products', '1'),
      params: {type: 'products', page: '1'},
      getLink,
      locales: ['EN-US', 'FR-CA'],
    });

    expect(await response.text()).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"><url>',
        '  <loc>https://shop.example/products/cloudalign-pillow</loc>',
        '  <lastmod>2026-09-01T00:00:00Z</lastmod>',
        '  <changefreq>weekly</changefreq>',
        '  <xhtml:link rel="alternate" hreflang="EN-US" href="https://shop.example/en-us/products/cloudalign-pillow" />',
        '  <xhtml:link rel="alternate" hreflang="FR-CA" href="https://shop.example/fr-ca/products/cloudalign-pillow" />',
        '</url>',
        '<url>',
        '  <loc>https://shop.example/products/sleep-mask</loc>',
        '  <lastmod>2026-09-02T10:30:00Z</lastmod>',
        '  <changefreq>weekly</changefreq>',
        '  <xhtml:link rel="alternate" hreflang="EN-US" href="https://shop.example/en-us/products/sleep-mask" />',
        '  <xhtml:link rel="alternate" hreflang="FR-CA" href="https://shop.example/fr-ca/products/sleep-mask" />',
        '</url></urlset>',
      ].join('\n'),
    );
    expect(getLink).toHaveBeenCalledTimes(6);
    expect(getLink).toHaveBeenCalledWith({
      type: 'products',
      baseUrl: ORIGIN,
      handle: 'sleep-mask',
      locale: 'FR-CA',
    });
  });

  it('takes the change frequency from getChangeFreq when given', async () => {
    const {storefront} = createFakeStorefront(sitemapItems([PILLOW]));
    const getChangeFreq = vi.fn(() => 'daily');

    const response = await getSitemap({
      storefront,
      request: pageRequest('pages', '1'),
      params: {type: 'pages', page: '1'},
      getLink: linkTo,
      getChangeFreq,
    });

    expect(await response.text()).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"><url>',
        '  <loc>https://shop.example/pages/cloudalign-pillow</loc>',
        '  <lastmod>2026-09-01T00:00:00Z</lastmod>',
        '  <changefreq>daily</changefreq>',
        '',
        '</url></urlset>',
      ].join('\n'),
    );
    expect(getChangeFreq.mock.calls).toStrictEqual([
      [{type: 'pages', handle: 'cloudalign-pillow'}],
    ]);
  });

  it('uses the metaobject type of an item for its links and change frequency', async () => {
    const {storefront} = createFakeStorefront(
      sitemapItems([
        {handle: 'spring', updatedAt: '2026-03-01T00:00:00Z', type: 'lookbook'},
      ]),
    );
    const getLink = vi.fn(linkTo);

    const response = await getSitemap({
      storefront,
      request: pageRequest('metaObjects', '1'),
      params: {type: 'metaObjects', page: '1'},
      getLink,
      locales: ['EN-US'],
      getChangeFreq: ({type}) => `freq-${type}`,
    });

    expect(await response.text()).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"><url>',
        '  <loc>https://shop.example/lookbook/spring</loc>',
        '  <lastmod>2026-03-01T00:00:00Z</lastmod>',
        '  <changefreq>freq-lookbook</changefreq>',
        '  <xhtml:link rel="alternate" hreflang="EN-US" href="https://shop.example/en-us/lookbook/spring" />',
        '</url></urlset>',
      ].join('\n'),
    );
    // Exactly Hydrogen's arguments: no `locale` key at all for the main link.
    expect(getLink.mock.calls).toStrictEqual([
      [{type: 'lookbook', baseUrl: ORIGIN, handle: 'spring'}],
      [{type: 'lookbook', baseUrl: ORIGIN, handle: 'spring', locale: 'EN-US'}],
    ]);
  });

  it.each([
    ['no items', sitemapItems([])],
    ['no resources', {sitemap: {resources: null}}],
    ['no sitemap', {sitemap: null}],
    ['an empty object', {}],
  ])(
    'falls back to a single home page entry for an answer with %s',
    async (_label, answer) => {
      const {storefront} = createFakeStorefront(answer);

      const response = await getSitemap({
        storefront,
        request: pageRequest('blogs', '1'),
        params: {type: 'blogs', page: '1'},
        getLink: linkTo,
      });

      expect(await response.text()).toBe(
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
          '  <url><loc>https://shop.example/</loc></url>',
          '</urlset>',
        ].join('\n'),
      );
    },
  );

  it('falls back to noItemsFallback when given', async () => {
    const {storefront} = createFakeStorefront({sitemap: null});

    const response = await getSitemap({
      storefront,
      request: pageRequest('blogs', '1'),
      params: {type: 'blogs', page: '1'},
      getLink: linkTo,
      noItemsFallback: '/collections/all',
    });

    expect(await response.text()).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        '  <url><loc>https://shop.example/collections/all</loc></url>',
        '</urlset>',
      ].join('\n'),
    );
  });

  it.each([
    ['products', 'PRODUCT'],
    ['collections', 'COLLECTION'],
    ['pages', 'PAGE'],
    ['blogs', 'BLOG'],
    ['articles', 'ARTICLE'],
    ['metaObjects', 'METAOBJECT'],
  ])(
    'asks the Storefront API for the requested page of the %s sitemap',
    async (type, sitemapType) => {
      const {query, storefront} = createFakeStorefront(sitemapItems([]));

      await getSitemap({
        storefront,
        request: pageRequest(type, '7'),
        params: {type, page: '7'},
        getLink: linkTo,
      });

      expect(query).toHaveBeenCalledTimes(1);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining(`sitemap(type: ${sitemapType})`),
        {variables: {page: 7}},
      );
    },
  );

  it('answers 200 with XML that may be cached for a day', async () => {
    const {storefront} = createFakeStorefront(sitemapItems([PILLOW]));

    const response = await getSitemap({
      storefront,
      request: pageRequest('products', '1'),
      params: {type: 'products', page: '1'},
      getLink: linkTo,
    });

    expect(response.status).toBe(200);
    expect(Object.fromEntries(response.headers)).toEqual(XML_HEADERS);
  });

  it('lists every item of a full page', async () => {
    const items = Array.from({length: 250}, (_, index) => ({
      handle: `product-${index + 1}`,
      updatedAt: '2026-09-01T00:00:00Z',
    }));
    const {storefront} = createFakeStorefront(sitemapItems(items));

    const response = await getSitemap({
      storefront,
      request: pageRequest('products', '1'),
      params: {type: 'products', page: '1'},
      getLink: linkTo,
    });

    const urls = locs(await response.text());
    expect(urls).toHaveLength(250);
    expect(urls.at(-1)).toBe(`${ORIGIN}/products/product-250`);
  });

  it.each(['unknown', 'Products', 'constructor', '__proto__', 'toString'])(
    'throws a 404 for the unknown type %j without calling the API',
    async (type) => {
      const {query, storefront} = createFakeStorefront(sitemapItems([PILLOW]));

      const response = await thrownResponse(
        getSitemap({
          storefront,
          request: pageRequest(type, '1'),
          params: {type, page: '1'},
          getLink: linkTo,
        }),
      );

      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Not found');
      expect(query).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['the type is missing', {page: '1'}],
    ['the page is missing', {type: 'products'}],
    ['the type is empty', {type: '', page: '1'}],
    ['the page is empty', {type: 'products', page: ''}],
  ])('throws a 404 without calling the API when %s', async (_label, params) => {
    const {query, storefront} = createFakeStorefront(sitemapItems([PILLOW]));

    const response = await thrownResponse(
      getSitemap({
        storefront,
        request: pageRequest('products', '1'),
        params,
        getLink: linkTo,
      }),
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('No data found');
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])(
    'throws a 404 and warns when the Storefront API answers %s',
    async (_label, answer) => {
      const {storefront} = createFakeStorefront(answer);

      const response = await thrownResponse(
        getSitemap({
          storefront,
          request: pageRequest('products', '1'),
          params: {type: 'products', page: '1'},
          getLink: linkTo,
        }),
      );

      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Sitemap not found.');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^\[sitemap\] /));
    },
  );
});

describe('sitemap queries', () => {
  it('are valid Storefront API queries that our client accepts', async () => {
    const index = createFakeStorefront(pageCounts(ALL_TYPE_COUNTS));
    await getSitemapIndex({
      storefront: index.storefront,
      request: indexRequest(),
    });
    const documents = [index.query.mock.calls[0][0]];
    for (const type of ALL_TYPES) {
      const page = createFakeStorefront(sitemapItems([]));
      await getSitemap({
        storefront: page.storefront,
        request: pageRequest(type, '1'),
        params: {type, page: '1'},
        getLink: linkTo,
      });
      documents.push(page.query.mock.calls[0][0]);
    }

    expect(new Set(documents).size).toBe(ALL_TYPES.length + 1);
    for (const document of documents) {
      expectValidStorefrontDocument(document);
      expect(isQueryDocument(String(document))).toBe(true);
    }
  });
});

describe('sitemaps on our Storefront client', () => {
  const API_URL = `https://${STORE_DOMAIN}/api/2026-04/graphql.json`;

  function createClient(path: string) {
    return createStorefrontClient({
      storeDomain: STORE_DOMAIN,
      publicStorefrontToken: 'public-token-placeholder',
      i18n: {language: 'EN', country: 'US'},
      request: new Request(`${ORIGIN}${path}`),
      waitUntil: () => {},
    });
  }

  /** Makes the Storefront API answer every call with `data`. */
  function stubStorefrontApi(data: unknown) {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json({data}),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  /** The URL and parsed JSON body of the first Storefront API call. */
  function sentRequest(fetchMock: ReturnType<typeof stubStorefrontApi>) {
    const [input, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body)) as {
      query: string;
      variables: Record<string, unknown>;
    };
    return {url: String(input), body};
  }

  it('posts the minified sitemap query with the page number and renders the answer', async () => {
    const fetchMock = stubStorefrontApi(sitemapItems([PILLOW]));

    const response = await getSitemap({
      storefront: createClient('/sitemap/products/2.xml'),
      request: pageRequest('products', '2'),
      params: {type: 'products', page: '2'},
      getLink: linkTo,
    });

    expect(sentRequest(fetchMock)).toEqual({
      url: API_URL,
      body: {
        query:
          'query SitemapProducts($page: Int!) { sitemap(type: PRODUCT) { resources(page: $page) { items { handle updatedAt } } } }',
        variables: {page: 2},
      },
    });
    expect(locs(await response.text())).toEqual([
      `${ORIGIN}/products/cloudalign-pillow`,
    ]);
  });

  it('reads the page counts of the sitemap index', async () => {
    const fetchMock = stubStorefrontApi(pageCounts(ALL_TYPE_COUNTS));

    const response = await getSitemapIndex({
      storefront: createClient('/sitemap.xml'),
      request: indexRequest(),
      types: ['products', 'blogs'],
    });

    expect(sentRequest(fetchMock).body.query).toMatch(
      /^query SitemapIndex \{ products: sitemap\(type: PRODUCT\) \{ pagesCount \{ count \} \}/,
    );
    expect(locs(await response.text())).toEqual([
      `${ORIGIN}/sitemap/products/1.xml`,
      `${ORIGIN}/sitemap/products/2.xml`,
      `${ORIGIN}/sitemap/blogs/1.xml`,
    ]);
  });
});

/**
 * Hydrogen wrote `loc`, `lastmod`, `changefreq`, `hreflang` and the origin into
 * the XML as they were. A handle, a date or a host with `&`, `<`, `>`, `"` or
 * `'` then made the document invalid, and a quote could end an attribute early.
 * Everything written is escaped; the values this app produces contain none of
 * these characters, so its output does not change (the golden tests above).
 */
describe('XML escaping', () => {
  type ExtraOptions = Partial<
    Pick<
      Parameters<typeof getSitemap>[0],
      'getLink' | 'locales' | 'getChangeFreq' | 'noItemsFallback'
    >
  >;

  /** A products sitemap page listing `item`; `linkTo` does not encode its handle. */
  async function productsSitemap(
    item: SitemapItem,
    options: ExtraOptions = {},
  ): Promise<string> {
    const {storefront} = createFakeStorefront(sitemapItems([item]));
    const response = await getSitemap({
      storefront,
      request: pageRequest('products', '1'),
      params: {type: 'products', page: '1'},
      getLink: linkTo,
      ...options,
    });
    return response.text();
  }

  it.each([
    ['an ampersand', 'a&b', 'a&amp;b'],
    ['angle brackets', '<s>', '&lt;s&gt;'],
    ['double quotes', 'say"hi"', 'say&quot;hi&quot;'],
    ['an apostrophe', "it's", 'it&apos;s'],
  ])('escapes %s in a location', async (_label, handle, escaped) => {
    const xml = await productsSitemap({handle, updatedAt: PILLOW.updatedAt});

    expect(locs(xml)).toEqual([`${ORIGIN}/products/${escaped}`]);
  });

  it('writes a handle with every special character as one byte-exact entry', async () => {
    const xml = await productsSitemap({
      handle: 'a&b<s>"q"\'',
      updatedAt: PILLOW.updatedAt,
    });

    expect(xml).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"><url>',
        '  <loc>https://shop.example/products/a&amp;b&lt;s&gt;&quot;q&quot;&apos;</loc>',
        '  <lastmod>2026-09-01T00:00:00Z</lastmod>',
        '  <changefreq>weekly</changefreq>',
        '',
        '</url></urlset>',
      ].join('\n'),
    );
  });

  it('keeps a handle from closing its location and adding markup of its own', async () => {
    const xml = await productsSitemap({
      handle: 'x</loc><url><loc>https://evil.example',
      updatedAt: PILLOW.updatedAt,
    });

    expect(xml.match(/<url>/g)).toHaveLength(1);
    expect(locs(xml)).toEqual([
      `${ORIGIN}/products/x&lt;/loc&gt;&lt;url&gt;&lt;loc&gt;https://evil.example`,
    ]);
  });

  it('escapes an ampersand once, however it sits among the other characters', async () => {
    const xml = await productsSitemap({
      handle: '<&amp;>',
      updatedAt: PILLOW.updatedAt,
    });

    expect(locs(xml)).toEqual([`${ORIGIN}/products/&lt;&amp;amp;&gt;`]);
  });

  it('escapes the last modification date and the change frequency', async () => {
    const xml = await productsSitemap(
      {handle: 'h', updatedAt: '2026-09-01<&>'},
      {getChangeFreq: () => 'weekly"daily\''},
    );

    expect(xml).toContain('<lastmod>2026-09-01&lt;&amp;&gt;</lastmod>');
    expect(xml).toContain('<changefreq>weekly&quot;daily&apos;</changefreq>');
  });

  it('escapes the language and the link of an alternate, which sit in attributes', async () => {
    const xml = await productsSitemap(
      {handle: 'h&1', updatedAt: PILLOW.updatedAt},
      {locales: ['en"US', 'fr&CA']},
    );

    expect(xml).toContain(
      '  <xhtml:link rel="alternate" hreflang="en&quot;US" href="https://shop.example/en&quot;us/products/h&amp;1" />',
    );
    expect(xml).toContain(
      '  <xhtml:link rel="alternate" hreflang="fr&amp;CA" href="https://shop.example/fr&amp;ca/products/h&amp;1" />',
    );
  });

  it('keeps a quote in a handle from ending the href attribute early', async () => {
    const xml = await productsSitemap(
      {handle: 'h" rel="x', updatedAt: PILLOW.updatedAt},
      {locales: ['en-US']},
    );

    expect(xml).toContain(
      'href="https://shop.example/en-us/products/h&quot; rel=&quot;x" />',
    );
  });

  it.each([
    ['an ampersand', 'sh&p', 'sh&amp;p'],
    ['an apostrophe', "sh'p", 'sh&apos;p'],
    ['a double quote', 'sh"p', 'sh&quot;p'],
  ])(
    'escapes %s in the request origin of the index and of a custom child sitemap',
    async (_label, host, escapedHost) => {
      const {storefront} = createFakeStorefront(pageCounts({pages: 1}));

      const response = await getSitemapIndex({
        storefront,
        request: indexRequest(`https://${host}.example/sitemap.xml`),
        types: ['pages'],
        customChildSitemaps: ['/feed.xml?a=1&b=2'],
      });

      expect(await response.text()).toBe(
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          `  <sitemap><loc>https://${escapedHost}.example/sitemap/pages/1.xml</loc></sitemap>`,
          `  <sitemap><loc>https://${escapedHost}.example/feed.xml?a=1&amp;b=2</loc></sitemap>`,
          '</sitemapindex>',
        ].join('\n'),
      );
    },
  );

  it('escapes the request origin in the entries of a page and the fallback entry of an empty one', async () => {
    const request = new Request('https://sh&p.example/sitemap/products/1.xml');
    const params = {type: 'products', page: '1'};

    const listed = await getSitemap({
      storefront: createFakeStorefront(sitemapItems([PILLOW])).storefront,
      request,
      params,
      getLink: linkTo,
    });
    const empty = await getSitemap({
      storefront: createFakeStorefront(sitemapItems([])).storefront,
      request,
      params,
      getLink: linkTo,
      noItemsFallback: '/?a=1&b=<2>',
    });

    expect(locs(await listed.text())).toEqual([
      'https://sh&amp;p.example/products/cloudalign-pillow',
    ]);
    expect(locs(await empty.text())).toEqual([
      'https://sh&amp;p.example/?a=1&amp;b=&lt;2&gt;',
    ]);
  });

  it('leaves the characters that are legal in XML text exactly as they are', async () => {
    const handle = 'a-b_c.d~e!f*g(h)i,j;k:l@m+n$o=p%20q?r#s/t über-日本語-🎉';
    const xml = await productsSitemap({handle, updatedAt: PILLOW.updatedAt});

    expect(locs(xml)).toEqual([`${ORIGIN}/products/${handle}`]);
  });

  it('does not fail the page for an item the API sent without a date', async () => {
    const xml = productsSitemap({handle: 'h', updatedAt: null as never});

    await expect(xml).resolves.toContain(`<loc>${ORIGIN}/products/h</loc>`);
  });
});
