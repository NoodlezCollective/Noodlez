import type {CartBuyerIdentityInput} from '@shopify/hydrogen-react/storefront-api-types';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {installMockStorefront} from '~/lib/mock/install.server';
import {CacheNone} from '~/lib/storefront/cache.server';
import type {Storefront} from '~/lib/storefront/client.server';
import {getOperationName} from '~/lib/storefront/graphql';
import {
  STOREFRONT_API_ERROR_STATUS,
  guardStorefrontErrors,
} from '~/lib/storefront-errors';
import {
  createCartService,
  type CartCustomerAccount,
  type CreateCartServiceOptions,
} from './cart.server';
import {
  CART_BUYER_IDENTITY_UPDATE_MUTATION,
  CART_CREATE_MUTATION,
  CART_DISCOUNT_CODES_UPDATE_MUTATION,
  CART_GIFT_CARD_CODES_ADD_MUTATION,
  CART_GIFT_CARD_CODES_REMOVE_MUTATION,
  CART_LINES_ADD_MUTATION,
  CART_LINES_REMOVE_MUTATION,
  CART_LINES_UPDATE_MUTATION,
  CART_QUERY,
} from './queries';
import type {OptimisticCartLineInput} from './types';

const CART_ID = 'gid://shopify/Cart/c1-abc?key=k';
/** The cookie Hydrogen set for CART_ID. */
const CART_COOKIE = 'cart=c1-abc%3Fkey%3Dk';
const NEW_CART_ID = 'gid://shopify/Cart/c1-new?key=n';
const CHECKOUT_URL = 'https://mellow-test.myshopify.com/cart/c/c1-abc?key=k';
const VARIANT_ID = 'gid://shopify/ProductVariant/1';
const OPTIMISTIC_LINE_ID = `__h_pending_${VARIANT_ID}`;
const LINE_ID = 'gid://shopify/CartLine/l1?cart=c1-abc';
const API_ERRORS = [{message: 'Throttled', extensions: {code: 'THROTTLED'}}];
const NO_BUYER_IDENTITY = {};

/** What `cart.get()` reads (the app's CartApiQuery fragment, trimmed). */
const QUERY_CART = {
  id: CART_ID,
  checkoutUrl: CHECKOUT_URL,
  totalQuantity: 2,
  lines: {nodes: [{id: LINE_ID, quantity: 2}]},
};

type Variables = Record<string, unknown>;
type OperationOptions = {variables?: Variables; cache?: unknown};
type Operation = (
  document: string,
  options?: OperationOptions,
) => Promise<Record<string, unknown>>;

/** The minimal cart every mutation selects (CartApiMutation). */
function mutationCart(id: unknown = CART_ID) {
  return {id, totalQuantity: 1, checkoutUrl: CHECKOUT_URL};
}

/** A cart mutation payload: the cart, userErrors and warnings. */
function payload(cart: unknown = mutationCart(), extra: Variables = {}) {
  return {cart, userErrors: [], warnings: [], ...extra};
}

/**
 * The Storefront API as the cart sees it: `cartCreate` answers a new cart,
 * every other mutation the cart it was given, under the mutation's field.
 */
async function answerMutation(document: string, options?: OperationOptions) {
  const field = getOperationName(document);
  const cartId =
    field === 'cartCreate' ? NEW_CART_ID : options?.variables?.cartId;
  return {[field]: payload(mutationCart(cartId))};
}

function createStorefront({
  query = async () => ({cart: QUERY_CART}),
  mutate = answerMutation,
}: {query?: Operation; mutate?: Operation} = {}) {
  return {
    query: vi.fn<Operation>(query),
    mutate: vi.fn<Operation>(mutate),
    CacheNone: vi.fn(CacheNone),
  };
}

function createCustomerAccount({
  loggedIn = false,
  buyer,
}: {loggedIn?: boolean; buyer?: Partial<CartBuyerIdentityInput>} = {}) {
  return {
    isLoggedIn: vi.fn(async () => loggedIn),
    getBuyer: vi.fn<CartCustomerAccount['getBuyer']>(async () => buyer),
  };
}

type FakeStorefront = ReturnType<typeof createStorefront>;

function setup({
  cookie,
  secureCookie = true,
  storefront = createStorefront(),
  customerAccount = createCustomerAccount(),
}: {
  cookie?: string;
  secureCookie?: boolean;
  storefront?: FakeStorefront;
  customerAccount?: ReturnType<typeof createCustomerAccount>;
} = {}) {
  const cart = createCartService({
    storefront: storefront as unknown as CreateCartServiceOptions['storefront'],
    customerAccount,
    requestHeaders: new Headers(cookie ? {Cookie: cookie} : undefined),
    secureCookie,
  });
  return {cart, storefront, customerAccount};
}

/** The document and options of every `storefront.mutate` call, in order. */
function mutations(storefront: FakeStorefront) {
  return storefront.mutate.mock.calls.map(([document, options]) => ({
    document,
    variables: options?.variables,
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getCartId', () => {
  it('is undefined when the request carries no cart cookie', () => {
    const {cart} = setup({cookie: 'session=s'});

    expect(cart.getCartId()).toBeUndefined();
  });

  it('is the gid stored in the cart cookie Hydrogen set', () => {
    const {cart} = setup({cookie: `session=s; ${CART_COOKIE}`});

    expect(cart.getCartId()).toBe(CART_ID);
  });
});

describe('setCartId', () => {
  it('answers a Set-Cookie header with the HttpOnly cart cookie, Secure over https', () => {
    const {cart} = setup({secureCookie: true});

    const headers = cart.setCartId(CART_ID);

    expect(headers.getSetCookie()).toEqual([
      `${CART_COOKIE}; Path=/; SameSite=Lax; Secure; HttpOnly`,
    ]);
  });

  it('leaves Secure out over plain http, so local development keeps working', () => {
    const {cart} = setup({secureCookie: false});

    const headers = cart.setCartId(CART_ID);

    expect(headers.getSetCookie()).toEqual([
      `${CART_COOKIE}; Path=/; SameSite=Lax; HttpOnly`,
    ]);
  });

  it('answers new headers on every call, which callers add Location to', () => {
    const {cart} = setup();

    const first = cart.setCartId(CART_ID);
    first.set('Location', '/cart');
    const second = cart.setCartId(CART_ID);

    expect(second).not.toBe(first);
    expect(second.get('Location')).toBeNull();
  });

  it('does not change the cart the request works on', () => {
    const {cart} = setup({cookie: CART_COOKIE});

    cart.setCartId(NEW_CART_ID);

    expect(cart.getCartId()).toBe(CART_ID);
  });
});

describe('get', () => {
  it('is null without a cart cookie, and asks the Storefront API nothing', async () => {
    const {cart, storefront, customerAccount} = setup();

    const result = await cart.get();

    expect(result).toBeNull();
    expect(storefront.query).not.toHaveBeenCalled();
    expect(customerAccount.isLoggedIn).not.toHaveBeenCalled();
  });

  it('queries the cart from the cookie uncached (CacheNone)', async () => {
    const {cart, storefront} = setup({cookie: CART_COOKIE});

    await cart.get();

    expect(storefront.CacheNone).toHaveBeenCalledTimes(1);
    expect(storefront.query).toHaveBeenCalledWith(CART_QUERY, {
      variables: {cartId: CART_ID},
      cache: CacheNone(),
    });
  });

  it('answers a copy of the cart, without an errors key when there are none', async () => {
    const {cart} = setup({cookie: CART_COOKIE});

    const result = await cart.get();

    expect(result).toEqual(QUERY_CART);
    expect(result).not.toBe(QUERY_CART);
    expect(result).not.toHaveProperty('errors');
  });

  it('adds the errors the API reported next to the cart ({...cart, errors})', async () => {
    const storefront = createStorefront({
      query: async () => ({cart: QUERY_CART, errors: API_ERRORS}),
    });
    const {cart} = setup({cookie: CART_COOKIE, storefront});

    const result = await cart.get();

    expect(result).toEqual({...QUERY_CART, errors: API_ERRORS});
  });

  it('is null when the cart no longer exists', async () => {
    const storefront = createStorefront({query: async () => ({cart: null})});
    const {cart} = setup({cookie: CART_COOKIE, storefront});

    expect(await cart.get()).toBeNull();
  });

  it('is null when the API answers errors and no cart (unguarded; the guard makes that a 502)', async () => {
    const storefront = createStorefront({
      query: async () => ({cart: null, errors: API_ERRORS}),
    });
    const {cart} = setup({cookie: CART_COOKIE, storefront});

    expect(await cart.get()).toBeNull();
  });

  it('adds logged_in=true to the checkout URL for a logged-in customer', async () => {
    const customerAccount = createCustomerAccount({loggedIn: true});
    const {cart} = setup({cookie: CART_COOKIE, customerAccount});

    const result = await cart.get();

    expect(result?.checkoutUrl).toBe(`${CHECKOUT_URL}&logged_in=true`);
  });

  it('keeps the checkout URL exactly as the API sent it for guests', async () => {
    const {cart} = setup({cookie: CART_COOKIE});

    const result = await cart.get();

    expect(result?.checkoutUrl).toBe(CHECKOUT_URL);
  });

  it('never modifies the API result', async () => {
    const answered = structuredClone(QUERY_CART);
    const storefront = createStorefront({
      query: async () => ({cart: answered}),
    });
    const customerAccount = createCustomerAccount({loggedIn: true});
    const {cart} = setup({cookie: CART_COOKIE, storefront, customerAccount});

    await cart.get();

    expect(answered).toEqual(QUERY_CART);
  });

  it('does not wait for the login check before querying the cart', async () => {
    // Arrange
    let finishLoginCheck!: (loggedIn: boolean) => void;
    const customerAccount = createCustomerAccount();
    customerAccount.isLoggedIn.mockReturnValue(
      new Promise((resolve) => {
        finishLoginCheck = resolve;
      }),
    );
    const {cart, storefront} = setup({cookie: CART_COOKIE, customerAccount});

    // Act
    const pending = cart.get();
    const queriedBeforeLogin = storefront.query.mock.calls.length;
    finishLoginCheck(false);

    // Assert
    expect(queriedBeforeLogin).toBe(1);
    expect(await pending).toEqual(QUERY_CART);
  });

  it('rejects with whatever the Storefront call rejected with (the guard 502)', async () => {
    const guarded = new Response('Storefront API error', {
      status: STOREFRONT_API_ERROR_STATUS,
    });
    const storefront = createStorefront({
      query: async () => {
        throw guarded;
      },
    });
    const {cart} = setup({cookie: CART_COOKIE, storefront});

    await expect(cart.get()).rejects.toBe(guarded);
  });

  it('rejects when the login check fails', async () => {
    const failure = new Error('session unreadable');
    const customerAccount = createCustomerAccount();
    customerAccount.isLoggedIn.mockRejectedValue(failure);
    const {cart} = setup({cookie: CART_COOKIE, customerAccount});

    await expect(cart.get()).rejects.toBe(failure);
  });
});

describe('create', () => {
  const INPUT = {
    lines: [{merchandiseId: VARIANT_ID, quantity: 1}],
    discountCodes: ['MELLOW10'],
  };

  it('creates a cart from the input, with an empty buyer identity for guests', async () => {
    const {cart, storefront} = setup();

    await cart.create(INPUT);

    expect(mutations(storefront)).toEqual([
      {
        document: CART_CREATE_MUTATION,
        variables: {input: {...INPUT, buyerIdentity: NO_BUYER_IDENTITY}},
      },
    ]);
  });

  it("merges the logged-in customer's buyer under the input's buyer identity", async () => {
    // Arrange
    const customerAccount = createCustomerAccount({
      buyer: {customerAccessToken: 'token', companyLocationId: 'location-1'},
    });
    const {cart, storefront} = setup({customerAccount});

    // Act
    await cart.create({
      ...INPUT,
      buyerIdentity: {countryCode: 'CA', companyLocationId: 'location-2'},
    });

    // Assert
    expect(mutations(storefront)[0].variables).toEqual({
      input: {
        ...INPUT,
        buyerIdentity: {
          customerAccessToken: 'token',
          companyLocationId: 'location-2',
          countryCode: 'CA',
        },
      },
    });
  });

  it('answers the cartCreate payload, without an errors key when there are none', async () => {
    const {cart} = setup();

    const result = await cart.create(INPUT);

    expect(result).toEqual(payload(mutationCart(NEW_CART_ID)));
    expect(result).not.toHaveProperty('errors');
  });

  it('answers the payload together with the API errors ({...payload, errors})', async () => {
    const storefront = createStorefront({
      mutate: async () => ({cartCreate: payload(), errors: API_ERRORS}),
    });
    const {cart} = setup({storefront});

    const result = await cart.create(INPUT);

    expect(result).toEqual({...payload(), errors: API_ERRORS});
  });

  it('answers cart null when the API sends no payload at all', async () => {
    const storefront = createStorefront({
      mutate: async () => ({errors: API_ERRORS}),
    });
    const {cart} = setup({storefront});

    const result = await cart.create(INPUT);

    expect(result).toEqual({cart: null, errors: API_ERRORS});
  });

  it('works on the new cart for the rest of the request', async () => {
    const {cart, storefront} = setup({cookie: CART_COOKIE});

    await cart.create(INPUT);
    await cart.addLines([{merchandiseId: VARIANT_ID, quantity: 1}]);

    expect(cart.getCartId()).toBe(NEW_CART_ID);
    expect(mutations(storefront)[1]).toMatchObject({
      document: CART_LINES_ADD_MUTATION,
      variables: {cartId: NEW_CART_ID},
    });
  });

  it('keeps working on the current cart when the API creates none', async () => {
    // Arrange
    const userErrors = [
      {message: 'Invalid variant', field: ['lines'], code: 'INVALID'},
    ];
    const storefront = createStorefront({
      mutate: async () => ({cartCreate: payload(null, {userErrors})}),
    });
    const {cart} = setup({cookie: CART_COOKIE, storefront});

    // Act
    const result = await cart.create(INPUT);

    // Assert
    expect(result).toEqual(payload(null, {userErrors}));
    expect(cart.getCartId()).toBe(CART_ID);
  });

  it('never modifies the input', async () => {
    const input = structuredClone(INPUT);
    const customerAccount = createCustomerAccount({
      buyer: {customerAccessToken: 'token'},
    });
    const {cart} = setup({customerAccount});

    await cart.create(input);

    expect(input).toEqual(INPUT);
  });
});

describe('addLines', () => {
  const LINE: OptimisticCartLineInput = {
    merchandiseId: VARIANT_ID,
    quantity: 2,
  };

  it('adds the lines to the cart from the cookie', async () => {
    const {cart, storefront} = setup({cookie: CART_COOKIE});

    await cart.addLines([LINE]);

    expect(mutations(storefront)).toEqual([
      {
        document: CART_LINES_ADD_MUTATION,
        variables: {cartId: CART_ID, lines: [LINE]},
      },
    ]);
  });

  it('sends only the line fields the Storefront API accepts (selectedVariant is stripped)', async () => {
    // Arrange
    const line = {
      merchandiseId: VARIANT_ID,
      quantity: 1,
      attributes: [{key: 'engraving', value: 'Mellow'}],
      sellingPlanId: 'gid://shopify/SellingPlan/1',
      parent: {lineId: LINE_ID},
      selectedVariant: {id: VARIANT_ID, title: 'Queen'},
      unexpected: 'dropped too',
    };
    const {cart, storefront} = setup({cookie: CART_COOKIE});

    // Act
    await cart.addLines([line]);

    // Assert
    const [sent] = mutations(storefront)[0].variables?.lines as Variables[];
    expect(sent).toEqual({
      merchandiseId: VARIANT_ID,
      quantity: 1,
      attributes: [{key: 'engraving', value: 'Mellow'}],
      sellingPlanId: 'gid://shopify/SellingPlan/1',
      parent: {lineId: LINE_ID},
    });
    expect(sent).not.toHaveProperty('selectedVariant');
    expect(sent).not.toHaveProperty('unexpected');
  });

  it('strips selectedVariant from every line of a large add', async () => {
    const lines = Array.from({length: 1_000}, (_, index) => ({
      merchandiseId: `gid://shopify/ProductVariant/${index}`,
      quantity: 1,
      selectedVariant: {id: `gid://shopify/ProductVariant/${index}`},
    }));
    const {cart, storefront} = setup({cookie: CART_COOKIE});

    await cart.addLines(lines);

    const sent = mutations(storefront)[0].variables?.lines as Variables[];
    expect(sent).toHaveLength(1_000);
    expect(sent.some((line) => 'selectedVariant' in line)).toBe(false);
  });

  it('creates the cart with the lines when there is none yet', async () => {
    const {cart, storefront} = setup();

    const result = await cart.addLines([{...LINE, selectedVariant: {}}]);

    expect(mutations(storefront)).toEqual([
      {
        document: CART_CREATE_MUTATION,
        variables: {input: {lines: [LINE], buyerIdentity: NO_BUYER_IDENTITY}},
      },
    ]);
    expect(result.cart?.id).toBe(NEW_CART_ID);
  });

  it('adds to the cart it created when called again in the same request', async () => {
    const {cart, storefront} = setup();

    await cart.addLines([LINE]);
    await cart.addLines([LINE]);

    expect(mutations(storefront)).toEqual([
      expect.objectContaining({document: CART_CREATE_MUTATION}),
      {
        document: CART_LINES_ADD_MUTATION,
        variables: {cartId: NEW_CART_ID, lines: [LINE]},
      },
    ]);
  });

  it('answers the payload together with the API errors ({...payload, errors})', async () => {
    const storefront = createStorefront({
      mutate: async () => ({cartLinesAdd: payload(), errors: API_ERRORS}),
    });
    const {cart} = setup({cookie: CART_COOKIE, storefront});

    const result = await cart.addLines([LINE]);

    expect(result).toEqual({...payload(), errors: API_ERRORS});
  });

  it('never modifies the lines it was given', async () => {
    const lines = [{...LINE, selectedVariant: {id: VARIANT_ID}}];
    const {cart} = setup({cookie: CART_COOKIE});

    await cart.addLines(lines);

    expect(lines).toEqual([{...LINE, selectedVariant: {id: VARIANT_ID}}]);
  });
});

describe('updateLines', () => {
  const UPDATE = {id: LINE_ID, quantity: 3};

  it('updates the lines of the cart from the cookie', async () => {
    const {cart, storefront} = setup({cookie: CART_COOKIE});

    const result = await cart.updateLines([UPDATE]);

    expect(mutations(storefront)).toEqual([
      {
        document: CART_LINES_UPDATE_MUTATION,
        variables: {cartId: CART_ID, lines: [UPDATE]},
      },
    ]);
    expect(result).toEqual(payload(mutationCart(CART_ID)));
  });

  it('rejects an optimistic line before calling the Storefront API', async () => {
    const {cart, storefront} = setup({cookie: CART_COOKIE});

    await expect(
      cart.updateLines([UPDATE, {id: OPTIMISTIC_LINE_ID, quantity: 1}]),
    ).rejects.toThrow(
      'Tried to perform an action on an optimistic line. Make sure to disable your "updateLines" CartForm action when the line is optimistic.',
    );
    expect(storefront.mutate).not.toHaveBeenCalled();
  });

  it('does not create a cart: without one the API rejects the missing id, as before', async () => {
    const {cart, storefront} = setup();

    await cart.updateLines([UPDATE]);

    expect(mutations(storefront)).toEqual([
      {
        document: CART_LINES_UPDATE_MUTATION,
        variables: {cartId: undefined, lines: [UPDATE]},
      },
    ]);
  });
});

describe('removeLines', () => {
  it('removes the lines from the cart from the cookie', async () => {
    const {cart, storefront} = setup({cookie: CART_COOKIE});

    const result = await cart.removeLines([LINE_ID]);

    expect(mutations(storefront)).toEqual([
      {
        document: CART_LINES_REMOVE_MUTATION,
        variables: {cartId: CART_ID, lineIds: [LINE_ID]},
      },
    ]);
    expect(result).toEqual(payload(mutationCart(CART_ID)));
  });

  it('rejects an optimistic line id before calling the Storefront API', async () => {
    const {cart, storefront} = setup({cookie: CART_COOKIE});

    await expect(
      cart.removeLines([LINE_ID, OPTIMISTIC_LINE_ID]),
    ).rejects.toThrow(
      'Tried to perform an action on an optimistic line. Make sure to disable your "removeLines" CartForm action when the line is optimistic.',
    );
    expect(storefront.mutate).not.toHaveBeenCalled();
  });

  it('only treats ids starting with the optimistic prefix as optimistic', async () => {
    const lineId = `gid://shopify/CartLine/${OPTIMISTIC_LINE_ID}`;
    const {cart, storefront} = setup({cookie: CART_COOKIE});

    await cart.removeLines([lineId]);

    expect(mutations(storefront)[0].variables?.lineIds).toEqual([lineId]);
  });
});

describe('updateDiscountCodes', () => {
  it('replaces the codes of the cart, each code once, in order', async () => {
    const {cart, storefront} = setup({cookie: CART_COOKIE});

    await cart.updateDiscountCodes([
      'ÉTÉ',
      'MELLOW10',
      'ÉTÉ',
      '😀',
      'mellow10',
    ]);

    expect(mutations(storefront)).toEqual([
      {
        document: CART_DISCOUNT_CODES_UPDATE_MUTATION,
        variables: {
          cartId: CART_ID,
          discountCodes: ['ÉTÉ', 'MELLOW10', '😀', 'mellow10'],
        },
      },
    ]);
  });

  it('sends an empty list, which removes every code', async () => {
    const {cart, storefront} = setup({cookie: CART_COOKIE});

    await cart.updateDiscountCodes([]);

    expect(mutations(storefront)[0].variables).toEqual({
      cartId: CART_ID,
      discountCodes: [],
    });
  });

  it('creates the cart with the codes when there is none yet', async () => {
    const {cart, storefront} = setup();

    const result = await cart.updateDiscountCodes(['MELLOW10', 'MELLOW10']);

    expect(mutations(storefront)).toEqual([
      {
        document: CART_CREATE_MUTATION,
        variables: {
          input: {
            discountCodes: ['MELLOW10'],
            buyerIdentity: NO_BUYER_IDENTITY,
          },
        },
      },
    ]);
    expect(result.cart?.id).toBe(NEW_CART_ID);
  });
});

describe('addGiftCardCodes', () => {
  it('adds the codes to the cart from the cookie', async () => {
    const {cart, storefront} = setup({cookie: CART_COOKIE});

    const result = await cart.addGiftCardCodes(['GIFT-1234']);

    expect(mutations(storefront)).toEqual([
      {
        document: CART_GIFT_CARD_CODES_ADD_MUTATION,
        variables: {cartId: CART_ID, giftCardCodes: ['GIFT-1234']},
      },
    ]);
    expect(result).toEqual(payload(mutationCart(CART_ID)));
  });
});

describe('removeGiftCardCodes', () => {
  it('removes the applied gift cards from the cart from the cookie', async () => {
    const appliedGiftCardIds = ['gid://shopify/AppliedGiftCard/1'];
    const {cart, storefront} = setup({cookie: CART_COOKIE});

    const result = await cart.removeGiftCardCodes(appliedGiftCardIds);

    expect(mutations(storefront)).toEqual([
      {
        document: CART_GIFT_CARD_CODES_REMOVE_MUTATION,
        variables: {cartId: CART_ID, appliedGiftCardIds},
      },
    ]);
    expect(result).toEqual(payload(mutationCart(CART_ID)));
  });
});

describe('updateBuyerIdentity', () => {
  const BUYER = {customerAccessToken: 'token', companyLocationId: 'location-1'};

  it("updates the buyer identity, merged over the logged-in customer's buyer", async () => {
    const customerAccount = createCustomerAccount({buyer: BUYER});
    const {cart, storefront} = setup({cookie: CART_COOKIE, customerAccount});

    await cart.updateBuyerIdentity({
      countryCode: 'CA',
      companyLocationId: 'location-2',
    });

    expect(mutations(storefront)).toEqual([
      {
        document: CART_BUYER_IDENTITY_UPDATE_MUTATION,
        variables: {
          cartId: CART_ID,
          buyerIdentity: {
            customerAccessToken: 'token',
            companyLocationId: 'location-2',
            countryCode: 'CA',
          },
        },
      },
    ]);
  });

  it('creates the cart with the merged buyer identity when there is none yet', async () => {
    const customerAccount = createCustomerAccount({buyer: BUYER});
    const {cart, storefront} = setup({customerAccount});

    const result = await cart.updateBuyerIdentity({countryCode: 'CA'});

    expect(mutations(storefront)).toEqual([
      {
        document: CART_CREATE_MUTATION,
        variables: {input: {buyerIdentity: {...BUYER, countryCode: 'CA'}}},
      },
    ]);
    expect(result.cart?.id).toBe(NEW_CART_ID);
  });
});

describe('the storefront client', () => {
  it('is used through the object at call time, so the mock and the guard installed afterwards apply', async () => {
    // Arrange
    const {cart, storefront} = setup({cookie: CART_COOKIE});
    const query = vi.fn<Operation>(async () => ({cart: QUERY_CART}));
    const mutate = vi.fn<Operation>(answerMutation);
    storefront.query = query;
    storefront.mutate = mutate;

    // Act
    await cart.get();
    await cart.addLines([{merchandiseId: VARIANT_ID, quantity: 1}]);

    // Assert
    expect(query).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledTimes(1);
  });
});

describe('against the development mock', () => {
  const CLOUDALIGN = 'gid://shopify/ProductVariant/cloudalign-pillow-1';
  const PEBBLE = 'gid://shopify/ProductVariant/pebble-pillow-1';

  /** The client the app builds in development: mock installed, then guarded. */
  function createMockCart(cookie?: string) {
    const storefront = {CacheNone} as unknown as Storefront;
    installMockStorefront(storefront, new Request('http://localhost:3000/'));
    guardStorefrontErrors(storefront);
    return createCartService({
      storefront,
      customerAccount: createCustomerAccount(),
      requestHeaders: new Headers(cookie ? {Cookie: cookie} : undefined),
      secureCookie: false,
    });
  }

  function linesOf(
    cart: Awaited<ReturnType<ReturnType<typeof createMockCart>['get']>>,
  ) {
    return cart?.lines.nodes.map((line) => ({
      id: line.id,
      variant: line.merchandise.id,
      quantity: line.quantity,
    }));
  }

  it('creates the cart on the first add, adds to it next, and reads it back', async () => {
    // Arrange
    const cart = createMockCart();

    // Act
    const first = await cart.addLines([
      {
        merchandiseId: CLOUDALIGN,
        quantity: 1,
        selectedVariant: {id: CLOUDALIGN},
      },
    ]);
    const second = await cart.addLines([{merchandiseId: PEBBLE, quantity: 2}]);
    const read = await cart.get();

    // Assert
    expect(first.cart?.id).toMatch(/^gid:\/\/shopify\/Cart\/mock/);
    expect(second.cart).toEqual({
      id: first.cart?.id,
      totalQuantity: 3,
      checkoutUrl: expect.stringContaining('/dev/mock-checkout?cart='),
    });
    expect(read?.id).toBe(first.cart?.id);
    expect(linesOf(read)).toEqual([
      {id: expect.any(String), variant: CLOUDALIGN, quantity: 1},
      {id: expect.any(String), variant: PEBBLE, quantity: 2},
    ]);
  });

  it('updates and removes the lines of a cart found through its cookie', async () => {
    // Arrange: a cart created in an earlier request, then its cookie.
    const earlier = createMockCart();
    const {cart: created} = await earlier.addLines([
      {merchandiseId: CLOUDALIGN, quantity: 1},
      {merchandiseId: PEBBLE, quantity: 1},
    ]);
    const [cookie] = earlier.setCartId(created?.id ?? '').getSetCookie();
    const cart = createMockCart(cookie.split(';')[0]);
    const [cloudAlign, pebble] = linesOf(await cart.get()) ?? [];

    // Act
    await cart.updateLines([{id: cloudAlign.id, quantity: 4}]);
    const removed = await cart.removeLines([pebble.id]);

    // Assert
    expect(cart.getCartId()).toBe(created?.id);
    expect(removed.cart?.totalQuantity).toBe(4);
    expect(linesOf(await cart.get())).toEqual([
      {id: cloudAlign.id, variant: CLOUDALIGN, quantity: 4},
    ]);
  });

  it('applies discount codes and a buyer identity the schema accepts', async () => {
    const cart = createMockCart();

    const discounted = await cart.updateDiscountCodes(['mellow10', 'mellow10']);
    const identified = await cart.updateBuyerIdentity({countryCode: 'CA'});
    const read = await cart.get();

    expect(identified.cart?.id).toBe(discounted.cart?.id);
    expect(read?.discountCodes).toEqual([{code: 'MELLOW10', applicable: true}]);
    expect(read?.buyerIdentity.countryCode).toBe('CA');
  });

  it('passes the user errors of a rejected change through', async () => {
    const cart = createMockCart('cart=c1-gift-card-test');

    const result = await cart.addGiftCardCodes(['GIFT-1234']);

    expect(result.userErrors).toEqual([
      expect.objectContaining({
        message: expect.stringMatching(/not supported/),
      }),
    ]);
  });

  it('turns an errors-only answer into the guard 502, as the cart action expects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const cart = createMockCart();

    const thrown = await cart
      .addLines([{merchandiseId: CLOUDALIGN, quantity: Number.NaN}])
      .catch((error: unknown) => error);

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(STOREFRONT_API_ERROR_STATUS);
  });

  it('answers a line update without a cart with the guard 502, as Hydrogen did', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const cart = createMockCart();

    const thrown = await cart
      .updateLines([{id: LINE_ID, quantity: 1}])
      .catch((error: unknown) => error);

    expect((thrown as Response).status).toBe(STOREFRONT_API_ERROR_STATUS);
  });
});
