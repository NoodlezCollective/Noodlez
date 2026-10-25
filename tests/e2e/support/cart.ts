/**
 * Cart seeding.
 *
 * `seedCart` puts lines into the browser context's cart without clicking
 * through the UI, the way a cart permalink does:
 *
 *   await seedCart(page, 'cloudalign-pillow-1:1');
 *   await seedCart(page, [{variant: PRODUCTS.pebble.variants[0], quantity: 2}]);
 *   await seedCart(page, 'cloudalign-pillow-1:1', {discount: 'MELLOW10'});
 *   await gotoHydrated(page, '/cart');
 *
 * How it works: `GET /cart/<variantId>:<qty>[,...]` answers 302 to
 * /dev/mock-checkout and sets the `cart` cookie. `page.request` shares the
 * browser context's cookie jar, so the next page load sees the cart. The
 * cookie is HttpOnly: page scripts cannot read it, so do not look for it with
 * `document.cookie` (use `context.cookies()`).
 *
 * Call it before the navigation that should show the cart; for an open page,
 * reload afterwards. Carts live in the dev server's memory keyed by that
 * cookie, so parallel tests never share state; restarting the dev server
 * drops them.
 *
 * Calling seedCart twice creates a second cart and replaces the cookie; to
 * add lines to an existing cart use the UI or POST /cart.
 */
import {expect, type Page} from '@playwright/test';
import type {VariantFixture} from './catalog';

export interface SeedLine {
  /** A catalog variant, or its mock id ("cloudalign-pillow-1"). */
  variant: Pick<VariantFixture, 'id'> | string;
  /** Defaults to 1. */
  quantity?: number;
}

export interface SeedCartOptions {
  /** Discount code applied at creation, e.g. "MELLOW10". */
  discount?: string;
}

function permalinkLines(lines: string | readonly SeedLine[]): string {
  if (typeof lines === 'string') return lines;
  return lines
    .map(({variant, quantity = 1}) => {
      const id = typeof variant === 'string' ? variant : variant.id;
      return `${id}:${quantity}`;
    })
    .join(',');
}

/** Creates a cart with `lines` for `page`'s browser context. */
export async function seedCart(
  page: Page,
  lines: string | readonly SeedLine[],
  options: SeedCartOptions = {},
): Promise<void> {
  const spec = permalinkLines(lines);
  const query = options.discount
    ? `?discount=${encodeURIComponent(options.discount)}`
    : '';
  const response = await page.request.get(`/cart/${spec}${query}`, {
    maxRedirects: 0,
  });
  expect(response.status(), `seeding a cart with "${spec}"`).toBe(302);
  expect(response.headers()['location'] ?? '').toContain('/dev/mock-checkout');
}
