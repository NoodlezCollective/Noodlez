/**
 * Collection listings: /collections (index), /collections/all and
 * /collections/:handle.
 *
 * Counts and cards per collection, sorting (URL parameters and order),
 * desktop filters (availability, price, product type, colour, size; chips;
 * AND across groups, OR inside one; clear all; empty state), the phone
 * filter sheet and "Load more" / "Load previous" on Shop All, which holds 13
 * products at 12 per page.
 *
 * Tags (playwright.config.ts): `@mobile` also runs at 390px, `@mobile-only`
 * only there (the sidebar is a modal sheet below 64em). Filter URLs follow
 * app/lib/collectionFilters.ts (`filter.<key>=<JSON>`, `sort_key`, `reverse`).
 *
 * Long on purpose (tests may exceed the 800-line guideline when justified):
 * every scenario is a self-contained test, so a failure points at one behaviour.
 */
import type {Locator, Page} from '@playwright/test';
import {
  COLLECTION_INDEX,
  COLLECTIONS,
  COPY,
  PAGE_SIZE,
  PRODUCTS,
  collectionPath,
  countLabel,
  productPath,
  productTitle,
  ratingLabel,
  type CollectionFixture,
  type ProductFixture,
} from './support/catalog';
import {expectFocusTrapped, expectModalOpen} from './support/dialogs';
import {expect, test} from './support/fixtures';
import {gotoHydrated} from './support/hydration';
import {expectNoHorizontalOverflow, expectSingleH1} from './support/layout';

const {cloudAlign, pebble, cloudBody} = PRODUCTS;

/* -------------------------------------------------------------------------- */
/* Locators. The structural hooks (`.collection-toolbar__count`,               */
/* `.active-filters`) stay in these helpers.                                   */
/* -------------------------------------------------------------------------- */

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function productByHandle(handle: string): ProductFixture {
  const product = Object.values(PRODUCTS).find((p) => p.handle === handle);
  if (!product) throw new Error(`Unknown product handle "${handle}"`);
  return product;
}

const titlesOf = (handles: readonly string[]) => handles.map(productTitle);

const main = (page: Page) => page.getByRole('main');
const productsRegion = (page: Page) =>
  page.getByRole('region', {name: 'Products'});
const cards = (page: Page) => productsRegion(page).getByRole('article');
/** Card titles are h2 on listing pages (they sit directly under the h1). */
const cardTitles = (page: Page) =>
  productsRegion(page).getByRole('heading', {level: 2});
/** "3 products". (`getByText('3 products')` also matches the filter counts.) */
const resultCount = (page: Page) => page.locator('.collection-toolbar__count');
const sortSelect = (page: Page) =>
  page.getByRole('combobox', {name: 'Sort by'});
/** The desktop sidebar landmark. */
const sidebar = (page: Page) =>
  page.getByRole('complementary', {name: /^Filters/});
const activeFilters = (page: Page) =>
  page.getByRole('list', {name: 'Active filters'});
/** The chip bar: the chips plus their own "Clear all" link. */
const chipBar = (page: Page) => page.locator('.active-filters');
const chip = (scope: Page | Locator, label: string) =>
  scope.getByRole('link', {name: `Remove filter: ${label}`});
const clearAll = (scope: Locator) =>
  scope.getByRole('link', {name: 'Clear all', exact: true});

/** A filter group ("Availability", "Color", ...) of a panel. */
function filterGroup(panel: Locator, title: string): Locator {
  return panel.locator('details').filter({
    has: panel.page().locator('summary', {hasText: new RegExp(`^${title}`)}),
  });
}

/** The checkbox of a list option or swatch ("In stock 3 products", "Baby Blue"). */
function option(panel: Locator, label: string): Locator {
  return panel.getByRole('checkbox', {
    name: new RegExp(`^${escapeRegExp(label)}(?: \\d+ products?)?$`),
  });
}

/** Resolves after `count` animation frames: lets React run effects without timers. */
function nextFrames(page: Page, count: number): Promise<void> {
  return page.evaluate(
    (frames) =>
      new Promise<void>((resolve) => {
        const tick = (left: number) =>
          left <= 0 ? resolve() : requestAnimationFrame(() => tick(left - 1));
        tick(frames);
      }),
    count,
  );
}

/**
 * Waits until no client-side navigation is in flight. A filter or sort change
 * navigates once, and <Pagination> (app/lib/pagination.tsx) then runs `navigate(url,
 * {replace: true})` from an effect right after that navigation commits. A
 * second click that lands in between would be overwritten by that replace
 * (the router goes back to the first URL), which no person can do but a test
 * can. Every helper that changes the filters or the sort waits here.
 */
async function settled(page: Page): Promise<void> {
  await nextFrames(page, 2);
  await page.waitForFunction(() => {
    const router = (
      window as unknown as {
        __reactRouterDataRouter?: {state: {navigation: {state: string}}};
      }
    ).__reactRouterDataRouter;
    return router?.state.navigation.state === 'idle';
  });
}

/** Checks (or unchecks) a list option such as "In stock 3 products". */
async function toggleOption(
  panel: Locator,
  label: string,
  checked = true,
): Promise<void> {
  await option(panel, label).setChecked(checked);
  await settled(panel.page());
}

/**
 * Colour swatches hide their checkbox behind the coloured dot, so a real
 * click lands on the label text (list options are checked directly).
 */
async function chooseSwatch(panel: Locator, name: string): Promise<void> {
  await panel.getByText(name, {exact: true}).click();
  await settled(panel.page());
}

async function sortBy(page: Page, label: string): Promise<void> {
  await sortSelect(page).selectOption({label});
  await settled(page);
}

/** Waits until the URL's query satisfies `check` (navigations commit later than clicks). */
function expectQuery(page: Page, check: (query: URLSearchParams) => boolean) {
  return expect(page).toHaveURL((url) => check(url.searchParams));
}

/** A JSON-valued query parameter such as `filter.price`, for `expect.poll`. */
const jsonQuery = (page: Page, name: string) => () => {
  const raw = new URL(page.url()).searchParams.get(name);
  return raw === null ? null : (JSON.parse(raw) as unknown);
};

/* -------------------------------------------------------------------------- */
/* Listings                                                                    */
/* -------------------------------------------------------------------------- */

test.describe('collection listings', () => {
  for (const collection of Object.values(COLLECTIONS)) {
    test(
      `${collection.title}: "${countLabel(collection)}" and ${collection.firstPage} cards`,
      {tag: '@mobile'},
      async ({page}) => {
        await gotoHydrated(page, collectionPath(collection));

        await expectSingleH1(page, collection.title);
        await expect(resultCount(page)).toHaveText(countLabel(collection));
        await expect(cards(page)).toHaveCount(collection.firstPage);
        const shown = collection.products.slice(0, PAGE_SIZE);
        await expect(cardTitles(page)).toHaveText(titlesOf(shown));
        await expectNoHorizontalOverflow(page);
      },
    );
  }

  test('each card shows its rating, lowest price and a "Shop Now" link', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));

    for (const handle of COLLECTIONS.pillows.products) {
      const product = productByHandle(handle);
      const [first] = product.variants;
      const card = cards(page).filter({
        has: page.getByRole('heading', {name: product.title, level: 2}),
      });
      await expect(card).toHaveCount(1);
      await expect(
        card.getByRole('img', {name: ratingLabel(product)}),
      ).toBeVisible();
      await expect(card.getByRole('group', {name: 'Price'})).toContainText(
        `${first.price}Regular price ${first.compareAt}`,
      );
      await expect(
        card.getByRole('link', {name: `Shop Now: ${product.title}`}),
      ).toHaveAttribute('href', productPath(product));
    }
  });

  test('clicking a card title opens the product', async ({page}) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));

    await cards(page)
      .getByRole('link', {name: pebble.title, exact: true})
      .click();

    await expect(page).toHaveURL(/\/products\/pebble-pillow(\?|$)/);
    await expectSingleH1(page, pebble.title);
  });

  test(
    'Shop All is sortable but has no filters',
    {tag: '@mobile'},
    async ({page}) => {
      await gotoHydrated(page, collectionPath(COLLECTIONS.all));

      await expect(sidebar(page)).toHaveCount(0);
      await expect(page.getByRole('button', {name: /^Filters/})).toHaveCount(0);
      await expect(sortSelect(page).locator('option')).toHaveText([
        'Best selling',
        'Price: low to high',
        'Price: high to low',
        'Newest',
        'Alphabetically: A–Z',
      ]);
    },
  );

  test('the Pillows collection offers Featured first', async ({page}) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));

    await expect(sortSelect(page).locator('option')).toHaveText([
      'Featured',
      'Best selling',
      'Price: low to high',
      'Price: high to low',
      'Newest',
      'Alphabetically: A–Z',
    ]);
    await expect(sortSelect(page)).toHaveValue('featured');
  });
});

/* -------------------------------------------------------------------------- */
/* Sorting                                                                     */
/* -------------------------------------------------------------------------- */

test.describe('sorting', () => {
  const PILLOWS = COLLECTIONS.pillows;
  const SORTS = [
    {
      label: 'Best selling',
      query: 'sort_key=BEST_SELLING',
      order: [cloudAlign, pebble, cloudBody],
    },
    {
      label: 'Price: low to high',
      query: 'sort_key=PRICE',
      order: [pebble, cloudAlign, cloudBody],
    },
    {
      label: 'Price: high to low',
      query: 'sort_key=PRICE&reverse=true',
      order: [cloudBody, cloudAlign, pebble],
    },
    {
      label: 'Newest',
      query: 'sort_key=CREATED&reverse=true',
      order: [cloudBody, pebble, cloudAlign],
    },
    {
      label: 'Alphabetically: A–Z',
      query: 'sort_key=TITLE',
      order: [cloudBody, cloudAlign, pebble],
    },
  ] as const;

  for (const sort of SORTS) {
    test(
      `"${sort.label}" sets ?${sort.query} and reorders the cards`,
      sort.label === 'Price: low to high' ? {tag: '@mobile'} : {},
      async ({page}) => {
        await gotoHydrated(page, collectionPath(PILLOWS));

        await sortBy(page, sort.label);

        await expect(page).toHaveURL(
          (url) =>
            url.pathname === '/collections/pillows' &&
            url.search === `?${sort.query}`,
        );
        await expect(cardTitles(page)).toHaveText(
          sort.order.map((product) => product.title),
        );
        await expect(sortSelect(page).locator('option:checked')).toHaveText(
          sort.label,
        );
      },
    );
  }

  test('"Featured" clears the sort parameters', async ({page}) => {
    await gotoHydrated(
      page,
      `${collectionPath(PILLOWS)}?sort_key=PRICE&reverse=true`,
    );
    await expect(cardTitles(page)).toHaveText(
      [cloudBody, cloudAlign, pebble].map((product) => product.title),
    );

    await sortBy(page, 'Featured');

    await expect(page).toHaveURL(
      (url) => url.pathname === '/collections/pillows' && url.search === '',
    );
    await expect(cardTitles(page)).toHaveText(titlesOf(PILLOWS.products));
  });

  test('a sorted link is rendered sorted and the select reflects it', async ({
    page,
  }) => {
    await gotoHydrated(page, `${collectionPath(PILLOWS)}?sort_key=TITLE`);

    await expect(sortSelect(page)).toHaveValue('title');
    await expect(cardTitles(page)).toHaveText(
      [cloudBody, cloudAlign, pebble].map((product) => product.title),
    );
  });

  test('an unknown sort key falls back to the default order', async ({
    page,
  }) => {
    await gotoHydrated(
      page,
      `${collectionPath(PILLOWS)}?sort_key=BOGUS&reverse=true`,
    );

    await expect(sortSelect(page)).toHaveValue('featured');
    await expect(cardTitles(page)).toHaveText(titlesOf(PILLOWS.products));
  });

  test('Shop All sorts across both pages', async ({page}) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.all));

    await sortBy(page, 'Price: low to high');

    await expect(page).toHaveURL(/\/collections\/all\?sort_key=PRICE$/);
    await expect(cardTitles(page).first()).toHaveText('Silk Sleep Mask');
    await expect(cards(page)).toHaveCount(PAGE_SIZE);
    // The most expensive product is on the second page.
    await expect(
      cardTitles(page).filter({hasText: 'Better Sleep Bundle'}),
    ).toHaveCount(0);
    await page.getByRole('link', {name: 'Load more'}).click();
    await expect(cards(page)).toHaveCount(PAGE_SIZE + 1);
    await expect(cardTitles(page).last()).toHaveText('Better Sleep Bundle');
  });

  test('changing the sort starts again from the first page', async ({page}) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.all));
    await page.getByRole('link', {name: 'Load more'}).click();
    await expect(cards(page)).toHaveCount(PAGE_SIZE + 1);
    await expectQuery(page, (query) => query.has('cursor'));

    await sortBy(page, 'Alphabetically: A–Z');

    await expect(page).toHaveURL(/\/collections\/all\?sort_key=TITLE$/);
    await expect(cards(page)).toHaveCount(PAGE_SIZE);
    await expect(resultCount(page)).toHaveText(`${PAGE_SIZE}+ products`);
    await expect(page.getByRole('link', {name: 'Load more'})).toBeVisible();
  });
});

/* -------------------------------------------------------------------------- */
/* Filters (desktop sidebar)                                                   */
/* -------------------------------------------------------------------------- */

test.describe('filters', () => {
  test('the sidebar lists five open groups with product counts', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));
    const panel = sidebar(page);

    for (const group of [
      'Availability',
      'Price',
      'Product type',
      'Color',
      'Size',
    ]) {
      await expect(filterGroup(panel, group), group).toHaveAttribute(
        'open',
        '',
      );
    }
    await expect(option(panel, 'In stock 3 products')).toBeVisible();
    await expect(option(panel, 'Out of stock 0 products')).toBeVisible();
    await expect(option(panel, 'Pillow 3 products')).toBeVisible();
    await expect(panel.getByRole('spinbutton', {name: 'Min'})).toBeVisible();
    await expect(panel.getByRole('spinbutton', {name: 'Max'})).toBeVisible();
    await expect(
      panel.getByRole('button', {name: 'Apply price'}),
    ).toBeVisible();
    await expect(panel.getByRole('checkbox', {name: 'Baby Blue'})).toHaveCount(
      1,
    );
    await expect(clearAll(panel)).toHaveCount(0);
  });

  test('an option with a single product reads "1 product" to screen readers', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));

    await expect(
      sidebar(page).getByRole('checkbox', {
        name: 'Standard 1 product',
        exact: true,
      }),
    ).toBeVisible();
  });

  test('a colour narrows the list, adds a chip and a count badge', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));
    const panel = sidebar(page);

    await chooseSwatch(panel, 'Baby Blue');

    await expect(resultCount(page)).toHaveText('1 product');
    await expect(cardTitles(page)).toHaveText([pebble.title]);
    await expect
      .poll(jsonQuery(page, 'filter.variantOption'))
      .toEqual({name: 'Color', value: 'Baby Blue'});
    await expect(activeFilters(page).getByRole('listitem')).toHaveCount(1);
    await expect(chip(page, 'Baby Blue')).toBeVisible();
    await expect(
      panel.getByRole('checkbox', {name: 'Baby Blue'}),
    ).toBeChecked();
    await expect(panel.getByRole('heading', {level: 2})).toHaveText(
      /^Filters\s*1$/,
    );
    await expect(clearAll(panel)).toBeVisible();
  });

  test('filters in different groups narrow together, values in one group widen', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.mostLoved));
    const panel = sidebar(page);
    const comforters = [
      'MarshMellow Comforter',
      'CloudCool Cooling Comforter',
      'CloudControl Comforter',
    ];

    await toggleOption(panel, 'King 4 products');
    await expect(resultCount(page)).toHaveText('4 products');
    await expect(cardTitles(page)).toHaveText([
      cloudAlign.title,
      ...comforters,
    ]);

    // Another group: AND.
    await toggleOption(panel, 'Pillow 3 products');
    await expect(resultCount(page)).toHaveText('1 product');
    await expect(cardTitles(page)).toHaveText([cloudAlign.title]);

    // Another value of the same group: OR.
    await toggleOption(panel, 'Comforter 3 products');
    await expect(resultCount(page)).toHaveText('4 products');
    await expect(cardTitles(page)).toHaveText([
      cloudAlign.title,
      ...comforters,
    ]);
    await expect(activeFilters(page).getByRole('listitem')).toHaveCount(3);

    await toggleOption(panel, 'King 4 products', false);
    await expect(resultCount(page)).toHaveText('6 products');
    await expect(activeFilters(page).getByRole('listitem')).toHaveCount(2);
  });

  test('a price range applies with the button and shows a "$50 – $70" chip', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));
    const panel = sidebar(page);

    await panel.getByRole('spinbutton', {name: 'Min'}).fill('50');
    await panel.getByRole('spinbutton', {name: 'Max'}).fill('70');
    await panel.getByRole('button', {name: 'Apply price'}).click();

    await expect(chip(page, COPY.priceChip50to70)).toBeVisible();
    await expect(resultCount(page)).toHaveText('2 products');
    await expect(cardTitles(page)).toHaveText([
      cloudAlign.title,
      cloudBody.title,
    ]);
    await expect
      .poll(jsonQuery(page, 'filter.price'))
      .toEqual({min: 50, max: 70});
    await expect(panel.getByRole('spinbutton', {name: 'Min'})).toHaveValue(
      '50',
    );
    await expect(panel.getByRole('spinbutton', {name: 'Max'})).toHaveValue(
      '70',
    );
  });

  test('Enter applies a one-sided price range; an inverted range is swapped', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));
    const panel = sidebar(page);

    await panel.getByRole('spinbutton', {name: 'Min'}).fill('60');
    await panel.getByRole('spinbutton', {name: 'Min'}).press('Enter');

    await expect(chip(page, 'From $60')).toBeVisible();
    await expect(cardTitles(page)).toHaveText([cloudBody.title]);
    await settled(page);

    await panel.getByRole('spinbutton', {name: 'Min'}).fill('70');
    await panel.getByRole('spinbutton', {name: 'Max'}).fill('50');
    await panel.getByRole('button', {name: 'Apply price'}).click();

    await expect(chip(page, COPY.priceChip50to70)).toBeVisible();
    await expect(cardTitles(page)).toHaveText([
      cloudAlign.title,
      cloudBody.title,
    ]);
  });

  test('sorting is kept while filtering', async ({page}) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));
    await sortBy(page, 'Price: high to low');
    await expect(cardTitles(page).first()).toHaveText(cloudBody.title);

    await toggleOption(sidebar(page), 'In stock 3 products');

    await expect(chip(page, 'In stock')).toBeVisible();
    await expectQuery(
      page,
      (query) =>
        query.get('sort_key') === 'PRICE' && query.get('reverse') === 'true',
    );
    await expect(cardTitles(page)).toHaveText(
      [cloudBody, cloudAlign, pebble].map((product) => product.title),
    );
    await expect(sortSelect(page)).toHaveValue('price-desc');
  });

  test('changing the sort keeps the filters', async ({page}) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));
    await toggleOption(sidebar(page), 'In stock 3 products');
    await expect(chip(page, 'In stock')).toBeVisible();

    await sortBy(page, 'Alphabetically: A–Z');

    await expect(page).toHaveURL(
      (url) =>
        url.searchParams.get('sort_key') === 'TITLE' &&
        url.searchParams.get('filter.available') === 'true',
    );
    await expect(chip(page, 'In stock')).toBeVisible();
    await expect(option(sidebar(page), 'In stock 3 products')).toBeChecked();
    await expect(cardTitles(page)).toHaveText(
      [cloudBody, cloudAlign, pebble].map((product) => product.title),
    );
  });

  test('Back undoes the last filter', async ({page}) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));
    await chooseSwatch(sidebar(page), 'Baby Blue');
    await expect(resultCount(page)).toHaveText('1 product');

    await page.goBack();
    await settled(page);

    await expect(resultCount(page)).toHaveText('3 products');
    await expect(page).toHaveURL(/\/collections\/pillows$/);
    await expect(activeFilters(page)).toHaveCount(0);
    await expect(
      sidebar(page).getByRole('checkbox', {name: 'Baby Blue'}),
    ).not.toBeChecked();

    await page.goForward();

    await expect(resultCount(page)).toHaveText('1 product');
    await expect(
      sidebar(page).getByRole('checkbox', {name: 'Baby Blue'}),
    ).toBeChecked();
  });

  test('a filtered link shows its chips and checked options', async ({
    page,
  }) => {
    await gotoHydrated(
      page,
      `${collectionPath(COLLECTIONS.pillows)}?filter.available=true&filter.productType=%22Pillow%22`,
    );

    await expect(resultCount(page)).toHaveText('3 products');
    await expect(activeFilters(page).getByRole('listitem')).toHaveCount(2);
    await expect(chip(page, 'In stock')).toBeVisible();
    await expect(chip(page, 'Pillow')).toBeVisible();
    await expect(option(sidebar(page), 'In stock 3 products')).toBeChecked();
    await expect(option(sidebar(page), 'Pillow 3 products')).toBeChecked();
  });

  test('malformed filter parameters are ignored', async ({page}) => {
    await gotoHydrated(
      page,
      `${collectionPath(COLLECTIONS.pillows)}?filter.available=maybe&filter.bogus=1&filter.price=%7Bnope&filter.variantOption=%22x%22`,
    );

    await expect(resultCount(page)).toHaveText('3 products');
    await expect(cards(page)).toHaveCount(3);
    await expect(activeFilters(page)).toHaveCount(0);
  });

  test.describe('without JavaScript', () => {
    test.use({javaScriptEnabled: false});

    test('the server renders the filtered list, chips and checked options', async ({
      page,
    }) => {
      await page.goto(
        `${collectionPath(COLLECTIONS.mostLoved)}?filter.productType=%22Comforter%22`,
      );

      await expect(resultCount(page)).toHaveText('3 products');
      await expect(cardTitles(page)).toHaveText(
        [PRODUCTS.marshMellow, PRODUCTS.cloudCool, PRODUCTS.cloudControl].map(
          (product) => product.title,
        ),
      );
      await expect(chip(page, 'Comforter')).toBeVisible();
      await expect(option(sidebar(page), 'Comforter 3 products')).toBeChecked();
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Removing filters, empty state and focus                                     */
/* -------------------------------------------------------------------------- */

test.describe('clearing filters', () => {
  /** In stock (index 0) and Baby Blue (index 1): chips follow the panel order. */
  async function applyTwoFilters(page: Page) {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));
    await toggleOption(sidebar(page), 'In stock 3 products');
    await chooseSwatch(sidebar(page), 'Baby Blue');
    await expect(activeFilters(page).getByRole('listitem')).toHaveCount(2);
    await expect(activeFilters(page).getByRole('link')).toHaveText([
      'In stock',
      'Baby Blue',
    ]);
  }

  test('removing a chip removes that filter only; focus moves to the next chip', async ({
    page,
  }) => {
    await applyTwoFilters(page);

    await chip(page, 'In stock').click();

    await expect(activeFilters(page).getByRole('listitem')).toHaveCount(1);
    await expect(chip(page, 'Baby Blue')).toBeVisible();
    await expect(resultCount(page)).toHaveText('1 product');
    await expectQuery(page, (query) => !query.has('filter.available'));
    await expect(chip(page, 'Baby Blue')).toBeFocused();
  });

  test('removing the last chip of several moves focus to "Clear all"', async ({
    page,
  }) => {
    await applyTwoFilters(page);

    await chip(page, 'Baby Blue').click();

    await expect(chip(page, 'In stock')).toBeVisible();
    await expect(chip(page, 'Baby Blue')).toHaveCount(0);
    await expect(clearAll(chipBar(page))).toBeFocused();
  });

  test('removing the only chip moves focus to the result count', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));
    await chooseSwatch(sidebar(page), 'Baby Blue');
    await expect(resultCount(page)).toHaveText('1 product');

    await chip(page, 'Baby Blue').click();

    await expect(resultCount(page)).toHaveText('3 products');
    await expect(activeFilters(page)).toHaveCount(0);
    await expect(resultCount(page)).toBeFocused();
  });

  test('"Clear all" in the chip bar removes every filter and keeps the sort', async ({
    page,
  }) => {
    await gotoHydrated(
      page,
      `${collectionPath(COLLECTIONS.pillows)}?sort_key=PRICE`,
    );
    await toggleOption(sidebar(page), 'In stock 3 products');
    await chooseSwatch(sidebar(page), 'Baby Blue');
    await expect(activeFilters(page).getByRole('listitem')).toHaveCount(2);

    await clearAll(chipBar(page)).click();

    await expect(activeFilters(page)).toHaveCount(0);
    await expect(resultCount(page)).toHaveText('3 products');
    await expect(page).toHaveURL((url) => url.search === '?sort_key=PRICE');
    await expect(resultCount(page)).toBeFocused();
  });

  test('"Clear all" in the sidebar clears the filters and focuses the Filters heading', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));
    await chooseSwatch(sidebar(page), 'Baby Blue');
    await expect(resultCount(page)).toHaveText('1 product');

    await clearAll(sidebar(page)).click();

    await expect(resultCount(page)).toHaveText('3 products');
    await expect(page).toHaveURL(/\/collections\/pillows$/);
    await expect(clearAll(sidebar(page))).toHaveCount(0);
    await expect(sidebar(page).getByRole('heading', {level: 2})).toBeFocused();
  });

  test('a filter that matches nothing shows the empty state with a way out', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));

    await toggleOption(sidebar(page), 'Out of stock 0 products');

    await expect(resultCount(page)).toHaveText('0 products');
    await expect(
      main(page).getByText('No products match your filters'),
    ).toBeVisible();
    await expect(productsRegion(page)).toHaveCount(0);
    await expect(chip(page, 'Out of stock')).toBeVisible();

    await main(page).getByRole('link', {name: 'Clear all filters'}).click();

    await expect(page).toHaveURL(/\/collections\/pillows$/);
    await expect(cards(page)).toHaveCount(3);
    await expect(resultCount(page)).toHaveText('3 products');
    await expect(
      main(page).getByText('No products match your filters'),
    ).toHaveCount(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Filter sheet (phones)                                                       */
/* -------------------------------------------------------------------------- */

test.describe('filter sheet on a phone', {tag: '@mobile-only'}, () => {
  const toggle = (page: Page) => page.getByRole('button', {name: /^Filters/});
  const sheet = (page: Page) => page.getByRole('dialog', {name: /^Filters/});
  const closeButton = (page: Page) =>
    sheet(page).getByRole('button', {name: 'Close filters'});
  /** Everything outside the sheet that must be inert while it is open. */
  const INERT_WHILE_OPEN = [
    '.announcement-bar',
    '.site-header',
    '.site-footer',
    '.collection-header',
    '.collection-layout__main',
  ];

  test('a "Filters" button replaces the sidebar', async ({page}) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));

    await expect(toggle(page)).toHaveText('Filters');
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle(page)).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(sidebar(page)).toBeHidden();
    await expect(sheet(page)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test('opens as a modal: focus inside, page inert, Tab trapped, Escape returns focus', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));

    await toggle(page).click();

    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
    await expectModalOpen(page, sheet(page), {
      initialFocus: closeButton(page),
      inert: INERT_WHILE_OPEN,
    });
    await expect(sheet(page)).toHaveAttribute('aria-modal', 'true');
    const stops = await expectFocusTrapped(page, sheet(page));
    expect(stops).toContain('Close filters');
    expect(stops).toContain('Show results');
    expect(stops).toContain('Apply price');

    await page.keyboard.press('Escape');

    await expect(sheet(page)).toHaveCount(0);
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle(page)).toBeFocused();
    for (const selector of INERT_WHILE_OPEN) {
      await expect(page.locator(selector)).toHaveJSProperty('inert', false);
    }
  });

  test('filtering keeps the sheet open; "Show results" closes it and the button reports the count', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));
    await toggle(page).click();
    await expect(sheet(page)).toBeVisible();

    await chooseSwatch(sheet(page), 'Baby Blue');

    await expect(sheet(page)).toBeVisible();
    await expect(
      sheet(page).getByRole('checkbox', {name: 'Baby Blue'}),
    ).toBeChecked();
    await expect(resultCount(page)).toHaveText('1 product');

    await sheet(page).getByRole('button', {name: 'Show results'}).click();

    await expect(sheet(page)).toHaveCount(0);
    await expect(toggle(page)).toHaveText(/^Filters\s*1\s*active$/);
    await expect(toggle(page)).toBeFocused();
    await expect(cardTitles(page)).toHaveText([pebble.title]);
    await expect(chip(page, 'Baby Blue')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('"Close filters" closes the sheet', async ({page}) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));
    await toggle(page).click();

    await closeButton(page).click();

    await expect(sheet(page)).toHaveCount(0);
    await expect(toggle(page)).toBeFocused();
  });

  test('widening the viewport turns the sheet back into the sidebar', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));
    await toggle(page).click();
    await expect(sheet(page)).toBeVisible();

    await page.setViewportSize({width: 1100, height: 800});

    await expect(sheet(page)).toHaveCount(0);
    await expect(sidebar(page)).toBeVisible();
    await expect(page.locator('.site-header')).toHaveJSProperty('inert', false);
  });

  test('a removable chip and "Clear all" are available below the toolbar', async ({
    page,
  }) => {
    await gotoHydrated(
      page,
      `${collectionPath(COLLECTIONS.pillows)}?filter.available=true`,
    );
    await expect(toggle(page)).toHaveText(/^Filters\s*1\s*active$/);

    await clearAll(chipBar(page)).click();

    await expect(resultCount(page)).toHaveText('3 products');
    await expect(toggle(page)).toHaveText('Filters');
    await expect(activeFilters(page)).toHaveCount(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Load more / Load previous (Shop All: 13 products, 12 per page)             */
/* -------------------------------------------------------------------------- */

test.describe('pagination on Shop All', () => {
  const loadMore = (page: Page) => page.getByRole('link', {name: 'Load more'});
  const loadPrevious = (page: Page) =>
    page.getByRole('link', {name: 'Load previous'});
  const LAST = 'Weighted Blanket';

  test(
    'page one has 12 cards, "12+ products" and a Load more link',
    {tag: '@mobile'},
    async ({page}) => {
      await gotoHydrated(page, collectionPath(COLLECTIONS.all));

      await expect(cards(page)).toHaveCount(PAGE_SIZE);
      await expect(resultCount(page)).toHaveText('12+ products');
      await expect(loadMore(page)).toBeVisible();
      await expect(loadPrevious(page)).toHaveCount(0);
      await expect(cardTitles(page).filter({hasText: LAST})).toHaveCount(0);
    },
  );

  test(
    'Load more appends the last product and the link goes away',
    {tag: '@mobile'},
    async ({page}) => {
      await gotoHydrated(page, collectionPath(COLLECTIONS.all));

      await loadMore(page).click();

      await expect(cards(page)).toHaveCount(PAGE_SIZE + 1);
      await expect(resultCount(page)).toHaveText('13 products');
      await expect(cardTitles(page).last()).toHaveText(LAST);
      await expect(loadMore(page)).toHaveCount(0);
      await expect(loadPrevious(page)).toHaveCount(0);
      await expectQuery(
        page,
        (query) => query.get('direction') === 'next' && query.has('cursor'),
      );
      // Appended, not replaced: page one is still there, in order.
      await expect(cardTitles(page)).toHaveText(
        titlesOf(COLLECTIONS.all.products),
      );
    },
  );

  test('a link to page two shows the last product and Load previous', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.all));
    await loadMore(page).click();
    await expect(cards(page)).toHaveCount(PAGE_SIZE + 1);
    const pageTwo = page.url();

    await gotoHydrated(page, pageTwo);

    await expect(cardTitles(page)).toHaveText([LAST]);
    await expect(resultCount(page)).toHaveText('1 product');
    await expect(loadPrevious(page)).toBeVisible();
    await expect(loadMore(page)).toHaveCount(0);

    await loadPrevious(page).click();

    await expect(cards(page)).toHaveCount(PAGE_SIZE + 1);
    await expect(resultCount(page)).toHaveText('13 products');
    await expect(cardTitles(page)).toHaveText(
      titlesOf(COLLECTIONS.all.products),
    );
    await expect(loadPrevious(page)).toHaveCount(0);
    await expectQuery(page, (query) => query.get('direction') === 'previous');
  });

  test('Load more hands keyboard focus to the list instead of dropping it', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.all));
    await loadMore(page).focus();

    await page.keyboard.press('Enter');

    await expect(cards(page)).toHaveCount(PAGE_SIZE + 1);
    await expect(page.locator('#main-content :focus')).toHaveCount(1);
  });

  test('Load previous hands keyboard focus to the list instead of dropping it', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.all));
    await loadMore(page).click();
    await expect(cards(page)).toHaveCount(PAGE_SIZE + 1);
    await gotoHydrated(page, page.url());
    await loadPrevious(page).focus();

    await page.keyboard.press('Enter');

    await expect(cards(page)).toHaveCount(PAGE_SIZE + 1);
    await expect(page.locator('#main-content :focus')).toHaveCount(1);
  });

  test('collections that fit one page have no pagination links', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.mostLoved));

    await expect(cards(page)).toHaveCount(COLLECTIONS.mostLoved.firstPage);
    await expect(loadMore(page)).toHaveCount(0);
    await expect(loadPrevious(page)).toHaveCount(0);
  });
});

/* -------------------------------------------------------------------------- */
/* /collections                                                                */
/* -------------------------------------------------------------------------- */

test.describe('collections index', {tag: '@mobile'}, () => {
  const grid = (page: Page) => page.getByRole('region', {name: 'Collections'});
  const cardFor = (page: Page, collection: CollectionFixture) =>
    grid(page)
      .getByRole('link')
      .filter({
        has: page.getByRole('heading', {name: collection.title, level: 2}),
      });

  test('lists the five collections as cards and offers Shop all products', async ({
    page,
  }) => {
    await gotoHydrated(page, '/collections');

    await expectSingleH1(page, 'Collections');
    await expect(grid(page).getByRole('heading', {level: 2})).toHaveText(
      COLLECTION_INDEX.map((collection) => collection.title),
    );
    for (const collection of COLLECTION_INDEX) {
      await expect(cardFor(page, collection)).toHaveAttribute(
        'href',
        collectionPath(collection),
      );
    }
    await expect(
      main(page).getByRole('link', {name: 'Shop all products'}),
    ).toHaveAttribute('href', '/collections/all');
    await expectNoHorizontalOverflow(page);
  });

  test('a card opens its collection', async ({page}) => {
    await gotoHydrated(page, '/collections');

    await cardFor(page, COLLECTIONS.bundles).click();

    await expect(page).toHaveURL(/\/collections\/bundles$/);
    await expectSingleH1(page, COLLECTIONS.bundles.title);
    await expect(resultCount(page)).toHaveText(countLabel(COLLECTIONS.bundles));
  });

  test('"Shop all products" opens Shop All', async ({page}) => {
    await gotoHydrated(page, '/collections');

    await main(page).getByRole('link', {name: 'Shop all products'}).click();

    await expect(page).toHaveURL(/\/collections\/all$/);
    await expectSingleH1(page, 'Shop All');
  });
});
