/**
 * The cart id cookie, byte-compatible with what Hydrogen's `cartSetIdDefault`
 * and `cartGetIdDefault` (worktop's cookie module) wrote and read, so shoppers
 * keep their carts across the switch to our own cart service. The cookie is
 * only ever read on the server; `HttpOnly` keeps it away from scripts.
 */

export const CART_COOKIE_NAME = 'cart';

/** The cookie stores the id without this prefix; reading adds it back. */
const CART_GID_PREFIX = 'gid://shopify/Cart/';

/** worktop's pair separator: `;` and any whitespace after it. */
const COOKIE_PAIR_SEPARATOR = /;\s*/g;

const COOKIE_ATTRIBUTES = ['Path=/', 'SameSite=Lax'] as const;
const SECURE_ATTRIBUTE = 'Secure';
const HTTP_ONLY_ATTRIBUTE = 'HttpOnly';

/**
 * The cart gid from a `Cookie` request header: `cart=c1-abc` reads back as
 * `gid://shopify/Cart/c1-abc`. Undefined without a (non-empty) cart cookie.
 */
export function readCartId(cookieHeader: string | null): string | undefined {
  const value = readCookieValue(cookieHeader ?? '', CART_COOKIE_NAME);
  return value ? `${CART_GID_PREFIX}${value}` : undefined;
}

/**
 * The `Set-Cookie` value for a cart id: the text after the gid's last `/`,
 * percent-encoded, then `Path=/; SameSite=Lax`, `Secure` when the request came
 * over https, and `HttpOnly`, in the order worktop wrote them.
 */
export function serializeCartIdCookie(
  cartId: string,
  options: {secure: boolean},
): string {
  // Hydrogen's `cartId.split('/').pop()`: everything after the last `/`.
  const value = encodeURIComponent(cartId.slice(cartId.lastIndexOf('/') + 1));
  return [
    `${CART_COOKIE_NAME}=${value}`,
    ...COOKIE_ATTRIBUTES,
    ...(options.secure ? [SECURE_ATTRIBUTE] : []),
    HTTP_ONLY_ATTRIBUTE,
  ].join('; ');
}

/**
 * worktop's `parse`, for one cookie name: names match exactly (trimmed,
 * case-sensitive) and, as in a parsed object, the last matching pair wins.
 */
function readCookieValue(header: string, name: string): string | undefined {
  let value: string | undefined;
  for (const pair of header.split(COOKIE_PAIR_SEPARATOR)) {
    const separator = pair.indexOf('=');
    if (separator !== -1 && pair.substring(0, separator).trim() === name) {
      value = decodeCookieValue(pair.substring(separator + 1).trim());
    }
  }
  return value;
}

/**
 * Strips one pair of surrounding quotes (worktop drops the first and last
 * character whenever the value starts with `"`), then percent-decodes. A
 * malformed sequence keeps the value as it is, exactly like worktop.
 */
function decodeCookieValue(raw: string): string {
  const unquoted = raw.startsWith('"') ? raw.substring(1, raw.length - 1) : raw;
  if (!unquoted.includes('%')) return unquoted;
  try {
    return decodeURIComponent(unquoted);
  } catch {
    return unquoted;
  }
}
