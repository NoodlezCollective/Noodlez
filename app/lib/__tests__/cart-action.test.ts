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

describe('POST /cart with malformed input', () => {
  it('answers 400 (not 500) when the body is not a form', async () => {
    const cart = cartWith(async () => {
      throw new Error('must not be called');
    });
    const result = await (callRoute(cartAction, {
      request: new Request(`${ORIGIN}/cart`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: '{"action":',
      }),
      context: {cart},
    }) as Promise<{data: Record<string, unknown>; init: {status: number}}>);

    expect(result.init.status).toBe(400);
    expect(result.data).toMatchObject({cart: null, userErrors: []});
    expect(cart.addLines).not.toHaveBeenCalled();
  });

  it('answers 400 when lines is not an array', async () => {
    const cart = cartWith(async () => {
      throw new Error('must not be called');
    });
    const formData = new FormData();
    formData.set(
      'cartFormInput',
      JSON.stringify({action: 'LinesAdd', inputs: {lines: 'nope'}}),
    );
    const result = await (callRoute(cartAction, {
      request: new Request(`${ORIGIN}/cart`, {method: 'POST', body: formData}),
      context: {cart},
    }) as Promise<{data: Record<string, unknown>; init: {status: number}}>);

    expect(result.init.status).toBe(400);
    expect(cart.addLines).not.toHaveBeenCalled();
  });

  it('answers 400 for an unknown action', async () => {
    const cart = cartWith(async () => {
      throw new Error('must not be called');
    });
    const formData = new FormData();
    formData.set('cartFormInput', JSON.stringify({action: 'Nope', inputs: {}}));
    const result = await (callRoute(cartAction, {
      request: new Request(`${ORIGIN}/cart`, {method: 'POST', body: formData}),
      context: {cart},
    }) as Promise<{data: Record<string, unknown>; init: {status: number}}>);

    expect(result.init.status).toBe(400);
  });
});

/** What the cart service answers after a successful line change. */
const LINE_CHANGE_RESULT = {
  cart: {id: 'gid://shopify/Cart/c1?key=k'},
  userErrors: [],
  errors: undefined,
  warnings: [],
};

/**
 * A cart whose line methods succeed, so a test can see whether the action
 * reached them: an invalid request must stop before the cart service.
 */
function createLineCart() {
  return {
    ...createFakeCart(),
    addLines: vi.fn(async (..._args: unknown[]) => LINE_CHANGE_RESULT),
    updateLines: vi.fn(async (..._args: unknown[]) => LINE_CHANGE_RESULT),
    removeLines: vi.fn(async (..._args: unknown[]) => LINE_CHANGE_RESULT),
  };
}

/** Posts `{action, inputs}` as the JSON of the cartFormInput field. */
function postCartInput(
  cart: ReturnType<typeof createLineCart>,
  cartFormInput: unknown,
) {
  const formData = new FormData();
  formData.set('cartFormInput', JSON.stringify(cartFormInput));
  return callRoute(cartAction, {
    request: new Request(`${ORIGIN}/cart`, {method: 'POST', body: formData}),
    context: {cart},
  }) as Promise<{data: Record<string, unknown>; init: {status: number}}>;
}

describe('POST /cart with hand-crafted line inputs', () => {
  // The body is attacker-controlled: every shape the cart UI cannot produce is
  // a 400 before the cart service, never a TypeError (a 500) inside it.
  it.each([
    ['LinesUpdate', 'lines of bare id strings', {lines: ['gid://x']}],
    ['LinesUpdate', 'a null line', {lines: [null]}],
    ['LinesUpdate', 'a line without an id', {lines: [{}]}],
    ['LinesUpdate', 'a line with a numeric id', {lines: [{id: 5}]}],
    ['LinesUpdate', 'a line with a null id', {lines: [{id: null}]}],
    [
      'LinesUpdate',
      'a null line after a valid one',
      {lines: [{id: 'gid://x', quantity: 1}, null]},
    ],
    ['LinesUpdate', 'a line that is an array', {lines: [['gid://x']]}],
    ['LinesUpdate', 'lines that are an object', {lines: {id: 'gid://x'}}],
    ['LinesUpdate', 'no lines at all', {}],
    ['LinesRemove', 'line ids that are objects', {lineIds: [{id: 'gid://x'}]}],
    ['LinesRemove', 'a numeric line id', {lineIds: [5]}],
    ['LinesRemove', 'a null line id', {lineIds: [null]}],
    [
      'LinesRemove',
      'a numeric line id after a valid one',
      {lineIds: ['gid://x', 5]},
    ],
    ['LinesRemove', 'a line id that is an array', {lineIds: [['gid://x']]}],
    ['LinesRemove', 'one line id that is not a list', {lineIds: 'gid://x'}],
    ['LinesRemove', 'no line ids at all', {}],
    ['LinesAdd', 'a null line', {lines: [null]}],
    ['LinesAdd', 'lines of bare strings', {lines: ['gid://x']}],
    ['LinesAdd', 'a line without a merchandise id', {lines: [{quantity: 1}]}],
    [
      'LinesAdd',
      'a numeric merchandise id',
      {lines: [{merchandiseId: 5, quantity: 1}]},
    ],
    [
      'LinesAdd',
      'a null line after a valid one',
      {lines: [{merchandiseId: 'gid://x', quantity: 1}, null]},
    ],
    ['LinesAdd', 'a line that is an array', {lines: [['gid://x']]}],
    ['LinesAdd', 'no lines at all', {}],
  ])(
    'answers 400 for %s with %s, without reaching the cart',
    async (action, _label, inputs) => {
      // Arrange
      const cart = createLineCart();

      // Act
      const result = await postCartInput(cart, {action, inputs});

      // Assert
      expect(result.init.status).toBe(400);
      expect(result.data).toMatchObject({
        cart: null,
        userErrors: [],
        errors: [{message: expect.stringMatching(/refresh the page/i)}],
      });
      expect(cart.addLines).not.toHaveBeenCalled();
      expect(cart.updateLines).not.toHaveBeenCalled();
      expect(cart.removeLines).not.toHaveBeenCalled();
    },
  );

  it('answers 400 when a repeated lineIds field carries an uploaded file', async () => {
    const cart = createLineCart();
    const formData = new FormData();
    formData.set('cartFormInput', JSON.stringify({action: 'LinesRemove'}));
    formData.append('lineIds', 'gid://shopify/CartLine/l1');
    formData.append('lineIds', new File(['x'], 'x.txt'));

    const result = (await callRoute(cartAction, {
      request: new Request(`${ORIGIN}/cart`, {method: 'POST', body: formData}),
      context: {cart},
    })) as {init: {status: number}};

    expect(result.init.status).toBe(400);
    expect(cart.removeLines).not.toHaveBeenCalled();
  });

  describe('valid line changes', () => {
    const LINE_IDS = ['gid://shopify/CartLine/l1', 'gid://shopify/CartLine/l2'];

    it('removes lines by their string ids', async () => {
      const cart = createLineCart();

      const result = await postCartInput(cart, {
        action: 'LinesRemove',
        inputs: {lineIds: LINE_IDS},
      });

      expect(result.init.status).toBe(200);
      expect(cart.removeLines).toHaveBeenCalledWith(LINE_IDS);
    });

    it('removes lines named by a repeated lineIds form field', async () => {
      const cart = createLineCart();
      const formData = new FormData();
      formData.set('cartFormInput', JSON.stringify({action: 'LinesRemove'}));
      for (const lineId of LINE_IDS) formData.append('lineIds', lineId);

      const result = (await callRoute(cartAction, {
        request: new Request(`${ORIGIN}/cart`, {
          method: 'POST',
          body: formData,
        }),
        context: {cart},
      })) as {init: {status: number}};

      expect(result.init.status).toBe(200);
      expect(cart.removeLines).toHaveBeenCalledWith(LINE_IDS);
    });

    it('updates lines that carry a string id', async () => {
      const cart = createLineCart();
      const lines = [
        {id: LINE_IDS[0], quantity: 2},
        {id: LINE_IDS[1], quantity: 0},
      ];

      const result = await postCartInput(cart, {
        action: 'LinesUpdate',
        inputs: {lines},
      });

      expect(result.init.status).toBe(200);
      expect(cart.updateLines).toHaveBeenCalledWith(lines);
    });

    it('adds lines that carry a string merchandise id, whatever else they hold', async () => {
      const cart = createLineCart();
      const lines = [
        {
          merchandiseId: 'gid://shopify/ProductVariant/1',
          quantity: 2,
          attributes: [{key: 'gift', value: 'yes'}],
          selectedVariant: {id: 'gid://shopify/ProductVariant/1'},
        },
        {merchandiseId: 'gid://shopify/ProductVariant/2'},
      ];

      const result = await postCartInput(cart, {
        action: 'LinesAdd',
        inputs: {lines},
      });

      expect(result.init.status).toBe(200);
      expect(cart.addLines).toHaveBeenCalledWith(lines);
    });

    it.each([
      ['LinesAdd', {lines: []}, 'addLines'],
      ['LinesUpdate', {lines: []}, 'updateLines'],
      ['LinesRemove', {lineIds: []}, 'removeLines'],
    ] as const)(
      'still forwards an empty list for %s, as before',
      async (action, inputs, method) => {
        const cart = createLineCart();

        const result = await postCartInput(cart, {action, inputs});

        expect(result.init.status).toBe(200);
        expect(cart[method]).toHaveBeenCalledWith([]);
      },
    );

    it.each([
      [
        'LinesRemove',
        {lineIds: ['__h_pending_gid://shopify/ProductVariant/1']},
      ],
      [
        'LinesUpdate',
        {
          lines: [
            {id: '__h_pending_gid://shopify/ProductVariant/1', quantity: 2},
          ],
        },
      ],
    ] as const)(
      'rejects a pending optimistic line id in %s with 400 before the cart service',
      async (action, inputs) => {
        const cart = createLineCart();

        const result = await postCartInput(cart, {action, inputs});

        expect(result.init.status).toBe(400);
        expect(cart.removeLines).not.toHaveBeenCalled();
        expect(cart.updateLines).not.toHaveBeenCalled();
      },
    );
  });
});

describe('POST /cart body size', () => {
  it('refuses a body larger than 64 KiB with 413 before reading it', async () => {
    const cart = createLineCart();
    const body = `cartFormInput=${encodeURIComponent(
      JSON.stringify({action: 'LinesRemove', inputs: {lineIds: []}}),
    )}&pad=${'x'.repeat(64 * 1024)}`;

    const result = (await callRoute(cartAction, {
      request: new Request(`${ORIGIN}/cart`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': String(body.length),
        },
        body,
      }),
      context: {cart},
    })) as {data: Record<string, unknown>; init: {status: number}};

    expect(result.init.status).toBe(413);
    expect(result.data).toMatchObject({
      cart: null,
      errors: [{message: 'That request was too large.'}],
    });
    expect(cart.removeLines).not.toHaveBeenCalled();
  });

  it('accepts a body at the limit', async () => {
    const cart = createLineCart();
    const prefix = `cartFormInput=${encodeURIComponent(
      JSON.stringify({action: 'LinesRemove', inputs: {lineIds: []}}),
    )}&pad=`;
    const body = `${prefix}${'x'.repeat(64 * 1024 - prefix.length)}`;

    const result = (await callRoute(cartAction, {
      request: new Request(`${ORIGIN}/cart`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': String(body.length),
        },
        body,
      }),
      context: {cart},
    })) as {init: {status: number}};

    expect(result.init.status).toBe(200);
    expect(cart.removeLines).toHaveBeenCalledWith([]);
  });
});
