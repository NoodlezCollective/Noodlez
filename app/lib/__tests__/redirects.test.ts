import {describe, expect, it} from 'vitest';
import {action as cartAction} from '../../routes/cart';
import {loader as discountLoader} from '../../routes/discount.$code';
import {ORIGIN, callRoute, createFakeCart} from './route-test-utils';

/** Inputs that try to leave the storefront or look like a protocol-relative URL. */
const HOSTILE_TARGETS = [
  '//evil.example',
  '///evil.example',
  '/\\evil.example/phish',
  '\\\\evil.example',
  'https://evil.example/phish',
  'http:evil.example',
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  '/\t/evil.example',
  // These normalise to the same-origin pathname `//evil.example`, which a
  // browser would read as a protocol-relative URL.
  '/.//evil.example',
  '/..//evil.example',
  '/a/..//evil.example',
  '/%2e//evil.example',
  '/./\\evil.example',
] as const;

/** A Location is safe when it is a plain path that resolves to the storefront. */
function expectSameOriginPath(location: string | null) {
  expect(location).not.toBeNull();
  expect(location).toMatch(/^\/(?![/\\])/);
  expect(new URL(location!, ORIGIN).origin).toBe(ORIGIN);
}

async function discountRedirect(search: string, cart = createFakeCart()) {
  const response = (await callRoute(discountLoader, {
    request: new Request(`${ORIGIN}/discount/SAVE10${search}`),
    context: {cart},
    params: {code: 'SAVE10'},
  })) as Response;
  return {response, cart, location: response.headers.get('Location')};
}

describe('discount/:code redirect', () => {
  it('defaults to the home page', async () => {
    const {location, response} = await discountRedirect('');
    expect(response.status).toBe(303);
    expect(location).toBe('/');
  });

  it.each([
    ['?redirect=/products', '/products'],
    ['?redirect=%2Fproducts%3Fcolor%3Dblue', '/products?color=blue'],
    ['?return_to=/pages/about', '/pages/about'],
    ['?redirect=/products&return_to=/cart', '/products'],
    [`?redirect=${encodeURIComponent(`${ORIGIN}/cart`)}`, '/cart'],
  ])('follows the same-origin target in %s', async (search, expected) => {
    const {location} = await discountRedirect(search);
    expect(location).toBe(expected);
  });

  it('carries the other query parameters over to the target', async () => {
    const {location} = await discountRedirect(
      '?redirect=/products&utm_source=mail&utm_medium=email',
    );
    expect(location).toBe('/products?utm_source=mail&utm_medium=email');
  });

  it.each(HOSTILE_TARGETS)('sends %j to the home page', async (target) => {
    const {location} = await discountRedirect(
      `?redirect=${encodeURIComponent(target)}`,
    );
    expect(location).toBe('/');
    expectSameOriginPath(location);
  });

  it.each(HOSTILE_TARGETS)(
    'sends return_to=%j to the home page, keeping tracking parameters',
    async (target) => {
      const {location} = await discountRedirect(
        `?return_to=${encodeURIComponent(target)}&utm_source=mail`,
      );
      expect(location).toBe('/?utm_source=mail');
      expectSameOriginPath(location);
    },
  );

  it('applies the discount code and stores the cart id', async () => {
    const {cart, response} = await discountRedirect('?redirect=/cart');
    expect(cart.updateDiscountCodes).toHaveBeenCalledWith(['SAVE10']);
    expect(cart.setCartId).toHaveBeenCalledWith('gid://shopify/Cart/c1?key=k');
    expect(response.headers.get('Set-Cookie')).toContain('cart=c1');
  });

  it('still redirects, without a cart cookie, when the API returns no cart', async () => {
    const cart = createFakeCart(null);
    const {response, location} = await discountRedirect(
      '?redirect=/cart',
      cart,
    );
    expect(response.status).toBe(303);
    expect(location).toBe('/cart');
    expect(cart.setCartId).not.toHaveBeenCalled();
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });
});

async function cartFormRedirect(redirectTo: string | null) {
  const formData = new FormData();
  formData.set(
    'cartFormInput',
    JSON.stringify({
      action: 'DiscountCodesUpdate',
      inputs: {discountCodes: []},
    }),
  );
  if (redirectTo !== null) formData.set('redirectTo', redirectTo);

  const cart = createFakeCart();
  const request = new Request(`${ORIGIN}/cart`, {
    method: 'POST',
    body: formData,
  });
  const result = (await callRoute(cartAction, {
    request,
    context: {cart},
  })) as {init: ResponseInit};
  const headers = result.init.headers as Headers;
  return {status: result.init.status, location: headers.get('Location')};
}

describe('POST /cart redirectTo', () => {
  it('follows a same-origin path with a 303', async () => {
    // The mock checkout page posts redirectTo=/collections/all.
    expect(await cartFormRedirect('/collections/all')).toEqual({
      status: 303,
      location: '/collections/all',
    });
  });

  it('keeps the query string of a same-origin target', async () => {
    const {location} = await cartFormRedirect('/cart?discount=SAVE10');
    expect(location).toBe('/cart?discount=SAVE10');
  });

  it.each(HOSTILE_TARGETS)('sends %j to the home page', async (target) => {
    const {status, location} = await cartFormRedirect(target);
    expect(status).toBe(303);
    expect(location).toBe('/');
    expectSameOriginPath(location);
  });

  it.each([null, ''])('does not redirect for redirectTo=%j', async (value) => {
    const {status, location} = await cartFormRedirect(value);
    expect(status).toBe(200);
    expect(location).toBeNull();
  });
});
