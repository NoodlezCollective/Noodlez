import {describe, expect, it} from 'vitest';
import {
  SITE_NAME,
  SITEMAP_TYPES,
  canonicalLink,
  isSitemapPage,
  isSitemapType,
  notFoundMeta,
  sitemapPath,
} from './seo';

const ORIGIN = 'https://shop.example';

describe('canonicalLink', () => {
  it('returns an absolute canonical link descriptor', () => {
    // Act
    const link = canonicalLink(ORIGIN, '/policies');

    // Assert
    expect(link).toEqual({
      tagName: 'link',
      rel: 'canonical',
      href: 'https://shop.example/policies',
    });
  });

  it('percent-encodes non-ASCII handles so the URL matches the sitemap', () => {
    expect(canonicalLink(ORIGIN, '/blogs/日本語/記事')).toMatchObject({
      href: 'https://shop.example/blogs/%E6%97%A5%E6%9C%AC%E8%AA%9E/%E8%A8%98%E4%BA%8B',
    });
  });

  it('keeps the root path absolute', () => {
    expect(canonicalLink(ORIGIN, '/')).toMatchObject({
      href: 'https://shop.example/',
    });
  });

  it('ignores a trailing slash on the origin', () => {
    expect(canonicalLink(`${ORIGIN}/`, '/blogs')).toMatchObject({
      href: 'https://shop.example/blogs',
    });
  });

  it('always stays on the given origin, even for a protocol-relative path', () => {
    const {href} = canonicalLink(ORIGIN, '//evil.example/x');
    expect(new URL(href).origin).toBe(ORIGIN);
    expect(
      canonicalLink(ORIGIN, '/\\evil.example').href.startsWith(ORIGIN),
    ).toBe(true);
  });

  it('treats the path as a pathname: ? and # are escaped, not interpreted', () => {
    expect(canonicalLink(ORIGIN, '/blogs/a?b#c').href).toBe(
      'https://shop.example/blogs/a%3Fb%23c',
    );
  });

  it('never throws from a meta function, even for an unusable origin', () => {
    // A throwing `meta` export would turn a cosmetic problem into a 500.
    expect(() => canonicalLink('', '/blogs')).not.toThrow();
    expect(canonicalLink('', '/blogs')).toMatchObject({href: '/blogs'});
  });
});

describe('notFoundMeta', () => {
  it('returns a "not found" title and a noindex robots tag', () => {
    expect(notFoundMeta('Page')).toEqual([
      {title: `Page not found | ${SITE_NAME}`},
      {name: 'robots', content: 'noindex'},
    ]);
  });

  it('uses the subject it is given', () => {
    expect(notFoundMeta('Article')[0]).toEqual({
      title: 'Article not found | {AppName}',
    });
  });
});

describe('isSitemapType', () => {
  it.each([...SITEMAP_TYPES])('accepts %s', (type) => {
    expect(isSitemapType(type)).toBe(true);
  });

  it('does not offer metaobject sitemaps (the app has no such route)', () => {
    expect(isSitemapType('metaObjects')).toBe(false);
  });

  it.each([
    'constructor',
    '__proto__',
    'toString',
    'hasOwnProperty',
    'Products',
    '',
    undefined,
  ])('rejects %j, including Object.prototype members', (type) => {
    expect(isSitemapType(type)).toBe(false);
  });
});

describe('isSitemapPage', () => {
  it.each(['1', '2', '250', '999999'])('accepts %s', (page) => {
    expect(isSitemapPage(page)).toBe(true);
  });

  it.each([
    '0',
    '01',
    '-1',
    '1.5',
    '1e3',
    'abc',
    '',
    ' 1',
    '1000000',
    '99999999999999',
    undefined,
  ])('rejects %j', (page) => {
    expect(isSitemapPage(page)).toBe(false);
  });
});

describe('sitemapPath', () => {
  it.each([
    ['products', 'cloudalign-pillow', '/products/cloudalign-pillow'],
    ['collections', 'pillows', '/collections/pillows'],
    ['pages', 'about', '/pages/about'],
    ['blogs', 'journal', '/blogs/journal'],
  ])('maps %s/%s to a served route', (type, handle, expected) => {
    expect(sitemapPath(type, handle)).toBe(expected);
  });

  it('maps articles to the /blogs/<blog>/<article> route', () => {
    // The Storefront API reports article handles as "<blog>/<article>".
    expect(sitemapPath('articles', 'journal/sleep-better')).toBe(
      '/blogs/journal/sleep-better',
    );
  });

  it('never produces the unserved /articles/... URL', () => {
    expect(sitemapPath('articles', 'journal/sleep-better')).not.toContain(
      '/articles/',
    );
  });

  it('falls back to the journal index for an article handle without a blog', () => {
    expect(sitemapPath('articles', 'orphan')).toBe('/blogs');
  });

  it('percent-encodes every segment so the XML <loc> stays valid', () => {
    expect(sitemapPath('products', 'a&b<c>')).toBe('/products/a%26b%3Cc%3E');
    expect(sitemapPath('articles', 'blog one/post&two')).toBe(
      '/blogs/blog%20one/post%26two',
    );
  });

  it.each(['metaObjects', 'constructor', '__proto__', 'nope', ''])(
    'maps the unserved type %j to the home page',
    (type) => {
      expect(sitemapPath(type, 'whatever')).toBe('/');
    },
  );

  it('maps a missing handle to the home page', () => {
    expect(sitemapPath('products', undefined)).toBe('/');
    expect(sitemapPath('products', '')).toBe('/');
  });
});
