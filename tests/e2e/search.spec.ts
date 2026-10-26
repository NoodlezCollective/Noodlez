/**
 * Search: the predictive drawer behind the header "Search" button and the
 * /search results page.
 *
 * The drawer (`@mobile`: it is full screen on phones) types into a field that
 * asks /search for predictive results; Enter, the drawer's "Search" button and
 * "View all results" go to the page. The page is the full result list with its
 * own form. A failing search (503, generic message) cannot be provoked without
 * breaking the mock, so it has no spec here; app/lib/search.loader.test.ts
 * covers the loader's failure path.
 *
 * Locator notes
 * - The drawer's field is a `searchbox` until suggestions arrive and a
 *   `combobox` afterwards (it points at a <datalist>), so it is found by its
 *   label.
 * - "Searching…" and "No results for …" are each in the DOM twice: once as
 *   visible text and once in a visually hidden live region.
 * - Each of the drawer's result groups ("Products", "Collections") is a region
 *   named by an h4; the page has its own "Products" region (h2), so scope to
 *   the dialog or to <main>.
 */
import type {Locator, Page} from '@playwright/test';
import {
  COPY,
  PAGE_SIZE,
  PRODUCTS,
  TITLES,
  productPath,
} from './support/catalog';
import {drawer, expectModalClosed, expectModalOpen} from './support/dialogs';
import {expect, test} from './support/fixtures';
import {gotoHydrated} from './support/hydration';
import {expectSingleH1} from './support/layout';

/** What the mock returns for "pillow", best match first. */
const PILLOW_RESULTS = [
  PRODUCTS.cloudAlign,
  PRODUCTS.pebble,
  PRODUCTS.cloudBody,
  PRODUCTS.betterSleepBundle,
  PRODUCTS.coolSleeperBundle,
] as const;

const SUGGESTED_SEARCHES = [
  ['pillow', '/search?q=pillow'],
  ['cooling comforter', '/search?q=cooling%20comforter'],
  ['body pillow', '/search?q=body%20pillow'],
  ['bundle', '/search?q=bundle'],
] as const;

const searchOpener = (page: Page) =>
  page.getByRole('banner').getByRole('button', {name: 'Search', exact: true});

/** Opens the drawer from the header and returns its dialog. */
async function openDrawer(page: Page): Promise<Locator> {
  await searchOpener(page).click();
  const dialog = drawer(page, 'Search');
  await expectModalOpen(page, dialog);
  return dialog;
}

const drawerField = (dialog: Locator) =>
  dialog.getByLabel('Search products', {exact: true});

/** The visually hidden live region that announces progress and counts. */
const drawerAnnouncement = (dialog: Locator) =>
  dialog.locator('[aria-live="polite"]');

/** The one-line "N results for …" summary on the page. */
const pageSummary = (page: Page) =>
  page.getByRole('main').getByText(/^[\d,]+\+? results? for /);

const pageField = (page: Page) =>
  page
    .getByRole('search')
    .getByRole('searchbox', {name: 'Search products, pages and articles'});

const pageCards = (page: Page) =>
  page.getByRole('region', {name: 'Product results'}).getByRole('article');

test.describe('search drawer', {tag: '@mobile'}, () => {
  test('lists matching products and collections as you type', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    const dialog = await openDrawer(page);
    await expect(drawerField(dialog)).toHaveAttribute(
      'placeholder',
      COPY.searchPlaceholder,
    );

    await drawerField(dialog).fill('pillow');

    const products = dialog.getByRole('region', {name: 'Products'});
    await expect(products.getByRole('listitem')).toContainText(
      PILLOW_RESULTS.map((product) => product.title),
    );
    const productHrefs = await products
      .getByRole('link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(productHrefs).toEqual(
      PILLOW_RESULTS.map((product) => `${productPath(product)}?q=pillow`),
    );
    const collections = dialog.getByRole('region', {name: 'Collections'});
    await expect(collections.getByRole('listitem')).toContainText(['Pillows']);
    await expect(collections.getByRole('link')).toHaveAttribute(
      'href',
      '/collections/pillows?q=pillow',
    );
    // The group headings sit one level below the drawer's own h3 title.
    await expect(dialog.getByRole('heading', {level: 3})).toHaveText('Search');
    await expect(dialog.getByRole('heading', {level: 4})).toHaveText([
      'Products',
      'Collections',
    ]);
  });

  test('announces progress and the result count in a live region', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    const dialog = await openDrawer(page);
    const announcement = drawerAnnouncement(dialog);
    await expect(announcement).toHaveAttribute('aria-atomic', 'true');
    await expect(announcement).toBeEmpty();

    // Hold the answer for "pillow" back to observe the loading state. The
    // empty request the field sends when it takes focus is not held.
    let release: () => void = () => undefined;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      (url) =>
        url.pathname === '/search.data' &&
        url.searchParams.get('q') === 'pillow' &&
        url.searchParams.has('predictive'),
      async (route) => {
        await released;
        await route.continue().catch(() => undefined);
      },
    );
    try {
      await drawerField(dialog).fill('pillow');

      await expect(announcement).toHaveText('Searching…');
      await expect(
        dialog.getByRole('paragraph').filter({hasText: 'Searching…'}),
      ).toBeVisible();

      release();

      await expect(announcement).toHaveText(/^\d+ results for pillow$/);
      await expect(
        dialog.getByRole('paragraph').filter({hasText: 'Searching…'}),
      ).toHaveCount(0);
    } finally {
      release();
      await page.unrouteAll({behavior: 'ignoreErrors'});
    }
  });

  test('says so when nothing matches', async ({page}) => {
    await gotoHydrated(page, '/');
    const dialog = await openDrawer(page);

    await drawerField(dialog).fill('zzzz');

    await expect(
      dialog.getByRole('paragraph').filter({hasText: 'No results for zzzz'}),
    ).toBeVisible();
    await expect(drawerAnnouncement(dialog)).toHaveText('No results for zzzz');
    await expect(dialog.getByRole('region')).toHaveCount(0);
    await expect(
      dialog.getByRole('link', {name: /View all results/}),
    ).toHaveCount(0);
  });

  test('"View all results" opens the full results and closes the drawer', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    const dialog = await openDrawer(page);
    await drawerField(dialog).fill('pillow');
    const viewAll = dialog.getByRole('link', {
      name: COPY.viewAllResults('pillow'),
    });
    await expect(viewAll).toHaveAttribute('href', '/search?q=pillow');

    await viewAll.click();

    await expect(page).toHaveURL('/search?q=pillow');
    await expectModalClosed(page, dialog);
    await expectSingleH1(page, 'Search');
    await expect(pageSummary(page)).toHaveText('5 results for pillow');
  });

  test('Enter opens the full results for the typed term', async ({page}) => {
    await gotoHydrated(page, '/');
    const dialog = await openDrawer(page);

    await drawerField(dialog).fill('bundle');
    await drawerField(dialog).press('Enter');

    await expect(page).toHaveURL('/search?q=bundle');
    await expectModalClosed(page, dialog);
    await expect(pageSummary(page)).toHaveText('2 results for bundle');
    await expect(pageField(page)).toHaveValue('bundle');
  });

  test('the "Search" button opens the full results too', async ({page}) => {
    await gotoHydrated(page, '/');
    const dialog = await openDrawer(page);

    await drawerField(dialog).fill('cooling');
    await dialog.getByRole('button', {name: 'Search', exact: true}).click();

    await expect(page).toHaveURL('/search?q=cooling');
    await expectModalClosed(page, dialog);
    await expect(pageField(page)).toHaveValue('cooling');
    await expect(pageSummary(page)).toBeVisible();
  });

  test('Escape in the field closes the drawer and returns focus to the Search button', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    const dialog = await openDrawer(page);
    await drawerField(dialog).fill('pillow');
    await expect(dialog.getByRole('region', {name: 'Products'})).toBeVisible();

    await drawerField(dialog).press('Escape');

    await expectModalClosed(page, dialog, searchOpener(page));
  });

  test('Enter on a blank field keeps the drawer open', async ({page}) => {
    await gotoHydrated(page, '/');
    const dialog = await openDrawer(page);

    await drawerField(dialog).fill('   ');
    await drawerField(dialog).press('Enter');

    await expect(dialog).toBeVisible();
    await expect(drawerField(dialog)).toBeFocused();
    await expect(page).toHaveURL('/');
  });

  test('keeps "&" and spaces in the term intact all the way to the page', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    const dialog = await openDrawer(page);

    await drawerField(dialog).fill('bath & body');
    await expect(
      dialog.getByRole('link', {name: COPY.viewAllResults('bath & body')}),
    ).toHaveAttribute('href', '/search?q=bath%20%26%20body');
    await drawerField(dialog).press('Enter');

    await expect(page).toHaveURL('/search?q=bath%20%26%20body');
    await expect(page).toHaveTitle(TITLES.searchResults('bath & body'));
    await expect(pageField(page)).toHaveValue('bath & body');
    await expect(pageSummary(page)).toHaveText('3 results for bath & body');
  });

  test('choosing a result clears the drawer for the next search', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    let dialog = await openDrawer(page);
    await drawerField(dialog).fill('pillow');
    await dialog
      .getByRole('region', {name: 'Products'})
      .getByRole('link', {name: PRODUCTS.cloudAlign.title})
      .click();
    await expect(page).toHaveURL(
      new RegExp(`${productPath(PRODUCTS.cloudAlign)}\\?q=pillow`),
    );
    await expectModalClosed(page, dialog);

    dialog = await openDrawer(page);

    await expect(drawerField(dialog)).toHaveValue('');
    await expect(drawerAnnouncement(dialog)).toBeEmpty();
    await expect(dialog.getByRole('region')).toHaveCount(0);
  });

  test('"View all results" also clears the drawer for the next search', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    let dialog = await openDrawer(page);
    await drawerField(dialog).fill('pillow');
    await dialog.getByRole('link', {name: /View all results/}).click();
    await expect(page).toHaveURL('/search?q=pillow');
    await expectModalClosed(page, dialog);

    dialog = await openDrawer(page);

    await expect(drawerField(dialog)).toHaveValue('');
    await expect(dialog.getByRole('region')).toHaveCount(0);
  });

  test('announces the number of results that are listed', async ({page}) => {
    await gotoHydrated(page, '/');
    const dialog = await openDrawer(page);

    await drawerField(dialog).fill('pillow');

    const listed = dialog.getByRole('region').getByRole('listitem');
    await expect(listed).toHaveCount(6);
    await expect(drawerAnnouncement(dialog)).toHaveText('6 results for pillow');
  });
});

test.describe('search page', {tag: '@mobile'}, () => {
  test('without a term offers a search field and suggestions', async ({
    page,
  }) => {
    await gotoHydrated(page, '/search');

    await expectSingleH1(page, 'Search');
    await expect(page).toHaveTitle(TITLES.search);
    await expect(pageField(page)).toHaveAttribute(
      'placeholder',
      COPY.searchPlaceholder,
    );
    await expect(pageField(page)).toHaveValue('');
    await expect(page.getByText('What are you looking for?')).toBeVisible();
    const suggestions = page
      .getByRole('list', {name: 'Suggested searches'})
      .getByRole('link');
    await expect(suggestions).toHaveText(
      SUGGESTED_SEARCHES.map(([label]) => label),
    );
    for (const [label, href] of SUGGESTED_SEARCHES) {
      await expect(suggestions.getByText(label, {exact: true})).toHaveAttribute(
        'href',
        href,
      );
    }
  });

  test('a suggestion runs that search and the field follows the URL', async ({
    page,
  }) => {
    // "body pillow" has a space: its URL used to differ between the server
    // (+) and the browser (%20) and logged a hydration error.
    await gotoHydrated(page, '/search');

    await page.getByRole('link', {name: 'body pillow', exact: true}).click();

    await expect(page).toHaveURL('/search?q=body%20pillow');
    await expect(pageField(page)).toHaveValue('body pillow');
    await expect(pageSummary(page)).toHaveText('5 results for body pillow');
    await expect(page).toHaveTitle(TITLES.searchResults('body pillow'));
  });

  test('lists the matching products', async ({page}) => {
    await gotoHydrated(page, '/search?q=pillow');

    await expectSingleH1(page, 'Search');
    await expect(page).toHaveTitle(TITLES.searchResults('pillow'));
    await expect(page.getByRole('search')).toBeVisible();
    await expect(pageField(page)).toHaveValue('pillow');
    await expect(pageSummary(page)).toHaveText('5 results for pillow');
    await expect(pageSummary(page)).toHaveAttribute('aria-live', 'polite');
    const cards = pageCards(page);
    await expect(cards).toHaveCount(PILLOW_RESULTS.length);
    await expect(cards.getByRole('heading', {level: 3})).toHaveText(
      PILLOW_RESULTS.map((product) => product.title),
    );
    for (const [index, product] of PILLOW_RESULTS.entries()) {
      await expect(
        cards
          .nth(index)
          .getByRole('link', {name: `Shop Now: ${product.title}`}),
      ).toHaveAttribute('href', `${productPath(product)}?q=pillow`);
    }
  });

  test('lists matching pages after the products', async ({page}) => {
    await gotoHydrated(page, '/search?q=mellow');

    // 2 products and the About page.
    await expect(pageSummary(page)).toHaveText('3 results for mellow');
    await expect(pageCards(page)).toHaveCount(2);
    const pages = page.getByRole('region', {name: 'Pages', exact: true});
    await expect(pages.getByRole('heading', {level: 2})).toHaveText('Pages');
    await expect(pages.getByRole('link')).toHaveText('About {AppName}');
    await expect(pages.getByRole('link')).toHaveAttribute(
      'href',
      '/pages/about?q=mellow',
    );
  });

  test('submitting the field searches for the new term and keeps focus in the field', async ({
    page,
  }) => {
    await gotoHydrated(page, '/search?q=pillow');

    await pageField(page).fill('bundle');
    await pageField(page).press('Enter');

    await expect(page).toHaveURL('/search?q=bundle');
    await expect(pageSummary(page)).toHaveText('2 results for bundle');
    await expect(pageCards(page)).toHaveCount(2);
    await expect(pageField(page)).toHaveValue('bundle');
    await expect(pageField(page)).toBeFocused();
  });

  test('says so when nothing matches, with ways out', async ({page}) => {
    await gotoHydrated(page, '/search?q=xyzzy');

    await expect(page).toHaveTitle(TITLES.searchResults('xyzzy'));
    await expect(pageField(page)).toHaveValue('xyzzy');
    await expect(page.getByText('No results for xyzzy')).toBeVisible();
    await expect(pageSummary(page)).toHaveCount(0);
    await expect(
      page.getByRole('link', {name: 'Shop all products', exact: true}),
    ).toHaveAttribute('href', '/collections/all');
    await expect(
      page.getByRole('link', {name: 'Browse collections', exact: true}),
    ).toHaveAttribute('href', '/collections');
    await expect(
      page.getByRole('list', {name: 'Suggested searches'}),
    ).toBeVisible();
  });

  test('the field follows the URL after a suggestion and after Back, even when it was edited', async ({
    page,
  }) => {
    // An untouched <input defaultValue> follows its prop by itself; the field
    // only needs `key={term}` once the visitor has typed in it.
    await gotoHydrated(page, '/search?q=xyzzy');
    await pageField(page).fill('half-typed');

    await page.getByRole('link', {name: 'pillow', exact: true}).click();

    await expect(page).toHaveURL('/search?q=pillow');
    await expect(pageField(page)).toHaveValue('pillow');
    await expect(pageSummary(page)).toHaveText('5 results for pillow');

    await pageField(page).fill('typed again');
    await page.goBack();

    await expect(page).toHaveURL('/search?q=xyzzy');
    await expect(pageField(page)).toHaveValue('xyzzy');
    await expect(page.getByText('No results for xyzzy')).toBeVisible();
  });

  test('treats a blank term like no term', async ({page}) => {
    await gotoHydrated(page, '/search?q=%20%20');

    await expect(page).toHaveTitle(TITLES.search);
    await expect(pageField(page)).toHaveValue('');
    await expect(page.getByText('What are you looking for?')).toBeVisible();
    await expect(pageSummary(page)).toHaveCount(0);
  });

  test('shows the full count for a broad term and loads the rest on request', async ({
    page,
  }) => {
    // Every product matches "a" (13, one more than a page) plus the About page;
    // the summary counts them all from the connection's totalCount even though
    // only the first page is listed.
    await gotoHydrated(page, '/search?q=a');

    await expect(pageSummary(page)).toHaveText(
      `${PAGE_SIZE + 2} results for a`,
    );
    await expect(pageCards(page)).toHaveCount(PAGE_SIZE);
    const loadMore = page.getByRole('link', {name: 'Load more'});
    await expect(loadMore).toHaveAttribute(
      'href',
      /^\/search\?q=a&direction=next&cursor=/,
    );

    await loadMore.click();

    await expect(pageCards(page)).toHaveCount(PAGE_SIZE + 1);
    await expect(page).toHaveURL(/direction=next&cursor=/);
    await expect(loadMore).toHaveCount(0);
  });

  test('the summary still counts every listed result after "Load more"', async ({
    page,
  }) => {
    await gotoHydrated(page, '/search?q=a');
    await expect(pageCards(page)).toHaveCount(PAGE_SIZE);

    await page.getByRole('link', {name: 'Load more'}).click();

    await expect(pageCards(page)).toHaveCount(PAGE_SIZE + 1);
    const summary = (await pageSummary(page).innerText()).replace(/,/g, '');
    expect(Number.parseInt(summary, 10)).toBeGreaterThanOrEqual(PAGE_SIZE + 1);
  });
});
