import {redirect} from 'react-router';
import type {Route} from './+types/cart.$lines';
import {isMockStorefrontEnabled} from '~/lib/mock/flag';

/** A hand-written permalink never has this many lines. */
const MAX_LINES = 50;
/** Shopify variant ids are numeric. */
const SHOPIFY_VARIANT_ID = /^\d{1,20}$/;
/** The development mock identifies variants by slug (`cloudalign-pillow-1`). */
const MOCK_VARIANT_ID = /^[a-z0-9-]{1,80}$/;
const QUANTITY = /^[1-9]\d{0,3}$/;

/**
 * Parses `<variant_id>:<quantity>[,<variant_id>:<quantity>…]`. Returns null for
 * anything else, so malformed links never reach the Storefront API (where
 * `quantity: NaN` or a non-numeric variant id is a GraphQL error).
 */
function parseCartLines(lines: string, allowMockIds: boolean) {
  const variantId = allowMockIds ? MOCK_VARIANT_ID : SHOPIFY_VARIANT_ID;
  const parts = lines.split(',');
  if (parts.length > MAX_LINES) return null;

  const parsed: Array<{merchandiseId: string; quantity: number}> = [];
  for (const part of parts) {
    const [id, quantity, ...extra] = part.split(':');
    if (extra.length || !variantId.test(id) || !QUANTITY.test(quantity ?? '')) {
      return null;
    }
    parsed.push({
      merchandiseId: `gid://shopify/ProductVariant/${id}`,
      quantity: Number(quantity),
    });
  }
  return parsed;
}

/**
 * Automatically creates a new cart based on the URL and redirects straight to checkout.
 * Expected URL structure:
 * ```js
 * /cart/<variant_id>:<quantity>
 *
 * ```
 *
 * More than one `<variant_id>:<quantity>` separated by a comma, can be supplied in the URL, for
 * carts with more than one product variant.
 *
 * @example
 * Example path creating a cart with two product variants, different quantities, and a discount code in the querystring:
 * ```js
 * /cart/41007289663544:1,41007289696312:2?discount=HYDROBOARD
 *
 * ```
 */
export async function loader({request, context, params}: Route.LoaderArgs) {
  const {cart, env} = context;
  const {lines} = params;
  if (!lines) return redirect('/cart');

  const linesMap = parseCartLines(lines, isMockStorefrontEnabled(env));
  if (!linesMap) {
    throw new Response('Link may be expired. Try checking the URL.', {
      status: 410,
    });
  }

  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  const discount = searchParams.get('discount');
  const discountArray = discount ? [discount] : [];

  // create a cart
  const result = await cart.create({
    lines: linesMap,
    discountCodes: discountArray,
  });

  const cartResult = result.cart;

  if (result.errors?.length || !cartResult) {
    throw new Response('Link may be expired. Try checking the URL.', {
      status: 410,
    });
  }

  // Update cart id in cookie
  const headers = cart.setCartId(cartResult.id);

  // redirect to checkout
  if (cartResult.checkoutUrl) {
    return redirect(cartResult.checkoutUrl, {headers});
  } else {
    throw new Error('No checkout URL found');
  }
}

export default function Component() {
  return null;
}
