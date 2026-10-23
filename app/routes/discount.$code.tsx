import {redirect} from 'react-router';
import type {Route} from './+types/discount.$code';
import {safeRedirectPath} from '~/lib/urls';

/**
 * Automatically applies a discount found on the url
 * If a cart exists it's updated with the discount, otherwise a cart is created with the discount already applied
 *
 * @example
 * Example path applying a discount and optional redirecting (defaults to the home page)
 * ```js
 * /discount/FREESHIPPING?redirect=/products
 *
 * ```
 */
export async function loader({request, context, params}: Route.LoaderArgs) {
  const {cart} = context;
  const {code} = params;

  const url = new URL(request.url);
  const redirectUrl = buildRedirectUrl(url);

  if (!code) {
    return redirect(redirectUrl);
  }

  const result = await cart.updateDiscountCodes([code]);
  // The cart is null when the API rejects the update with user errors: still
  // send the shopper on their way, just without a cart cookie.
  const headers = result.cart?.id
    ? cart.setCartId(result.cart.id)
    : new Headers();

  // Using set-cookie on a 303 redirect will not work if the domain origin have port number (:3000)
  // If there is no cart id and a new cart id is created in the progress, it will not be set in the cookie
  // on localhost:3000
  return redirect(redirectUrl, {
    status: 303,
    headers,
  });
}

/**
 * Where to send the shopper: the same-origin path in `?redirect=` (or
 * `?return_to=`), otherwise the home page, with the remaining query parameters
 * (utm_*, …) carried over.
 *
 * Both parameters are attacker-controlled, so they are resolved against the
 * request origin instead of being copied: `//host`, `/\host`, `https://host`
 * and `javascript:` all end up at `/`.
 */
function buildRedirectUrl(url: URL): string {
  const {searchParams} = url;
  const requested = safeRedirectPath(
    searchParams.get('redirect') || searchParams.get('return_to'),
    url.origin,
  );
  // `/.//host` parses to the same-origin pathname `//host`, which a browser
  // would read as a protocol-relative URL (and `new URL` below as another
  // origin). No legitimate link looks like that.
  const safePath = requested.startsWith('//') ? '/' : requested;

  const target = new URL(safePath, url.origin);
  for (const [key, value] of searchParams) {
    if (key !== 'redirect' && key !== 'return_to') {
      target.searchParams.append(key, value);
    }
  }

  return `${target.pathname}${target.search}${target.hash}`;
}
