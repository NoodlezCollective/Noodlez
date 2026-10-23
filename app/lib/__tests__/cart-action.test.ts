import {describe, expect, it, vi} from 'vitest';
import {action as cartAction} from '../../routes/cart';
import {STOREFRONT_API_ERROR_STATUS} from '../storefront-errors';
import {ORIGIN, callRoute, createFakeCart} from './route-test-utils';

/** Submits a LinesAdd the way <AddToCartButton> does. */
function addToCart(
  cart: ReturnType<typeof createFakeCart> & Record<string, unknown>,
) {
  const formData = new FormData();
  formData.set(
    'cartFormInput',
    JSON.stringify({
      action: 'LinesAdd',
      inputs: {
        lines: [{merchandiseId: 'gid://shopify/ProductVariant/1', quantity: 1}],
      },
    }),
  );
  return callRoute(cartAction, {
    request: new Request(`${ORIGIN}/cart`, {method: 'POST', body: formData}),
    context: {cart},
  }) as Promise<{data: Record<string, unknown>; init: {status: number}}>;
}

function cartWith(addLines: (...args: unknown[]) => Promise<unknown>) {
  return {...createFakeCart(), addLines: vi.fn(addLines)};
}

describe('POST /cart when the Storefront API fails', () => {
  it('reports a guarded 502 to the cart UI as inline errors, not a full-page error', async () => {
    // app/lib/storefront-errors.ts rejects with this when the API answers `{errors}`.
    const cart = cartWith(async () => {
      throw new Response('Storefront API error', {
        status: STOREFRONT_API_ERROR_STATUS,
      });
    });

    const result = await addToCart(cart);

    expect(result.init.status).toBe(502);
    expect(result.data).toMatchObject({
      cart: null,
      userErrors: [],
      errors: [{message: expect.stringMatching(/try again/i)}],
    });
  });

  it('does not leak the raw API messages to the browser', async () => {
    const cart = cartWith(async () => {
      throw new Response('Storefront API error', {
        status: STOREFRONT_API_ERROR_STATUS,
      });
    });

    const result = await addToCart(cart);

    expect(JSON.stringify(result.data)).not.toMatch(
      /Storefront API error|Variable|Throttled/,
    );
  });

  it('still lets other thrown responses through (e.g. a redirect)', async () => {
    const redirect = new Response(null, {
      status: 302,
      headers: {Location: '/x'},
    });
    const cart = cartWith(async () => {
      throw redirect;
    });

    await expect(addToCart(cart)).rejects.toBe(redirect);
  });

  it('still lets other errors through', async () => {
    const failure = new Error('network down');
    const cart = cartWith(async () => {
      throw failure;
    });

    await expect(addToCart(cart)).rejects.toBe(failure);
  });

  it('passes successful results and API userErrors through unchanged', async () => {
    const userErrors = [{message: 'Only 1 left in stock'}];
    const cart = cartWith(async () => ({
      cart: {id: 'gid://shopify/Cart/c1?key=k'},
      userErrors,
      errors: undefined,
      warnings: [],
    }));

    const result = await addToCart(cart);

    expect(result.init.status).toBe(200);
    expect(result.data).toMatchObject({
      userErrors,
      cart: {id: 'gid://shopify/Cart/c1?key=k'},
    });
  });
});
