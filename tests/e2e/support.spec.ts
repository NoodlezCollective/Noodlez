/**
 * Self-tests for the shared helpers in ./support. A broken helper would
 * otherwise show up as dozens of confusing failures in other specs (or, worse,
 * as a guard that silently stops guarding), so each helper is proven here:
 *
 * - console guard: records what it should, ignores what it should, allowances
 *   are scoped and apply retroactively, the baseline is empty;
 * - network stubs: third parties are answered locally, the app is untouched;
 * - hydration gate: the page is React-owned when gotoHydrated() returns;
 * - dialog helpers: open / focus trap / Escape / backdrop on the real drawers;
 * - seedCart: carts appear in the browser and never leak between contexts;
 * - layout helpers: they fail when the page is wrong;
 * - catalog constants: they agree with what the mock actually serves.
 *
 * Untagged tests run on desktop only; the hydration and dialog tests are also
 * tagged @mobile so the touch/390px setup is exercised.
 */
import type {Page} from '@playwright/test';
import {seedCart} from './support/cart';
import {
  COLLECTIONS,
  COPY,
  PAGE_SIZE,
  PRODUCTS,
  collectionPath,
  countLabel,
  productPath,
  productTitle,
  ratingLabel,
} from './support/catalog';
import {BASELINE_ALLOWLIST, ConsoleGuard} from './support/console';
import {
  WITH_MOTION,
  clickBackdrop,
  drawer,
  expectFocusTrapped,
  expectModalClosed,
  expectModalOpen,
} from './support/dialogs';
import {expect, test} from './support/fixtures';
import {gotoHydrated} from './support/hydration';
import {
  expectNoHorizontalOverflow,
  expectPageChrome,
  expectSingleH1,
} from './support/layout';

const CART_LINK = /^Cart, \d+ items?$/;
/**
 * The warning Hydrogen's <Analytics.Provider> logged on every page in mock
 * mode, the baseline's only entry until analytics was rebuilt (Phase 4c).
 */
const MOCK_SHOP_WARNING_BEFORE_4C =
  '[h2:error:Analytics.Provider] - Mock shop is used. Analytics will not work properly.';

test.describe('console guard', () => {
  /** A guard on a context of its own, so the test fixture's guard stays quiet. */
  async function withGuard(
    browser: import('@playwright/test').Browser,
    baseURL: string | undefined,
    body: (guard: ConsoleGuard, page: Page) => Promise<void>,
  ) {
    const context = await browser.newContext({baseURL});
    try {
      const guard = new ConsoleGuard(context);
      const page = await context.newPage();
      await page.goto('/robots.txt');
      await body(guard, page);
    } finally {
      await context.close();
    }
  }

  test('records errors, warnings, assertions and uncaught errors; ignores log, info and debug', async ({
    browser,
    baseURL,
  }) => {
    await withGuard(browser, baseURL, async (guard, page) => {
      /* eslint-disable no-console -- deliberately exercises every console method */
      await page.evaluate(() => {
        console.log('chatter-log');
        console.info('chatter-info');
        console.debug('chatter-debug');
        console.error('recorded-error');
        console.warn('recorded-warning');
        console.assert(false, 'recorded-assert');
        setTimeout(() => {
          throw new Error('recorded-uncaught');
        }, 0);
      });
      /* eslint-enable no-console */

      await expect
        .poll(() => guard.records().map(({type}) => type))
        .toEqual(['error', 'warning', 'assert', 'pageerror']);
      const text = guard.describe(guard.records()).join('\n');
      expect(text).toContain('recorded-error');
      expect(text).toContain('recorded-uncaught');
      expect(text).not.toContain('chatter');
      expect(guard.unexpected()).toHaveLength(4);
    });
  });

  test('allow() takes substrings, regular expressions and predicates, and applies retroactively', async ({
    browser,
    baseURL,
  }) => {
    await withGuard(browser, baseURL, async (guard, page) => {
      await page.evaluate(() => {
        console.error('alpha-error');
        console.error('beta-error');
        console.warn('gamma-warning');
        console.error('delta-error');
      });
      await expect.poll(() => guard.records().length).toBe(4);
      expect(guard.unexpected()).toHaveLength(4);

      guard.allow('alpha-error', 'substring');
      expect(guard.unexpected()).toHaveLength(3);
      guard.allow(/^beta-/, 'regular expression');
      expect(guard.unexpected()).toHaveLength(2);
      guard.allow((record) => record.type === 'warning', 'predicate');
      expect(guard.unexpected().map(({text}) => text)).toEqual(['delta-error']);
      expect(guard.allowances()).toEqual(
        expect.arrayContaining([
          'substring',
          'regular expression',
          'predicate',
        ]),
      );
    });
  });

  test('allowHttpStatus() is scoped to one status and one URL', async ({
    browser,
    baseURL,
  }) => {
    await withGuard(browser, baseURL, async (guard, page) => {
      await page.evaluate(async () => {
        await fetch('/gone-a');
        await fetch('/gone-b');
      });
      await expect.poll(() => guard.records().length).toBe(2);
      const [first] = guard.records();
      expect(first.url, 'url is the failing resource').toMatch(/\/gone-a$/);
      expect(first.text).toContain('status of 404');

      guard.allowHttpStatus(500, '/gone-a'); // wrong status
      guard.allowHttpStatus(404, '/elsewhere'); // wrong URL
      expect(guard.unexpected()).toHaveLength(2);

      guard.allowHttpStatus(404, '/gone-a');
      expect(guard.unexpected().map(({url}) => url)).toEqual([
        expect.stringMatching(/\/gone-b$/),
      ]);
    });
  });

  test('the baseline allowlist is empty', async ({browser, baseURL}) => {
    expect(BASELINE_ALLOWLIST).toEqual([]);
    await withGuard(browser, baseURL, async (guard, page) => {
      await page.evaluate((warning) => {
        console.warn(warning); // Hydrogen's mock-shop warning, allowed until Phase 4c
        console.warn('any other warning');
      }, MOCK_SHOP_WARNING_BEFORE_4C);

      await expect.poll(() => guard.records().length).toBe(2);
      expect(
        guard.unexpected().map(({type, text}) => `${type}: ${text}`),
      ).toEqual([
        `warning: ${MOCK_SHOP_WARNING_BEFORE_4C}`,
        'warning: any other warning',
      ]);
      expect(guard.allowances()).toEqual([]);
    });
  });
});

test.describe('network stubs', () => {
  test('third parties are answered locally; the app itself is untouched', async ({
    page,
  }) => {
    await page.goto('/robots.txt');

    const result = await page.evaluate(async () => {
      const third = await fetch(
        'https://fonts.googleapis.com/css2?family=Inter',
      );
      const own = await fetch('/robots.txt');
      const loaded = (
        element: HTMLScriptElement | HTMLLinkElement | HTMLImageElement,
      ) =>
        new Promise<string>((resolve) => {
          element.onload = () => resolve('load');
          element.onerror = () => resolve('error');
          document.head.append(element);
        });
      const script = document.createElement('script');
      script.src = 'https://cdn.shopify.com/shopifycloud/consent.js';
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'https://fonts.googleapis.com/css2?family=Outfit';
      const image = new Image();
      image.src = 'https://cdn.shopify.com/files/pixel.png';
      await image.decode();
      return {
        thirdStatus: third.status,
        thirdBody: await third.text(),
        ownStatus: own.status,
        ownBody: await own.text(),
        script: await loaded(script),
        style: await loaded(style),
        imageWidth: image.naturalWidth,
      };
    });

    expect(result).toMatchObject({
      thirdStatus: 200,
      thirdBody: '',
      ownStatus: 200,
      script: 'load',
      style: 'load',
      imageWidth: 1,
    });
    expect(result.ownBody).toContain('User-agent');
  });
});

test.describe('hydration gate', {tag: '@mobile'}, () => {
  test('gotoHydrated returns once React owns the page', async ({page}) => {
    const response = await gotoHydrated(page, '/');

    expect(response?.status()).toBe(200);
    const state = await page.evaluate(() => ({
      router: '__reactRouterDataRouter' in window,
      reactKeys: Object.keys(document.documentElement).filter((key) =>
        key.startsWith('__react'),
      ),
    }));
    expect(state.router).toBe(true);
    // If this fails after a React upgrade, update the key check in
    // support/hydration.ts: every other spec relies on this gate.
    expect(state.reactKeys.length, 'React state on <html>').toBeGreaterThan(0);
  });

  test('a click right after gotoHydrated is handled by React, not by the browser', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');

    await page.getByRole('link', {name: CART_LINK}).click();

    await expect(drawer(page, 'Your cart')).toBeVisible();
    // Un-hydrated, the link would have navigated to /cart natively.
    expect(new URL(page.url()).pathname).toBe('/');
  });
});

test.describe('dialog helpers', {tag: '@mobile'}, () => {
  // Runs under the suite default (prefers-reduced-motion: reduce) on purpose:
  // the drawers must take focus even when their transitions are collapsed.

  test('cart drawer: opens, traps focus, closes on Escape and gives focus back', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    const opener = page.getByRole('link', {name: CART_LINK});
    await opener.click();

    const cart = drawer(page, 'Your cart');
    await expectModalOpen(page, cart);
    const stops = await expectFocusTrapped(page, cart);
    expect(stops).toEqual(['Close', 'Shop best sellers', 'Continue shopping']);

    await page.keyboard.press('Escape');
    await expectModalClosed(page, cart, opener);
  });

  test('search drawer: opens from the header and closes with its close button', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    const opener = page.getByRole('button', {name: 'Search', exact: true});
    await opener.click();

    const search = drawer(page, 'Search');
    await expectModalOpen(page, search);
    const stops = await expectFocusTrapped(page, search);
    expect(stops.length).toBeGreaterThanOrEqual(3);
    expect(stops[0]).toBe('Close');

    await search.locator('.drawer__close').click();
    await expectModalClosed(page, search, opener);
  });

  test('menu drawer: opens from the hamburger below the desktop breakpoint', async ({
    page,
  }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) >= 1024,
      'the hamburger only exists below 64em',
    );
    await gotoHydrated(page, '/');
    await page.getByRole('button', {name: 'Open menu'}).click();

    await expectModalOpen(page, drawer(page, 'Menu'));
  });

  test('backdrop click closes a drawer wider than the drawer panel', async ({
    page,
  }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) < 600,
      'at 390px the drawer covers the whole screen',
    );
    await gotoHydrated(page, '/');
    const opener = page.getByRole('link', {name: CART_LINK});
    await opener.click();
    const cart = drawer(page, 'Your cart');
    await expectModalOpen(page, cart);

    await clickBackdrop(page);

    await expectModalClosed(page, cart);
  });
});

test(
  'a drawer takes focus when the visitor prefers reduced motion',
  {tag: '@mobile'},
  async ({page}) => {
    await gotoHydrated(page, '/'); // reducedMotion: 'reduce', the suite default
    await page.getByRole('link', {name: CART_LINK}).click();

    await expectModalOpen(page, drawer(page, 'Your cart'));
  },
);

test.describe('seedCart', () => {
  test('puts lines (and a discount) into the browser cart', async ({page}) => {
    await seedCart(page, 'cloudalign-pillow-1:2');
    await gotoHydrated(page, '/cart');

    await expect(page.getByRole('heading', {level: 1})).toHaveText(
      'Your cart 2 items',
    );
    await expect(page.getByRole('link', {name: 'Cart, 2 items'})).toBeVisible();
  });

  test('accepts catalog variants and applies a discount code', async ({
    page,
  }) => {
    await seedCart(page, [{variant: PRODUCTS.cloudAlign.variants[0]}], {
      discount: 'MELLOW10',
    });
    await gotoHydrated(page, '/cart');

    const summary = page.getByRole('complementary', {name: 'Order summary'});
    await expect(summary).toContainText(COPY.discountRowMellow10);
    await expect(summary).toContainText('$44.99');
  });

  test('several lines, and carts do not leak into other contexts', async ({
    page,
    browser,
    baseURL,
  }) => {
    await seedCart(page, [
      {variant: PRODUCTS.pebble.variants[0], quantity: 2},
      {variant: PRODUCTS.cloudAlign.variants[1].id},
    ]);
    await gotoHydrated(page, '/cart');
    await expect(page.getByRole('heading', {level: 1})).toHaveText(
      'Your cart 3 items',
    );

    const other = await browser.newContext({baseURL});
    try {
      const response = await other.request.get('/cart');
      expect(await response.text()).not.toContain('Pebble Pillow');
    } finally {
      await other.close();
    }
  });
});

test.describe('layout helpers', () => {
  test('expectSingleH1 fails for zero, two or a wrong heading', async ({
    page,
  }) => {
    const quick = {timeout: 400};
    await page.setContent('<p>no heading</p>');
    await expect(expectSingleH1(page, undefined, quick)).rejects.toThrow(
      /exactly one <h1>/,
    );
    await page.setContent('<h1>a</h1><h1>b</h1>');
    await expect(expectSingleH1(page, undefined, quick)).rejects.toThrow(
      /exactly one <h1>/,
    );
    await page.setContent('<h1>Real</h1>');
    await expect(expectSingleH1(page, 'Other', quick)).rejects.toThrow();
    await expectSingleH1(page, 'Real', quick);
  });

  test('expectSingleH1 reads innerText, so headings with <br> match their one-line form', async ({
    page,
  }) => {
    await page.setContent('<h1>Sleep Was Broken.<br>We Fixed It.</h1>');
    await expectSingleH1(page, 'Sleep Was Broken. We Fixed It.');
  });

  test('expectNoHorizontalOverflow names the offending element', async ({
    page,
  }) => {
    await page.setContent(
      '<div id="wide" class="banner" style="width:3000px;height:10px">wide</div>',
    );
    await expect(
      expectNoHorizontalOverflow(page, {timeout: 400}),
    ).rejects.toThrow(/Widest elements:[\s\S]*<div#wide\.banner>/);

    await page.setContent('<div style="width:10px">narrow</div>');
    await expectNoHorizontalOverflow(page, {timeout: 400});
  });

  test('expectPageChrome accepts a real page', async ({page}) => {
    await gotoHydrated(page, '/');
    await expectPageChrome(page);
  });
});

test.describe('catalog constants match the running mock', () => {
  // Server-rendered markup is enough: no hydration, no JavaScript.
  test.use({javaScriptEnabled: false});

  for (const product of Object.values(PRODUCTS)) {
    test(`product page ${product.handle}`, async ({page}) => {
      const [first] = product.variants;
      await page.goto(productPath(product));

      await expect(page.locator('h1')).toHaveText(product.title);
      const price = page
        .locator('.product-info')
        .getByRole('group', {name: 'Price'});
      await expect(price.locator('.price__current')).toHaveText(first.price);
      await expect(price.locator('.price__compare')).toContainText(
        first.compareAt,
      );
      await expect(
        page
          .locator('.product-info')
          .getByRole('img', {name: ratingLabel(product)}),
      ).toBeVisible();
      await expect(
        page.getByRole('button', {name: /^View image \d+ of \d+$/}),
      ).toHaveCount(product.imageCount);
    });
  }

  for (const collection of Object.values(COLLECTIONS)) {
    test(`collection ${collection.handle}`, async ({page}) => {
      await page.goto(collectionPath(collection));

      await expect(page.locator('h1')).toHaveText(collection.title);
      // (Not getByText: filter options repeat "3 products" in their counts.)
      await expect(page.locator('.collection-toolbar__count')).toHaveText(
        countLabel(collection),
      );
      await expect(
        page
          .getByRole('region', {name: 'Products'})
          .getByRole('article')
          .getByRole('heading', {level: 2}),
      ).toHaveText(
        collection.products
          .slice(0, PAGE_SIZE)
          .map((handle) => productTitle(handle)),
      );
      const loadMore = page.getByRole('link', {name: 'Load more'});
      if (collection.products.length > PAGE_SIZE) {
        await expect(loadMore).toBeVisible();
      } else {
        await expect(loadMore).toHaveCount(0);
      }
    });
  }
});
