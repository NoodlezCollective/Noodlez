/**
 * Navigation: the header and footer, the skip link, the route announcer and
 * the three modal drawers (cart, search, mobile menu).
 *
 * Projects (see playwright.config.ts):
 * - untagged tests run on desktop-1440 only (the desktop navigation and the
 *   backdrop click need a wide viewport);
 * - `@mobile` tests also run on mobile-390 (the drawers are full screen there);
 * - `@mobile-only` tests run on mobile-390 only (the menu behind "Open menu"
 *   exists below 64em).
 *
 * Strict-mode traps handled below: two "Mellow – home" links (banner and
 * footer), two "Close" buttons per drawer (the helpers in
 * ./support/dialogs.ts), and a second "Search" button on /search.
 */
import type {Locator, Page} from '@playwright/test';
import {
  COLLECTIONS,
  COPY,
  PRODUCTS,
  TITLES,
  collectionPath,
} from './support/catalog';
import {
  clickBackdrop,
  drawer,
  drawerClose,
  expectFocusTrapped,
  expectModalClosed,
  expectModalOpen,
  type DrawerName,
} from './support/dialogs';
import {expect, test} from './support/fixtures';
import {gotoHydrated} from './support/hydration';
import {expectSingleH1} from './support/layout';

const header = (page: Page) => page.getByRole('banner');
const footer = (page: Page) => page.getByRole('contentinfo');
const primaryNav = (page: Page) =>
  header(page).getByRole('navigation', {name: 'Primary', exact: true});
const cartLink = (page: Page) =>
  header(page).getByRole('link', {name: /^Cart, \d+ items?$/});
const searchOpener = (page: Page) =>
  header(page).getByRole('button', {name: 'Search', exact: true});
const menuOpener = (page: Page) =>
  header(page).getByRole('button', {name: 'Open menu', exact: true});
const routeAnnouncer = (page: Page) => page.locator('#route-announcer');

/** Resolves once `count` more frames were painted, so the effects of the last render have run. */
async function nextFrames(page: Page, count = 2): Promise<void> {
  await page.evaluate(async (frames) => {
    for (let frame = 0; frame < frames; frame++) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    }
  }, count);
}

const PRIMARY_LINKS = [
  {
    name: 'Shop',
    href: collectionPath(COLLECTIONS.all),
    h1: COLLECTIONS.all.title,
  },
  {
    name: 'Bath',
    href: collectionPath(COLLECTIONS.bath),
    h1: COLLECTIONS.bath.title,
  },
  {
    name: 'Bundles',
    href: collectionPath(COLLECTIONS.bundles),
    h1: COLLECTIONS.bundles.title,
  },
  {name: 'About', href: '/pages/about', h1: COPY.aboutH1},
] as const;

interface FooterNav {
  title: string;
  links: ReadonlyArray<readonly [label: string, href: string]>;
}

const FOOTER_NAVS: readonly FooterNav[] = [
  {
    title: 'Shop',
    links: [
      ['Shop All', '/collections/all'],
      ['Pillows', '/collections/pillows'],
      ['Comforters', '/collections/comforters'],
      ['Bath', '/collections/bath'],
      ['Bundles', '/collections/bundles'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About Mellow', '/pages/about'],
      ['Reviews', '/#reviews'],
      ['Search', '/search'],
    ],
  },
  {
    title: 'Support',
    links: [
      ['FAQ', '/#faq'],
      ['Shipping Policy', '/policies/shipping-policy'],
      ['Refund Policy', '/policies/refund-policy'],
      ['Privacy Policy', '/policies/privacy-policy'],
      ['Terms of Service', '/policies/terms-of-service'],
      ['Contact Information', '/policies/contact-information'],
      ['Legal Notice', '/policies/legal-notice'],
    ],
  },
];

test.describe('header', () => {
  test('the primary navigation lists the shop sections', async ({page}) => {
    await gotoHydrated(page, '/');

    const nav = primaryNav(page);
    await expect(nav.getByRole('link')).toHaveText(
      PRIMARY_LINKS.map((link) => link.name),
    );
    for (const link of PRIMARY_LINKS) {
      await expect(
        nav.getByRole('link', {name: link.name, exact: true}),
      ).toHaveAttribute('href', link.href);
    }
    // Nothing is current on the home page.
    await expect(nav.locator('[aria-current]')).toHaveCount(0);
  });

  test('following a primary link marks that link, and only that link, as current', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    const nav = primaryNav(page);

    for (const target of PRIMARY_LINKS) {
      await nav.getByRole('link', {name: target.name, exact: true}).click();

      await expect(page).toHaveURL(target.href);
      await expectSingleH1(page, target.h1);
      for (const link of PRIMARY_LINKS) {
        const locator = nav.getByRole('link', {name: link.name, exact: true});
        if (link === target) {
          await expect(locator).toHaveAttribute('aria-current', 'page');
        } else {
          await expect(locator).not.toHaveAttribute('aria-current');
        }
      }
    }
  });

  test('both logos link to the home page', async ({page}) => {
    await gotoHydrated(page, '/pages/about');

    // The footer carries a second "Mellow – home" link: scope to a landmark.
    await expect(
      footer(page).getByRole('link', {name: COPY.logoLink, exact: true}),
    ).toHaveAttribute('href', '/');
    const logo = header(page).getByRole('link', {
      name: COPY.logoLink,
      exact: true,
    });
    await expect(logo).toHaveAttribute('href', '/');

    await logo.click();

    await expect(page).toHaveURL('/');
    await expectSingleH1(page, COPY.homeH1);
  });

  test('the announcements region carries the promotion text', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');

    const announcements = page.getByRole('region', {
      name: 'Announcements',
      exact: true,
    });
    await expect(announcements).toBeVisible();
    await expect(announcements).toContainText('Up to 50% Off Sitewide');
    await expect(announcements).toContainText('Save More When You Bundle');
  });

  test('the "Sign in" link leads to the account page that explains sign-in is unavailable', async ({
    page,
    consoleGuard,
  }) => {
    consoleGuard.allowHttpStatus(
      503,
      '/account/login',
      'customer accounts are not configured in the mock, so the login page answers 503',
    );
    await gotoHydrated(page, '/');

    const signIn = header(page).getByRole('link', {
      name: 'Sign in',
      exact: true,
    });
    await expect(signIn).toHaveAttribute('href', '/account');
    await signIn.click();

    await expect(page).toHaveURL('/account/login');
    await expectSingleH1(page, COPY.signInUnavailableH1);
    await expect(page).toHaveTitle(TITLES.signIn);
  });
});

test.describe('skip link', () => {
  test('is the first tab stop, appears when focused and moves focus to the main content', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));
    const skipLink = page.getByRole('link', {
      name: 'Skip to content',
      exact: true,
    });
    await expect(skipLink).toHaveAttribute('href', '#main-content');
    await expect(skipLink, 'tucked away until focused').not.toBeInViewport();

    await page.keyboard.press('Tab');

    await expect(skipLink).toBeFocused();
    await expect(skipLink, 'shown while focused').toBeInViewport();

    await page.keyboard.press('Enter');

    await expect(page.getByRole('main')).toBeFocused();
    await expect(page).toHaveURL(/#main-content$/);
    // The next Tab continues inside the content, not back in the header.
    await page.keyboard.press('Tab');
    await expect(page.locator('main :focus')).toHaveCount(1);
  });
});

test.describe('keyboard order', () => {
  test('Tab reaches the skip link, the header controls in reading order, then the page content', async ({
    page,
  }) => {
    await gotoHydrated(page, '/pages/about');

    for (const name of [
      'Skip to content',
      ...PRIMARY_LINKS.map((link) => link.name),
      COPY.logoLink,
      'Sign in',
      'Search',
      'Cart, 0 items',
    ]) {
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveAccessibleName(name);
    }

    await page.keyboard.press('Tab');
    await expect(page.locator('main :focus')).toHaveCount(1);
  });
});

test.describe('footer', () => {
  test('the navigation groups use relative links', async ({page}) => {
    await gotoHydrated(page, '/');

    for (const group of FOOTER_NAVS) {
      const nav = footer(page).getByRole('navigation', {
        name: group.title,
        exact: true,
      });
      await expect(nav.getByRole('link'), `${group.title} links`).toHaveText(
        group.links.map(([label]) => label),
      );
      for (const [label, href] of group.links) {
        await expect(
          nav.getByRole('link', {name: label, exact: true}),
          `${group.title} / ${label}`,
        ).toHaveAttribute('href', href);
      }
    }

    // The mock menus store absolute URLs on the fake store domain; the footer
    // (policy list included) must turn every one into a path.
    const hrefs = await footer(page)
      .getByRole('link')
      .evaluateAll((anchors) =>
        anchors.map((anchor) => anchor.getAttribute('href') ?? ''),
      );
    expect(hrefs.length, 'footer links').toBeGreaterThan(10);
    expect(hrefs.filter((href) => !href.startsWith('/'))).toEqual([]);
    expect(hrefs.filter((href) => href.includes('mellow.mock'))).toEqual([]);
  });

  test('"FAQ" and "Reviews" scroll to those sections of the home page', async ({
    page,
  }) => {
    // From another page, so the links must resolve to the home page.
    await gotoHydrated(page, '/pages/about');

    await footer(page).getByRole('link', {name: 'FAQ', exact: true}).click();

    await expect(page).toHaveURL('/#faq');
    const faq = page.getByRole('region', {name: 'Questions, Answered'});
    await expect(faq).toHaveAttribute('id', 'faq');
    await expect(faq).toBeInViewport();

    await footer(page)
      .getByRole('link', {name: 'Reviews', exact: true})
      .click();

    await expect(page).toHaveURL('/#reviews');
    const reviews = page.getByRole('region', {name: /^Loved By/});
    await expect(reviews).toHaveAttribute('id', 'reviews');
    await expect(reviews).toBeInViewport();
  });
});

test.describe('route announcer', () => {
  test('announces the new title after a client-side navigation and focuses the main content', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));
    const announcer = routeAnnouncer(page);
    await expect(announcer).toHaveAttribute('role', 'status');
    await expect(announcer, 'nothing is announced on first load').toBeEmpty();
    await expect(page.getByRole('main')).not.toBeFocused();

    const link = page
      .getByRole('region', {name: 'Products'})
      .getByRole('link', {name: PRODUCTS.pebble.title, exact: true});
    await link.focus();
    await page.keyboard.press('Enter');

    await expect(announcer).toHaveText(TITLES.product(PRODUCTS.pebble));
    await expectSingleH1(page, PRODUCTS.pebble.title);
    await expect(page.getByRole('main')).toBeFocused();
    // The next Tab continues at the top of the new content.
    await page.keyboard.press('Tab');
    await expect(page.locator('main :focus')).toHaveCount(1);
  });

  test('changing only the search params (sorting) neither announces nor moves focus', async ({
    page,
  }) => {
    await gotoHydrated(page, collectionPath(COLLECTIONS.pillows));
    const sort = page.getByRole('combobox', {name: 'Sort by'});
    await sort.focus();

    await sort.selectOption({label: 'Price: low to high'});

    await expect(page).toHaveURL(/sort_key=PRICE/);
    // The cheapest pillow comes first once the sorted list has rendered.
    await expect(
      page
        .getByRole('region', {name: 'Products'})
        .getByRole('heading', {level: 2})
        .first(),
    ).toHaveText(PRODUCTS.pebble.title);
    await nextFrames(page);
    await expect(routeAnnouncer(page)).toBeEmpty();
    await expect(page.getByRole('main')).not.toBeFocused();
    await expect(sort).toBeFocused();
  });
});

test.describe('cart link', () => {
  type ClickOptions = NonNullable<Parameters<Locator['click']>[0]>;
  const NEW_TAB_CLICKS: ReadonlyArray<{name: string; options: ClickOptions}> = [
    {name: 'Ctrl/Cmd-click', options: {modifiers: ['ControlOrMeta']}},
    {name: 'middle-click', options: {button: 'middle'}},
  ];

  for (const {name, options} of NEW_TAB_CLICKS) {
    test(`${name} opens the cart page in a new tab instead of the drawer`, async ({
      page,
      context,
    }) => {
      await gotoHydrated(page, '/');
      const cart = cartLink(page);
      await expect(cart).toHaveAttribute('href', '/cart');

      const [popup] = await Promise.all([
        context.waitForEvent('page'),
        cart.click(options),
      ]);

      // A tab opened in the background loads slowly on a busy machine: bring it
      // to the front and let it finish before closing it.
      await popup.bringToFront();
      await expect(popup).toHaveURL('/cart', {timeout: 30_000});
      await popup.waitForLoadState('domcontentloaded');
      await expect(drawer(page, 'Your Sleep Stack')).toBeHidden();
      await expect(page).toHaveURL('/');
      await popup.close();
    });
  }
});

interface DrawerCase {
  name: DrawerName;
  opener: (page: Page) => Locator;
  /** Controls reachable with Tab, in order, starting at the close button. */
  stops: readonly string[];
}

const DRAWERS: readonly DrawerCase[] = [
  {
    name: 'Your Sleep Stack',
    opener: cartLink,
    // The empty drawer also offers the three bestsellers.
    stops: [
      'Close',
      'Shop best sellers',
      'Continue shopping',
      'CloudAlign Pillow',
      'MarshMellow Comforter',
      'CloudCool Cooling Comforter',
    ],
  },
  {
    name: 'Search',
    opener: searchOpener,
    // The field has no aria-label, so the helper reports it by its tag name.
    stops: ['Close', 'input', 'Search'],
  },
];

test.describe('drawers', {tag: '@mobile'}, () => {
  for (const {name, opener, stops} of DRAWERS) {
    test(`${name}: opens as a modal, traps Tab, and Escape closes it and returns focus`, async ({
      page,
    }) => {
      await gotoHydrated(page, '/');
      const dialog = drawer(page, name);
      await expect(dialog, 'closed drawers are hidden').toBeHidden();

      await opener(page).click();

      await expectModalOpen(page, dialog);
      expect(await expectFocusTrapped(page, dialog)).toEqual(stops);

      await page.keyboard.press('Escape');

      await expectModalClosed(page, dialog, opener(page));
    });

    test(`${name}: the close button closes it, and it opens again afterwards`, async ({
      page,
    }) => {
      await gotoHydrated(page, '/');
      const dialog = drawer(page, name);

      await opener(page).click();
      await expectModalOpen(page, dialog);
      await drawerClose(dialog).click();
      await expectModalClosed(page, dialog, opener(page));

      await opener(page).click();
      await expectModalOpen(page, dialog);
      await page.keyboard.press('Escape');
      await expectModalClosed(page, dialog, opener(page));
    });
  }
});

test.describe('drawers on wide screens', () => {
  for (const {name, opener} of DRAWERS) {
    test(`${name}: clicking the dimmed backdrop closes it and returns focus`, async ({
      page,
    }) => {
      await gotoHydrated(page, '/');
      const dialog = drawer(page, name);
      await opener(page).click();
      await expectModalOpen(page, dialog);

      await clickBackdrop(page);

      await expectModalClosed(page, dialog, opener(page));
    });
  }
});

test.describe('mobile menu', {tag: '@mobile-only'}, () => {
  test('opens as a modal that lists the main sections', async ({page}) => {
    await gotoHydrated(page, '/');
    const opener = menuOpener(page);
    const menu = drawer(page, 'Menu');
    await expect(opener).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(opener).toHaveAttribute('aria-expanded', 'false');

    await opener.click();

    await expectModalOpen(page, menu);
    await expect(opener).toHaveAttribute('aria-expanded', 'true');
    const links = menu
      .getByRole('navigation', {name: 'Primary', exact: true})
      .getByRole('link');
    await expect(links).toHaveText([
      'Home',
      ...PRIMARY_LINKS.map((link) => link.name),
      'Sign in',
    ]);
    await expect(links).toHaveCount(PRIMARY_LINKS.length + 2);
    for (const link of PRIMARY_LINKS) {
      await expect(
        menu.getByRole('link', {name: link.name, exact: true}),
      ).toHaveAttribute('href', link.href);
    }
    await expect(
      menu.getByRole('link', {name: 'Sign in', exact: true}),
    ).toHaveAttribute('href', '/account');
    expect(await expectFocusTrapped(page, menu)).toEqual([
      'Close',
      'Home',
      ...PRIMARY_LINKS.map((link) => link.name),
      'Search',
      'Sign in',
    ]);

    await page.keyboard.press('Escape');

    await expectModalClosed(page, menu, opener);
    await expect(opener).toHaveAttribute('aria-expanded', 'false');
  });

  test('its "Search" button switches to the search dialog, and Escape returns focus to the menu button', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    const opener = menuOpener(page);
    const menu = drawer(page, 'Menu');
    const search = drawer(page, 'Search');
    await opener.click();
    await expectModalOpen(page, menu);

    await menu.getByRole('button', {name: 'Search', exact: true}).click();

    await expectModalOpen(page, search);
    await expect(menu).toBeHidden();
    await expect(opener).toHaveAttribute('aria-expanded', 'false');

    // The menu handed focus back to its button before the search dialog opened,
    // so Escape returns the visitor to where they started.
    await page.keyboard.press('Escape');

    await expectModalClosed(page, search, opener);
  });

  test('following "Shop" navigates, closes the menu and focuses the main content', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    const opener = menuOpener(page);
    const menu = drawer(page, 'Menu');
    await opener.click();
    await expectModalOpen(page, menu);

    await menu.getByRole('link', {name: 'Shop', exact: true}).click();

    await expect(page).toHaveURL('/collections/all');
    await expectSingleH1(page, COLLECTIONS.all.title);
    await expectModalClosed(page, menu);
    await expect(opener).toHaveAttribute('aria-expanded', 'false');
    await expect(routeAnnouncer(page)).toHaveText(TITLES.shopAll);
    await expect(page.getByRole('main')).toBeFocused();
  });

  test('its "Sign in" link leads to the account page that explains sign-in is unavailable', async ({
    page,
    consoleGuard,
  }) => {
    consoleGuard.allowHttpStatus(
      503,
      '/account/login',
      'customer accounts are not configured in the mock, so the login page answers 503',
    );
    await gotoHydrated(page, '/');
    await menuOpener(page).click();
    const menu = drawer(page, 'Menu');
    await expectModalOpen(page, menu);

    await menu.getByRole('link', {name: 'Sign in', exact: true}).click();

    await expect(page).toHaveURL('/account/login');
    await expectSingleH1(page, COPY.signInUnavailableH1);
    await expectModalClosed(page, menu);
  });
});
