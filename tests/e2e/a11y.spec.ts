/**
 * Automated accessibility scans (axe-core, WCAG 2.0 to 2.2, levels A and AA)
 * of every page template and every open drawer. Each state must report no
 * violations. axe cannot judge everything (reading order, meaningful names,
 * focus behaviour): those are asserted in navigation.spec.ts and the other
 * specs.
 *
 * Scope and options
 * - Tags: wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa. In axe 4.14 the only
 *   rule tagged wcag22aa is `target-size` (2.5.8, targets of at least 24x24
 *   CSS px) and it ships disabled, so the 2.2 tag alone selects nothing; it is
 *   switched on explicitly below. The canary test at the end proves it runs.
 * - `preload: false`: axe would otherwise fetch the cross-origin Google Fonts
 *   stylesheet to read its rules. The page's CSP (connect-src) blocks that
 *   fetch and Chromium logs two console messages, which the console guard
 *   rightly rejects. Only css-orientation-lock (an experimental rule that does
 *   not run for the tags above) needs that data.
 * - Contrast is evaluated with the system fonts the suite runs with (Google
 *   Fonts are stubbed). Elements axe cannot judge (text over photos) are
 *   reported as "incomplete" and not asserted. The report's accepted
 *   deviation, the coral star fill, is non-text contrast (1.4.11), which these
 *   tags do not cover.
 *
 * Page-level states are tagged `@mobile` and also run at 390px. The product
 * page keeps a separate phone scan: at that width the gallery becomes a
 * sideways-scrolling strip, which axe requires to be keyboard reachable.
 */
import {AxeBuilder} from '@axe-core/playwright';
import type {Page} from '@playwright/test';
import {seedCart} from './support/cart';
import {
  COLLECTIONS,
  PRODUCTS,
  collectionPath,
  productPath,
} from './support/catalog';
import {drawer, expectModalOpen} from './support/dialogs';
import {expect, test} from './support/fixtures';
import {gotoHydrated} from './support/hydration';

const WCAG_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
] as const;

type Violations = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'];

interface ScanOptions {
  /** CSS selectors left out of the scan; explain each one at the call site. */
  exclude?: readonly string[];
}

/** One readable block per offending element: rule, selector, markup, reason. */
function describeViolations(violations: Violations): string[] {
  return violations.flatMap((violation) =>
    violation.nodes.map((node) =>
      [
        `${violation.id} [${violation.impact ?? 'unrated'}]: ${violation.help}`,
        `  selector: ${node.target.join(' ')}`,
        `  html: ${node.html}`,
        `  why: ${(node.failureSummary ?? '').replace(/\s*\n\s*/g, ' | ')}`,
      ].join('\n'),
    ),
  );
}

function analyze(page: Page, options: ScanOptions = {}) {
  const builder = new AxeBuilder({page})
    .withTags([...WCAG_TAGS])
    .options({preload: false, rules: {'target-size': {enabled: true}}});
  for (const selector of options.exclude ?? []) builder.exclude(selector);
  return builder.analyze();
}

/** Fails with every violation (rule, selector, html) when axe finds any. */
async function expectNoViolations(
  page: Page,
  options: ScanOptions = {},
): Promise<void> {
  const results = await analyze(page, options);
  if (results.violations.length > 0) {
    await test.info().attach('axe-violations.json', {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json',
    });
  }
  expect(
    describeViolations(results.violations),
    'axe violations (WCAG 2.0 to 2.2, A and AA)',
  ).toEqual([]);
}

interface PageState {
  name: string;
  path: string;
  /** Cart permalink lines to seed before loading the page. */
  cart?: string;
  discount?: string;
  /** The error line Chromium logs for this document's own HTTP status. */
  status?: {code: number; urlIncludes: string};
  exclude?: readonly string[];
}

const PAGE_STATES: readonly PageState[] = [
  {name: 'home page', path: '/'},
  {
    name: 'collection with a filter applied',
    path: `${collectionPath(COLLECTIONS.pillows)}?filter.available=true`,
  },
  {name: 'search results', path: '/search?q=pillow'},
  {name: 'search without a term', path: '/search'},
  {
    name: 'cart page with a discounted line',
    path: '/cart',
    cart: 'cloudalign-pillow-1:2',
    discount: 'MELLOW10',
  },
  {name: 'empty cart page', path: '/cart'},
  {
    name: 'sign-in page (503: accounts are not connected)',
    path: '/account/login',
    status: {code: 503, urlIncludes: '/account/login'},
  },
  {
    name: '404 page',
    path: '/this-page-does-not-exist',
    status: {code: 404, urlIncludes: '/this-page-does-not-exist'},
    // The big "404" is aria-hidden decoration, lavender (#e1e1fe) on white at
    // 1.28:1 (app/styles/app.css .route-error__code). WCAG 1.4.3 exempts text
    // that is pure decoration, but axe cannot tell, so exactly that node is
    // left out and the rest of the page is still scanned. The <h1> carries
    // the message.
    exclude: ['.route-error__code'],
  },
  {name: 'policies index', path: '/policies'},
  {name: 'policy page', path: '/policies/shipping-policy'},
  {name: 'About page', path: '/pages/about'},
  {name: 'collections index', path: '/collections'},
  {name: 'journal (empty state)', path: '/blogs'},
  {name: 'development checkout (empty cart)', path: '/dev/mock-checkout'},
];

test.describe('page templates', {tag: '@mobile'}, () => {
  for (const state of PAGE_STATES) {
    test(`${state.name} has no WCAG A/AA violations`, async ({
      page,
      consoleGuard,
    }) => {
      if (state.status) {
        consoleGuard.allowHttpStatus(
          state.status.code,
          state.status.urlIncludes,
        );
      }
      if (state.cart) {
        await seedCart(page, state.cart, {discount: state.discount});
      }

      await gotoHydrated(page, state.path);

      await expectNoViolations(page, {exclude: state.exclude});
    });
  }
});

test.describe('product page on a wide screen', () => {
  const VARIANTS = [
    {
      name: 'Pebble Pillow (colour swatches)',
      path: productPath(PRODUCTS.pebble),
    },
    {
      name: 'Pebble Pillow with the sold-out colour selected',
      path: `${productPath(PRODUCTS.pebble)}?Color=Charcoal`,
    },
    {
      name: 'CloudAlign Pillow (size buttons)',
      path: productPath(PRODUCTS.cloudAlign),
    },
  ];

  for (const variant of VARIANTS) {
    test(`${variant.name} has no WCAG A/AA violations`, async ({page}) => {
      await gotoHydrated(page, variant.path);

      await expectNoViolations(page);
    });
  }
});

test.describe('product page on a phone', {tag: '@mobile-only'}, () => {
  test('the swipeable gallery can be reached with the keyboard', async ({
    page,
  }) => {
    await gotoHydrated(page, productPath(PRODUCTS.pebble));

    await expectNoViolations(page);
  });
});

test.describe('drawers', {tag: '@mobile'}, () => {
  test('cart drawer with a line has no WCAG A/AA violations', async ({
    page,
  }) => {
    await seedCart(page, 'cloudalign-pillow-1:1');
    await gotoHydrated(page, '/');

    await page.getByRole('link', {name: 'Cart, 1 item', exact: true}).click();

    const cart = drawer(page, 'Your cart');
    await expectModalOpen(page, cart);
    await expect(
      cart.getByRole('link', {name: PRODUCTS.cloudAlign.title}),
    ).toBeVisible();
    await expectNoViolations(page);
  });

  test('empty cart drawer has no WCAG A/AA violations', async ({page}) => {
    await gotoHydrated(page, '/');

    await page.getByRole('link', {name: 'Cart, 0 items', exact: true}).click();

    const cart = drawer(page, 'Your cart');
    await expectModalOpen(page, cart);
    await expect(cart.getByText('Your cart is empty.').first()).toBeVisible();
    await expectNoViolations(page);
  });

  test('search drawer with results has no WCAG A/AA violations', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    await page
      .getByRole('banner')
      .getByRole('button', {name: 'Search', exact: true})
      .click();
    const search = drawer(page, 'Search');
    await expectModalOpen(page, search);

    await search.getByLabel('Search products', {exact: true}).fill('pillow');

    await expect(search.getByRole('region', {name: 'Products'})).toBeVisible();
    await expectNoViolations(page);
  });
});

test.describe('mobile menu', {tag: '@mobile-only'}, () => {
  test('has no WCAG A/AA violations', async ({page}) => {
    await gotoHydrated(page, '/');

    await page
      .getByRole('banner')
      .getByRole('button', {name: 'Open menu', exact: true})
      .click();

    const menu = drawer(page, 'Menu');
    await expectModalOpen(page, menu);
    await expect(
      menu.getByRole('link', {name: 'Sign in', exact: true}),
    ).toBeVisible();
    await expectNoViolations(page);
  });
});

test.describe('the scan itself', () => {
  test('reports a missing image description, low contrast and tiny targets, so a clean result means something', async ({
    page,
  }) => {
    await gotoHydrated(page, '/policies');
    await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.id = 'axe-canary';
      probe.innerHTML =
        '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="10" height="10">' +
        '<p style="color:#cccccc;background:#ffffff">Pale grey on white</p>' +
        '<button aria-label="tiny one" style="width:10px;height:10px;padding:0"></button>' +
        '<button aria-label="tiny two" style="width:10px;height:10px;padding:0"></button>';
      document.querySelector('main')?.append(probe);
    });

    const results = await analyze(page);

    const rules = results.violations.map((violation) => violation.id);
    expect(rules).toContain('image-alt');
    expect(rules).toContain('color-contrast');
    expect(rules, 'WCAG 2.2 target size is checked').toContain('target-size');
    expect(results.passes.length, 'rules that passed').toBeGreaterThan(20);
  });
});
