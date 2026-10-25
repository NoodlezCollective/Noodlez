import {describe, expect, it} from 'vitest';
import {
  FALLBACK_FOOTER_MENU,
  FALLBACK_HEADER_MENU,
  isExternalUrl,
  normalizeMenuUrl,
} from './menu';
import {safeHref} from './urls';

const STORE_DOMAIN = 'mellow.myshopify.com';
const PRIMARY_URL = 'https://mellow.example';

const normalize = (url: string) =>
  normalizeMenuUrl(url, STORE_DOMAIN, PRIMARY_URL);

describe('normalizeMenuUrl', () => {
  describe('internal links', () => {
    it.each([
      ['/collections/all', '/collections/all'],
      ['/', '/'],
      ['/pages/about?ref=nav#team', '/pages/about?ref=nav#team'],
    ])('keeps the relative path %s', (url, expected) => {
      expect(normalize(url)).toBe(expected);
    });

    it('rewrites a store-domain URL to a relative path', () => {
      expect(
        normalize('https://mellow.myshopify.com/collections/bath?sort=1#top'),
      ).toBe('/collections/bath?sort=1#top');
    });

    it('rewrites a primary-domain URL to a relative path', () => {
      expect(normalize('https://mellow.example/pages/about')).toBe(
        '/pages/about',
      );
    });

    it('rewrites any myshopify.com URL, as before', () => {
      expect(normalize('https://other-store.myshopify.com/products/x')).toBe(
        '/products/x',
      );
    });

    it('rewrites the bare domain to the root path', () => {
      expect(normalize('https://mellow.example')).toBe('/');
    });

    it('matches the public store domain when it is the only one known', () => {
      expect(
        normalizeMenuUrl(
          'https://shop.custom.example/cart',
          'shop.custom.example',
          '',
        ),
      ).toBe('/cart');
    });

    it('ignores empty store and primary domains', () => {
      expect(normalizeMenuUrl('https://anything.example/page', '', '')).toBe(
        'https://anything.example/page',
      );
    });
  });

  describe('external links', () => {
    it.each([
      'https://instagram.com/mellow',
      'http://example.com/press',
      'https://www.tiktok.com/@mellow?lang=en#x',
    ])('keeps %s as it is', (url) => {
      expect(normalize(url)).toBe(url);
    });

    it.each([
      ['mailto:hello@example.com'],
      ['tel:+15551234567'],
      ['mailto:support@mellow.myshopify.com'],
      ['mailto:hello@mellow.example'],
    ])(
      'keeps the %s link untouched, even when it names the store domain',
      (url) => {
        expect(normalize(url)).toBe(url);
      },
    );
  });

  describe('unsafe schemes (merchant-managed menus)', () => {
    it.each([
      'javascript:alert(1)',
      'JAVASCRIPT:alert(document.cookie)',
      '  javascript:alert(1)',
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'blob:https://mellow.example/uuid',
    ])('never returns the href %j', (url) => {
      const result = normalize(url);

      expect(result).toBe('/');
      expect(result).not.toMatch(/^\s*(javascript|data|vbscript|file|blob):/i);
    });

    it.each([
      "javascript:alert('mellow.myshopify.com')",
      'javascript:fetch("https://mellow.example")',
      'data:text/html,<a href="https://mellow.example">x</a>',
    ])(
      'rejects the script URL %j even though it mentions the store domain',
      (url) => {
        // The domain check alone would have called these "internal".
        expect(normalize(url)).toBe('/');
      },
    );

    it('falls back for a store-domain URL that cannot be parsed', () => {
      expect(normalize('https://mellow.myshopify.com:badport/x')).toBe('/');
    });

    it.each([null, undefined, '', '   '])('falls back for %j', (url) => {
      expect(normalizeMenuUrl(url, STORE_DOMAIN, PRIMARY_URL)).toBe('/');
    });

    it.each([
      'javascript:alert(1)',
      '\u0000javascript:alert(1)',
      'jAvAsCrIpT:alert(1)',
      'data:text/html,hi',
      'https://mellow.myshopify.com/\u0000',
      '//evil.example',
      '',
    ])('returns something safeHref accepts for %j', (url) => {
      const result = normalize(url);

      expect(safeHref(result, 'REJECTED')).toBe(result);
    });
  });

  it('trims padding around an otherwise valid URL', () => {
    expect(normalize('  /collections/all  ')).toBe('/collections/all');
  });
});

describe('isExternalUrl', () => {
  it.each(['https://example.com', 'http://example.com', 'HTTPS://EXAMPLE.COM'])(
    'is true for %s',
    (url) => {
      expect(isExternalUrl(url)).toBe(true);
    },
  );

  it.each(['/collections/all', '#faq', '?page=2', 'collections/all', ''])(
    'is false for %j',
    (url) => {
      expect(isExternalUrl(url)).toBe(false);
    },
  );
});

describe('fallback menus', () => {
  type Item = {id: string; url?: string | null; items?: Item[] | null};
  const flatten = (items: Item[]): Item[] =>
    items.flatMap((item) => [item, ...flatten(item.items ?? [])]);

  const fallbackLinks = [
    ...flatten(FALLBACK_HEADER_MENU.items as Item[]).map(
      (item) => ['header', item.id, item.url] as const,
    ),
    ...flatten(FALLBACK_FOOTER_MENU.items as Item[]).map(
      (item) => ['footer', item.id, item.url] as const,
    ),
  ];

  it('has fallback links to check', () => {
    expect(fallbackLinks.length).toBeGreaterThan(0);
  });

  it.each(fallbackLinks)(
    'the %s menu item %s links to a safe internal path',
    (_menu, _id, url) => {
      expect(url).toMatch(/^\/[a-z]/);
      expect(normalize(url ?? '')).toBe(url);
    },
  );

  it.each([
    ['header', FALLBACK_HEADER_MENU],
    ['footer', FALLBACK_FOOTER_MENU],
  ])('the %s menu has unique item ids', (_name, menu) => {
    const ids = flatten(menu.items as Item[]).map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
