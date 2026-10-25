import type {Storefront} from '~/lib/storefront/client.server';

/**
 * Sitemap index and child sitemaps, ported from Hydrogen 2026.4.7's
 * `getSitemapIndex` and `getSitemap` (its src/sitemap/sitemap.ts, bundled in
 * the package's development build). The XML templates, queries, defaults,
 * headers and 404s are Hydrogen's, so the output does not change by a byte.
 * Differences: a type is looked up only among its own keys (`constructor` or
 * `__proto__` are unknown types, a 404), a type without a page count fails
 * like a missing type, and messages use the `[sitemap]` prefix. TypeScript
 * replaces Hydrogen's runtime checks for missing arguments.
 */

export type SitemapType =
  'products' | 'collections' | 'pages' | 'blogs' | 'articles' | 'metaObjects';

type SitemapStorefront = Pick<Storefront, 'query'>;

/** What `getLink` receives; `locale` is set only for alternate links. */
type SitemapLinkOptions = {
  type: string;
  baseUrl: string;
  handle?: string;
  locale?: string;
};

type SitemapIndexOptions = {
  storefront: SitemapStorefront;
  request: Request;
  /** Defaults to every type, metaobjects included (Hydrogen's default). */
  types?: ReadonlyArray<SitemapType>;
  /** Extra child sitemaps, as paths on the request origin. */
  customChildSitemaps?: ReadonlyArray<string>;
};

type SitemapOptions = {
  storefront: SitemapStorefront;
  request: Request;
  /** The route params, as they come from the URL. */
  params: {type?: string; page?: string};
  /** Builds the URL of every entry and, with `locale`, of its alternates. */
  getLink: (options: SitemapLinkOptions) => string;
  /** Locales to write `xhtml:link` alternates for. */
  locales?: ReadonlyArray<string>;
  /** Defaults to `weekly` for every entry. */
  getChangeFreq?: (options: {type: string; handle: string}) => string;
  /** The single entry of an empty sitemap; defaults to the home page. */
  noItemsFallback?: string;
};

type SitemapIndexData = Partial<
  Record<SitemapType, {pagesCount?: {count?: number} | null} | null>
>;

type SitemapItem = {handle: string; updatedAt: string; type?: string};

type SitemapPageData = {
  sitemap?: {resources?: {items?: SitemapItem[] | null} | null} | null;
};

/** What every entry of one child sitemap shares. */
type UrlTagContext = {
  type: string;
  baseUrl: string;
  getLink: SitemapOptions['getLink'];
  locales: ReadonlyArray<string>;
  getChangeFreq: SitemapOptions['getChangeFreq'];
};

const DEFAULT_INDEX_TYPES: ReadonlyArray<SitemapType> = [
  'products',
  'pages',
  'collections',
  'metaObjects',
  'articles',
  'blogs',
];
const DEFAULT_CHANGE_FREQ = 'weekly';
const DEFAULT_NO_ITEMS_FALLBACK = '/';
const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
const XML_HEADERS = {
  'Content-Type': 'application/xml',
  'Cache-Control': `max-age=${ONE_DAY_IN_SECONDS}`,
};

// Hydrogen's templates, verbatim (blank lines and all).
const SITEMAP_INDEX_PREFIX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
const SITEMAP_INDEX_SUFFIX = `
</sitemapindex>`;
const SITEMAP_PREFIX = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`;
const SITEMAP_SUFFIX = `</urlset>`;

// Hydrogen's queries, verbatim.
const PRODUCT_SITEMAP_QUERY = `#graphql
    query SitemapProducts($page: Int!) {
      sitemap(type: PRODUCT) {
        resources(page: $page) {
          items {
            handle
            updatedAt
          }
        }
      }
    }
`;
const COLLECTION_SITEMAP_QUERY = `#graphql
    query SitemapCollections($page: Int!) {
      sitemap(type: COLLECTION) {
        resources(page: $page) {
          items {
            handle
            updatedAt
          }
        }
      }
    }
`;
const ARTICLE_SITEMAP_QUERY = `#graphql
    query SitemapArticles($page: Int!) {
      sitemap(type: ARTICLE) {
        resources(page: $page) {
          items {
            handle
            updatedAt
          }
        }
      }
    }
`;
const PAGE_SITEMAP_QUERY = `#graphql
    query SitemapPages($page: Int!) {
      sitemap(type: PAGE) {
        resources(page: $page) {
          items {
            handle
            updatedAt
          }
        }
      }
    }
`;
const BLOG_SITEMAP_QUERY = `#graphql
    query SitemapBlogs($page: Int!) {
      sitemap(type: BLOG) {
        resources(page: $page) {
          items {
            handle
            updatedAt
          }
        }
      }
    }
`;
const METAOBJECT_SITEMAP_QUERY = `#graphql
    query SitemapMetaobjects($page: Int!) {
      sitemap(type: METAOBJECT) {
        resources(page: $page) {
          items {
            handle
            updatedAt
            ... on SitemapResourceMetaobject {
              type
            }
          }
        }
      }
    }
`;
const SITEMAP_INDEX_QUERY = `#graphql
query SitemapIndex {
  products: sitemap(type: PRODUCT) {
    pagesCount {
      count
    }
  }
  collections: sitemap(type: COLLECTION) {
    pagesCount {
      count
    }
  }
  articles: sitemap(type: ARTICLE) {
    pagesCount {
      count
    }
  }
  pages: sitemap(type: PAGE) {
    pagesCount {
      count
    }
  }
  blogs: sitemap(type: BLOG) {
    pagesCount {
      count
    }
  }
  metaObjects: sitemap(type: METAOBJECT) {
    pagesCount {
      count
    }
  }
}
`;

const SITEMAP_QUERIES: Readonly<Record<SitemapType, string>> = {
  products: PRODUCT_SITEMAP_QUERY,
  articles: ARTICLE_SITEMAP_QUERY,
  collections: COLLECTION_SITEMAP_QUERY,
  pages: PAGE_SITEMAP_QUERY,
  blogs: BLOG_SITEMAP_QUERY,
  metaObjects: METAOBJECT_SITEMAP_QUERY,
};

/**
 * The sitemap index: one `<sitemap>` per page of every requested type, then
 * the custom child sitemaps. Throws a 404 `Response` when the Storefront API
 * returns nothing; rejects when a requested type is missing from its answer.
 */
export async function getSitemapIndex(
  options: SitemapIndexOptions,
): Promise<Response> {
  const {
    storefront,
    request,
    types = DEFAULT_INDEX_TYPES,
    customChildSitemaps = [],
  } = options;

  const data = await storefront.query<SitemapIndexData | null>(
    SITEMAP_INDEX_QUERY,
  );
  if (!data) {
    console.warn('[sitemap] The Storefront API returned no sitemap index');
    throw new Response('Sitemap index not found.', {status: 404});
  }

  const baseUrl = new URL(request.url).origin;
  const body =
    SITEMAP_INDEX_PREFIX +
    types
      .map((type) =>
        renderSitemapLinks(type, readPagesCount(data, type), baseUrl),
      )
      .join('\n') +
    customChildSitemaps
      .map((url) => renderCustomSitemapLink(url, baseUrl))
      .join('\n') +
    SITEMAP_INDEX_SUFFIX;

  return xmlResponse(body);
}

/**
 * One page of a type's sitemap. Throws a 404 `Response` for a missing type or
 * page, an unknown type (before any API call) or an empty API answer. A page
 * without items lists `noItemsFallback` so search consoles see no error.
 */
export async function getSitemap(options: SitemapOptions): Promise<Response> {
  const {
    storefront,
    request,
    params,
    getLink,
    locales = [],
    getChangeFreq,
    noItemsFallback = DEFAULT_NO_ITEMS_FALLBACK,
  } = options;

  if (!params.type || !params.page) {
    throw new Response('No data found', {status: 404});
  }
  const {type} = params;
  if (!hasSitemapQuery(type)) throw new Response('Not found', {status: 404});

  const data = await storefront.query<SitemapPageData | null>(
    SITEMAP_QUERIES[type],
    {variables: {page: parseInt(params.page, 10)}},
  );
  if (!data) {
    console.warn(`[sitemap] The Storefront API returned no ${type} sitemap`);
    throw new Response('Sitemap not found.', {status: 404});
  }

  const baseUrl = new URL(request.url).origin;
  const items = data.sitemap?.resources?.items;
  return xmlResponse(
    items?.length
      ? renderUrlSet(items, {type, baseUrl, getLink, locales, getChangeFreq})
      : renderFallbackUrlSet(baseUrl + noItemsFallback),
  );
}

/** Own keys only: `constructor` or `__proto__` are not sitemap types. */
function hasSitemapQuery(type: string): type is SitemapType {
  return Object.hasOwn(SITEMAP_QUERIES, type);
}

function readPagesCount(data: SitemapIndexData, type: SitemapType): number {
  const count = data[type]?.pagesCount?.count;
  if (typeof count !== 'number') {
    throw new Error(
      `[sitemap] No data found for type ${type}. Check types passed to \`getSitemapIndex\``,
    );
  }
  return count;
}

function renderSitemapLinks(
  type: SitemapType,
  count: number,
  baseUrl: string,
): string {
  return Array.from(
    {length: count},
    (_, index) =>
      `  <sitemap><loc>${baseUrl}/sitemap/${type}/${index + 1}.xml</loc></sitemap>
`,
  ).join('');
}

function renderCustomSitemapLink(url: string, baseUrl: string): string {
  const path = url.startsWith('/') ? url : '/' + url;
  return '  <sitemap><loc>' + baseUrl + path + '</loc></sitemap>';
}

function renderUrlSet(
  items: ReadonlyArray<SitemapItem>,
  context: UrlTagContext,
): string {
  return (
    SITEMAP_PREFIX +
    items.map((item) => renderUrlTag(item, context)).join('\n') +
    SITEMAP_SUFFIX
  );
}

/** A sitemap without items lists one URL, so search consoles see no error. */
function renderFallbackUrlSet(url: string): string {
  const entry = `
  <url><loc>${url}</loc></url>
`;
  return SITEMAP_PREFIX + entry + SITEMAP_SUFFIX;
}

/**
 * Hydrogen's `renderUrlTag`: `getLink` for the entry, then `getChangeFreq`,
 * then `getLink` once per locale. Without locales the line between
 * `</changefreq>` and `</url>` stays empty, as in Hydrogen's output.
 */
function renderUrlTag(
  item: SitemapItem,
  {type, baseUrl, getLink, locales, getChangeFreq}: UrlTagContext,
): string {
  const {handle, updatedAt} = item;
  const entryType = item.type ?? type;
  const url = getLink({type: entryType, baseUrl, handle});
  const changeFreq = getChangeFreq
    ? getChangeFreq({type: entryType, handle})
    : DEFAULT_CHANGE_FREQ;
  const alternates = locales
    .map((locale) =>
      renderAlternateTag(
        getLink({type: entryType, baseUrl, handle, locale}),
        locale,
      ),
    )
    .join('\n');

  return `<url>
  <loc>${url}</loc>
  <lastmod>${updatedAt}</lastmod>
  <changefreq>${changeFreq}</changefreq>
${alternates}
</url>
  `.trim();
}

function renderAlternateTag(url: string, locale: string): string {
  return `  <xhtml:link rel="alternate" hreflang="${locale}" href="${url}" />`;
}

function xmlResponse(body: string): Response {
  return new Response(body, {headers: XML_HEADERS});
}
