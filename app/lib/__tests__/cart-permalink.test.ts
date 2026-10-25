import {describe, expect, it} from 'vitest';
import {loader} from '../../routes/cart.$lines';
import {
  ORIGIN,
  callRoute,
  createFakeCart,
  thrownResponse,
} from './route-test-utils';

type TestEnv = {MOCK_STOREFRONT?: string};
const LIVE_ENV: TestEnv = {};
const MOCK_ENV: TestEnv = {MOCK_STOREFRONT: 'true'};

function permalink(
  lines: string,
  {
    env = LIVE_ENV,
    search = '',
    cart = createFakeCart(),
  }: {
    env?: TestEnv;
    search?: string;
    cart?: ReturnType<typeof createFakeCart>;
  } = {},
) {
  const promise = callRoute(loader, {
    request: new Request(
      `${ORIGIN}/cart/${encodeURIComponent(lines)}${search}`,
    ),
    context: {cart, env},
    params: {lines},
  });
  return {promise, cart};
}

describe('cart/:lines permalink', () => {
  it('creates a cart from numeric variant ids and redirects to checkout', async () => {
    // Arrange
    const {promise, cart} = permalink('41007289663544:1,41007289696312:2');

    // Act
    const response = (await promise) as Response;

    // Assert
    expect(cart.create).toHaveBeenCalledWith({
      lines: [
        {
          merchandiseId: 'gid://shopify/ProductVariant/41007289663544',
          quantity: 1,
        },
        {
          merchandiseId: 'gid://shopify/ProductVariant/41007289696312',
          quantity: 2,
        },
      ],
      discountCodes: [],
    });
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(`${ORIGIN}/checkout/c1`);
    expect(response.headers.get('Set-Cookie')).toContain('cart=c1');
  });

  it('passes the discount query parameter on', async () => {
    const {promise, cart} = permalink('41007289663544:1', {
      search: '?discount=HYDRO',
    });
    await promise;
    expect(cart.create).toHaveBeenCalledWith(
      expect.objectContaining({discountCodes: ['HYDRO']}),
    );
  });

  it.each([
    'abc:xyz',
    '123:abc',
    '123:0',
    '123:-1',
    '123:1.5',
    '123:1e3',
    '123:10000',
    '123',
    '123:',
    ':1',
    '123:1:2',
    '123:1,',
    ',123:1',
    '12 3:1',
    'abc:1',
    'cloudalign-pillow-1:1',
    '1'.repeat(21) + ':1',
    '123:NaN',
    '<script>:1',
    '../../etc:1',
    Array.from({length: 51}, () => '123:1').join(','),
  ])('answers 410 without calling the API for %j', async (lines) => {
    const {promise, cart} = permalink(lines);

    const response = await thrownResponse(promise);

    expect(response.status).toBe(410);
    expect(await response.text()).toBe(
      'Link may be expired. Try checking the URL.',
    );
    expect(cart.create).not.toHaveBeenCalled();
  });

  it('allows up to 50 lines', async () => {
    const {promise, cart} = permalink(
      Array.from({length: 50}, () => '123:1').join(','),
    );
    await promise;
    expect(cart.create).toHaveBeenCalledTimes(1);
  });

  it('accepts the development mock slugs only while the mock is active', async () => {
    const mock = permalink('cloudalign-pillow-1:1', {env: MOCK_ENV});
    await mock.promise;
    expect(mock.cart.create).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          {
            merchandiseId: 'gid://shopify/ProductVariant/cloudalign-pillow-1',
            quantity: 1,
          },
        ],
      }),
    );

    const live = permalink('cloudalign-pillow-1:1', {env: LIVE_ENV});
    expect((await thrownResponse(live.promise)).status).toBe(410);
  });

  it('still rejects malformed lines in mock mode', async () => {
    const {promise, cart} = permalink('abc:xyz', {env: MOCK_ENV});
    expect((await thrownResponse(promise)).status).toBe(410);
    expect(cart.create).not.toHaveBeenCalled();
  });

  it('answers 410 when the API does not return a cart', async () => {
    const {promise} = permalink('123:1', {cart: createFakeCart(null)});
    expect((await thrownResponse(promise)).status).toBe(410);
  });

  it('answers 410 when the API reports errors next to partial data', async () => {
    const cart = createFakeCart();
    cart.create.mockResolvedValueOnce({
      cart: {id: 'gid://shopify/Cart/c1', checkoutUrl: `${ORIGIN}/checkout`},
      errors: [{message: 'Something partial'}],
    } as never);
    const {promise} = permalink('123:1', {cart});
    expect((await thrownResponse(promise)).status).toBe(410);
  });

  it('redirects to the cart page when there are no lines', async () => {
    const response = (await callRoute(loader, {
      request: new Request(`${ORIGIN}/cart/`),
      context: {cart: createFakeCart(), env: LIVE_ENV},
      params: {},
    })) as Response;
    expect(response.headers.get('Location')).toBe('/cart');
  });
});
