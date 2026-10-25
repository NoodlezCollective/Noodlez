import {describe, expect, it} from 'vitest';
import {loader as robotsLoader} from '../../routes/[robots.txt]';
import {loader as sitemapIndexLoader} from '../../routes/[sitemap.xml]';
import {loader as sitemapPageLoader} from '../../routes/sitemap.$type.$page[.xml]';
import {
  ORIGIN,
  callRoute,
  createFakeStorefront,
  thrownResponse,
} from './route-test-utils';

/** Locations written to a sitemap XML document. */
function locs(xml: string) {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
}

function sitemapPage(
  params: Record<string, string | undefined>,
  items: Array<{handle: string; updatedAt?: string}> = [],
) {
  const storefront = createFakeStorefront({
    sitemap: {
      resources: {
        items: items.map((item) => ({
          updatedAt: '2026-09-01T00:00:00Z',
          ...item,
        })),
      },
    },
  });
  const promise = callRoute(sitemapPageLoader, {
    request: new Request(`${ORIGIN}/sitemap/${params.type}/${params.page}.xml`),
    params,
    context: {storefront},
  }) as Promise<Response>;
  return {promise, storefront};
}

describe('sitemap page', () => {
  it.each([
    ['products', 'cloudalign-pillow', '/products/cloudalign-pillow'],
    ['collections', 'pillows', '/collections/pillows'],
    ['pages', 'faq', '/pages/faq'],
    ['blogs', 'journal', '/blogs/journal'],
    ['articles', 'journal/sleep-better', '/blogs/journal/sleep-better'],
  ])('lists %s at a URL the app serves', async (type, handle, path) => {
    const {promise} = sitemapPage({type, page: '1'}, [{handle}]);

    const response = await promise;

    expect(response.headers.get('Content-Type')).toBe('application/xml');
    expect(locs(await response.text())).toEqual([`${ORIGIN}${path}`]);
  });

  it('never lists the /articles/... URLs that the app does not serve', async () => {
    const {promise} = sitemapPage({type: 'articles', page: '1'}, [
      {handle: 'journal/one'},
      {handle: 'news/two'},
    ]);

    const urls = locs(await (await promise).text());

    expect(urls).toEqual([
      `${ORIGIN}/blogs/journal/one`,
      `${ORIGIN}/blogs/news/two`,
    ]);
    expect(urls.some((url) => url.includes('/articles/'))).toBe(false);
  });

  it('escapes handles so the XML stays well formed', async () => {
    const {promise} = sitemapPage({type: 'products', page: '1'}, [
      {handle: 'a&b<c>'},
    ]);
    const xml = await (await promise).text();
    expect(locs(xml)).toEqual([`${ORIGIN}/products/a%26b%3Cc%3E`]);
    expect(xml).not.toContain('a&b');
  });

  it('falls back to the home page for an empty sitemap', async () => {
    const {promise} = sitemapPage({type: 'blogs', page: '1'}, []);
    expect(locs(await (await promise).text())).toEqual([`${ORIGIN}/`]);
  });

  it('asks the Storefront API for the requested page', async () => {
    const {promise, storefront} = sitemapPage({type: 'products', page: '3'});
    await promise;
    expect(storefront.query).toHaveBeenCalledWith(
      expect.stringContaining('sitemap(type: PRODUCT)'),
      {variables: {page: 3}},
    );
  });

  it('caches for a day', async () => {
    const {promise} = sitemapPage({type: 'products', page: '1'});
    expect((await promise).headers.get('Cache-Control')).toBe('max-age=86400');
  });

  it.each([
    ['metaObjects', '1'],
    ['constructor', '1'],
    ['__proto__', '1'],
    ['toString', '1'],
    ['Products', '1'],
    ['products', '0'],
    ['products', '01'],
    ['products', '-1'],
    ['products', 'abc'],
    ['products', '1.5'],
    ['products', '1000000'],
    ['products', '99999999999999'],
    ['products', ''],
    [undefined, '1'],
    ['products', undefined],
  ])(
    'answers 404 for type %j page %j without calling the API',
    async (type, page) => {
      const {promise, storefront} = sitemapPage({type, page});

      const response = await thrownResponse(promise);

      expect(response.status).toBe(404);
      expect(storefront.query).not.toHaveBeenCalled();
    },
  );
});

describe('sitemap index', () => {
  const counts = {
    products: 2,
    collections: 1,
    articles: 1,
    pages: 1,
    blogs: 1,
    metaObjects: 3,
  };

  async function index() {
    const storefront = createFakeStorefront(
      Object.fromEntries(
        Object.entries(counts).map(([type, count]) => [
          type,
          {pagesCount: {count}},
        ]),
      ),
    );
    const response = (await callRoute(sitemapIndexLoader, {
      request: new Request(`${ORIGIN}/sitemap.xml`),
      context: {storefront},
    })) as Response;
    return {response, xml: await response.text()};
  }

  it('lists a child sitemap for every type the app has pages for', async () => {
    const {xml} = await index();
    expect([...locs(xml)].sort()).toEqual(
      [
        'products/1',
        'products/2',
        'collections/1',
        'blogs/1',
        'articles/1',
        'pages/1',
      ]
        .map((entry) => `${ORIGIN}/sitemap/${entry}.xml`)
        .sort(),
    );
  });

  it('does not advertise metaobject sitemaps, which have no route', async () => {
    const {xml} = await index();
    expect(xml).not.toMatch(/metaObjects/i);
  });

  it('serves every advertised child sitemap path', async () => {
    const {xml} = await index();
    for (const location of locs(xml)) {
      const [, type, file] =
        /\/sitemap\/([^/]+)\/([^/]+)\.xml$/.exec(location) ?? [];
      const {promise} = sitemapPage({type, page: file});
      expect((await promise).status).toBe(200);
    }
  });

  it('caches for a day', async () => {
    const {response} = await index();
    expect(response.headers.get('Cache-Control')).toBe('max-age=86400');
  });
});

describe('robots.txt', () => {
  async function robots() {
    const response = (await callRoute(robotsLoader, {
      request: new Request(`${ORIGIN}/robots.txt`),
    })) as Response;
    return {response, text: await response.text()};
  }

  /** The Disallow rules of each "general" block (everyone, AhrefsBot, AhrefsSiteAudit). */
  function blocks(text: string) {
    return text
      .split(/\n(?=User-agent: )/)
      .filter(
        (block) =>
          block.includes('Disallow: /cart') && block.includes('Sitemap:'),
      );
  }

  it('is plain text, cached for a day', async () => {
    const {response} = await robots();
    expect(response.headers.get('Content-Type')).toBe('text/plain');
    expect(response.headers.get('Cache-Control')).toBe('max-age=86400');
  });

  it('points at the sitemap index', async () => {
    const {text} = await robots();
    expect(text.match(/^Sitemap: .*$/gm)).toEqual(
      Array(3).fill(`Sitemap: ${ORIGIN}/sitemap.xml`),
    );
  });

  it('no longer disallows the unused sort_by parameter', async () => {
    const {text} = await robots();
    expect(text).not.toContain('sort_by');
  });

  it.each([
    'Disallow: /collections/*sort_key*',
    'Disallow: /collections/*reverse=*',
    'Disallow: /collections/*filter.*',
    'Disallow: /collections/*cursor=*',
    'Disallow: /*/collections/*sort_key*',
    'Disallow: /blogs?*cursor=*',
    'Disallow: /blogs/*cursor=*',
  ])('blocks the listing parameters the app uses: %s', async (rule) => {
    const {text} = await robots();
    const general = blocks(text);
    expect(general).toHaveLength(3);
    for (const block of general) expect(block).toContain(rule);
  });

  it('keeps the Hydrogen defaults', async () => {
    const {text} = await robots();
    for (const block of blocks(text)) {
      for (const rule of [
        'Disallow: /cart',
        'Disallow: /account',
        'Disallow: /collections/*+*',
        'Disallow: /*/collections/*filter*&*filter*',
        'Disallow: /blogs/*+*',
        'Disallow: /policies/',
        'Disallow: /search',
        'Allow: /search/',
        'Disallow: /search/?*',
      ]) {
        expect(block).toContain(rule);
      }
    }
    expect(text).toContain('User-agent: Nutch\nDisallow: /');
  });

  it('does not block the paths customers and crawlers need', async () => {
    const {text} = await robots();
    const disallowed = [...text.matchAll(/^Disallow: (.*)$/gm)].map(
      (m) => m[1],
    );
    // A plain listing, product and article must stay crawlable.
    const toRegex = (rule: string) =>
      new RegExp(
        '^' + rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'),
      );
    for (const path of [
      '/',
      '/collections/pillows',
      '/collections/all',
      '/products/cloudalign-pillow',
      '/blogs',
      '/blogs/journal',
      '/blogs/journal/sleep-better',
      '/pages/about',
    ]) {
      expect(
        disallowed.filter((rule) => rule !== '/' && toRegex(rule).test(path)),
      ).toEqual([]);
    }
    // ...while faceted, sorted and paginated variants are blocked.
    for (const path of [
      '/collections/pillows?sort_key=PRICE&reverse=true',
      '/collections/pillows?filter.available=true',
      '/collections/all?cursor=abc&direction=next',
      '/blogs?cursor=abc&direction=next',
      '/blogs/journal?cursor=abc&direction=next',
    ]) {
      expect(disallowed.some((rule) => toRegex(rule).test(path))).toBe(true);
    }
  });
});
