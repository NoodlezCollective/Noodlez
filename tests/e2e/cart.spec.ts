/**
 * Cart: the /cart page, the cart drawer and the development checkout.
 *
 * Carts are seeded with a permalink (support/cart.ts) so each test starts from
 * a known state; the product page journey adds through the UI. Totals, the
 * header count, discount codes and gift cards run against the in-memory mock
 * cart (app/lib/mock/cart.server.ts): MELLOW10 is 10% off, WELCOME15 15% off,
 * several codes apply the best rate, gift cards are not supported.
 *
 * Tags (playwright.config.ts): `@mobile` also runs at 390px. Page locators are
 * scoped to `main` because the closed cart drawer holds a second CartMain.
 */
import type {Locator, Page} from '@playwright/test';
import {seedCart, type SeedCartOptions, type SeedLine} from './support/cart';
import {COPY, PRODUCTS, productPath} from './support/catalog';
import {drawer} from './support/dialogs';
import {expect, test} from './support/fixtures';
import {gotoHydrated, waitForHydration} from './support/hydration';
import {expectSingleH1} from './support/layout';

const {cloudAlign, pebble, cloudBody} = PRODUCTS;
const [standard] = cloudAlign.variants;

const ONE_PILLOW: readonly SeedLine[] = [{variant: standard}];
const THREE_PILLOWS: readonly SeedLine[] = [
  {variant: standard},
  {variant: pebble.variants[0]},
  {variant: cloudBody.variants[0]},
];

/* -------------------------------------------------------------------------- */
/* Locators. Structural hooks (`.cart-summary__row`, `.cart-line__total`)      */
/* stay in these helpers.                                                      */
/* -------------------------------------------------------------------------- */

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const main = (page: Page) => page.getByRole('main');

/** The cart contents of the /cart page (the drawer's region is "Cart contents"). */
const pageCart = (page: Page) => main(page).getByRole('region', {name: 'Cart'});

const cartLink = (page: Page, count: number) =>
  page.getByRole('banner').getByRole('link', {
    name: `Cart, ${count} ${count === 1 ? 'item' : 'items'}`,
  });

/** The list item of the line for product `title`. */
function lineFor(scope: Locator, title: string): Locator {
  return scope.getByRole('listitem').filter({
    has: scope.page().getByRole('link', {name: title, exact: true}),
  });
}

const quantityOf = (line: Locator) =>
  line.getByRole('group', {name: 'Quantity'});
const increaseOf = (line: Locator) =>
  line.getByRole('button', {name: 'Increase quantity'});
const decreaseOf = (line: Locator) =>
  line.getByRole('button', {name: 'Decrease quantity'});
const lineTotalOf = (line: Locator) => line.locator('.cart-line__total');
const removeButton = (scope: Locator, title: string) =>
  scope.getByRole('button', {name: `Remove ${title} from cart`});

const orderSummary = (scope: Locator) =>
  scope.getByRole('complementary', {name: 'Order summary'});

function summaryRow(order: Locator, label: 'Subtotal' | 'Discount' | 'Total') {
  return order.locator('.cart-summary__row', {
    hasText: new RegExp(`^${label}`),
  });
}

interface Totals {
  subtotal: string;
  total: string;
  /** The applied codes as listed ("WELCOME15, MELLOW10") and the amount taken off. */
  discount?: {codes: string; amount: string};
}

async function expectTotals(order: Locator, totals: Totals): Promise<void> {
  await expect(summaryRow(order, 'Subtotal')).toHaveText(
    new RegExp(`^Subtotal\\s*${escapeRegExp(totals.subtotal)}$`),
  );
  if (totals.discount) {
    await expect(summaryRow(order, 'Discount')).toHaveText(
      new RegExp(
        `^Discount\\s*${escapeRegExp(totals.discount.codes)}\\s*${escapeRegExp(totals.discount.amount)}$`,
      ),
    );
  } else {
    await expect(summaryRow(order, 'Discount')).toHaveCount(0);
  }
  await expect(summaryRow(order, 'Total')).toHaveText(
    new RegExp(`^Total\\s*${escapeRegExp(totals.total)}$`),
  );
}

/** A "Have a ...?" panel (`<details>`) of the order summary. */
function promoPanel(order: Locator, summary: string): Locator {
  return order.locator('details').filter({
    has: order.page().locator('summary', {hasText: summary}),
  });
}

async function openPanel(panel: Locator): Promise<void> {
  if (!(await panel.evaluate((el: HTMLDetailsElement) => el.open))) {
    await panel.locator('summary').click();
  }
  await expect(panel).toHaveAttribute('open', '');
}

interface DiscountPanel {
  panel: Locator;
  summary: Locator;
  input: Locator;
  chips: Locator;
  remove: (code: string) => Locator;
  apply: (code: string) => Promise<void>;
}

function discountPanel(order: Locator): DiscountPanel {
  const panel = promoPanel(order, 'Have a discount code?');
  const input = panel.getByRole('textbox', {name: 'Discount code'});
  return {
    panel,
    summary: panel.locator('summary'),
    input,
    chips: panel.getByRole('list', {name: 'Applied discount codes'}),
    remove: (code) =>
      panel.getByRole('button', {name: `Remove discount code ${code}`}),
    apply: async (code) => {
      await openPanel(panel);
      await input.fill(code);
      await panel.getByRole('button', {name: 'Apply discount code'}).click();
    },
  };
}

/** Seeds a cart for this browser context and opens the cart page. */
async function openCartPage(
  page: Page,
  lines: string | readonly SeedLine[] = ONE_PILLOW,
  options?: SeedCartOptions,
): Promise<void> {
  await seedCart(page, lines, options);
  await gotoHydrated(page, '/cart');
}

/* -------------------------------------------------------------------------- */
/* The cart page                                                               */
/* -------------------------------------------------------------------------- */

test.describe('cart page', () => {
  test(
    'lists the line and summarises the order',
    {tag: '@mobile'},
    async ({page}) => {
      await openCartPage(page);

      await expectSingleH1(page, 'Your cart 1 item');
      const cart = pageCart(page);
      await expect(
        cart.getByRole('list', {name: 'Items in your cart'}),
      ).toBeVisible();
      const line = lineFor(cart, cloudAlign.title);
      await expect(line).toHaveCount(1);
      await expect(
        line.getByRole('link', {name: cloudAlign.title, exact: true}),
      ).toHaveAttribute('href', `${productPath(cloudAlign)}?Size=Standard`);
      await expect(line).toContainText('Size: Standard');
      await expect(line.getByRole('group', {name: 'Price'})).toContainText(
        `${standard.price}Regular price ${standard.compareAt}`,
      );
      await expect(lineTotalOf(line)).toHaveText(standard.price);
      await expect(quantityOf(line)).toHaveText('Quantity 1');

      const order = orderSummary(cart);
      await expectTotals(order, {subtotal: '$49.99', total: '$49.99'});
      await expect(order.getByText(COPY.cartShippingNote)).toBeVisible();
      await expect(order.getByRole('listitem')).toHaveText([
        '30-Day Trial',
        'Hassle-Free Returns',
      ]);
      await expect(
        order.getByRole('link', {name: 'Continue shopping'}),
      ).toHaveAttribute('href', '/collections/all');
      await expect(cartLink(page, 1)).toBeVisible();
    },
  );

  test('lists several lines in the order they were added', async ({page}) => {
    await openCartPage(page, THREE_PILLOWS);

    await expectSingleH1(page, 'Your cart 3 items');
    const cart = pageCart(page);
    await expect(
      cart.getByRole('list', {name: 'Items in your cart'}).getByRole('link', {
        name: /^(CloudAlign Pillow|Pebble Pillow|Cloud Body Pillow)$/,
      }),
    ).toHaveText([cloudAlign.title, pebble.title, cloudBody.title]);
    await expect(lineFor(cart, pebble.title)).toContainText(
      `Color: ${pebble.variants[0].option}`,
    );
    await expectTotals(orderSummary(cart), {
      subtotal: '$164.97',
      total: '$164.97',
    });
    await expect(cartLink(page, 3)).toBeVisible();
  });

  test(
    'increasing and decreasing the quantity updates the totals and the header count',
    {tag: '@mobile'},
    async ({page}) => {
      await openCartPage(page);
      const cart = pageCart(page);
      const line = lineFor(cart, cloudAlign.title);
      const order = orderSummary(cart);
      await expect(decreaseOf(line)).toHaveAttribute('aria-disabled', 'true');

      await increaseOf(line).click();

      await expect(quantityOf(line)).toHaveText('Quantity 2');
      await expect(lineTotalOf(line)).toHaveText('$99.98');
      await expectTotals(order, {subtotal: '$99.98', total: '$99.98'});
      await expectSingleH1(page, 'Your cart 2 items');
      await expect(cartLink(page, 2)).toBeVisible();
      await expect(decreaseOf(line)).not.toHaveAttribute('aria-disabled');
      await expect(increaseOf(line)).toBeFocused();

      await decreaseOf(line).click();

      await expect(quantityOf(line)).toHaveText('Quantity 1');
      await expectTotals(order, {subtotal: '$49.99', total: '$49.99'});
      await expectSingleH1(page, 'Your cart 1 item');
      await expect(cartLink(page, 1)).toBeVisible();
      await expect(decreaseOf(line)).toHaveAttribute('aria-disabled', 'true');
      await expect(decreaseOf(line)).toBeFocused();
    },
  );

  test('"Decrease quantity" at 1 does nothing and keeps focus', async ({
    page,
  }) => {
    await openCartPage(page);
    const line = lineFor(pageCart(page), cloudAlign.title);

    await decreaseOf(line).focus();
    await page.keyboard.press('Enter');

    await expect(quantityOf(line)).toHaveText('Quantity 1');
    await expect(lineFor(pageCart(page), cloudAlign.title)).toHaveCount(1);
    await expect(decreaseOf(line)).toBeFocused();
  });

  test('the cart survives a reload', async ({page}) => {
    await openCartPage(page, [{variant: standard, quantity: 2}]);
    await expect(
      quantityOf(lineFor(pageCart(page), cloudAlign.title)),
    ).toHaveText('Quantity 2');

    await page.reload();
    await waitForHydration(page);

    await expectSingleH1(page, 'Your cart 2 items');
    await expectTotals(orderSummary(pageCart(page)), {
      subtotal: '$99.98',
      total: '$99.98',
    });
  });

  test('without a cart the page shows the empty state', async ({page}) => {
    await gotoHydrated(page, '/cart');

    await expectSingleH1(page, 'Your cart');
    await expect(
      main(page).getByRole('heading', {name: 'Your cart is empty'}),
    ).toBeVisible();
    await expect(
      main(page).getByRole('link', {name: 'Shop best sellers'}),
    ).toHaveAttribute('href', '/collections/all');
    await expect(
      main(page).getByRole('link', {name: 'Continue shopping'}),
    ).toHaveAttribute('href', '/');
    await expect(orderSummary(main(page))).toHaveCount(0);
    await expect(cartLink(page, 0)).toBeVisible();
  });
});

/* -------------------------------------------------------------------------- */
/* Removing lines                                                              */
/* -------------------------------------------------------------------------- */

test.describe('removing lines', () => {
  test(
    'removing the only line shows the empty cart and moves focus to its heading',
    {tag: '@mobile'},
    async ({page}) => {
      await openCartPage(page);

      await removeButton(pageCart(page), cloudAlign.title).click();

      const empty = main(page).getByRole('heading', {
        name: 'Your cart is empty',
      });
      await expect(empty).toBeVisible();
      await expect(empty).toBeFocused();
      await expectSingleH1(page, 'Your cart');
      await expect(cartLink(page, 0)).toBeVisible();
      await expect(
        main(page).getByRole('link', {name: 'Shop best sellers'}),
      ).toHaveAttribute('href', '/collections/all');
      await expect(
        main(page).getByRole('link', {name: 'Continue shopping'}),
      ).toHaveAttribute('href', '/');
      await expect(orderSummary(main(page))).toHaveCount(0);
    },
  );

  test('focus moves to the neighbouring remove button, then to the empty heading', async ({
    page,
  }) => {
    await openCartPage(page, THREE_PILLOWS);
    const cart = pageCart(page);
    const order = orderSummary(cart);

    // Middle line: the one that follows takes its place.
    await removeButton(cart, pebble.title).click();
    await expect(lineFor(cart, pebble.title)).toHaveCount(0);
    await expect(removeButton(cart, cloudBody.title)).toBeFocused();
    await expectTotals(order, {subtotal: '$119.98', total: '$119.98'});
    await expect(cartLink(page, 2)).toBeVisible();

    // Last line: focus goes to the one before it.
    await removeButton(cart, cloudBody.title).click();
    await expect(lineFor(cart, cloudBody.title)).toHaveCount(0);
    await expect(removeButton(cart, cloudAlign.title)).toBeFocused();
    await expectTotals(order, {subtotal: '$49.99', total: '$49.99'});

    // Nothing left: the empty-cart heading.
    await removeButton(cart, cloudAlign.title).click();
    await expect(
      main(page).getByRole('heading', {name: 'Your cart is empty'}),
    ).toBeFocused();
  });
});

/* -------------------------------------------------------------------------- */
/* Discount codes and gift cards                                               */
/* -------------------------------------------------------------------------- */

test.describe('discount codes', () => {
  test(
    'applying a code shows the chip, the discount row and the new total',
    {tag: '@mobile'},
    async ({page}) => {
      await openCartPage(page);
      const order = orderSummary(pageCart(page));
      const discounts = discountPanel(order);
      await expect(discounts.panel).not.toHaveAttribute('open');

      await discounts.apply('mellow10');

      await expect(discounts.chips).toHaveText('MELLOW10');
      await expectTotals(order, {
        subtotal: '$49.99',
        discount: {codes: 'MELLOW10', amount: COPY.discountRowMellow10},
        total: '$44.99',
      });
      await expect(discounts.input).toHaveValue('');
    },
  );

  test('WELCOME15 takes 15% off', async ({page}) => {
    await openCartPage(page);
    const order = orderSummary(pageCart(page));

    await discountPanel(order).apply('WELCOME15');

    await expectTotals(order, {
      subtotal: '$49.99',
      discount: {codes: 'WELCOME15', amount: '−$7.50'},
      total: '$42.49',
    });
  });

  test('a second code is listed too and the better rate applies', async ({
    page,
  }) => {
    await openCartPage(page);
    const order = orderSummary(pageCart(page));
    const discounts = discountPanel(order);
    await discounts.apply('MELLOW10');
    await expect(discounts.chips).toHaveText('MELLOW10');

    await discounts.apply('WELCOME15');

    await expect(discounts.chips.getByRole('listitem')).toHaveText([
      'WELCOME15',
      'MELLOW10',
    ]);
    await expectTotals(order, {
      subtotal: '$49.99',
      discount: {codes: 'WELCOME15, MELLOW10', amount: '−$7.50'},
      total: '$42.49',
    });
  });

  test('removing codes restores the total and keeps focus inside the panel', async ({
    page,
  }) => {
    await openCartPage(page, ONE_PILLOW, {discount: 'MELLOW10'});
    const order = orderSummary(pageCart(page));
    const discounts = discountPanel(order);
    // A cart created with ?discount= starts with the panel open and the code applied.
    await expect(discounts.panel).toHaveAttribute('open', '');
    await expect(discounts.chips).toHaveText('MELLOW10');
    await discounts.apply('WELCOME15');
    await expect(discounts.chips.getByRole('listitem')).toHaveCount(2);

    await discounts.remove('WELCOME15').click();

    await expect(discounts.chips).toHaveText('MELLOW10');
    await expectTotals(order, {
      subtotal: '$49.99',
      discount: {codes: 'MELLOW10', amount: COPY.discountRowMellow10},
      total: '$44.99',
    });
    // The chip that took its place gets focus.
    await expect(discounts.remove('MELLOW10')).toBeFocused();

    await discounts.remove('MELLOW10').click();

    await expectTotals(order, {subtotal: '$49.99', total: '$49.99'});
    await expect(discounts.chips).toHaveCount(0);
    // The panel closes with its last code: focus lands on its summary, not <body>.
    await expect(discounts.summary).toBeFocused();
  });

  test('an unknown code is reported and discounts nothing', async ({page}) => {
    await openCartPage(page);
    const order = orderSummary(pageCart(page));
    const discounts = discountPanel(order);

    await discounts.apply('bogus');

    await expect(
      discounts.panel.getByText(COPY.invalidDiscount('bogus')),
    ).toBeVisible();
    await expect(discounts.panel).toHaveAttribute('open', '');
    await expect(discounts.chips).toHaveCount(0);
    await expectTotals(order, {subtotal: '$49.99', total: '$49.99'});

    // A valid code replaces the rejected one.
    await discounts.apply('MELLOW10');

    await expect(discounts.chips).toHaveText('MELLOW10');
    await expect(
      discounts.panel.getByText(COPY.invalidDiscount('bogus')),
    ).toHaveCount(0);
  });

  test('gift cards are not supported by the development mock', async ({
    page,
  }) => {
    await openCartPage(page);
    const order = orderSummary(pageCart(page));
    const giftCards = promoPanel(order, 'Have a gift card?');
    await openPanel(giftCards);

    await giftCards
      .getByRole('textbox', {name: 'Gift card code'})
      .fill('GIFT-1234');
    await giftCards.getByRole('button', {name: 'Apply gift card code'}).click();

    await expect(giftCards.getByText(COPY.giftCardUnsupported)).toBeVisible();
    await expect(giftCards).toHaveAttribute('open', '');
    await expect(
      giftCards.getByRole('list', {name: 'Applied gift cards'}),
    ).toHaveCount(0);
    await expectTotals(order, {subtotal: '$49.99', total: '$49.99'});
  });
});

/* -------------------------------------------------------------------------- */
/* Checkout (development stand-in)                                             */
/* -------------------------------------------------------------------------- */

test.describe('checkout', () => {
  test('the Checkout link leads to the development checkout with the same lines and total', async ({
    page,
  }) => {
    await openCartPage(page, [{variant: standard, quantity: 2}], {
      discount: 'MELLOW10',
    });
    const origin = new URL(page.url()).origin;
    const checkout = orderSummary(pageCart(page)).getByRole('link', {
      name: 'Checkout',
    });
    await expect(checkout).toHaveAttribute(
      'href',
      new RegExp(
        `^${escapeRegExp(origin)}/dev/mock-checkout\\?cart=gid%3A%2F%2Fshopify%2FCart%2Fmock`,
      ),
    );

    await checkout.click();
    await expect(page).toHaveURL(/\/dev\/mock-checkout\?cart=/);
    await waitForHydration(page);

    await expectSingleH1(page, COPY.mockCheckoutH1);
    const lines = main(page).getByRole('list', {name: 'Cart lines'});
    await expect(lines.getByRole('listitem')).toHaveCount(1);
    await expect(lines).toContainText('CloudAlign Pillow – Standard × 2');
    await expect(lines).toContainText('$99.98');
    await expect(main(page).locator('p', {hasText: /^Total/})).toHaveText(
      'Total$89.98',
    );
  });

  test('"Back to cart" returns to the cart page', async ({page}) => {
    await seedCart(page, ONE_PILLOW);
    await gotoHydrated(page, '/dev/mock-checkout');

    await main(page).getByRole('link', {name: 'Back to cart'}).click();

    await expect(page).toHaveURL(/\/cart$/);
    await expectSingleH1(page, 'Your cart 1 item');
  });

  test('"Clear cart and keep shopping" empties the cart and opens Shop All', async ({
    page,
  }) => {
    await seedCart(page, THREE_PILLOWS);
    await gotoHydrated(page, '/dev/mock-checkout');
    await expect(cartLink(page, 3)).toBeVisible();
    await expect(
      main(page).getByRole('list', {name: 'Cart lines'}).getByRole('listitem'),
    ).toHaveCount(3);

    await main(page)
      .getByRole('button', {name: 'Clear cart and keep shopping'})
      .click();

    await expect(page).toHaveURL(/\/collections\/all$/);
    await expectSingleH1(page, 'Shop All');
    await expect(cartLink(page, 0)).toBeVisible();
  });
});

/* -------------------------------------------------------------------------- */
/* The cart drawer                                                             */
/* -------------------------------------------------------------------------- */

test.describe('cart drawer', {tag: '@mobile'}, () => {
  /** Seeds a cart, loads an unrelated page and opens the drawer from the header. */
  async function openDrawer(page: Page): Promise<Locator> {
    await seedCart(page, ONE_PILLOW);
    await gotoHydrated(page, '/collections/pillows');
    await cartLink(page, 1).click();
    const cart = drawer(page, 'Your Sleep Stack');
    await expect(cart).toBeVisible();
    return cart;
  }

  test('quantity and totals work inside "Your cart"', async ({page}) => {
    const cart = await openDrawer(page);
    const line = lineFor(cart, cloudAlign.title);
    await expect(quantityOf(line)).toHaveText('Quantity 1');

    await increaseOf(line).click();

    await expect(quantityOf(line)).toHaveText('Quantity 2');
    await expectTotals(orderSummary(cart), {
      subtotal: '$99.98',
      total: '$99.98',
    });
    await expect(cartLink(page, 2)).toBeVisible();

    await decreaseOf(line).click();

    await expect(quantityOf(line)).toHaveText('Quantity 1');
    await expect(cartLink(page, 1)).toBeVisible();
  });

  test('a discount code can be applied inside the drawer', async ({page}) => {
    const cart = await openDrawer(page);
    const order = orderSummary(cart);

    await discountPanel(order).apply('MELLOW10');

    await expect(discountPanel(order).chips).toHaveText('MELLOW10');
    await expectTotals(order, {
      subtotal: '$49.99',
      discount: {codes: 'MELLOW10', amount: COPY.discountRowMellow10},
      total: '$44.99',
    });
  });

  test('"Continue shopping" closes the drawer and stays on the page', async ({
    page,
  }) => {
    const cart = await openDrawer(page);

    await orderSummary(cart)
      .getByRole('button', {name: 'Continue shopping'})
      .click();

    await expect(cart).toBeHidden();
    await expect(page).toHaveURL(/\/collections\/pillows$/);
    await expectSingleH1(page, 'Pillows');
  });

  test('the product title opens the product and closes the drawer', async ({
    page,
  }) => {
    const cart = await openDrawer(page);

    await lineFor(cart, cloudAlign.title)
      .getByRole('link', {name: cloudAlign.title, exact: true})
      .click();

    await expect(page).toHaveURL(
      /\/products\/cloudalign-pillow\?Size=Standard$/,
    );
    await expectSingleH1(page, cloudAlign.title);
    await expect(cart).toBeHidden();
  });

  test('removing the last line shows the empty drawer with working links', async ({
    page,
  }) => {
    const cart = await openDrawer(page);

    await removeButton(cart, cloudAlign.title).click();

    const empty = cart.getByRole('heading', {name: 'Your cart is empty'});
    await expect(empty).toBeFocused();
    await expect(cartLink(page, 0)).toBeVisible();

    await cart.getByRole('link', {name: 'Shop best sellers'}).click();

    await expect(page).toHaveURL(/\/collections\/all$/);
    await expectSingleH1(page, 'Shop All');
    await expect(cart).toBeHidden();
  });

  test('"Continue shopping" in the empty drawer closes it', async ({page}) => {
    await gotoHydrated(page, '/collections/pillows');
    await cartLink(page, 0).click();
    const cart = drawer(page, 'Your Sleep Stack');
    await expect(
      cart.getByRole('heading', {name: 'Your cart is empty'}),
    ).toBeVisible();

    await cart.getByRole('button', {name: 'Continue shopping'}).click();

    await expect(cart).toBeHidden();
    await expect(page).toHaveURL(/\/collections\/pillows$/);
  });
});

/* -------------------------------------------------------------------------- */
/* Journey                                                                     */
/* -------------------------------------------------------------------------- */

test.describe('journey', () => {
  test(
    'add on the product page, adjust in the drawer, check out',
    {tag: '@mobile'},
    async ({page}) => {
      await gotoHydrated(page, productPath(cloudAlign));
      await page
        .getByRole('main')
        .getByRole('button', {name: 'Add to cart'})
        .click();
      const cart = drawer(page, 'Your Sleep Stack');
      const line = lineFor(cart, cloudAlign.title);
      await expect(line).toHaveCount(1);
      await expect(increaseOf(line)).toBeEnabled();

      await increaseOf(line).click();
      await expect(quantityOf(line)).toHaveText('Quantity 2');
      await expect(cartLink(page, 2)).toBeVisible();

      await orderSummary(cart).getByRole('link', {name: 'Checkout'}).click();
      await expect(page).toHaveURL(/\/dev\/mock-checkout\?cart=/);
      await waitForHydration(page);

      await expectSingleH1(page, COPY.mockCheckoutH1);
      await expect(
        main(page).getByRole('list', {name: 'Cart lines'}),
      ).toContainText('CloudAlign Pillow – Standard × 2');
      await expect(main(page).locator('p', {hasText: /^Total/})).toHaveText(
        'Total$99.98',
      );

      await main(page).getByRole('link', {name: 'Back to cart'}).click();

      await expect(page).toHaveURL(/\/cart$/);
      await expectSingleH1(page, 'Your cart 2 items');
      await expect(
        quantityOf(lineFor(pageCart(page), cloudAlign.title)),
      ).toHaveText('Quantity 2');
    },
  );
});
