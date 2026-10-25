import type {
  CartBuyerIdentityInput,
  CartInput,
  CartLineInput,
  CartLineUpdateInput,
} from '@shopify/hydrogen-react/storefront-api-types';
import type {Storefront} from '~/lib/storefront/client.server';
import type {StorefrontApiError} from '~/lib/storefront/types';
import {readCartId, serializeCartIdCookie} from './cookie';
import {isOptimisticLineId} from './optimistic';
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
import type {
  CartMutationCart,
  CartQueryDataReturn,
  CartReturn,
  CartUserError,
  CartWarning,
  OptimisticCartLineInput,
} from './types';

/**
 * The server-side cart on our Storefront client, ported from Hydrogen
 * 2026.4.7's `createCartHandler`, which it replaces. One service per request:
 * it works on the cart in the request's cookie, or on the cart it created
 * during the request.
 */
export interface CartService {
  /** The full cart, or null without a cart cookie or when it is gone. */
  get(): Promise<CartReturn | null>;
  getCartId(): string | undefined;
  /** A `Set-Cookie` header for the cart id; the caller sends it. */
  setCartId(cartId: string): Headers;
  create(input: CartInput): Promise<CartQueryDataReturn>;
  addLines(lines: OptimisticCartLineInput[]): Promise<CartQueryDataReturn>;
  updateLines(lines: CartLineUpdateInput[]): Promise<CartQueryDataReturn>;
  removeLines(lineIds: string[]): Promise<CartQueryDataReturn>;
  updateDiscountCodes(codes: string[]): Promise<CartQueryDataReturn>;
  addGiftCardCodes(codes: string[]): Promise<CartQueryDataReturn>;
  removeGiftCardCodes(
    appliedGiftCardIds: string[],
  ): Promise<CartQueryDataReturn>;
  updateBuyerIdentity(
    buyerIdentity: CartBuyerIdentityInput,
  ): Promise<CartQueryDataReturn>;
}

/** What the cart needs from the customer-account client. */
export interface CartCustomerAccount {
  isLoggedIn(): Promise<boolean>;
  getBuyer(): Promise<Partial<CartBuyerIdentityInput> | undefined>;
}

export interface CreateCartServiceOptions {
  /**
   * Called through the object at call time, never destructured: the
   * development mock and guardStorefrontErrors replace `query` and `mutate`
   * on it after the service is created.
   */
  storefront: Pick<Storefront, 'query' | 'mutate' | 'CacheNone'>;
  customerAccount: CartCustomerAccount;
  /** The incoming request's headers; the cart id comes from its cookie. */
  requestHeaders: Headers;
  /** Adds `Secure` to the cart cookie (requests over https). */
  secureCookie: boolean;
}

type CartStorefront = CreateCartServiceOptions['storefront'];

/** A mutation's payload as the CartApi fragments select it. */
type CartMutationPayload =
  | {
      cart?: CartMutationCart | null;
      userErrors?: CartUserError[];
      warnings?: CartWarning[];
    }
  | null
  | undefined;

/** Tells Shopify checkout that the buyer is logged in (Hydrogen parity). */
const LOGGED_IN_PARAM = 'logged_in';

export function createCartService(
  options: CreateCartServiceOptions,
): CartService {
  const {storefront, customerAccount, secureCookie} = options;
  const cart = trackRequestCart(
    storefront,
    customerAccount,
    readCartId(options.requestHeaders.get('Cookie')),
  );

  return {
    get: async () => getCart(storefront, customerAccount, cart.id()),
    getCartId: () => cart.id(),
    setCartId: (cartId) => cartIdCookieHeaders(cartId, secureCookie),
    create: async (input) => cart.create(input),
    addLines: async (lines) => {
      const cartLines = lines.map(toCartLineInput);
      return cart.changeOrCreate(
        (id) => addCartLines(storefront, id, cartLines),
        {lines: cartLines},
      );
    },
    updateLines: async (lines) =>
      updateCartLines(storefront, cart.existingId(), lines),
    removeLines: async (lineIds) =>
      removeCartLines(storefront, cart.existingId(), lineIds),
    updateDiscountCodes: async (codes) => {
      const discountCodes = [...new Set(codes)];
      return cart.changeOrCreate(
        (id) => updateCartDiscountCodes(storefront, id, discountCodes),
        {discountCodes},
      );
    },
    addGiftCardCodes: async (codes) =>
      addCartGiftCardCodes(storefront, cart.existingId(), codes),
    removeGiftCardCodes: async (appliedGiftCardIds) =>
      removeCartGiftCardCodes(
        storefront,
        cart.existingId(),
        appliedGiftCardIds,
      ),
    updateBuyerIdentity: async (identity) =>
      cart.changeOrCreate(
        (id) =>
          updateCartBuyerIdentity(storefront, customerAccount, id, identity),
        {buyerIdentity: identity},
      ),
  };
}

type CartChange = (cartId: string) => Promise<CartQueryDataReturn>;

/**
 * The cart one request works on: the one in its cookie, replaced by the cart
 * `create` makes (a failed create keeps the current one).
 */
function trackRequestCart(
  storefront: CartStorefront,
  customerAccount: CartCustomerAccount,
  cookieCartId: string | undefined,
) {
  let cartId = cookieCartId;
  const create = async (input: CartInput) => {
    const result = await createCart(storefront, customerAccount, input);
    cartId = result.cart?.id ?? cartId;
    return result;
  };

  return {
    id: () => cartId,
    create,
    /** Hydrogen's rule for lines, discount codes and buyer identity. */
    changeOrCreate: (change: CartChange, input: CartInput) =>
      cartId ? change(cartId) : create(input),
    /**
     * For the other changes. Like Hydrogen, they send the id even when there
     * is none: the Storefront API rejects the missing `$cartId` with an
     * errors-only answer, which guardStorefrontErrors turns into the 502 the
     * cart action reports.
     */
    existingId: () => cartId as string,
  };
}

async function getCart(
  storefront: CartStorefront,
  customerAccount: CartCustomerAccount,
  cartId: string | undefined,
): Promise<CartReturn | null> {
  if (!cartId) return null;
  const [isLoggedIn, {cart, errors}] = await Promise.all([
    customerAccount.isLoggedIn(),
    storefront.query(CART_QUERY, {
      variables: {cartId},
      cache: storefront.CacheNone(),
    }),
  ]);
  // No cart: it is gone, or the answer was errors-only, which the app's
  // guardStorefrontErrors has already turned into a 502 rejection.
  if (!cart) return null;
  return {...withLoggedInCheckoutUrl(cart, isLoggedIn), ...withErrors(errors)};
}

/** The logged-in customer's buyer goes under the input's buyer identity. */
async function createCart(
  storefront: CartStorefront,
  customerAccount: CartCustomerAccount,
  input: CartInput,
): Promise<CartQueryDataReturn> {
  const {buyerIdentity, ...rest} = input;
  const buyer = await customerAccount.getBuyer();
  const {cartCreate, errors} = await storefront.mutate(CART_CREATE_MUTATION, {
    variables: {input: {...rest, buyerIdentity: {...buyer, ...buyerIdentity}}},
  });
  return toCartResult(cartCreate, errors);
}

async function addCartLines(
  storefront: CartStorefront,
  cartId: string,
  lines: CartLineInput[],
): Promise<CartQueryDataReturn> {
  const {cartLinesAdd, errors} = await storefront.mutate(
    CART_LINES_ADD_MUTATION,
    {variables: {cartId, lines}},
  );
  return toCartResult(cartLinesAdd, errors);
}

async function updateCartLines(
  storefront: CartStorefront,
  cartId: string,
  lines: CartLineUpdateInput[],
): Promise<CartQueryDataReturn> {
  assertNoOptimisticLines(
    'updateLines',
    lines.map((line) => line.id),
  );
  const {cartLinesUpdate, errors} = await storefront.mutate(
    CART_LINES_UPDATE_MUTATION,
    {variables: {cartId, lines}},
  );
  return toCartResult(cartLinesUpdate, errors);
}

async function removeCartLines(
  storefront: CartStorefront,
  cartId: string,
  lineIds: string[],
): Promise<CartQueryDataReturn> {
  assertNoOptimisticLines('removeLines', lineIds);
  const {cartLinesRemove, errors} = await storefront.mutate(
    CART_LINES_REMOVE_MUTATION,
    {variables: {cartId, lineIds}},
  );
  return toCartResult(cartLinesRemove, errors);
}

async function updateCartDiscountCodes(
  storefront: CartStorefront,
  cartId: string,
  discountCodes: string[],
): Promise<CartQueryDataReturn> {
  const {cartDiscountCodesUpdate, errors} = await storefront.mutate(
    CART_DISCOUNT_CODES_UPDATE_MUTATION,
    {variables: {cartId, discountCodes}},
  );
  return toCartResult(cartDiscountCodesUpdate, errors);
}

async function addCartGiftCardCodes(
  storefront: CartStorefront,
  cartId: string,
  giftCardCodes: string[],
): Promise<CartQueryDataReturn> {
  const {cartGiftCardCodesAdd, errors} = await storefront.mutate(
    CART_GIFT_CARD_CODES_ADD_MUTATION,
    {variables: {cartId, giftCardCodes}},
  );
  return toCartResult(cartGiftCardCodesAdd, errors);
}

async function removeCartGiftCardCodes(
  storefront: CartStorefront,
  cartId: string,
  appliedGiftCardIds: string[],
): Promise<CartQueryDataReturn> {
  const {cartGiftCardCodesRemove, errors} = await storefront.mutate(
    CART_GIFT_CARD_CODES_REMOVE_MUTATION,
    {variables: {cartId, appliedGiftCardIds}},
  );
  return toCartResult(cartGiftCardCodesRemove, errors);
}

/** The input's buyer identity goes over the logged-in customer's buyer. */
async function updateCartBuyerIdentity(
  storefront: CartStorefront,
  customerAccount: CartCustomerAccount,
  cartId: string,
  buyerIdentity: CartBuyerIdentityInput,
): Promise<CartQueryDataReturn> {
  const buyer = await customerAccount.getBuyer();
  const {cartBuyerIdentityUpdate, errors} = await storefront.mutate(
    CART_BUYER_IDENTITY_UPDATE_MUTATION,
    {variables: {cartId, buyerIdentity: {...buyer, ...buyerIdentity}}},
  );
  return toCartResult(cartBuyerIdentityUpdate, errors);
}

/** Only the line fields the Storefront API accepts (no `selectedVariant`). */
function toCartLineInput(line: OptimisticCartLineInput): CartLineInput {
  return {
    attributes: line.attributes,
    quantity: line.quantity,
    merchandiseId: line.merchandiseId,
    sellingPlanId: line.sellingPlanId,
    parent: line.parent,
  };
}

/**
 * Optimistic lines do not exist in the Storefront API yet; the UI keeps their
 * controls disabled until the server answers, so one here is a bug. An id that
 * is not a string is no optimistic id: the Storefront API refuses it.
 */
function assertNoOptimisticLines(
  method: 'updateLines' | 'removeLines',
  lineIds: string[],
): void {
  if (lineIds.some(isOptimisticLineId)) {
    throw new Error(
      `Tried to perform an action on an optimistic line. Make sure to disable your "${method}" CartForm action when the line is optimistic.`,
    );
  }
}

/**
 * Hydrogen's result shape: the payload, plus `errors` when there are some.
 * `cart` is null (not missing) when the API sent no payload at all.
 */
function toCartResult(
  payload: CartMutationPayload,
  errors: StorefrontApiError[] | undefined,
): CartQueryDataReturn {
  return {...payload, cart: payload?.cart ?? null, ...withErrors(errors)};
}

function withErrors(errors: StorefrontApiError[] | undefined): {
  errors?: StorefrontApiError[];
} {
  return errors ? {errors} : {};
}

/**
 * A logged-in customer's checkout URL carries `logged_in=true`. Like Hydrogen,
 * only a string `checkoutUrl` is rewritten (a cart fragment may leave it out);
 * any other cart is returned as it is. Never modifies the cart.
 */
function withLoggedInCheckoutUrl<TCart extends {checkoutUrl: string}>(
  cart: TCart,
  isLoggedIn: boolean,
): TCart {
  if (!isLoggedIn || typeof cart.checkoutUrl !== 'string') return cart;
  return {...cart, checkoutUrl: withLoggedInFlag(cart.checkoutUrl)};
}

function withLoggedInFlag(checkoutUrl: string): string {
  const url = new URL(checkoutUrl);
  url.searchParams.set(LOGGED_IN_PARAM, 'true');
  return url.toString();
}

function cartIdCookieHeaders(cartId: string, secure: boolean): Headers {
  const headers = new Headers();
  headers.append('Set-Cookie', serializeCartIdCookie(cartId, {secure}));
  return headers;
}
