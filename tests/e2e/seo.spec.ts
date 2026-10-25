/**
 * SEO: what crawlers and link-preview bots read.
 *
 * The head and JSON-LD tests run with JavaScript disabled, so they assert on
 * the server-rendered HTML exactly as a crawler receives it (and need no
 * hydration). One hydrated test checks that client-side navigation keeps the
 * title and canonical in step with the route.
 *
 * Desktop only: the markup does not depend on the viewport.
 */
import type {Page} from '@playwright/test';
import {
  PRODUCTS,
  TITLES,
  productPath,
  type ProductFixture,
} from './support/catalog';
import {expect, test} from './support/fixtures';
import {gotoHydrated} from './support/hydration';
import {
  canonicalHrefs,
  countMeta,
  namedMeta,
  ogContent,
  readRawJsonLd,
} from './support/seo';

function originOf(baseURL: string | undefined): string {
  if (!baseURL) throw new Error('baseURL is not configured');
  return new URL(baseURL).origin;
}

interface HeadRow {
  path: string;
  /** Defaults to 200. */
  status?: number;
  title: string;
  /** Expected canonical path (the host is added), or null for none. */
  canonical: string | null;
  robots: 'noindex' | null;
  /** Expected og:type, or null when the page carries no Open Graph tags. */
  ogType: 'website' | 'product' | null;
}

const indexable = (
  path: string,
  title: string,
  canonical: string,
  ogType: 'website' | 'product' = 'website',
): HeadRow => ({path, title, canonical, robots: null, ogType});

const noindex = (path: string, title: string, status = 200): HeadRow => ({
  path,
  status,
  title,
  canonical: null,
  robots: 'noindex',
  ogType: null,
});

const HEAD_ROWS: readonly HeadRow[] = [
  // Indexable pages: one absolute canonical each, query strings dropped.
  indexable('/', TITLES.home, '/'),
  indexable('/collections', TITLES.collections, '/collections'),
  indexable('/collections/all', TITLES.shopAll, '/collections/all'),
  indexable(
    '/collections/all?sort_key=PRICE&reverse=true',
    TITLES.shopAll,
    '/collections/all',
  ),
  indexable('/collections/pillows', TITLES.pillows, '/collections/pillows'),
  indexable(
    '/collections/pillows?filter.available=true',
    TITLES.pillows,
    '/collections/pillows',
  ),
  indexable(
    productPath(PRODUCTS.cloudAlign),
    TITLES.product(PRODUCTS.cloudAlign),
    productPath(PRODUCTS.cloudAlign),
    'product',
  ),
  indexable(
    `${productPath(PRODUCTS.cloudAlign)}?Size=King`,
    TITLES.product(PRODUCTS.cloudAlign),
    productPath(PRODUCTS.cloudAlign),
    'product',
  ),
  indexable('/pages/about', TITLES.about, '/pages/about'),
  indexable('/policies', TITLES.policies, '/policies'),
  indexable(
    '/policies/privacy-policy',
    TITLES.privacyPolicy,
    '/policies/privacy-policy',
  ),
  indexable('/blogs', TITLES.journal, '/blogs'),
  // Pages that must stay out of the index.
  noindex('/cart', TITLES.cart),
  noindex('/search', TITLES.search),
  noindex('/search?q=pillow', TITLES.searchResults('pillow')),
  noindex('/account/login', TITLES.signIn, 503),
  noindex('/dev/mock-checkout', TITLES.mockCheckout),
  // Missing resources: "<Thing> not found" title, noindex, no canonical.
  noindex('/this-page-does-not-exist', TITLES.pageNotFound, 404),
  noindex('/products/does-not-exist', TITLES.productNotFound, 404),
  noindex('/collections/does-not-exist', TITLES.collectionNotFound, 404),
  noindex('/pages/does-not-exist', 'Page not found | Mellow', 404),
  noindex('/policies/does-not-exist', 'Policy not found | Mellow', 404),
  // The mock has no subscription policy (the real API may).
  noindex('/policies/subscription-policy', 'Policy not found | Mellow', 404),
  noindex('/blogs/news', 'Blog not found | Mellow', 404),
  noindex('/blogs/news/does-not-exist', 'Article not found | Mellow', 404),
];

test.describe('server-rendered head', () => {
  // Crawlers do not run the app: read the HTML the server sends.
  test.use({javaScriptEnabled: false});

  for (const row of HEAD_ROWS) {
    test(`${row.path} -> ${row.status ?? 200}`, async ({
      page,
      baseURL,
      consoleGuard,
    }) => {
      const origin = originOf(baseURL);
      const status = row.status ?? 200;
      if (status !== 200) {
        // Chromium logs the error status of the document itself.
        consoleGuard.allowHttpStatus(status, row.path.split('?')[0]);
      }

      const response = await page.goto(row.path);

      expect(response?.status(), `status of ${row.path}`).toBe(status);
      await expect(page).toHaveTitle(row.title);
      await expect(page.locator('head title')).toHaveCount(1);
      expect(await canonicalHrefs(page), 'canonical links').toEqual(
        row.canonical === null ? [] : [`${origin}${row.canonical}`],
      );
      expect(await namedMeta(page, 'robots'), 'meta robots').toBe(row.robots);

      // The site name comes from the document shell: every page has it, once.
      expect(await ogContent(page, 'site_name')).toBe('Mellow');
      expect(await countMeta(page, 'head meta[property="og:site_name"]')).toBe(
        1,
      );

      // No duplicate tags, whatever the route sets.
      for (const selector of [
        'head meta[property="og:title"]',
        'head meta[property="og:description"]',
        'head meta[property="og:type"]',
        'head meta[name="description"]',
      ]) {
        expect(
          await countMeta(page, selector),
          `${selector} appears at most once`,
        ).toBeLessThanOrEqual(1);
      }

      if (row.ogType) {
        expect(await ogContent(page, 'type'), 'og:type').toBe(row.ogType);
        expect(await ogContent(page, 'title'), 'og:title').toBe(row.title);
        const description = await namedMeta(page, 'description');
        expect(description, 'meta description').toBeTruthy();
        expect(await ogContent(page, 'description')).toBe(description);
      }
      if (row.ogType === 'product') {
        const image = await ogContent(page, 'image');
        expect(image, 'og:image is absolute').toMatch(
          new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`),
        );
      }
    });
  }
});

interface ProductJsonLd {
  '@context': string;
  '@type': string;
  name: string;
  description: string;
  url: string;
  sku: string;
  image: string[];
  brand: {'@type': string; name: string};
  offers: {
    '@type': string;
    url: string;
    price: string;
    priceCurrency: string;
    availability: string;
    itemCondition: string;
    sku: string;
  };
  aggregateRating: {
    '@type': string;
    ratingValue: number;
    reviewCount: number;
  };
}

test.describe('product JSON-LD', () => {
  test.use({javaScriptEnabled: false});

  async function readProductJsonLd(
    page: Page,
  ): Promise<{raw: string; data: ProductJsonLd}> {
    const blocks = await readRawJsonLd(page);
    expect(blocks, 'exactly one JSON-LD block').toHaveLength(1);
    return {raw: blocks[0], data: JSON.parse(blocks[0]) as ProductJsonLd};
  }

  test('CloudAlign Pillow carries a complete Product document', async ({
    page,
    baseURL,
  }) => {
    const origin = originOf(baseURL);
    const product = PRODUCTS.cloudAlign;
    const variant = product.variants[0];
    await page.goto(productPath(product));

    const {raw, data} = await readProductJsonLd(page);

    // "<" is escaped as \u003c so the JSON cannot close its <script> early.
    expect(raw).not.toContain('<');
    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.title,
      url: `${origin}${productPath(product)}`,
      sku: variant.sku,
      brand: {'@type': 'Brand', name: 'Mellow'},
      offers: {
        '@type': 'Offer',
        url: `${origin}${productPath(product)}`,
        price: variant.amount,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
        sku: variant.sku,
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: Number(product.rating),
        reviewCount: product.ratingCount,
      },
    });
    expect(data.description).toBeTruthy();
    expect(data.image, 'one image per gallery picture').toHaveLength(
      product.imageCount,
    );
    for (const image of data.image) {
      expect(image, 'image URLs are absolute').toMatch(/^https?:\/\//);
      expect(image.startsWith(`${origin}/`)).toBe(true);
    }
  });

  const VARIANT_CASES: ReadonlyArray<{
    label: string;
    product: ProductFixture;
    query: string;
    variant: number;
    availability: 'InStock' | 'OutOfStock';
  }> = [
    {
      label: 'default variant',
      product: PRODUCTS.cloudAlign,
      query: '',
      variant: 0,
      availability: 'InStock',
    },
    {
      label: 'King selected',
      product: PRODUCTS.cloudAlign,
      query: '?Size=King',
      variant: 1,
      availability: 'InStock',
    },
    {
      label: 'unknown option value falls back to the default variant',
      product: PRODUCTS.cloudAlign,
      query: '?Size=Bogus',
      variant: 0,
      availability: 'InStock',
    },
    {
      label: 'Pebble default (Baby Blue)',
      product: PRODUCTS.pebble,
      query: '',
      variant: 0,
      availability: 'InStock',
    },
    {
      label: 'Pebble Charcoal is sold out',
      product: PRODUCTS.pebble,
      query: '?Color=Charcoal',
      variant: 5,
      availability: 'OutOfStock',
    },
    {
      label: 'whole-dollar price keeps its cents (Linen Sheet Set)',
      product: PRODUCTS.linenSheetSet,
      query: '',
      variant: 0,
      availability: 'InStock',
    },
  ];

  for (const {label, product, query, variant, availability} of VARIANT_CASES) {
    test(`offer follows the selected variant: ${label}`, async ({page}) => {
      await page.goto(`${productPath(product)}${query}`);

      const {data} = await readProductJsonLd(page);
      const expected = product.variants[variant];

      expect(data.offers.price).toBe(expected.amount);
      expect(data.offers.priceCurrency).toBe('USD');
      expect(data.offers.sku).toBe(expected.sku);
      expect(data.sku).toBe(expected.sku);
      expect(data.offers.availability).toBe(
        `https://schema.org/${availability}`,
      );
    });
  }

  test('pages other than the product page have no Product document', async ({
    page,
  }) => {
    for (const path of ['/', '/collections/pillows', '/cart']) {
      await page.goto(path);
      const blocks = await readRawJsonLd(page);
      for (const block of blocks) {
        expect(
          (JSON.parse(block) as {'@type'?: string})['@type'],
          `${path} must not claim to be a Product`,
        ).not.toBe('Product');
      }
    }
  });
});

test.describe('robots.txt and sitemaps', () => {
  test('robots.txt is plain text, points at the sitemap and hides private areas', async ({
    request,
    baseURL,
  }) => {
    const origin = originOf(baseURL);
    const response = await request.get('/robots.txt');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/plain');
    const body = await response.text();
    expect(body).toContain(`Sitemap: ${origin}/sitemap.xml`);
    expect(body).toMatch(/^User-agent: \*$/m);
    for (const rule of [
      'Disallow: /cart',
      'Disallow: /account',
      'Disallow: /search',
      // Listing parameters this storefront actually uses (not Shopify's sort_by):
      'Disallow: /collections/*sort_key*',
      'Disallow: /collections/*reverse=*',
      'Disallow: /collections/*filter.*',
      'Disallow: /collections/*cursor=*',
    ]) {
      expect(body, rule).toContain(rule);
    }
    // The catch-all group must not block the whole site (only Nutch is banned).
    const catchAll = body
      .split(/\n\s*\n/)[0]
      .split('\n')
      .map((line) => line.trim());
    expect(catchAll).toContain('User-agent: *');
    expect(catchAll).not.toContain('Disallow: /');
  });

  test('sitemap.xml is an XML sitemap index', async ({request}) => {
    const response = await request.get('/sitemap.xml');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('xml');
    expect(await response.text()).toContain('<sitemapindex');
  });

  test('child sitemaps are XML and unknown ones are 404', async ({request}) => {
    const ok = await request.get('/sitemap/products/1.xml');
    expect(ok.status()).toBe(200);
    expect(ok.headers()['content-type']).toContain('xml');
    expect(await ok.text()).toContain('<urlset');

    for (const path of [
      '/sitemap/constructor/1.xml',
      '/sitemap/__proto__/1.xml',
      '/sitemap/products/0.xml',
      '/sitemap/products/abc.xml',
    ]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
    }
  });
});

test.describe('client-side navigation', () => {
  test('keeps the title and canonical in step with the route', async ({
    page,
    baseURL,
  }) => {
    const origin = originOf(baseURL);
    await gotoHydrated(page, '/');
    await expect(page).toHaveTitle(TITLES.home);
    expect(await canonicalHrefs(page)).toEqual([`${origin}/`]);

    await page
      .getByRole('banner')
      .getByRole('link', {name: 'Shop', exact: true})
      .click();
    await expect(page).toHaveURL(`${origin}/collections/all`);
    await expect(page).toHaveTitle(TITLES.shopAll);
    await expect
      .poll(() => canonicalHrefs(page))
      .toEqual([`${origin}/collections/all`]);

    await page
      .getByRole('region', {name: 'Products'})
      .getByRole('link', {name: PRODUCTS.cloudAlign.title, exact: true})
      .click();
    await expect(page).toHaveTitle(TITLES.product(PRODUCTS.cloudAlign));
    await expect
      .poll(() => canonicalHrefs(page))
      .toEqual([`${origin}${productPath(PRODUCTS.cloudAlign)}`]);
    await expect.poll(() => ogContent(page, 'type')).toBe('product');
  });
});
