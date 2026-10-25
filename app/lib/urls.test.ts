import {describe, expect, it} from 'vitest';
import {safeHref, safeRedirectPath} from './urls';

const ORIGIN = 'https://shop.example';

/** True when `path` resolves to `origin` (i.e. cannot leave the storefront). */
function staysOnOrigin(path: string, origin = ORIGIN) {
  return new URL(path, origin).origin === origin;
}

describe('safeRedirectPath', () => {
  it('keeps same-origin paths with their query string and hash', () => {
    // Arrange
    const value = '/account/orders?status=open&page=2#latest';

    // Act
    const result = safeRedirectPath(value, ORIGIN);

    // Assert
    expect(result).toBe('/account/orders?status=open&page=2#latest');
  });

  it('keeps the root path', () => {
    expect(safeRedirectPath('/', ORIGIN, '/account')).toBe('/');
  });

  it('resolves a relative path against the origin', () => {
    expect(safeRedirectPath('account/addresses', ORIGIN)).toBe(
      '/account/addresses',
    );
  });

  it('reduces an absolute same-origin URL to its path', () => {
    expect(safeRedirectPath(`${ORIGIN}/cart?x=1`, ORIGIN)).toBe('/cart?x=1');
  });

  it.each([null, undefined, ''])('returns the fallback for %j', (value) => {
    expect(safeRedirectPath(value, ORIGIN)).toBe('/');
    expect(safeRedirectPath(value, ORIGIN, '/account')).toBe('/account');
  });

  it.each([
    ['protocol-relative URL', '//evil.example'],
    ['protocol-relative URL with path', '//evil.example/phish?x=1'],
    ['backslash host', '/\\evil.example'],
    ['double backslash host', '\\\\evil.example'],
    ['absolute https URL', 'https://evil.example/login'],
    ['absolute http URL', 'http://evil.example'],
    ['userinfo trick', 'https://shop.example@evil.example/'],
    ['subdomain look-alike', 'https://shop.example.evil.example/'],
    ['javascript scheme', 'javascript:alert(document.cookie)'],
    ['mixed-case javascript scheme', 'JaVaScRiPt:alert(1)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['scheme without slashes', 'http:evil.example'],
    ['tab inside the leading slashes', '/\t/evil.example'],
    ['newline inside the leading slashes', '/\n/evil.example'],
    ['carriage return inside the leading slashes', '/\r/evil.example'],
    ['leading tab', '\t//evil.example'],
    ['leading space', ' //evil.example'],
    ['leading control characters', '\u0001//evil.example'],
    ['tab inside the scheme', 'java\tscript:alert(1)'],
  ])('falls back for a %s', (_label, value) => {
    // Arrange
    const fallback = '/account';

    // Act
    const result = safeRedirectPath(value, ORIGIN, fallback);

    // Assert
    expect(result).toBe(fallback);
  });

  it('neutralises CRLF header-injection attempts in a same-origin path', () => {
    // Arrange
    const value = '/account\r\nSet-Cookie: session=attacker';

    // Act
    const result = safeRedirectPath(value, ORIGIN);

    // Assert
    expect(result).not.toMatch(/[\r\n\t]/);
    expect(result.startsWith('/')).toBe(true);
    expect(staysOnOrigin(result)).toBe(true);
  });

  it('returns the fallback when the origin itself is not a valid URL', () => {
    expect(safeRedirectPath('/cart', 'not a url', '/safe')).toBe('/safe');
  });

  const HOSTILE = [
    '//evil.example',
    '/\\evil.example',
    'https://evil.example',
    'http:evil.example',
    'javascript:alert(1)',
    '/%2f%2fevil.example',
    '/\t/evil.example',
    '////evil.example',
    '/\\/evil.example',
  ];
  const hostileCases = [ORIGIN, 'http://localhost:3000'].flatMap((origin) =>
    HOSTILE.map((value) => [origin, value] as const),
  );

  it.each(hostileCases)(
    'on %s, %j never resolves outside the origin',
    (origin, value) => {
      // On an http origin `http:evil.example` resolves to a same-origin
      // relative path, so assert the property rather than a fixed string.
      const result = safeRedirectPath(value, origin);

      expect(staysOnOrigin(result, origin)).toBe(true);
    },
  );
});

/**
 * Dot segments are resolved before the origin is compared, so a path such as
 * "/..//evil.example" parses to the same-origin pathname "//evil.example",
 * which a `Location` header or `<a href>` would treat as another host.
 */
describe('safeRedirectPath: dot segments that collapse into "//host"', () => {
  it.each([
    '/..//evil.example',
    '/.//evil.example',
    '/a/..//evil.example',
    '/%2e%2e//evil.example',
    '/..\\/evil.example',
  ])('never returns a protocol-relative path for %j', (value) => {
    const result = safeRedirectPath(value, ORIGIN, '/account');

    expect(result.startsWith('//')).toBe(false);
    expect(staysOnOrigin(result)).toBe(true);
  });
});

describe('safeHref', () => {
  it.each([
    ['/collections/all'],
    ['/'],
    ['/products/pillow?variant=1#reviews'],
    ['#faq'],
    ['?page=2'],
    ['pages/about'],
    ['https://example.com/story'],
    ['http://example.com'],
    ['mailto:hello@example.com'],
    ['tel:+15551234567'],
  ])('keeps %s', (value) => {
    expect(safeHref(value)).toBe(value);
  });

  it('trims surrounding whitespace from a kept value', () => {
    expect(safeHref('  /about  ')).toBe('/about');
  });

  it.each([null, undefined, '', '   '])('falls back for %j', (value) => {
    expect(safeHref(value)).toBe('/');
    expect(safeHref(value, '#')).toBe('#');
  });

  it.each([
    ['javascript scheme', 'javascript:alert(1)'],
    ['upper-case javascript scheme', 'JAVASCRIPT:alert(1)'],
    ['padded javascript scheme', '  javascript:alert(1)'],
    ['javascript scheme split by a newline', 'java\nscript:alert(1)'],
    ['javascript scheme split by a tab', 'java\tscript:alert(1)'],
    [
      'data scheme',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    ],
    ['vbscript scheme', 'vbscript:msgbox(1)'],
    ['file scheme', 'file:///etc/passwd'],
    ['ftp scheme', 'ftp://example.com/file'],
    ['blob scheme', 'blob:https://example.com/uuid'],
  ])('rejects a %s', (_label, value) => {
    expect(safeHref(value, '/fallback')).toBe('/fallback');
  });

  it.each([
    'javascript:alert(1)',
    ' JavaScript:alert(1)',
    'java\r\nscript:alert(1)',
    'data:text/html,hi',
    '\u0000javascript:alert(1)',
  ])('never returns a script-capable scheme for %j', (value) => {
    expect(safeHref(value)).not.toMatch(/^\s*(javascript|data|vbscript):/i);
  });
});
