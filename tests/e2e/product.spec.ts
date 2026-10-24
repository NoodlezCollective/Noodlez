/**
 * Product detail page (/products/:handle) against the mock catalog.
 *
 * Variant selection through the URL, price and compare-at price, the sold-out
 * Charcoal Pebble Pillow, the gallery (arrows, thumbnails, phone swipe), the
 * quantity stepper, add to cart (drawer, busy and failure states), the savings
 * disclosure, accordions, the review carousel, recommendations, state reset
 * between products and the review date in a US time zone.
 *
 * Tags (playwright.config.ts): `@mobile` also runs at 390px, `@mobile-only`
 * only there; untagged tests run on desktop. Like every spec they run with
 * reduced motion on, which includes the drawer focus assertions of the
 * add-to-cart tests.
 *
 * Long on purpose (tests may exceed the 800-line guideline when justified):
 * every scenario is a self-contained test, so a failure points at one behaviour.
 */
import type {Locator, Page} from '@playwright/test';
import {
  COPY,
  PRODUCTS,
  SOLD_OUT_VARIANT,
  productPath,
  ratingLabel,
} from './support/catalog';
import {drawer, expectModalOpen} from './support/dialogs';
import {expect, test} from './support/fixtures';
import {gotoHydrated} from './support/hydration';
import {expectSingleH1} from './support/layout';

const {cloudAlign, marshMellow, pebble, silkSleepMask} = PRODUCTS;
const [standard, king] = cloudAlign.variants;

/* -------------------------------------------------------------------------- */
/* Locators and small assertions. Structural hooks (`.product-info`,           */
/* `.gallery__track`) stay in these helpers.                                   */
/* -------------------------------------------------------------------------- */

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const main = (page: Page) => page.getByRole('main');

/** The price group of the buy box (current price plus "Regular price"). */
const price = (page: Page) =>
  page.locator('.product-info').getByRole('group', {name: 'Price'});

/** Current price, then the struck-through compare-at price (as text). */
function expectPrice(page: Page, current: string, compareAt: string) {
  return expect(price(page)).toHaveText(
    new RegExp(
      `^${escapeRegExp(current)}\\s*Regular price ${escapeRegExp(compareAt)}$`,
    ),
  );
}

/** The variant picker of one option: "Select Size: Standard". */
const optionGroup = (page: Page, optionName: string) =>
  page.getByRole('group', {name: new RegExp(`^Select ${optionName}:`)});

/** A size pill or colour swatch, by its accessible name. */
const option = (page: Page, name: string) =>
  page.getByRole('button', {name, exact: true});

const gallery = (page: Page, productTitle: string) =>
  page.getByRole('region', {name: `${productTitle} images`});

const thumbnail = (
  page: Page,
  productTitle: string,
  index: number,
  count: number,
) =>
  gallery(page, productTitle).getByRole('button', {
    name: `View image ${index} of ${count}`,
  });

const expectPressed = (button: Locator, pressed = true) =>
  expect(button).toHaveAttribute('aria-pressed', String(pressed));

/** `aria-disabled`, not `disabled`: a disabled button would drop keyboard focus. */
const expectAriaDisabled = (button: Locator, disabled = true) =>
  disabled
    ? expect(button).toHaveAttribute('aria-disabled', 'true')
    : expect(button).not.toHaveAttribute('aria-disabled');

const quantityInput = (page: Page) =>
  main(page).getByRole('spinbutton', {name: 'Quantity'});
const decreaseQuantity = (page: Page) =>
  main(page).getByRole('button', {name: 'Decrease quantity'});
const increaseQuantity = (page: Page) =>
  main(page).getByRole('button', {name: 'Increase quantity'});
const addToCart = (page: Page) =>
  main(page).getByRole('button', {name: 'Add to cart'});
const soldOutButton = (page: Page) =>
  main(page).getByRole('button', {name: 'Sold out', exact: true});
/** The polite status next to the form ("Added to cart."). */
const addStatus = (page: Page) => main(page).getByRole('status');
const reviews = (page: Page) =>
  page.getByRole('region', {name: 'Customer reviews'});
const review = (page: Page, position: number, total: number) =>
  reviews(page).getByRole('article', {name: `Review ${position} of ${total}`});
const recommendations = (page: Page) =>
  page.getByRole('region', {name: 'You may also like'});
const cartLink = (page: Page, count: number) =>
  page.getByRole('banner').getByRole('link', {
    name: `Cart, ${count} ${count === 1 ? 'item' : 'items'}`,
  });

/** `<details>` with this summary. (`<summary>` has no role in Playwright.) */
const accordion = (page: Page, title: string) =>
  page.locator('details').filter({
    has: page.locator('summary', {hasText: new RegExp(`^${title}$`)}),
  });

/* -------------------------------------------------------------------------- */
/* Variants and price                                                          */
/* -------------------------------------------------------------------------- */

test.describe('variants and price', () => {
  test(
    'opens on the first variant and writes the selection into the URL',
    {tag: '@mobile'},
    async ({page}) => {
      await gotoHydrated(page, productPath(cloudAlign));

      await expectSingleH1(page, cloudAlign.title);
      await expect(page).toHaveURL(/\/cloudalign-pillow\?Size=Standard$/);
      await expect(optionGroup(page, 'Size')).toHaveAccessibleName(
        'Select Size: Standard',
      );
      await expectPressed(option(page, 'Standard'));
      await expectPressed(option(page, 'King'), false);
      await expectPrice(page, standard.price, standard.compareAt);
      await expect(
        page
          .locator('.product-info')
          .getByRole('img', {name: ratingLabel(cloudAlign)}),
      ).toBeVisible();
    },
  );

  test(
    'choosing King updates the URL, the label, the price and the compare-at price',
    {tag: '@mobile'},
    async ({page}) => {
      await gotoHydrated(page, productPath(cloudAlign));

      await option(page, 'King').click();

      await expect(page).toHaveURL(/\/cloudalign-pillow\?Size=King$/);
      await expect(optionGroup(page, 'Size')).toHaveAccessibleName(
        'Select Size: King',
      );
      await expectPressed(option(page, 'King'));
      await expectPressed(option(page, 'Standard'), false);
      await expectPrice(page, king.price, king.compareAt);

      await option(page, 'Standard').click();

      await expect(page).toHaveURL(/\/cloudalign-pillow\?Size=Standard$/);
      await expectPrice(page, standard.price, standard.compareAt);
    },
  );

  test('a size with a slash is encoded in the URL', async ({page}) => {
    const fullQueen = marshMellow.variants[1];
    await gotoHydrated(page, productPath(marshMellow));

    await option(page, fullQueen.option).click();

    await expect(page).toHaveURL(/\/marshmellow-comforter\?Size=Full%2FQueen$/);
    await expectPressed(option(page, fullQueen.option));
    await expectPrice(page, fullQueen.price, fullQueen.compareAt);
  });

  test('a variant change replaces the history entry instead of adding one', async ({
    page,
  }) => {
    await gotoHydrated(page, '/collections/pillows');
    await page
      .getByRole('link', {name: `Shop Now: ${cloudAlign.title}`})
      .click();
    await expectSingleH1(page, cloudAlign.title);

    await option(page, 'King').click();
    await expect(page).toHaveURL(/\?Size=King$/);
    await navigationsSettled(page);
    await page.goBack();

    await expectSingleH1(page, 'Pillows');
    await expect(page).toHaveURL(
      (url) => url.pathname === '/collections/pillows' && url.search === '',
    );
  });

  test('going Back while a variant change is still loading leaves the previous URL clean', async ({
    page,
  }) => {
    test.fixme(
      true,
      'BUG: pressing Back before a variant change has loaded appends ' +
        '"?Size=Standard" to the previous page (/collections/pillows becomes ' +
        "/collections/pillows?Size=Standard). Hydrogen's " +
        'useSelectedOptionInUrlParam (called at app/routes/products.$handle.tsx:143; ' +
        'hydrogen-react useSelectedOptionInUrlParam.js:14) writes the selected ' +
        'options with window.history.replaceState onto whatever URL the browser ' +
        'has at that moment. useOptimisticVariant shows King (and the hook ' +
        'writes ?Size=King) while the navigation is in flight; Back cancels ' +
        'that navigation, the loader data is still Standard, the hook re-runs ' +
        'and rewrites the already-restored previous URL. Reproduces whenever the ' +
        'product loader answers slower than the shopper presses Back (slow ' +
        'network). Suggested fix: replace the hook with a local effect that ' +
        'returns early unless window.location.pathname still is the product ' +
        'page.',
    );
    await gotoHydrated(page, '/collections/pillows');
    await page
      .getByRole('link', {name: `Shop Now: ${cloudAlign.title}`})
      .click();
    await expect(page).toHaveURL(/\/cloudalign-pillow\?Size=Standard$/);
    const kingLoads = await holdRequests(page, {
      url: (url) =>
        url.pathname === '/products/cloudalign-pillow.data' &&
        url.searchParams.get('Size') === 'King',
    });

    await option(page, 'King').click();
    await expect(page).toHaveURL(/\?Size=King$/); // written before the loader answers
    await page.goBack();
    await expectSingleH1(page, 'Pillows');
    kingLoads.release();

    await expect(page).toHaveURL(
      (url) => url.pathname === '/collections/pillows' && url.search === '',
    );
  });

  test('a direct link to ?Size=King keeps the selection after hydration', async ({
    page,
  }) => {
    await gotoHydrated(page, `${productPath(cloudAlign)}?Size=King`);

    await expect(page).toHaveURL(/\/cloudalign-pillow\?Size=King$/);
    await expectPressed(option(page, 'King'));
    await expectPrice(page, king.price, king.compareAt);
  });

  test('an unknown option value falls back to the default variant', async ({
    page,
  }) => {
    await gotoHydrated(page, `${productPath(cloudAlign)}?Size=Huge`);

    await expectPressed(option(page, 'Standard'));
    await expectPrice(page, standard.price, standard.compareAt);
    await expect(page).toHaveURL(/\?Size=Standard$/);
  });

  test('a product with one variant has no option picker', async ({page}) => {
    await gotoHydrated(page, productPath(silkSleepMask));

    await expectSingleH1(page, silkSleepMask.title);
    await expectPrice(
      page,
      silkSleepMask.variants[0].price,
      silkSleepMask.variants[0].compareAt,
    );
    await expect(optionGroup(page, 'Size')).toHaveCount(0);
    await expect(addToCart(page)).toBeEnabled();
  });

  test('keeps the quantity when only the variant changes', async ({page}) => {
    await gotoHydrated(page, productPath(cloudAlign));
    await increaseQuantity(page).click();
    await increaseQuantity(page).click();
    await expect(quantityInput(page)).toHaveValue('3');

    await option(page, 'King').click();

    await expect(page).toHaveURL(/\?Size=King$/);
    await expect(quantityInput(page)).toHaveValue('3');
  });

  test('lists the features, guarantees and accordion headings', async ({
    page,
  }) => {
    await gotoHydrated(page, productPath(cloudAlign));

    await expect(main(page).getByRole('list', {name: 'Guarantees'})).toHaveText(
      /30-Day Trial.*Hassle-Free Returns/,
    );
    await expect(
      main(page).getByText('Supports proper spinal alignment all night'),
    ).toBeVisible();
    for (const title of ['Overview', 'Materials', 'Care']) {
      await expect(accordion(page, title)).toBeVisible();
    }
    await expect(addToCart(page)).toBeEnabled();
    await expect(addStatus(page)).toHaveText('');
  });
});

/* -------------------------------------------------------------------------- */
/* Server-rendered selection                                                   */
/* -------------------------------------------------------------------------- */

test.describe('server-rendered selection (JavaScript off)', () => {
  test.use({javaScriptEnabled: false});

  test('?Size=King renders the King variant and its price', async ({page}) => {
    const response = await page.goto(`${productPath(cloudAlign)}?Size=King`);

    expect(response?.status()).toBe(200);
    await expect(optionGroup(page, 'Size')).toHaveAccessibleName(
      'Select Size: King',
    );
    await expectPressed(option(page, 'King'));
    await expectPrice(page, king.price, king.compareAt);
  });

  test('?Color=Charcoal renders the sold-out state and its image', async ({
    page,
  }) => {
    await page.goto(`${productPath(pebble)}?Color=Charcoal`);

    await expect(soldOutButton(page)).toBeDisabled();
    await expectPressed(thumbnail(page, pebble.title, 6, 8));
  });
});

/* -------------------------------------------------------------------------- */
/* Sold-out variant                                                            */
/* -------------------------------------------------------------------------- */

test.describe('sold-out variant', () => {
  const soldOutName = `${SOLD_OUT_VARIANT.option} (sold out)`;

  test('groups the Pebble swatches under their collection labels', async ({
    page,
  }) => {
    await gotoHydrated(page, productPath(pebble));

    await expect(page).toHaveURL(/\?Color=Baby\+Blue$/);
    await expect(optionGroup(page, 'Color')).toMatchAriaSnapshot(`
      - paragraph: "Select Color: Baby Blue"
      - paragraph: ${COPY.pebbleGroupCool}
      - button "Baby Blue" [pressed]
      - button "Blush"
      - button "Sage"
      - button "Stone"
      - paragraph: ${COPY.pebbleGroupLush}
      - button "Cream"
      - button "${soldOutName}"
    `);
  });

  test(
    'Charcoal can be selected but not bought',
    {tag: '@mobile'},
    async ({page}) => {
      await gotoHydrated(page, productPath(pebble));

      await option(page, soldOutName).click();

      await expect(page).toHaveURL(/\?Color=Charcoal$/);
      await expectPressed(option(page, soldOutName));
      await expect(optionGroup(page, 'Color')).toHaveAccessibleName(
        'Select Color: Charcoal',
      );
      await expect(soldOutButton(page)).toBeDisabled();
      await expect(addToCart(page)).toHaveCount(0);
      await expectPressed(thumbnail(page, pebble.title, 6, 8));
      await expectPrice(
        page,
        SOLD_OUT_VARIANT.price,
        SOLD_OUT_VARIANT.compareAt,
      );
    },
  );

  test('picking an available colour re-enables the buy button and moves the gallery', async ({
    page,
  }) => {
    await gotoHydrated(page, `${productPath(pebble)}?Color=Charcoal`);
    await expect(soldOutButton(page)).toBeDisabled();

    await option(page, 'Sage').click();

    await expect(page).toHaveURL(/\?Color=Sage$/);
    await expect(addToCart(page)).toBeEnabled();
    await expectPressed(thumbnail(page, pebble.title, 3, 8));
    await expectPressed(thumbnail(page, pebble.title, 6, 8), false);
  });
});

/* -------------------------------------------------------------------------- */
/* Gallery                                                                     */
/* -------------------------------------------------------------------------- */

test.describe('gallery', () => {
  const thumb = (page: Page, index: number) =>
    thumbnail(page, cloudAlign.title, index, cloudAlign.imageCount);
  const images = (page: Page) => gallery(page, cloudAlign.title);

  test('Next and Previous image move the selection and wrap around', async ({
    page,
  }) => {
    await gotoHydrated(page, productPath(cloudAlign));
    await expectPressed(thumb(page, 1));

    await images(page).getByRole('button', {name: 'Next image'}).click();
    await expectPressed(thumb(page, 2));
    await expect(
      images(page).getByRole('group', {name: '2 of 3'}),
    ).toBeVisible();

    await images(page).getByRole('button', {name: 'Previous image'}).click();
    await images(page).getByRole('button', {name: 'Previous image'}).click();
    await expectPressed(thumb(page, 3));

    await images(page).getByRole('button', {name: 'Next image'}).click();
    await expectPressed(thumb(page, 1));
  });

  test('thumbnails select one image at a time', async ({page}) => {
    await gotoHydrated(page, productPath(cloudAlign));

    await thumb(page, 3).click();

    await expectPressed(thumb(page, 3));
    await expectPressed(thumb(page, 1), false);
    await expectPressed(thumb(page, 2), false);
    await expect(
      images(page).getByRole('group', {name: '3 of 3'}),
    ).toBeVisible();
  });

  test('a product with eight images has eight thumbnails', async ({page}) => {
    await gotoHydrated(page, productPath(pebble));

    await expect(
      gallery(page, pebble.title).getByRole('button', {name: /^View image/}),
    ).toHaveCount(pebble.imageCount);
  });
});

test.describe('gallery on a phone', {tag: '@mobile-only'}, () => {
  test('swiping moves between images and the arrows scroll the strip', async ({
    page,
  }) => {
    const thumb = (index: number) =>
      thumbnail(page, cloudAlign.title, index, cloudAlign.imageCount);
    await gotoHydrated(page, productPath(cloudAlign));
    const track = gallery(page, cloudAlign.title).locator('.gallery__track');
    await expectPressed(thumb(1));

    await swipe(page, track, 'next');
    await expectPressed(thumb(2));
    await swipe(page, track, 'previous');
    await expectPressed(thumb(1));

    // The arrows drive the same strip: the active slide scrolls into view.
    await gallery(page, cloudAlign.title)
      .getByRole('button', {name: 'Next image'})
      .click();
    await expectPressed(thumb(2));
    await expect
      .poll(() =>
        track.evaluate((strip) =>
          Math.round(strip.scrollLeft / strip.clientWidth),
        ),
      )
      .toBe(1);
  });
});

/** Resolves after `count` animation frames: paces synthetic input without timers. */
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

/** Waits until the router has no navigation in flight (a variant change has committed). */
async function navigationsSettled(page: Page): Promise<void> {
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

/**
 * A slow one-finger swipe across `strip` with real touch events (Chromium
 * DevTools protocol). Slow on purpose, with a rest before the finger lifts:
 * a fast flick would fling past the next slide.
 */
async function swipe(
  page: Page,
  strip: Locator,
  direction: 'next' | 'previous',
): Promise<void> {
  await strip.scrollIntoViewIfNeeded();
  const box = await strip.boundingBox();
  if (!box) throw new Error('the gallery strip is not laid out');
  const steps = 22;
  const dx = (direction === 'next' ? -0.6 : 0.6) * box.width;
  const startX = box.x + box.width * (direction === 'next' ? 0.85 : 0.15);
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{x: startX, y}],
    });
    for (let step = 1; step <= steps; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{x: startX + (dx / steps) * step, y}],
      });
      await nextFrames(page, 1);
    }
    await nextFrames(page, 12);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  } finally {
    await cdp.detach();
  }
}

/* -------------------------------------------------------------------------- */
/* Quantity                                                                    */
/* -------------------------------------------------------------------------- */

test.describe('quantity stepper', () => {
  test(
    'starts at 1 and stops at the minimum without losing focus',
    {tag: '@mobile'},
    async ({page}) => {
      await gotoHydrated(page, productPath(cloudAlign));
      await expect(quantityInput(page)).toHaveValue('1');
      await expectAriaDisabled(decreaseQuantity(page));
      await expect(decreaseQuantity(page)).not.toHaveAttribute('disabled');

      await increaseQuantity(page).click();
      await increaseQuantity(page).click();
      await expect(quantityInput(page)).toHaveValue('3');
      await expectAriaDisabled(decreaseQuantity(page), false);

      await decreaseQuantity(page).click();
      await decreaseQuantity(page).click();
      await expect(quantityInput(page)).toHaveValue('1');
      await expectAriaDisabled(decreaseQuantity(page));

      await decreaseQuantity(page).focus();
      await page.keyboard.press('Enter');
      await expect(quantityInput(page)).toHaveValue('1');
      await expect(decreaseQuantity(page)).toBeFocused();
    },
  );

  test('typed values are clamped to at least 1 when the field loses focus', async ({
    page,
  }) => {
    await gotoHydrated(page, productPath(cloudAlign));

    for (const typed of ['0', '-4', '']) {
      await quantityInput(page).fill('7');
      await quantityInput(page).blur();
      await expect(quantityInput(page)).toHaveValue('7');

      await quantityInput(page).fill(typed);
      await quantityInput(page).blur();

      await expect(quantityInput(page), `typed "${typed}"`).toHaveValue('1');
    }
  });

  test('Enter commits a typed quantity', async ({page}) => {
    await gotoHydrated(page, productPath(cloudAlign));

    await quantityInput(page).fill('5');
    await quantityInput(page).press('Enter');

    await expect(quantityInput(page)).toHaveValue('5');
    await expectAriaDisabled(decreaseQuantity(page), false);
    await increaseQuantity(page).click();
    await expect(quantityInput(page)).toHaveValue('6');
  });
});

/* -------------------------------------------------------------------------- */
/* Add to cart                                                                 */
/* -------------------------------------------------------------------------- */

test.describe('add to cart', () => {
  /** The cart line of the pillow inside the open drawer. */
  const pillowLine = (cart: Locator) =>
    cart.getByRole('listitem').filter({
      has: cart.page().getByRole('link', {name: cloudAlign.title}),
    });

  test(
    'adds two King pillows, opens the cart drawer and announces it',
    {tag: '@mobile'},
    async ({page}) => {
      await gotoHydrated(page, productPath(cloudAlign));
      await option(page, 'King').click();
      await expect(page).toHaveURL(/\?Size=King$/);
      await increaseQuantity(page).click();
      await expect(quantityInput(page)).toHaveValue('2');

      await addToCart(page).click();

      const cart = drawer(page, 'Your cart');
      await expectModalOpen(page, cart);
      const line = pillowLine(cart);
      await expect(line).toHaveCount(1);
      await expect(line).toContainText('Size: King');
      await expect(line.getByRole('group', {name: 'Quantity'})).toContainText(
        '2',
      );
      // Settled: an optimistic line's controls stay disabled until the server answers.
      await expect(
        line.getByRole('button', {name: 'Increase quantity'}),
      ).toBeEnabled();
      await expect(
        cart.getByRole('complementary', {name: 'Order summary'}),
      ).toContainText('$119.98');
      await expect(cartLink(page, 2)).toBeVisible();
      await expect(addStatus(page)).toHaveText('Added to cart.');

      await page.keyboard.press('Escape');
      await expect(cart).toBeHidden();
      await expect(addToCart(page)).toBeFocused();
    },
  );

  test('adding the same variant again merges into one line', async ({page}) => {
    await gotoHydrated(page, productPath(cloudAlign));
    await addToCart(page).click();
    const cart = drawer(page, 'Your cart');
    await expectModalOpen(page, cart);
    await page.keyboard.press('Escape');
    await expect(cart).toBeHidden();

    await addToCart(page).click();

    await expectModalOpen(page, cart);
    await expect(
      cart
        .getByRole('list', {name: 'Items in your cart'})
        .getByRole('listitem'),
    ).toHaveCount(1);
    await expect(
      pillowLine(cart).getByRole('group', {name: 'Quantity'}),
    ).toContainText('2');
    await expect(cartLink(page, 2)).toBeVisible();
  });

  test('uses the typed quantity even if the field never lost focus', async ({
    page,
  }) => {
    await gotoHydrated(page, productPath(cloudAlign));

    await quantityInput(page).fill('4');
    await addToCart(page).click();

    const cart = drawer(page, 'Your cart');
    await expect(cart).toBeVisible();
    await expect(cart.getByRole('group', {name: 'Quantity'})).toContainText(
      '4',
    );
    await expect(cartLink(page, 4)).toBeVisible();
  });

  test('a single-variant product shows its option in the cart line', async ({
    page,
  }) => {
    await gotoHydrated(page, productPath(silkSleepMask));

    await addToCart(page).click();

    const cart = drawer(page, 'Your cart');
    await expect(cart).toBeVisible();
    await expect(cart).toContainText('Size: One Size');
    await expect(cart).toContainText(silkSleepMask.variants[0].price);
  });

  test('stays busy and keeps the drawer closed until the cart answers', async ({
    page,
  }) => {
    await gotoHydrated(page, productPath(cloudAlign));
    const cartAction = await holdRequests(page, {
      url: (url) => url.pathname === '/cart.data',
      method: 'POST',
    });

    await addToCart(page).click();

    await expect(
      main(page).getByRole('button', {name: 'Adding…'}),
    ).toBeDisabled();
    await expect(addStatus(page)).toHaveText('Adding…');
    await expect(drawer(page, 'Your cart')).toBeHidden();

    cartAction.release();

    await expect(drawer(page, 'Your cart')).toBeVisible();
    await expect(addStatus(page)).toHaveText('Added to cart.');
  });

  test('shows the error and keeps the drawer closed when the cart refuses the add', async ({
    page,
    consoleGuard,
  }) => {
    consoleGuard.allowHttpStatus(
      400,
      '/cart.data',
      'the cart action answers an unreadable request with 400',
    );
    await gotoHydrated(page, productPath(cloudAlign));
    // Corrupt the form payload so the real action rejects it.
    await page.route(
      (url) => url.pathname === '/cart.data',
      async (route) => {
        if (route.request().method() === 'POST') {
          await route.continue({postData: 'cartFormInput=%7Bnot-json'});
        } else {
          await route.fallback();
        }
      },
    );

    await addToCart(page).click();

    await expect(main(page).getByRole('alert')).toHaveText(
      COPY.cartInvalidRequest,
    );
    await expect(addStatus(page)).toHaveText('Could not add to cart.');
    await expect(drawer(page, 'Your cart')).toBeHidden();
    await expect(addToCart(page)).toBeEnabled();
    await expect(cartLink(page, 0)).toBeVisible();
  });
});

/**
 * Holds the requests whose URL matches until `release()` is called, so a test
 * can look at the page while the server has not answered yet.
 */
async function holdRequests(
  page: Page,
  match: {url: (url: URL) => boolean; method?: string},
): Promise<{release: () => void}> {
  let release: () => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(match.url, async (route) => {
    if (match.method && route.request().method() !== match.method) {
      await route.fallback();
      return;
    }
    await released;
    await route.continue();
  });
  return {release: () => release()};
}

/* -------------------------------------------------------------------------- */
/* Savings disclosure                                                          */
/* -------------------------------------------------------------------------- */

test.describe('savings disclosure', () => {
  const learnMore = (page: Page) =>
    main(page).getByRole('button', {name: 'Learn more'});
  const explanation = (page: Page) => page.getByRole('note');

  test(
    '"Learn more" toggles the explanation of the compare-at price',
    {tag: '@mobile'},
    async ({page}) => {
      await gotoHydrated(page, productPath(cloudAlign));
      await expect(main(page)).toContainText(COPY.savingsNote);
      await expect(learnMore(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(explanation(page)).toBeHidden();

      await learnMore(page).click();

      await expect(learnMore(page)).toHaveAttribute('aria-expanded', 'true');
      await expect(explanation(page)).toBeVisible();
      await expect(explanation(page)).toContainText(
        COPY.savingsExplanationStart,
      );

      await learnMore(page).click();

      await expect(learnMore(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(explanation(page)).toBeHidden();
    },
  );

  test('Escape closes the explanation and focus stays on the button', async ({
    page,
  }) => {
    await gotoHydrated(page, productPath(cloudAlign));
    await learnMore(page).click();
    await expect(explanation(page)).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(explanation(page)).toBeHidden();
    await expect(learnMore(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(learnMore(page)).toBeFocused();
  });

  test('clicking outside closes it, clicking inside does not', async ({
    page,
  }) => {
    await gotoHydrated(page, productPath(cloudAlign));
    await learnMore(page).click();
    await expect(explanation(page)).toBeVisible();

    await explanation(page).click();
    await expect(explanation(page)).toBeVisible();

    await page.getByRole('heading', {level: 1}).click();

    await expect(explanation(page)).toBeHidden();
    await expect(learnMore(page)).toHaveAttribute('aria-expanded', 'false');
  });
});

/* -------------------------------------------------------------------------- */
/* Accordions                                                                  */
/* -------------------------------------------------------------------------- */

test.describe('accordions', () => {
  test('start closed and open independently', async ({page}) => {
    await gotoHydrated(page, productPath(cloudAlign));
    const materials = accordion(page, 'Materials');
    const care = accordion(page, 'Care');
    for (const title of ['Overview', 'Materials', 'Care']) {
      await expect(accordion(page, title)).not.toHaveAttribute('open');
    }
    await expect(page.getByText('Cover: 65% polyester')).toBeHidden();

    await materials.locator('summary').click();

    await expect(materials).toHaveAttribute('open', '');
    await expect(
      materials.getByText(
        'Cover: 65% polyester, 35% viscose cooling knit, removable.',
      ),
    ).toBeVisible();
    await expect(
      materials.getByText('Core: CertiPUR-US® certified adaptive memory foam.'),
    ).toBeVisible();

    await care.locator('summary').click();
    await expect(care).toHaveAttribute('open', '');
    await expect(materials).toHaveAttribute('open', '');

    await materials.locator('summary').click();
    await expect(materials).not.toHaveAttribute('open');
    await expect(care).toHaveAttribute('open', '');
  });

  test('Overview shows the product description and the keyboard toggles it', async ({
    page,
  }) => {
    await gotoHydrated(page, productPath(cloudAlign));
    const overview = accordion(page, 'Overview');

    await overview.locator('summary').focus();
    await page.keyboard.press('Enter');

    await expect(overview).toHaveAttribute('open', '');
    await expect(overview).toContainText(
      'The #1 best-selling ergonomic pillow of 2025',
    );

    await page.keyboard.press('Enter');

    await expect(overview).not.toHaveAttribute('open');
  });
});

/* -------------------------------------------------------------------------- */
/* Reviews                                                                     */
/* -------------------------------------------------------------------------- */

test.describe('customer reviews', () => {
  test('shows the first review with author, verified badge and date', async ({
    page,
  }) => {
    await gotoHydrated(page, productPath(cloudAlign));
    const first = review(page, 1, 2);

    await expect(first).toBeVisible();
    await expect(first.getByRole('heading', {level: 3})).toHaveText(
      'Finally, no neck pain',
    );
    await expect(
      first.getByRole('img', {name: 'Rated 5.0 out of 5'}),
    ).toBeVisible();
    await expect(first).toContainText('Jenna R.');
    await expect(first).toContainText('Verified buyer');
    await expect(first.locator('time')).toHaveText('Sep 12, 2026');
    await expect(first.locator('time')).toHaveAttribute(
      'datetime',
      '2026-09-12',
    );
  });

  test('arrows cycle through the reviews with wrap-around and the dots follow', async ({
    page,
  }) => {
    await gotoHydrated(page, productPath(cloudAlign));
    const dot = (index: number) =>
      reviews(page).getByRole('button', {name: `Go to review ${index}`});
    const next = reviews(page).getByRole('button', {name: 'Next review'});
    const previous = reviews(page).getByRole('button', {
      name: 'Previous review',
    });
    await expect(dot(1)).toHaveAttribute('aria-current', 'true');
    await expect(dot(2)).not.toHaveAttribute('aria-current');

    await next.click();
    await expect(
      review(page, 2, 2).getByRole('heading', {level: 3}),
    ).toHaveText('Worth every penny');
    await expect(review(page, 2, 2)).toContainText('Daniel K.');
    await expect(dot(2)).toHaveAttribute('aria-current', 'true');
    await expect(dot(1)).not.toHaveAttribute('aria-current');

    await next.click();
    await expect(review(page, 1, 2)).toBeVisible();

    await previous.click();
    await expect(review(page, 2, 2)).toBeVisible();

    await dot(1).click();
    await expect(review(page, 1, 2)).toBeVisible();
    await expect(dot(1)).toHaveAttribute('aria-current', 'true');
  });

  test('a product with three reviews has three dots', async ({page}) => {
    await gotoHydrated(page, productPath(pebble));

    await expect(review(page, 1, 3)).toBeVisible();
    await expect(
      reviews(page).getByRole('button', {name: /^Go to review/}),
    ).toHaveCount(3);
  });

  test.describe('in a US time zone', () => {
    // The server formats in UTC. A browser west of UTC must not shift the
    // date-only value to the 11th (nor log a hydration mismatch, which the
    // console guard would report).
    test.use({timezoneId: 'America/Los_Angeles'});

    test('shows Sep 12, 2026 on server and client alike', async ({page}) => {
      await gotoHydrated(page, productPath(cloudAlign));

      await expect(reviews(page).locator('time')).toHaveText('Sep 12, 2026');
      expect(
        await page.evaluate(
          () => Intl.DateTimeFormat().resolvedOptions().timeZone,
        ),
      ).toBe('America/Los_Angeles');
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Recommendations and state between products                                  */
/* -------------------------------------------------------------------------- */

test.describe('recommendations', () => {
  const RECOMMENDED = [
    PRODUCTS.marshMellow,
    PRODUCTS.cloudCool,
    PRODUCTS.pebble,
    PRODUCTS.cloudControl,
  ];

  test('lists four products in order, each with a price and a "Shop Now" link', async ({
    page,
  }) => {
    await gotoHydrated(page, productPath(cloudAlign));
    const section = recommendations(page);

    await expect(section.getByRole('heading', {level: 3})).toHaveText(
      RECOMMENDED.map((product) => product.title),
    );
    for (const product of RECOMMENDED) {
      const card = section.getByRole('article').filter({
        has: page.getByRole('heading', {name: product.title}),
      });
      await expect(
        card.getByRole('link', {name: `Shop Now: ${product.title}`}),
      ).toHaveAttribute('href', productPath(product));
      await expect(card.getByRole('group', {name: 'Price'})).toContainText(
        product.variants[0].price,
      );
    }
    // Never recommends the product being viewed.
    await expect(
      section.getByRole('link', {name: cloudAlign.title}),
    ).toHaveCount(0);
  });

  test('clicking a recommendation opens that product', async ({page}) => {
    await gotoHydrated(page, productPath(cloudAlign));

    await recommendations(page)
      .getByRole('link', {name: `Shop Now: ${pebble.title}`})
      .click();

    await expect(page).toHaveURL(/\/pebble-pillow\?Color=Baby\+Blue$/);
    await expectSingleH1(page, pebble.title);
    const [first] = pebble.variants;
    await expectPrice(page, first.price, first.compareAt);
  });

  test('state from one product does not leak into the next', async ({page}) => {
    await gotoHydrated(page, productPath(cloudAlign));
    await increaseQuantity(page).click();
    await increaseQuantity(page).click();
    await expect(quantityInput(page)).toHaveValue('3');
    await reviews(page).getByRole('button', {name: 'Next review'}).click();
    await expect(review(page, 2, 2)).toBeVisible();
    await gallery(page, cloudAlign.title)
      .getByRole('button', {name: 'Next image'})
      .click();
    await expectPressed(thumbnail(page, cloudAlign.title, 2, 3));
    await accordion(page, 'Materials').locator('summary').click();
    await expect(accordion(page, 'Materials')).toHaveAttribute('open', '');

    await recommendations(page)
      .getByRole('link', {name: `Shop Now: ${pebble.title}`})
      .click();

    await expectSingleH1(page, pebble.title);
    await expect(quantityInput(page)).toHaveValue('1');
    await expect(review(page, 1, 3)).toBeVisible();
    await expectPressed(thumbnail(page, pebble.title, 1, 8));
    await expect(accordion(page, 'Materials')).not.toHaveAttribute('open');
  });
});
