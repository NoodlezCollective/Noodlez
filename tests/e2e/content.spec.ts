/**
 * Content pages and home-page sections: the hero, the featured products, the
 * story and UGC links, the FAQ accordion, the newsletter forms, About, the
 * 404 page, the account-unavailable page, policies, the journal and the
 * development checkout stand-in. Desktop only (the smoke spec renders every
 * route at three widths); layout-sensitive behaviour lives in the other specs.
 *
 * Strict-mode traps handled below: two "Email address" fields and two
 * "Sign Up" buttons on the home page (the band and the footer), many "Shop
 * Now" links, and a second "Shop All" / "Shop all" pair in the footer.
 */
import type {Locator, Page} from '@playwright/test';
import {
  COLLECTIONS,
  COPY,
  PRODUCTS,
  TITLES,
  collectionPath,
  productPath,
  productTitle,
} from './support/catalog';
import {expect, test} from './support/fixtures';
import {gotoHydrated, redirectChain} from './support/hydration';
import {expectSingleH1} from './support/layout';
import {namedMeta} from './support/seo';

const main = (page: Page) => page.getByRole('main');

/**
 * The page is on `pathname`, whatever query the app appended. A product page
 * rewrites its URL once it has hydrated (`?Size=Standard`, the default
 * variant), so an exact URL match would race that replace.
 */
function expectPathname(page: Page, pathname: string) {
  return expect(page).toHaveURL((url) => url.pathname === pathname);
}

test.describe('home page', () => {
  test('the hero call to action leads to the whole range', async ({page}) => {
    await gotoHydrated(page, '/');

    const hero = page.getByRole('region', {name: /^Shop Premium/});
    await expect(hero.getByRole('heading', {level: 1})).toBeVisible();
    const cta = hero.getByRole('link', {name: 'Shop Now', exact: true});
    await expect(cta).toHaveAttribute('href', collectionPath(COLLECTIONS.all));

    await cta.click();

    await expect(page).toHaveURL(collectionPath(COLLECTIONS.all));
    await expectSingleH1(page, COLLECTIONS.all.title);
  });

  test('the most loved products appear in collection order with unambiguous links', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');

    const featured = page.getByRole('region', {
      name: 'Explore Our Most Loved Sleep Products',
    });
    await expect(featured.getByRole('heading', {level: 2})).toBeVisible();
    const handles = COLLECTIONS.mostLoved.products;
    const titles = handles.map(productTitle);
    const cards = featured.getByRole('article');
    await expect(cards).toHaveCount(handles.length);
    await expect(cards.getByRole('heading', {level: 3})).toHaveText(titles);
    for (const [index, handle] of handles.entries()) {
      const card = cards.nth(index);
      const href = `/products/${handle}`;
      await expect(
        card.getByRole('link', {name: titles[index], exact: true}),
      ).toHaveAttribute('href', href);
      // The visible label is "Shop Now"; the title tells the six links apart.
      await expect(
        card.getByRole('link', {name: `Shop Now: ${titles[index]}`}),
      ).toHaveAttribute('href', href);
    }
  });

  test('a product card call to action opens that product', async ({page}) => {
    await gotoHydrated(page, '/');

    await page
      .getByRole('link', {name: `Shop Now: ${PRODUCTS.pebble.title}`})
      .click();

    await expectPathname(page, productPath(PRODUCTS.pebble));
    await expectSingleH1(page, PRODUCTS.pebble.title);
  });

  test('the story call to action leads to the About page', async ({page}) => {
    await gotoHydrated(page, '/');

    const story = page.getByRole('region', {
      name: 'Redefining Sleep. One Innovation At A Time.',
    });
    const cta = story.getByRole('link', {name: 'Our Story', exact: true});
    await expect(cta).toHaveAttribute('href', '/pages/about');

    await cta.click();

    await expect(page).toHaveURL('/pages/about');
    await expectSingleH1(page, COPY.aboutH1);
  });

  test('every customer video links to the product it shows', async ({page}) => {
    await gotoHydrated(page, '/');

    const ugc = page.getByRole('region', {name: 'Sleep Better With {AppName}'});
    const links = ugc.getByRole('link');
    await expect(links).toHaveCount(4);
    const hrefs = await links.evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute('href')),
    );
    expect(hrefs).toEqual([
      productPath(PRODUCTS.cloudAlign),
      productPath(PRODUCTS.cloudCool),
      productPath(PRODUCTS.cloudAlign),
      productPath(PRODUCTS.cloudControl),
    ]);
    // Their names say where they lead, not just what the video is about.
    for (const name of await links.evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute('aria-label')),
    )) {
      expect(name).toMatch(/ – shop the product$/);
    }

    await ugc.getByRole('link', {name: COPY.ugcLink, exact: true}).click();

    await expectPathname(page, productPath(PRODUCTS.cloudAlign));
    await expectSingleH1(page, PRODUCTS.cloudAlign.title);
  });
});

test.describe('FAQ', () => {
  const FIRST_QUESTION = 'How does the 30-day trial work?';
  const FIRST_ANSWER = 'Sleep on any {AppName} product for 30 nights.';

  const faqRegion = (page: Page) =>
    page.getByRole('region', {name: 'Questions, Answered'});
  /** A question's <details>; the answer sits inside it. */
  const faqItem = (page: Page, question: string): Locator =>
    faqRegion(page).getByRole('group').filter({hasText: question});

  test('starts with every answer collapsed', async ({page}) => {
    await gotoHydrated(page, '/');

    const items = faqRegion(page).getByRole('group');
    await expect(items).toHaveCount(4);
    await expect(items.locator('summary')).toHaveText([
      FIRST_QUESTION,
      'Are {AppName} comforters and pillows machine washable?',
      'Which side of the CloudCool comforter is the cool side?',
      'How long does shipping take?',
    ]);
    await expect(faqRegion(page).locator('details[open]')).toHaveCount(0);
    await expect(page.getByText(FIRST_ANSWER)).toBeHidden();
  });

  test('clicking a question opens its answer and clicking again closes it', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    const item = faqItem(page, FIRST_QUESTION);
    const question = faqRegion(page).getByText(FIRST_QUESTION, {exact: true});

    await question.click();

    await expect(item).toHaveAttribute('open', '');
    await expect(item.getByText(FIRST_ANSWER)).toBeVisible();

    await question.click();

    await expect(item).not.toHaveAttribute('open');
    await expect(item.getByText(FIRST_ANSWER)).toBeHidden();
  });

  test('Enter and Space on a focused question toggle its answer', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    const item = faqItem(page, FIRST_QUESTION);
    await item.locator('summary').focus();

    await page.keyboard.press('Enter');
    await expect(item).toHaveAttribute('open', '');
    await page.keyboard.press('Enter');
    await expect(item).not.toHaveAttribute('open');
    await page.keyboard.press('Space');
    await expect(item).toHaveAttribute('open', '');
    await expect(item.getByText(FIRST_ANSWER)).toBeVisible();
    await page.keyboard.press('Space');
    await expect(item).not.toHaveAttribute('open');
  });

  test('the questions can be reached with Tab', async ({page}) => {
    await gotoHydrated(page, '/');
    const summaries = faqRegion(page).locator('summary');
    await summaries.first().focus();

    await page.keyboard.press('Tab');

    await expect(summaries.nth(1)).toBeFocused();
  });
});

interface NewsletterCase {
  name: string;
  /** The `source` the form posts, which tells the two forms apart. */
  source: string;
  scope: (page: Page) => Locator;
  /** The other form, which must not react. */
  other: (page: Page) => Locator;
}

const band = (page: Page) =>
  page.getByRole('region', {name: 'Sleep Smarter. Save More.'});
const footer = (page: Page) => page.getByRole('contentinfo');

// The footer no longer carries a form (it ends in the call-to-action card and
// the social columns); the band is the one newsletter form on the page.
const NEWSLETTER_FORMS: readonly NewsletterCase[] = [
  {name: 'home page band', source: 'homepage', scope: band, other: footer},
];

const SIGNUP_EMAIL = 'shopper@example.com';

test.describe('newsletter forms', () => {
  for (const form of NEWSLETTER_FORMS) {
    const email = (page: Page) =>
      form.scope(page).getByRole('textbox', {name: 'Email address'});
    const signUp = (page: Page) =>
      form.scope(page).getByRole('button', {name: 'Sign Up', exact: true});
    const status = (page: Page) => form.scope(page).getByRole('status');
    /** Resolves with the POST this form sends to /newsletter. */
    const signupRequest = (page: Page) =>
      page.waitForRequest(
        (request) =>
          request.method() === 'POST' && request.url().includes('/newsletter'),
      );

    test(`${form.name}: the status region is mounted empty before anything is sent`, async ({
      page,
    }) => {
      await gotoHydrated(page, '/');

      await expect(status(page)).toHaveCount(1);
      await expect(status(page)).toBeEmpty();
      await expect(email(page)).toHaveAttribute('required', '');
      await expect(email(page)).toHaveAttribute('type', 'email');
      await expect(email(page)).not.toHaveAttribute('aria-invalid');
    });

    test(`${form.name}: a valid address gets the neutral development message and keeps its value`, async ({
      page,
    }) => {
      await gotoHydrated(page, '/');
      await email(page).fill(SIGNUP_EMAIL);

      const [request] = await Promise.all([
        signupRequest(page),
        signUp(page).click(),
      ]);

      expect(request.postData()).toContain(
        `email=${encodeURIComponent(SIGNUP_EMAIL)}`,
      );
      expect(request.postData()).toContain(`source=${form.source}`);
      const message = status(page).locator('p');
      await expect(message).toHaveText(COPY.newsletterMock);
      // The mock did not record anything: no success styling, no error styling.
      await expect(message).not.toHaveClass(/form-message--(success|error)/);
      await expect(email(page)).toHaveValue(SIGNUP_EMAIL);
      await expect(email(page)).not.toHaveAttribute('aria-invalid');
      // The field is described by the status region.
      const describedBy = await email(page).getAttribute('aria-describedby');
      expect(describedBy, 'aria-describedby').toBeTruthy();
      await expect(status(page)).toHaveAttribute('id', describedBy ?? '');
      // The other form does not react.
      await expect(
        form.other(page).getByRole('status').locator('p'),
      ).toHaveCount(0);
    });

    test(`${form.name}: an invalid address is rejected with a message, and a corrected one goes through`, async ({
      page,
      consoleGuard,
    }) => {
      consoleGuard.allowHttpStatus(
        400,
        '/newsletter',
        'the action answers 400 to an invalid address',
      );
      await gotoHydrated(page, '/');
      // Passes the browser's own check, but not the server's.
      await email(page).fill('test@example.c');

      await signUp(page).click();

      const message = status(page).locator('p');
      await expect(message).toHaveText(COPY.newsletterInvalid);
      await expect(message).toHaveClass(/form-message--error/);
      await expect(email(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(email(page)).toHaveValue('test@example.c');

      await email(page).fill(SIGNUP_EMAIL);
      await signUp(page).click();

      await expect(message).toHaveText(COPY.newsletterMock);
      await expect(email(page)).not.toHaveAttribute('aria-invalid');
    });

    test(`${form.name}: submitting an empty field sends nothing`, async ({
      page,
    }) => {
      await gotoHydrated(page, '/');
      const posts: string[] = [];
      page.on('request', (request) => {
        if (
          request.method() === 'POST' &&
          request.url().includes('/newsletter')
        )
          posts.push(request.postData() ?? '');
      });

      await signUp(page).click();

      await expect(email(page)).toBeFocused();
      expect(
        await email(page).evaluate((input) => input.matches(':invalid')),
        'the empty required field is invalid',
      ).toBe(true);
      await expect(status(page)).toBeEmpty();
      // Prove the listener works, and that nothing was sent before: the first
      // POST is the one for this valid address.
      await email(page).fill(SIGNUP_EMAIL);
      await signUp(page).click();
      await expect(status(page).locator('p')).toHaveText(COPY.newsletterMock);
      expect(posts).toHaveLength(1);
      expect(posts[0]).toContain(`email=${encodeURIComponent(SIGNUP_EMAIL)}`);
    });
  }
});

test.describe('About page', () => {
  test('tells the story and offers the range twice', async ({page}) => {
    await gotoHydrated(page, '/pages/about');

    await expect(page).toHaveTitle(TITLES.about);
    await expectSingleH1(page, COPY.aboutH1);
    const hero = page.getByRole('region', {name: COPY.aboutH1});
    await expect(
      hero.getByRole('link', {name: 'Shop Now', exact: true}),
    ).toHaveAttribute('href', collectionPath(COLLECTIONS.all));
    await expect(
      page.getByRole('region', {name: 'About {AppName}'}),
    ).toContainText(
      '{AppName} started with a comforter that changed everything.',
    );
    const closing = page.getByRole('region', {
      name: 'Ready to sleep {AppName}?',
    });
    await expect(closing.getByRole('heading', {level: 2})).toBeVisible();
    await expect(
      closing.getByRole('link', {name: 'Shop Best Sellers', exact: true}),
    ).toHaveAttribute('href', collectionPath(COLLECTIONS.all));
  });

  test('lists what the brand stands for', async ({page}) => {
    await gotoHydrated(page, '/pages/about');

    const values = page.getByRole('region', {name: 'What we stand for'});
    await expect(values.getByRole('heading', {level: 2})).toHaveText(
      'What we stand for',
    );
    await expect(values.getByRole('heading', {level: 3})).toHaveText([
      'Engineered for every sleeper',
      'Washable by design',
      COPY.aboutValueTested,
    ]);
    await expect(values.getByRole('listitem')).toHaveCount(3);
  });

  test('the closing call to action opens the range', async ({page}) => {
    await gotoHydrated(page, '/pages/about');

    await page
      .getByRole('link', {name: 'Shop Best Sellers', exact: true})
      .click();

    await expect(page).toHaveURL(collectionPath(COLLECTIONS.all));
    await expectSingleH1(page, COLLECTIONS.all.title);
  });
});

test.describe('not found', () => {
  test('an unknown URL gets a friendly 404 with ways back', async ({
    page,
    consoleGuard,
  }) => {
    consoleGuard.allowHttpStatus(404, '/this-page-does-not-exist');

    const response = await gotoHydrated(page, '/this-page-does-not-exist');

    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle(TITLES.pageNotFound);
    expect(await namedMeta(page, 'robots')).toContain('noindex');
    await expectSingleH1(page, COPY.notFoundH1);
    // Scoped to <main>: the footer also has a "Shop All" link.
    const links = main(page).getByRole('link');
    await expect(links).toHaveText(['Back to home', 'Shop all']);
    await expect(
      main(page).getByRole('link', {name: 'Back to home', exact: true}),
    ).toHaveAttribute('href', '/');
    await expect(
      main(page).getByRole('link', {name: 'Shop all', exact: true}),
    ).toHaveAttribute('href', collectionPath(COLLECTIONS.all));
  });

  test('"Back to home" returns to the home page', async ({
    page,
    consoleGuard,
  }) => {
    consoleGuard.allowHttpStatus(404, '/this-page-does-not-exist');
    await gotoHydrated(page, '/this-page-does-not-exist');

    await main(page)
      .getByRole('link', {name: 'Back to home', exact: true})
      .click();

    await expect(page).toHaveURL('/');
    await expectSingleH1(page, COPY.homeH1);
  });

  test('"Shop all" opens the range', async ({page, consoleGuard}) => {
    consoleGuard.allowHttpStatus(404, '/this-page-does-not-exist');
    await gotoHydrated(page, '/this-page-does-not-exist');

    await main(page).getByRole('link', {name: 'Shop all', exact: true}).click();

    await expect(page).toHaveURL(collectionPath(COLLECTIONS.all));
    await expectSingleH1(page, COLLECTIONS.all.title);
  });

  test('a policy the store does not have is a 404 titled for the policy', async ({
    page,
    consoleGuard,
  }) => {
    // The mock shop has no subscription policy.
    consoleGuard.allowHttpStatus(404, '/policies/subscription-policy');

    const response = await gotoHydrated(page, '/policies/subscription-policy');

    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle('Policy not found | {AppName}');
    expect(await namedMeta(page, 'robots')).toContain('noindex');
    await expectSingleH1(page, COPY.notFoundH1);
  });
});

test.describe('customer accounts are not connected', () => {
  test('every account URL redirects towards the sign-in page', async ({
    request,
  }) => {
    const hops: ReadonlyArray<readonly [from: string, to: string]> = [
      ['/account', '/account/orders'],
      ['/account/orders', '/account/login'],
      ['/account/profile', '/account/login'],
      ['/account/addresses', '/account/login'],
      ['/account/orders/1001', '/account/login'],
    ];
    for (const [from, to] of hops) {
      const response = await request.get(from, {maxRedirects: 0});
      expect(response.status(), `${from} status`).toBe(302);
      expect(response.headers()['location'], `${from} location`).toBe(to);
    }

    const login = await request.get('/account/login', {maxRedirects: 0});
    expect(login.status()).toBe(503);
  });

  test('/account ends on a sign-in page that explains why', async ({
    page,
    consoleGuard,
  }) => {
    consoleGuard.allowHttpStatus(503, '/account/login');

    const response = await gotoHydrated(page, '/account');

    expect(response?.status()).toBe(503);
    const hops = await redirectChain(response!);
    expect(
      hops.map((hop) => [new URL(hop.url).pathname, hop.status]),
      'the two redirects before the page',
    ).toEqual([
      ['/account', 302],
      ['/account/orders', 302],
    ]);
    await expect(page).toHaveURL('/account/login');
    await expect(page).toHaveTitle(TITLES.signIn);
    await expectSingleH1(page, COPY.signInUnavailableH1);
    await expect(main(page)).toContainText('Customer Account API');
  });

  test('offers ways back to the shop', async ({page, consoleGuard}) => {
    consoleGuard.allowHttpStatus(503, '/account/login');
    await gotoHydrated(page, '/account/login');

    await expect(
      main(page).getByRole('link', {name: 'Go to homepage', exact: true}),
    ).toHaveAttribute('href', '/');
    const shop = main(page).getByRole('link', {
      name: 'Back to shopping',
      exact: true,
    });
    await expect(shop).toHaveAttribute('href', collectionPath(COLLECTIONS.all));

    await shop.click();

    await expect(page).toHaveURL(collectionPath(COLLECTIONS.all));
    await expectSingleH1(page, COLLECTIONS.all.title);
  });

  test('keeps the developer instructions in a collapsed section', async ({
    page,
    consoleGuard,
  }) => {
    consoleGuard.allowHttpStatus(503, '/account/login');
    await gotoHydrated(page, '/account/login');
    const details = main(page).getByRole('group');
    await expect(details).not.toHaveAttribute('open');
    await expect(main(page).getByRole('list')).toBeHidden();

    await details.getByText(COPY.accountDeveloperSummary).click();

    await expect(details).toHaveAttribute('open', '');
    const steps = main(page).getByRole('list').getByRole('listitem');
    await expect(steps).toHaveCount(4);
    await expect(steps.first()).toContainText('Customer accounts are deferred');
  });
});

test.describe('policies', () => {
  const POLICIES = [
    {
      title: 'Privacy Policy',
      handle: 'privacy-policy',
      blurb: 'How we collect, use and protect your personal information.',
      headline: "Sleep Easy, Your Data's Safe",
    },
    {
      title: 'Shipping Policy',
      handle: 'shipping-policy',
      blurb: 'Processing times, delivery estimates and tracking.',
      headline: 'From Our Door To Yours',
    },
    {
      title: 'Terms of Service',
      handle: 'terms-of-service',
      blurb: 'The terms that apply when you shop with {AppName}.',
      headline: 'Our Terms, Made Simple',
    },
    {
      title: 'Return and Refund Policy',
      handle: 'refund-policy',
      blurb: 'Our 30-day return window and how refunds and exchanges work.',
      headline: 'Love It, Or Send It Back',
    },
    {
      title: 'Contact Information',
      handle: 'contact-information',
      blurb: 'Business details, how to reach us and when we reply.',
      headline: "We're Here To Help",
    },
    {
      title: 'Legal Notice',
      handle: 'legal-notice',
      blurb: 'Who operates this website, hosting and intellectual property.',
      headline: 'The Legal Details',
    },
  ] as const;

  test('the index lists every policy', async ({page}) => {
    await gotoHydrated(page, '/policies');

    await expectSingleH1(page, 'Policies');
    await expect(page).toHaveTitle(TITLES.policies);
    const items = main(page).getByRole('listitem');
    // No subscription policy in the mock.
    await expect(items).toHaveCount(POLICIES.length);
    for (const [index, policy] of POLICIES.entries()) {
      const item = items.nth(index);
      await expect(item).toContainText(policy.title);
      await expect(item).toContainText(policy.blurb);
      await expect(item.getByRole('link')).toHaveAttribute(
        'href',
        `/policies/${policy.handle}`,
      );
    }
  });

  test('a policy has a breadcrumb back to the index', async ({page}) => {
    await gotoHydrated(page, '/policies');

    await main(page)
      .getByRole('link', {name: /^Shipping Policy/})
      .click();

    await expect(page).toHaveURL('/policies/shipping-policy');
    await expectSingleH1(page, 'From Our Door To Yours');
    await expect(page).toHaveTitle('Shipping Policy | {AppName}');
    const breadcrumb = main(page).getByRole('navigation', {name: 'Breadcrumb'});
    await expect(breadcrumb.getByRole('link')).toHaveText('Policies');
    await expect(breadcrumb.getByRole('link')).toHaveAttribute(
      'href',
      '/policies',
    );
    await expect(
      breadcrumb.getByText('Shipping Policy', {exact: true}),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      main(page).getByRole('link', {name: 'Continue shopping', exact: true}),
    ).toHaveAttribute('href', collectionPath(COLLECTIONS.all));

    await breadcrumb.getByRole('link', {name: 'Policies'}).click();

    await expect(page).toHaveURL('/policies');
    await expectSingleH1(page, 'Policies');
  });

  test('every listed policy opens with its own title', async ({page}) => {
    for (const policy of POLICIES) {
      await gotoHydrated(page, `/policies/${policy.handle}`);

      // The banner headline is the h1; the policy's formal name is its eyebrow.
      await expectSingleH1(page, policy.headline);
      await expect(main(page)).toContainText(policy.title);
      await expect(page).toHaveTitle(`${policy.title} | {AppName}`);
      await expect(
        main(page).getByRole('link', {name: 'All policies', exact: true}),
      ).toHaveAttribute('href', '/policies');
    }
  });
});

test.describe('journal', () => {
  test('shows an empty state with ways to keep shopping', async ({page}) => {
    await gotoHydrated(page, '/blogs');

    await expectSingleH1(page, 'Journal');
    await expect(page).toHaveTitle(TITLES.journal);
    await expect(
      main(page).getByRole('heading', {level: 2, name: 'No stories yet'}),
    ).toBeVisible();
    await expect(
      main(page).getByRole('link', {name: 'Shop best sellers', exact: true}),
    ).toHaveAttribute('href', collectionPath(COLLECTIONS.all));
    await expect(
      main(page).getByRole('link', {name: 'Back to home', exact: true}),
    ).toHaveAttribute('href', '/');
  });
});

test.describe('development checkout', () => {
  test('an empty cart says so and links back to the shop', async ({page}) => {
    await gotoHydrated(page, '/dev/mock-checkout');

    await expectSingleH1(page, COPY.mockCheckoutH1);
    await expect(page).toHaveTitle(TITLES.mockCheckout);
    await expect(main(page)).toContainText('Your cart is empty.');
    await expect(
      main(page).getByRole('list', {name: 'Cart lines'}),
    ).toHaveCount(0);
    const link = main(page).getByRole('link', {
      name: 'Continue shopping',
      exact: true,
    });
    await expect(link).toHaveAttribute('href', collectionPath(COLLECTIONS.all));

    await link.click();

    await expect(page).toHaveURL(collectionPath(COLLECTIONS.all));
    await expectSingleH1(page, COLLECTIONS.all.title);
  });
});
