import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CART_FORM_INPUT_NAME} from './form-input';
import {
  OPTIMISTIC_LINE_ID_PREFIX,
  applyOptimisticCartActions,
  isOptimisticLineId,
} from './optimistic';

type Merchandise = {id: string; title: string};
type Line = {
  id: string;
  quantity: number;
  merchandise: Merchandise;
  isOptimistic?: boolean;
};
type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  lines: {nodes: Line[]};
};

const VARIANT_A: Merchandise = {
  id: 'gid://shopify/ProductVariant/1',
  title: 'A',
};
const VARIANT_B: Merchandise = {
  id: 'gid://shopify/ProductVariant/2',
  title: 'B',
};
const VARIANT_C: Merchandise = {
  id: 'gid://shopify/ProductVariant/3',
  title: 'C',
};

const LINE_A = 'gid://shopify/CartLine/a';
const LINE_B = 'gid://shopify/CartLine/b';

function lineOf(id: string, merchandise: Merchandise, quantity: number): Line {
  return {id, quantity, merchandise};
}

/** A cart with two lines: 2 x A and 3 x B (5 items). */
function sampleCart(): Cart {
  return {
    id: 'gid://shopify/Cart/c1',
    checkoutUrl: 'https://shop.example/checkout/c1',
    totalQuantity: 5,
    lines: {
      nodes: [lineOf(LINE_A, VARIANT_A, 2), lineOf(LINE_B, VARIANT_B, 3)],
    },
  };
}

type Fetcher = {formData?: FormData | null};

/** A fetcher that is submitting a cart form, as `<CartForm>` builds it. */
function cartFetcher(action: string, inputs: unknown): Fetcher {
  const formData = new FormData();
  formData.set(CART_FORM_INPUT_NAME, JSON.stringify({action, inputs}));
  return {formData};
}

function addFetcher(...lines: unknown[]): Fetcher {
  return cartFetcher('LinesAdd', {lines});
}

function addInput(variant: Merchandise, quantity?: number) {
  return {merchandiseId: variant.id, quantity, selectedVariant: variant};
}

function removeFetcher(...lineIds: unknown[]): Fetcher {
  return cartFetcher('LinesRemove', {lineIds});
}

function updateFetcher(...lines: unknown[]): Fetcher {
  return cartFetcher('LinesUpdate', {lines});
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** The shape tests read the result in, whatever `T` the cart had. */
type Result = Cart & {isOptimistic?: boolean};

function apply(cart: Cart | null | undefined, ...fetchers: Fetcher[]): Result {
  return applyOptimisticCartActions(cart, fetchers) as unknown as Result;
}

let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OPTIMISTIC_LINE_ID_PREFIX and isOptimisticLineId', () => {
  it('uses the prefix Hydrogen used for lines that are not in the cart yet', () => {
    expect(OPTIMISTIC_LINE_ID_PREFIX).toBe('__h_pending_');
  });

  it.each([
    [`${OPTIMISTIC_LINE_ID_PREFIX}gid://shopify/ProductVariant/1`, true],
    [OPTIMISTIC_LINE_ID_PREFIX, true],
    ['gid://shopify/CartLine/a?cart=c1', false],
    ['', false],
    ['x__h_pending_y', false],
    ['__H_PENDING_x', false],
    ['__h_pending', false],
  ])('answers %j with %s', (id, expected) => {
    expect(isOptimisticLineId(id)).toBe(expected);
  });

  it.each([[undefined], [null], [42], [{}]])(
    'answers false for a value that is not a string (%j)',
    (value) => {
      expect(isOptimisticLineId(value as never)).toBe(false);
    },
  );
});

describe('applyOptimisticCartActions when nothing is pending', () => {
  it('returns the very same cart when there are no fetchers', () => {
    const cart = sampleCart();

    expect(apply(cart)).toBe(cart);
  });

  it.each([[null], [undefined]])(
    'returns %s itself when there are no fetchers',
    (cart) => {
      expect(applyOptimisticCartActions(cart, [])).toBe(cart);
    },
  );

  it('returns the cart when the fetchers argument is missing', () => {
    const cart = sampleCart();

    expect(applyOptimisticCartActions(cart, undefined as never)).toBe(cart);
  });

  it('ignores idle fetchers, which have no form data', () => {
    const cart = sampleCart();

    const result = apply(cart, {formData: undefined}, {formData: null}, {});

    expect(result).toBe(cart);
  });

  it('ignores fetchers that are not cart forms', () => {
    const cart = sampleCart();
    const search = new FormData();
    search.set('q', 'pillow');
    const newsletter = new FormData();
    newsletter.set('email', 'a@example.com');
    newsletter.set('subscribe', 'on');

    const result = apply(cart, {formData: search}, {formData: newsletter});

    expect(result).toBe(cart);
  });

  it('ignores a fetcher whose cart input is not valid JSON, without throwing', () => {
    const cart = sampleCart();
    const broken = new FormData();
    broken.set(CART_FORM_INPUT_NAME, '{"action":');

    expect(apply(cart, {formData: broken})).toBe(cart);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['DiscountCodesUpdate', {discountCodes: ['SAVE10']}],
    ['GiftCardCodesAdd', {giftCardCodes: ['ABCD']}],
    ['BuyerIdentityUpdate', {buyerIdentity: {email: 'a@example.com'}}],
    ['NoteUpdate', {note: 'hi'}],
    ['SomethingNew', {}],
    ['constructor', {}],
    ['toString', {}],
  ])(
    'ignores the %s action, which does not change the lines',
    (action, inputs) => {
      const cart = sampleCart();

      const result = apply(cart, cartFetcher(action, inputs));

      expect(result).toBe(cart);
    },
  );

  it.each([
    'Create',
    'NoteUpdate',
    'GiftCardCodesRemove',
    'lineSadd',
    'linesadd',
  ])(
    'does not mistake the %s action for a lines action because of its inputs',
    (action) => {
      const cart = sampleCart();
      const inputs = {
        lines: [addInput(VARIANT_C, 2), {id: LINE_A, quantity: 0}],
        lineIds: [LINE_A],
      };

      const result = apply(cart, cartFetcher(action, inputs));

      expect(result).toBe(cart);
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    },
  );

  it('applies nothing for a null cart when only unrelated forms are pending', () => {
    expect(apply(null, cartFetcher('DiscountCodesUpdate', {}))).toBeNull();
  });
});

describe('applyOptimisticCartActions with LinesAdd', () => {
  it('puts a new line first, with a prefixed id and the selected variant', () => {
    const cart = sampleCart();

    const result = apply(cart, addFetcher(addInput(VARIANT_C, 2)));

    expect(result.lines.nodes).toHaveLength(3);
    expect(result.lines.nodes[0]).toEqual({
      id: `${OPTIMISTIC_LINE_ID_PREFIX}${VARIANT_C.id}`,
      merchandise: VARIANT_C,
      isOptimistic: true,
      quantity: 2,
    });
    expect(result.lines.nodes.slice(1)).toEqual(cart.lines.nodes);
  });

  it('marks the cart and recomputes the total quantity', () => {
    const result = apply(sampleCart(), addFetcher(addInput(VARIANT_C, 2)));

    expect(result.isOptimistic).toBe(true);
    expect(result.totalQuantity).toBe(7);
  });

  it('keeps the other properties of the cart', () => {
    const cart = sampleCart();

    const result = apply(cart, addFetcher(addInput(VARIANT_C, 1)));

    expect(result.id).toBe(cart.id);
    expect(result.checkoutUrl).toBe(cart.checkoutUrl);
  });

  it.each([[undefined], [0], [-3], [2.5], [null], ['2']])(
    'adds one when the quantity is %j',
    (quantity) => {
      const result = apply(
        sampleCart(),
        addFetcher({
          merchandiseId: VARIANT_C.id,
          quantity,
          selectedVariant: VARIANT_C,
        }),
      );

      expect(result.lines.nodes[0].quantity).toBe(1);
      expect(result.totalQuantity).toBe(6);
    },
  );

  it('adds to the quantity of an existing line for the same variant', () => {
    const cart = sampleCart();

    const result = apply(cart, addFetcher(addInput(VARIANT_A, 3)));

    expect(result.lines.nodes).toHaveLength(2);
    expect(result.lines.nodes[0]).toEqual({
      ...cart.lines.nodes[0],
      quantity: 5,
      isOptimistic: true,
    });
    expect(result.lines.nodes[1]).toEqual(cart.lines.nodes[1]);
    expect(result.totalQuantity).toBe(8);
    expect(result.isOptimistic).toBe(true);
  });

  it('does not add a second line when the variant is already in the cart', () => {
    const result = apply(sampleCart(), addFetcher(addInput(VARIANT_B)));

    expect(result.lines.nodes.map((line) => line.id)).toEqual([LINE_A, LINE_B]);
    expect(result.lines.nodes[1].quantity).toBe(4);
  });

  it('merges a second pending add of the same new variant into one line', () => {
    const result = apply(
      sampleCart(),
      addFetcher(addInput(VARIANT_C, 1)),
      addFetcher(addInput(VARIANT_C, 2)),
    );

    const optimistic = result.lines.nodes.filter((line) => line.isOptimistic);
    expect(optimistic).toHaveLength(1);
    expect(optimistic[0].quantity).toBe(3);
    expect(result.totalQuantity).toBe(8);
  });

  it('puts the lines of one action first in turn, so the last one ends up on top', () => {
    const result = apply(
      sampleCart(),
      addFetcher(addInput(VARIANT_C, 1), {
        merchandiseId: 'gid://shopify/ProductVariant/4',
        quantity: 1,
        selectedVariant: {id: 'gid://shopify/ProductVariant/4', title: 'D'},
      }),
    );

    expect(result.lines.nodes.map((line) => line.merchandise.title)).toEqual([
      'D',
      'C',
      'A',
      'B',
    ]);
  });

  it('builds the id from the variant id even when it has special characters', () => {
    const variant = {
      id: 'gid://shopify/ProductVariant/9?a=1&b=é🎉',
      title: 'X',
    };

    const result = apply(sampleCart(), addFetcher(addInput(variant)));

    expect(result.lines.nodes[0].id).toBe(
      `${OPTIMISTIC_LINE_ID_PREFIX}${variant.id}`,
    );
  });

  it('logs an error and skips an input without a selected variant', () => {
    const cart = sampleCart();

    const result = apply(
      cart,
      addFetcher({merchandiseId: VARIANT_C.id, quantity: 1}),
    );

    expect(result).toBe(cart);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\[useOptimisticCart\].*selected variant/),
    );
  });

  it.each([
    ['a selected variant without an id', {title: 'No id'}],
    ['a selected variant with a numeric id', {id: 7}],
    ['a selected variant that is a string', 'gid://shopify/ProductVariant/3'],
    ['a null selected variant', null],
  ])('treats %s like a missing selected variant', (_label, selectedVariant) => {
    const cart = sampleCart();

    const result = apply(
      cart,
      addFetcher({merchandiseId: VARIANT_C.id, quantity: 1, selectedVariant}),
    );

    expect(result).toBe(cart);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('still applies the valid inputs of an action that also has an invalid one', () => {
    const result = apply(
      sampleCart(),
      addFetcher({merchandiseId: 'x'}, addInput(VARIANT_C, 2)),
    );

    expect(result.lines.nodes[0].merchandise).toEqual(VARIANT_C);
    expect(result.totalQuantity).toBe(7);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it.each([['nope'], [{}], [null], [undefined]])(
    'ignores an action whose lines are %j instead of an array',
    (lines) => {
      const cart = sampleCart();

      expect(apply(cart, cartFetcher('LinesAdd', {lines}))).toBe(cart);
    },
  );

  it.each([[null], ['text'], [7]])(
    'ignores an element of lines that is %j instead of an object',
    (element) => {
      const cart = sampleCart();

      expect(apply(cart, addFetcher(element))).toBe(cart);
    },
  );

  it('ignores an action with no inputs', () => {
    const cart = sampleCart();
    const formData = new FormData();
    formData.set(CART_FORM_INPUT_NAME, JSON.stringify({action: 'LinesAdd'}));

    expect(apply(cart, {formData})).toBe(cart);
  });

  it('logs nothing when the add succeeds', () => {
    apply(sampleCart(), addFetcher(addInput(VARIANT_C), addInput(VARIANT_A)));

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('applyOptimisticCartActions with a cart that does not exist yet', () => {
  it.each([[null], [undefined]])(
    'starts from an empty cart when it is %s',
    (cart) => {
      const result = apply(cart, addFetcher(addInput(VARIANT_C, 2)));

      expect(result).toEqual({
        isOptimistic: true,
        totalQuantity: 2,
        lines: {
          nodes: [
            {
              id: `${OPTIMISTIC_LINE_ID_PREFIX}${VARIANT_C.id}`,
              merchandise: VARIANT_C,
              isOptimistic: true,
              quantity: 2,
            },
          ],
        },
      });
    },
  );

  it('stays null when the pending action cannot be applied', () => {
    expect(apply(null, removeFetcher(LINE_A))).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('starts from an empty cart when the cart has no lines property', () => {
    const cart = {id: 'gid://shopify/Cart/c1'} as unknown as Cart;

    const result = apply(cart, addFetcher(addInput(VARIANT_C)));

    expect(result.lines.nodes).toHaveLength(1);
    expect(result.totalQuantity).toBe(1);
  });
});

describe('applyOptimisticCartActions with LinesRemove', () => {
  it('removes the line and recomputes the total quantity', () => {
    const cart = sampleCart();

    const result = apply(cart, removeFetcher(LINE_A));

    expect(result.lines.nodes).toEqual([cart.lines.nodes[1]]);
    expect(result.totalQuantity).toBe(3);
    expect(result.isOptimistic).toBe(true);
  });

  it('removes several lines of one action', () => {
    const result = apply(sampleCart(), removeFetcher(LINE_A, LINE_B));

    expect(result.lines.nodes).toEqual([]);
    expect(result.totalQuantity).toBe(0);
    expect(result.isOptimistic).toBe(true);
  });

  it('keeps the lines it was not asked to remove, in order', () => {
    const cart = sampleCart();
    cart.lines.nodes.push(lineOf('gid://shopify/CartLine/c', VARIANT_C, 1));

    const result = apply(cart, removeFetcher(LINE_B));

    expect(result.lines.nodes.map((line) => line.id)).toEqual([
      LINE_A,
      'gid://shopify/CartLine/c',
    ]);
  });

  it('warns and changes nothing for a line that is not in the cart', () => {
    const cart = sampleCart();

    const result = apply(cart, removeFetcher('gid://shopify/CartLine/zzz'));

    expect(result).toBe(cart);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("'gid://shopify/CartLine/zzz'"),
    );
  });

  it('removes the lines that exist and warns about the ones that do not', () => {
    const result = apply(sampleCart(), removeFetcher('missing', LINE_B));

    expect(result.lines.nodes.map((line) => line.id)).toEqual([LINE_A]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('refuses to remove a line that is itself still pending', () => {
    const pending = addFetcher(addInput(VARIANT_C));
    const pendingId = `${OPTIMISTIC_LINE_ID_PREFIX}${VARIANT_C.id}`;

    const result = apply(sampleCart(), pending, removeFetcher(pendingId));

    expect(result.lines.nodes[0].id).toBe(pendingId);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\[useOptimisticCart\].*remove an optimistic line/,
      ),
    );
  });

  it.each([[5], [null], [{}], [undefined]])(
    'ignores a lineId that is %j instead of a string',
    (lineId) => {
      const cart = sampleCart();

      expect(apply(cart, removeFetcher(lineId))).toBe(cart);
      expect(warnSpy).not.toHaveBeenCalled();
    },
  );

  it.each([['nope'], [{}], [null], [undefined]])(
    'ignores an action whose lineIds are %j instead of an array',
    (lineIds) => {
      const cart = sampleCart();

      expect(apply(cart, cartFetcher('LinesRemove', {lineIds}))).toBe(cart);
    },
  );

  it('leaves an empty cart with a total of zero when the last line goes', () => {
    const cart = sampleCart();
    const single: Cart = {
      ...cart,
      totalQuantity: 2,
      lines: {nodes: [cart.lines.nodes[0]]},
    };

    const result = apply(single, removeFetcher(LINE_A));

    expect(result.lines.nodes).toEqual([]);
    expect(result.totalQuantity).toBe(0);
  });
});

describe('applyOptimisticCartActions with LinesUpdate', () => {
  it('sets the new quantity and recomputes the total', () => {
    const cart = sampleCart();

    const result = apply(cart, updateFetcher({id: LINE_A, quantity: 4}));

    expect(result.lines.nodes[0]).toEqual({
      ...cart.lines.nodes[0],
      quantity: 4,
    });
    expect(result.lines.nodes[1]).toEqual(cart.lines.nodes[1]);
    expect(result.totalQuantity).toBe(7);
    expect(result.isOptimistic).toBe(true);
  });

  it('does not mark an updated line as optimistic', () => {
    const result = apply(
      sampleCart(),
      updateFetcher({id: LINE_A, quantity: 4}),
    );

    expect(result.lines.nodes[0].isOptimistic).toBeUndefined();
  });

  it('removes the line when the quantity is zero', () => {
    const cart = sampleCart();

    const result = apply(cart, updateFetcher({id: LINE_A, quantity: 0}));

    expect(result.lines.nodes).toEqual([cart.lines.nodes[1]]);
    expect(result.totalQuantity).toBe(3);
    expect(result.isOptimistic).toBe(true);
  });

  it('updates several lines of one action', () => {
    const result = apply(
      sampleCart(),
      updateFetcher({id: LINE_A, quantity: 1}, {id: LINE_B, quantity: 1}),
    );

    expect(result.lines.nodes.map((line) => line.quantity)).toEqual([1, 1]);
    expect(result.totalQuantity).toBe(2);
  });

  it('warns and changes nothing for a line that is not in the cart', () => {
    const cart = sampleCart();

    const result = apply(cart, updateFetcher({id: 'missing', quantity: 2}));

    expect(result).toBe(cart);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("'missing'"));
  });

  it('refuses to update a line that is itself still pending', () => {
    const pendingId = `${OPTIMISTIC_LINE_ID_PREFIX}${VARIANT_C.id}`;

    const result = apply(
      sampleCart(),
      addFetcher(addInput(VARIANT_C, 2)),
      updateFetcher({id: pendingId, quantity: 5}),
    );

    expect(result.lines.nodes[0].quantity).toBe(2);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\[useOptimisticCart\].*update an optimistic line/,
      ),
    );
  });

  it.each([
    ['missing', undefined],
    ['negative', -1],
    ['fractional', 1.5],
    ['a string', '3'],
    ['null', null],
    ['not finite', Number.POSITIVE_INFINITY],
  ])('ignores an update whose quantity is %s', (_label, quantity) => {
    const cart = sampleCart();

    const result = apply(cart, updateFetcher({id: LINE_A, quantity}));

    expect(result).toBe(cart);
  });

  it.each([[null], ['text'], [{quantity: 2}], [{id: 5, quantity: 2}]])(
    'ignores an update that is %j',
    (update) => {
      const cart = sampleCart();

      expect(apply(cart, updateFetcher(update))).toBe(cart);
      expect(warnSpy).not.toHaveBeenCalled();
    },
  );

  it.each([['nope'], [{}], [null]])(
    'ignores an action whose lines are %j instead of an array',
    (lines) => {
      const cart = sampleCart();

      expect(apply(cart, cartFetcher('LinesUpdate', {lines}))).toBe(cart);
    },
  );
});

describe('applyOptimisticCartActions with several fetchers', () => {
  it('applies the fetchers in order, each on the result of the one before', () => {
    const result = apply(
      sampleCart(),
      removeFetcher(LINE_A),
      updateFetcher({id: LINE_B, quantity: 1}),
      addFetcher(addInput(VARIANT_C, 4)),
    );

    expect(
      result.lines.nodes.map((line) => [line.merchandise.title, line.quantity]),
    ).toEqual([
      ['C', 4],
      ['B', 1],
    ]);
    expect(result.totalQuantity).toBe(5);
  });

  it('skips fetchers that are not cart forms between the ones that are', () => {
    const search = new FormData();
    search.set('q', 'x');

    const result = apply(
      sampleCart(),
      {formData: undefined},
      removeFetcher(LINE_A),
      {formData: search},
      removeFetcher(LINE_B),
    );

    expect(result.lines.nodes).toEqual([]);
  });

  it('updates a line that an earlier fetcher already changed', () => {
    const result = apply(
      sampleCart(),
      updateFetcher({id: LINE_A, quantity: 5}),
      updateFetcher({id: LINE_A, quantity: 6}),
    );

    expect(result.lines.nodes[0].quantity).toBe(6);
    expect(result.totalQuantity).toBe(9);
  });

  it('warns when a later fetcher targets a line an earlier one removed', () => {
    const result = apply(
      sampleCart(),
      removeFetcher(LINE_A),
      updateFetcher({id: LINE_A, quantity: 3}),
    );

    expect(result.lines.nodes.map((line) => line.id)).toEqual([LINE_B]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('applyOptimisticCartActions total quantity', () => {
  it('is computed from the lines, not adjusted from the cart total', () => {
    const cart = {...sampleCart(), totalQuantity: 99};

    const result = apply(cart, addFetcher(addInput(VARIANT_C, 1)));

    expect(result.totalQuantity).toBe(6);
  });

  it('does not need the cart to have a total', () => {
    const cart = {lines: {nodes: [lineOf(LINE_A, VARIANT_A, 2)]}} as Cart;

    const result = apply(
      cart,
      removeFetcher('missing'),
      addFetcher(addInput(VARIANT_B, 3)),
    );

    expect(result.totalQuantity).toBe(5);
  });
});

describe('applyOptimisticCartActions never mutates its input', () => {
  it.each([
    ['LinesAdd of a new variant', () => addFetcher(addInput(VARIANT_C, 2))],
    [
      'LinesAdd of a variant in the cart',
      () => addFetcher(addInput(VARIANT_A)),
    ],
    ['LinesRemove', () => removeFetcher(LINE_A)],
    ['LinesUpdate', () => updateFetcher({id: LINE_B, quantity: 9})],
    ['LinesUpdate to zero', () => updateFetcher({id: LINE_B, quantity: 0})],
  ])('%s', (_label, makeFetcher) => {
    const cart = deepFreeze(sampleCart());
    const before = JSON.stringify(cart);

    const result = apply(cart, makeFetcher());

    expect(result).not.toBe(cart);
    expect(JSON.stringify(cart)).toBe(before);
  });

  it('builds new containers for what it changes and shares the lines it leaves alone', () => {
    const cart = sampleCart();

    const result = apply(cart, updateFetcher({id: LINE_A, quantity: 4}));

    expect(result.lines).not.toBe(cart.lines);
    expect(result.lines.nodes).not.toBe(cart.lines.nodes);
    expect(result.lines.nodes[0]).not.toBe(cart.lines.nodes[0]);
    expect(result.lines.nodes[1]).toBe(cart.lines.nodes[1]);
  });

  it('gives the same answer when it is applied twice to the same cart', () => {
    const cart = sampleCart();
    const fetcher = addFetcher(addInput(VARIANT_C, 2));

    expect(apply(cart, fetcher)).toEqual(apply(cart, fetcher));
  });
});

describe('applyOptimisticCartActions with a large cart', () => {
  it('handles thousands of lines', () => {
    const count = 5_000;
    const nodes = Array.from({length: count}, (_, index) =>
      lineOf(
        `gid://shopify/CartLine/${index}`,
        {id: `v${index}`, title: `V${index}`},
        1,
      ),
    );
    const cart: Cart = {
      id: 'gid://shopify/Cart/big',
      checkoutUrl: 'https://shop.example/checkout/big',
      totalQuantity: count,
      lines: {nodes},
    };

    const result = apply(
      cart,
      removeFetcher('gid://shopify/CartLine/0'),
      updateFetcher({id: `gid://shopify/CartLine/${count - 1}`, quantity: 3}),
    );

    expect(result.lines.nodes).toHaveLength(count - 1);
    expect(result.totalQuantity).toBe(count - 1 + 2);
  });
});
