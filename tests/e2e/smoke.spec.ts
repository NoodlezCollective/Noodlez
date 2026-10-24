/**
 * Smoke: every route renders at all three viewports (desktop-1440, tablet-820,
 * mobile-390) without console errors, page errors or horizontal overflow.
 *
 * Per route: expected final status, exactly one <h1> with the expected text,
 * <html lang="en">, one main/banner/contentinfo landmark, the skip link, and no
 * horizontal overflow. The console guard (support/fixtures.ts) fails any test
 * that logs an unexpected console error/warning or throws; the 404 and 503
 * pages log Chromium's "Failed to load resource" line for their own document,
 * which each of those rows allows explicitly.
 */
import {COPY, PAGE_SIZE, PRODUCTS, productPath} from './support/catalog';
import {expect, test} from './support/fixtures';
import {gotoHydrated, redirectChain} from './support/hydration';
import {
  expectNoHorizontalOverflow,
  expectPageChrome,
  expectSingleH1,
} from './support/layout';
import type {Page} from '@playwright/test';

interface SmokeRoute {
  path: string;
  /** Status of the final response of the navigation. */
  status: number;
  h1: string | RegExp;
  /** HTTP error lines Chromium logs for this route's own document. */
  logged?: ReadonlyArray<{status: number; urlIncludes: string}>;
  /** Route-specific checks, run after the generic ones. */
  extra?: (page: Page) => Promise<void>;
}

const notFound = (path: string): SmokeRoute => ({
  path,
  status: 404,
  h1: COPY.notFoundH1,
  logged: [{status: 404, urlIncludes: path}],
});

const ROUTES: readonly SmokeRoute[] = [
  {path: '/', status: 200, h1: COPY.homeH1},
  {path: '/collections', status: 200, h1: 'Collections'},
  {
    path: '/collections/all',
    status: 200,
    h1: 'Shop All',
    // 13 products, 12 per page: the label and the pagination link prove the
    // three extra Shop-All-only mock products are in place.
    extra: async (page) => {
      await expect(page.getByText('12+ products')).toBeVisible();
      await expect(
        page.getByRole('region', {name: 'Products'}).getByRole('article'),
      ).toHaveCount(PAGE_SIZE);
      await expect(page.getByRole('link', {name: 'Load more'})).toBeVisible();
    },
  },
  {path: '/collections/most-loved', status: 200, h1: 'Most Loved'},
  {path: '/collections/pillows', status: 200, h1: 'Pillows'},
  {
    path: productPath(PRODUCTS.cloudAlign),
    status: 200,
    h1: 'CloudAlign Pillow',
  },
  {
    path: `${productPath(PRODUCTS.pebble)}?Color=Charcoal`,
    status: 200,
    h1: 'Pebble Pillow',
    extra: async (page) => {
      // exact: the "Charcoal (sold out)" swatch also contains the words.
      await expect(
        page.getByRole('button', {name: 'Sold out', exact: true}),
      ).toBeDisabled();
    },
  },
  {
    // One of the three Shop-All-only products added for pagination.
    path: productPath(PRODUCTS.silkSleepMask),
    status: 200,
    h1: 'Silk Sleep Mask',
    extra: async (page) => {
      await expect(
        page.locator('.product-info').getByRole('group', {name: 'Price'}),
      ).toContainText(PRODUCTS.silkSleepMask.variants[0].price);
    },
  },
  {path: '/search', status: 200, h1: 'Search'},
  {path: '/search?q=pillow', status: 200, h1: 'Search'},
  {path: '/cart', status: 200, h1: 'Your cart'},
  {path: '/pages/about', status: 200, h1: COPY.aboutH1},
  {path: '/policies', status: 200, h1: 'Policies'},
  {path: '/policies/privacy-policy', status: 200, h1: 'Privacy Policy'},
  {path: '/blogs', status: 200, h1: 'Journal'},
  {path: '/dev/mock-checkout', status: 200, h1: COPY.mockCheckoutH1},
  notFound('/this-page-does-not-exist'),
  notFound('/products/does-not-exist'),
  notFound('/collections/does-not-exist'),
];

test.describe('routes', {tag: '@smoke'}, () => {
  for (const route of ROUTES) {
    test(`${route.path} -> ${route.status}`, async ({page, consoleGuard}) => {
      for (const {status, urlIncludes} of route.logged ?? []) {
        consoleGuard.allowHttpStatus(status, urlIncludes);
      }

      const response = await gotoHydrated(page, route.path);

      expect(response?.status(), `status of ${route.path}`).toBe(route.status);
      await expectPageChrome(page);
      await expectSingleH1(page, route.h1);
      await expectNoHorizontalOverflow(page);
      await route.extra?.(page);
    });
  }

  test('/search?q=body%20pillow hydrates without a mismatch', async ({
    page,
  }) => {
    test.fixme(
      true,
      'BUG: GET /search?q=body%20pillow logs a React hydration error ' +
        '("Prop `action` did not match. Server: /search?q=body+pillow Client: ' +
        '/search?q=body%20pillow"). react-router rewrites the request URL ' +
        'through URLSearchParams on the server (%20 becomes +, see ' +
        'stripIndexParam in its request handler) while the browser keeps %20, ' +
        'and <SearchForm> renders <Form> without an `action`, so the form ' +
        'action is derived from location.search. The app itself links to such ' +
        'URLs: PageLayout.tsx:210, SearchFormPredictive.tsx:41 and ' +
        'SearchResults.tsx:185 use encodeURIComponent(term). Suggested fix: ' +
        'pass action="/search" to <SearchForm> in app/routes/search.tsx (a GET ' +
        'form discards the action query anyway).',
    );

    await gotoHydrated(page, '/search?q=body%20pillow');

    await expectSingleH1(page, 'Search');
  });

  test('/account -> 302 chain -> 503 sign-in page', async ({
    page,
    consoleGuard,
  }) => {
    // Customer accounts are not configured in the mock: the account routes
    // redirect to the login route, which answers 503 with an explanation.
    consoleGuard.allowHttpStatus(503, '/account/login');

    const response = await gotoHydrated(page, '/account');

    expect(response?.status()).toBe(503);
    expect(new URL(page.url()).pathname).toBe('/account/login');
    const hops = await redirectChain(response!);
    expect(hops.length, 'at least one redirect').toBeGreaterThan(0);
    expect(new URL(hops[0].url).pathname).toBe('/account');
    expect(hops.map((hop) => hop.status)).toEqual(hops.map(() => 302));

    await expectPageChrome(page);
    await expectSingleH1(page, COPY.signInUnavailableH1);
    await expectNoHorizontalOverflow(page);
  });

  test('a path with far too many segments is a plain 404', async ({
    page,
    consoleGuard,
  }) => {
    // server.ts rejects such URLs before routing, so there is no app shell:
    // no h1, no landmarks, no hydration. Just the bare 404 and its headers.
    const path = `/${Array.from({length: 40}, (_, index) => `s${index}`).join('/')}`;
    consoleGuard.allowHttpStatus(404, '/s0/s1/');

    const response = await page.goto(path);

    expect(response?.status()).toBe(404);
    expect(response?.headers()['content-type']).toContain('text/plain');
    expect(response?.headers()['x-content-type-options']).toBe('nosniff');
    await expect(page.locator('body')).toHaveText('Not found');
  });
});
