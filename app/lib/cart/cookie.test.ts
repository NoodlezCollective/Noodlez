import {describe, expect, it} from 'vitest';
import {CART_COOKIE_NAME, readCartId, serializeCartIdCookie} from './cookie';

/**
 * Golden values captured from Hydrogen 2026.4.7's `cartSetIdDefault({httponly:
 * true, samesite: 'Lax', secure})` and `cartGetIdDefault(headers)` (worktop's
 * cookie module), which set and read every cart cookie shoppers hold today.
 * Matching them byte for byte keeps those carts across the switch.
 */
const SET_COOKIE_GOLDEN: ReadonlyArray<[cartId: string, cookie: string]> = [
  ['gid://shopify/Cart/c1-abc', 'cart=c1-abc; Path=/; SameSite=Lax'],
  [
    'gid://shopify/Cart/c1-abc?key=k',
    'cart=c1-abc%3Fkey%3Dk; Path=/; SameSite=Lax',
  ],
  [
    'gid://shopify/Cart/hWN2cGJpY2x1ZHNmYzBkZmtlN2d3?key=3f1a9e0c',
    'cart=hWN2cGJpY2x1ZHNmYzBkZmtlN2d3%3Fkey%3D3f1a9e0c; Path=/; SameSite=Lax',
  ],
  [
    'gid://shopify/Cart/c1 ä;é,"x"',
    'cart=c1%20%C3%A4%3B%C3%A9%2C%22x%22; Path=/; SameSite=Lax',
  ],
  // Only the text after the last `/` is kept, as Hydrogen did.
  ['gid://shopify/Cart/c1?key=a/b', 'cart=b; Path=/; SameSite=Lax'],
  ['c1-bare', 'cart=c1-bare; Path=/; SameSite=Lax'],
  ['', 'cart=; Path=/; SameSite=Lax'],
  ['gid://shopify/Cart/', 'cart=; Path=/; SameSite=Lax'],
  ["gid://shopify/Cart/!'()*~-_.", "cart=!'()*~-_.; Path=/; SameSite=Lax"],
];

const READ_GOLDEN: ReadonlyArray<[header: string, cartId: string | undefined]> =
  [
    ['cart=c1-abc', 'gid://shopify/Cart/c1-abc'],
    ['session=s; cart=c1-abc; _shopify_y=1', 'gid://shopify/Cart/c1-abc'],
    ['cart=c1-abc%3Fkey%3Dk', 'gid://shopify/Cart/c1-abc?key=k'],
    ['cart=c1%20abc', 'gid://shopify/Cart/c1 abc'],
    ['cart=c1%2Fabc', 'gid://shopify/Cart/c1/abc'],
    ['cart=%3Bx', 'gid://shopify/Cart/;x'],
    ['cart="c1-abc"', 'gid://shopify/Cart/c1-abc'],
    ['cart= "c1-abc" ', 'gid://shopify/Cart/c1-abc'],
    ['cart="c1-abc', 'gid://shopify/Cart/c1-ab'],
    ['cart="', 'gid://shopify/Cart/"'],
    ['cart=""', undefined],
    // Quotes are stripped before decoding, so encoded quotes survive.
    ['cart=%22c1-abc%22', 'gid://shopify/Cart/"c1-abc"'],
    [' cart = c1-abc ', 'gid://shopify/Cart/c1-abc'],
    ['path=/; cart=c1-abc', 'gid://shopify/Cart/c1-abc'],
    ['cart=a; Cart=b', 'gid://shopify/Cart/a'],
    ['x=1;\tcart=tab', 'gid://shopify/Cart/tab'],
    ['cart=c1-abc;', 'gid://shopify/Cart/c1-abc'],
    ['cart=c1=abc', 'gid://shopify/Cart/c1=abc'],
    ['cart=a,cart=b', 'gid://shopify/Cart/a,cart=b'],
    ['cart=a; cart=b', 'gid://shopify/Cart/b'],
    ['cart=a;cart=b', 'gid://shopify/Cart/b'],
    ['cart=', undefined],
    ['cart', undefined],
    ['cart; x=1', undefined],
    ['Cart=c1-abc', undefined],
    ['mycart=x; cart_token=y', undefined],
    ['', undefined],
  ];

describe('CART_COOKIE_NAME', () => {
  it("is Hydrogen's cookie name, so existing carts are found", () => {
    expect(CART_COOKIE_NAME).toBe('cart');
  });
});

describe('serializeCartIdCookie', () => {
  it.each(SET_COOKIE_GOLDEN)(
    'serializes %j over https exactly like Hydrogen',
    (cartId, cookie) => {
      expect(serializeCartIdCookie(cartId, {secure: true})).toBe(
        `${cookie}; Secure; HttpOnly`,
      );
    },
  );

  it.each(SET_COOKIE_GOLDEN)(
    'serializes %j over plain http exactly like Hydrogen',
    (cartId, cookie) => {
      expect(serializeCartIdCookie(cartId, {secure: false})).toBe(
        `${cookie}; HttpOnly`,
      );
    },
  );

  it('drops the gid prefix and lists the attributes in the order Hydrogen wrote them', () => {
    // Act
    const cookie = serializeCartIdCookie('gid://shopify/Cart/c1-abc', {
      secure: true,
    });

    // Assert
    expect(cookie).toBe('cart=c1-abc; Path=/; SameSite=Lax; Secure; HttpOnly');
  });

  it('adds Secure only when asked to (requests over https)', () => {
    const cartId = 'gid://shopify/Cart/c1-abc';

    expect(serializeCartIdCookie(cartId, {secure: true})).toMatch(
      /; Secure; HttpOnly$/,
    );
    expect(serializeCartIdCookie(cartId, {secure: false})).not.toContain(
      'Secure',
    );
  });

  it('percent-encodes the cart key so it stays one cookie value', () => {
    expect(
      serializeCartIdCookie('gid://shopify/Cart/c1-abc?key=k', {
        secure: false,
      }),
    ).toBe('cart=c1-abc%3Fkey%3Dk; Path=/; SameSite=Lax; HttpOnly');
  });

  it('never sets Domain, Expires or Max-Age (a host-only session cookie, as before)', () => {
    const cookie = serializeCartIdCookie('gid://shopify/Cart/c1-abc', {
      secure: true,
    });

    expect(cookie).not.toMatch(/Domain|Expires|Max-Age/i);
  });
});

describe('readCartId', () => {
  it.each(READ_GOLDEN)('reads %j exactly like Hydrogen', (header, cartId) => {
    expect(readCartId(header)).toBe(cartId);
  });

  it('reads cart=c1-abc back as the cart gid', () => {
    expect(readCartId('cart=c1-abc')).toBe('gid://shopify/Cart/c1-abc');
  });

  it('is undefined without a Cookie header', () => {
    expect(readCartId(null)).toBeUndefined();
  });

  it.each([
    [
      'a truncated sequence',
      'cart=c1%E0%A4%A',
      'gid://shopify/Cart/c1%E0%A4%A',
    ],
    ['a lone percent sign', 'cart=%', 'gid://shopify/Cart/%'],
    ['non-hex digits', 'cart=c1-abc%zz', 'gid://shopify/Cart/c1-abc%zz'],
  ])(
    'keeps a value with %s as it is instead of throwing',
    (_label, header, cartId) => {
      expect(readCartId(header)).toBe(cartId);
    },
  );

  it.each([
    'gid://shopify/Cart/c1-abc',
    'gid://shopify/Cart/c1-abc?key=k',
    'gid://shopify/Cart/hWN2cGJpY2x1ZHNmYzBkZmtlN2d3?key=3f1a9e0c',
    'gid://shopify/Cart/c1 ä;é,"x"',
    'gid://shopify/Cart/😀%41',
  ])('reads back the id that serializeCartIdCookie wrote for %j', (cartId) => {
    // Arrange: the browser sends back only the name=value pair.
    const [pair] = serializeCartIdCookie(cartId, {secure: true}).split('; ');

    // Act
    const read = readCartId(`session=s; ${pair}`);

    // Assert
    expect(read).toBe(cartId);
  });

  it('finds the cart among thousands of other cookies', () => {
    // Arrange
    const others = Array.from({length: 10_000}, (_, index) => `c${index}=v`);
    const header = [...others.slice(0, 5_000), 'cart=c1-abc', ...others].join(
      '; ',
    );

    // Act
    const cartId = readCartId(header);

    // Assert
    expect(cartId).toBe('gid://shopify/Cart/c1-abc');
  });
});
