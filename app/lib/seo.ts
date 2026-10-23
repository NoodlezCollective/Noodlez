/**
 * SEO helpers shared by the content routes (`meta` exports) and the sitemap.
 */

export const SITE_NAME = 'Mellow';

type CanonicalLink = {tagName: 'link'; rel: 'canonical'; href: string};

/**
 * `<link rel="canonical">` descriptor for a route's `meta` export. The URL is
 * always absolute (search engines ignore relative canonicals) and
 * percent-encoded like the sitemap URLs. Pass the request origin that the
 * loader returned, e.g. `canonicalLink(data.origin, '/policies')`.
 */
export function canonicalLink(origin: string, path: string): CanonicalLink {
  let href: string;
  try {
    // Set the pathname on the origin rather than resolving `path` against it:
    // resolution would let `//host` switch hosts and would read `?` / `#`.
    const url = new URL(origin);
    url.pathname = path;
    url.search = '';
    url.hash = '';
    href = url.href;
  } catch {
    // `meta` runs during render: a bad origin must not turn into a 500.
    href = `${origin}${path}`;
  }
  return {tagName: 'link', rel: 'canonical', href};
}

/**
 * Meta for a page whose resource does not exist: a "not found" title instead
 * of the site-wide one, and `noindex` so the 404 is never indexed.
 *
 * @example notFoundMeta('Page') // "Page not found | Mellow"
 */
export function notFoundMeta(subject: string) {
  return [
    {title: `${subject} not found | ${SITE_NAME}`},
    {name: 'robots', content: 'noindex'},
  ];
}

/**
 * Resource types advertised in the sitemap index. Every type maps to a route
 * the app serves (see `sitemapPath`); metaobject sitemaps are left out
 * because the storefront has no metaobject pages.
 */
export const SITEMAP_TYPES = [
  'products',
  'collections',
  'pages',
  'blogs',
  'articles',
] as const;

export type SitemapType = (typeof SITEMAP_TYPES)[number];

export function isSitemapType(value: string | undefined): value is SitemapType {
  // `some` instead of a keyed lookup: `constructor` / `__proto__` are not types.
  return SITEMAP_TYPES.some((type) => type === value);
}

/** Sitemap pages are 1-based integers; real stores stay far below 1,000,000. */
export function isSitemapPage(value: string | undefined): value is string {
  return /^[1-9]\d{0,5}$/.test(value ?? '');
}

const SITEMAP_PATH_PREFIX: Record<SitemapType, string> = {
  products: '/products',
  collections: '/collections',
  pages: '/pages',
  blogs: '/blogs',
  // Article sitemap handles are "<blog-handle>/<article-handle>".
  articles: '/blogs',
};

/**
 * Path of the storefront route that serves a sitemap entry. Hydrogen's stock
 * `/${type}/${handle}` yields `/articles/<blog>/<article>`, which does not
 * exist: articles live at `/blogs/<blog>/<article>`.
 *
 * Handles are percent-encoded segment by segment because Hydrogen writes the
 * URL into the sitemap XML verbatim.
 */
export function sitemapPath(type: string, handle: string | undefined): string {
  if (!isSitemapType(type) || !handle) return '/';
  // Without a blog handle there is no article URL to build: point at the index.
  if (type === 'articles' && !handle.includes('/')) return '/blogs';
  const encoded = handle.split('/').map(encodeURIComponent).join('/');
  return `${SITEMAP_PATH_PREFIX[type]}/${encoded}`;
}
