import {useLoaderData, data, type HeadersFunction} from 'react-router';
import type {Route} from './+types/cart';
import type {
  CartBuyerIdentityInput,
  CartLineInput,
  CartLineUpdateInput,
} from '@shopify/hydrogen-react/storefront-api-types';
import {CartMain, formatItemCount} from '~/components/CartMain';
import {CartForm} from '~/lib/cart/CartForm';
import {isOptimisticLineId} from '~/lib/cart/optimistic';
import type {CartQueryDataReturn} from '~/lib/cart/types';
import {useOptimisticCart} from '~/lib/cart/useOptimisticCart';
import {STOREFRONT_API_ERROR_STATUS} from '~/lib/storefront-errors';
import {safeRedirectPath} from '~/lib/urls';

export const meta: Route.MetaFunction = () => {
  return [{title: 'Cart | {AppName}'}, {name: 'robots', content: 'noindex'}];
};

export const headers: HeadersFunction = ({actionHeaders}) => actionHeaders;

const CART_UNAVAILABLE_MESSAGE =
  'We couldn’t update your cart right now. Please try again.';
const CART_INVALID_MESSAGE =
  'That cart request wasn’t understood. Please refresh the page and try again.';

/** The body is attacker-controlled: malformed input is a 400, never a crash. */
/**
 * A real cart POST is a few kilobytes. Anything far larger is refused before
 * the body is read; parsing it is linear but not free, and nothing legitimate
 * sends it.
 */
const MAX_CART_BODY_BYTES = 64 * 1024;

function invalidCartRequest(
  status = 400,
  message: string = CART_INVALID_MESSAGE,
) {
  return data(
    {
      cart: null,
      errors: [{message}],
      userErrors: [],
      warnings: [],
      analytics: {cartId: undefined},
    },
    {status},
  );
}

type PlainRecord = Record<string, unknown>;

function isPlainRecord(value: unknown): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A real line id: a string that is not a pending optimistic id. */
function isLineId(value: unknown): value is string {
  return typeof value === 'string' && !isOptimisticLineId(value);
}

/** Line ids the cart service can use: a list of real line ids. */
function isLineIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isLineId);
}

/**
 * Lines the cart service can read: a list of objects that each hold a string
 * under `idKey` (`merchandiseId` to add a line, `id` to update one). Shopify
 * validates the rest of each line.
 */
function isLineList(
  value: unknown,
  idKey: 'id' | 'merchandiseId',
): value is PlainRecord[] {
  return (
    Array.isArray(value) &&
    value.every(
      (line) =>
        isPlainRecord(line) &&
        (idKey === 'id' ? isLineId(line.id) : typeof line[idKey] === 'string'),
    )
  );
}

export async function action({request, context}: Route.ActionArgs) {
  const {cart} = context;

  if (
    Number(request.headers.get('content-length') ?? 0) > MAX_CART_BODY_BYTES
  ) {
    return invalidCartRequest(413, 'That request was too large.');
  }

  let formData: FormData;
  let action: ReturnType<typeof CartForm.getFormInput>['action'];
  let inputs: ReturnType<typeof CartForm.getFormInput>['inputs'];
  try {
    formData = await request.formData();
    ({action, inputs} = CartForm.getFormInput(formData));
  } catch {
    return invalidCartRequest();
  }

  if (!action) return invalidCartRequest();

  let status = 200;
  let result: CartQueryDataReturn;

  try {
    switch (action) {
      case CartForm.ACTIONS.LinesAdd:
        if (!isLineList(inputs.lines, 'merchandiseId')) {
          return invalidCartRequest();
        }
        result = await cart.addLines(inputs.lines as CartLineInput[]);
        break;
      case CartForm.ACTIONS.LinesUpdate:
        if (!isLineList(inputs.lines, 'id')) return invalidCartRequest();
        result = await cart.updateLines(inputs.lines as CartLineUpdateInput[]);
        break;
      case CartForm.ACTIONS.LinesRemove:
        if (!isLineIdList(inputs.lineIds)) return invalidCartRequest();
        result = await cart.removeLines(inputs.lineIds);
        break;
      case CartForm.ACTIONS.DiscountCodesUpdate: {
        const formDiscountCode = inputs.discountCode;

        // User inputted discount code
        const discountCodes = (
          formDiscountCode ? [formDiscountCode] : []
        ) as string[];

        // Combine discount codes already applied on cart
        if (Array.isArray(inputs.discountCodes)) {
          discountCodes.push(...(inputs.discountCodes as string[]));
        }

        result = await cart.updateDiscountCodes(discountCodes);
        break;
      }
      case CartForm.ACTIONS.GiftCardCodesAdd: {
        const formGiftCardCode = inputs.giftCardCode;

        const giftCardCodes = (
          formGiftCardCode ? [formGiftCardCode] : []
        ) as string[];

        result = await cart.addGiftCardCodes(giftCardCodes);
        break;
      }
      case CartForm.ACTIONS.GiftCardCodesRemove: {
        if (!Array.isArray(inputs.giftCardCodes)) return invalidCartRequest();
        result = await cart.removeGiftCardCodes(
          inputs.giftCardCodes as string[],
        );
        break;
      }
      case CartForm.ACTIONS.BuyerIdentityUpdate: {
        result = await cart.updateBuyerIdentity({
          ...(inputs.buyerIdentity as CartBuyerIdentityInput),
        });
        break;
      }
      default:
        return invalidCartRequest();
    }
  } catch (error) {
    // The storefront client rejects with a 502 when the API answers with GraphQL
    // errors and no data (app/lib/storefront-errors.ts). The cart UI shows
    // `errors` inline (AddToCartButton, CartSummary), so report the failure as
    // data instead of replacing the page with an error view. The API's own
    // messages were logged by the guard and are not sent to the browser.
    if (
      error instanceof Response &&
      error.status === STOREFRONT_API_ERROR_STATUS
    ) {
      return data(
        {
          cart: null,
          errors: [{message: CART_UNAVAILABLE_MESSAGE}],
          userErrors: [],
          warnings: [],
          analytics: {cartId: undefined},
        },
        {status: error.status},
      );
    }
    throw error;
  }

  const cartId = result?.cart?.id;
  const headers = cartId ? cart.setCartId(cartId) : new Headers();
  const {cart: cartResult, errors: apiErrors, userErrors, warnings} = result;

  // GraphQL errors returned next to partial data carry the API's own text
  // (request ids, echoed variables): record that they happened and show the
  // fixed message instead.
  if (apiErrors?.length) {
    console.error(`[cart] ${action} returned ${apiErrors.length} API error(s)`);
  }
  const errors = apiErrors?.length
    ? [{message: CART_UNAVAILABLE_MESSAGE}]
    : apiErrors;

  // `redirectTo` is a form field, so it is attacker-controlled: only a
  // same-origin path is followed, anything else lands on `/`.
  const redirectTo = formData.get('redirectTo');
  if (typeof redirectTo === 'string' && redirectTo) {
    status = 303;
    headers.set(
      'Location',
      safeRedirectPath(redirectTo, new URL(request.url).origin),
    );
  }

  return data(
    {
      cart: cartResult,
      errors,
      userErrors,
      warnings,
      analytics: {
        cartId,
      },
    },
    {status, headers},
  );
}

/**
 * What the cart UI receives from the action through a fetcher (CartSummary,
 * AddToCartButton). Derived from the action itself, so a change to its result
 * is a type error in the components that read it.
 */
export type CartActionData = Route.ComponentProps['actionData'];

export async function loader({context}: Route.LoaderArgs) {
  const {cart} = context;
  return await cart.get();
}

export default function Cart() {
  const originalCart = useLoaderData<typeof loader>();
  const cart = useOptimisticCart(originalCart);
  const count = cart?.totalQuantity ?? 0;

  return (
    <div className="container cart-page">
      <header className="page-header cart-page__header">
        <p className="eyebrow page-header__eyebrow">{'{AppName}'}</p>
        <h1>
          Your cart
          {count > 0 ? (
            <span className="cart-page__count"> {formatItemCount(count)}</span>
          ) : null}
        </h1>
      </header>
      <CartMain layout="page" cart={originalCart} />
    </div>
  );
}
