import {useLoaderData, data, type HeadersFunction} from 'react-router';
import type {Route} from './+types/cart';
import type {CartQueryDataReturn} from '@shopify/hydrogen';
import type {
  CartBuyerIdentityInput,
  CartLineInput,
  CartLineUpdateInput,
} from '@shopify/hydrogen/storefront-api-types';
import {CartForm, useOptimisticCart} from '@shopify/hydrogen';
import {CartMain, formatItemCount} from '~/components/CartMain';
import {STOREFRONT_API_ERROR_STATUS} from '~/lib/storefront-errors';
import {safeRedirectPath} from '~/lib/urls';

export const meta: Route.MetaFunction = () => {
  return [{title: 'Cart | Mellow'}, {name: 'robots', content: 'noindex'}];
};

export const headers: HeadersFunction = ({actionHeaders}) => actionHeaders;

const CART_UNAVAILABLE_MESSAGE =
  'We couldn’t update your cart right now. Please try again.';
const CART_INVALID_MESSAGE =
  'That cart request wasn’t understood. Please refresh the page and try again.';

/** The body is attacker-controlled: malformed input is a 400, never a crash. */
function invalidCartRequest() {
  return data(
    {
      cart: null,
      errors: [{message: CART_INVALID_MESSAGE}],
      userErrors: [],
      warnings: [],
      analytics: {cartId: undefined},
    },
    {status: 400},
  );
}

export async function action({request, context}: Route.ActionArgs) {
  const {cart} = context;

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
        if (!Array.isArray(inputs.lines)) return invalidCartRequest();
        result = await cart.addLines(inputs.lines as CartLineInput[]);
        break;
      case CartForm.ACTIONS.LinesUpdate:
        if (!Array.isArray(inputs.lines)) return invalidCartRequest();
        result = await cart.updateLines(inputs.lines as CartLineUpdateInput[]);
        break;
      case CartForm.ACTIONS.LinesRemove:
        if (!Array.isArray(inputs.lineIds)) return invalidCartRequest();
        result = await cart.removeLines(inputs.lineIds as string[]);
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
  const headers = cartId ? cart.setCartId(result.cart.id) : new Headers();
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
        <p className="eyebrow page-header__eyebrow">Mellow</p>
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
