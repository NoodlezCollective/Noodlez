import type {FooterQuery, HeaderQuery} from 'storefrontapi.generated';
import {safeHref} from '~/lib/urls';

export type MenuItemLike = {
  id: string;
  title: string;
  url?: string | null;
  type?: string | null;
  items?: MenuItemLike[] | null;
};

/**
 * Shopify menu items carry absolute URLs on the store domain. Internal links
 * are converted to relative paths so React Router handles navigation.
 *
 * Menus are merchant-managed content, so the result always goes through
 * `safeHref`: a `javascript:` or `data:` URL entered in the admin comes out
 * as `/` and can never become an `href`.
 */
export function normalizeMenuUrl(
  url: string | null | undefined,
  publicStoreDomain: string,
  primaryDomainUrl: string,
): string {
  const href = url?.trim();
  if (!href) return '/';
  const isInternal =
    href.startsWith('/') ||
    href.includes('myshopify.com') ||
    (publicStoreDomain && href.includes(publicStoreDomain)) ||
    (primaryDomainUrl && href.includes(primaryDomainUrl));
  if (!isInternal || href.startsWith('/')) return safeHref(href);
  try {
    const parsed = new URL(href);
    // Only web URLs become relative paths; "mailto:help@store.myshopify.com"
    // and friends are not pages of this storefront.
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return safeHref(`${parsed.pathname}${parsed.search}${parsed.hash}`);
    }
  } catch {
    // Not an absolute URL: `safeHref` below decides what to do with it.
  }
  return safeHref(href);
}

export function isExternalUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

/** Navigation used until a `main-menu` menu exists in Shopify. */
export const FALLBACK_HEADER_MENU: NonNullable<HeaderQuery['menu']> = {
  id: 'gid://shopify/Menu/fallback-header',
  items: [
    {
      id: 'fallback-shop',
      resourceId: null,
      tags: [],
      title: 'Shop',
      type: 'HTTP',
      url: '/collections/all',
      items: [],
    },
    {
      id: 'fallback-bath',
      resourceId: null,
      tags: [],
      title: 'Bath',
      type: 'HTTP',
      url: '/collections/bath',
      items: [],
    },
    {
      id: 'fallback-bundles',
      resourceId: null,
      tags: [],
      title: 'Bundles',
      type: 'HTTP',
      url: '/collections/bundles',
      items: [],
    },
    {
      id: 'fallback-about',
      resourceId: null,
      tags: [],
      title: 'About',
      type: 'HTTP',
      url: '/pages/about',
      items: [],
    },
  ],
};

/** Footer navigation used until a `footer` menu exists in Shopify. */
export const FALLBACK_FOOTER_MENU: NonNullable<FooterQuery['menu']> = {
  id: 'gid://shopify/Menu/fallback-footer',
  items: [
    {
      id: 'fallback-footer-shop',
      resourceId: null,
      tags: [],
      title: 'Shop',
      type: 'HTTP',
      url: '/collections/all',
      items: [
        {
          id: 'ff-shop-all',
          resourceId: null,
          tags: [],
          title: 'Shop All',
          type: 'HTTP',
          url: '/collections/all',
        },
        {
          id: 'ff-bath',
          resourceId: null,
          tags: [],
          title: 'Bath',
          type: 'HTTP',
          url: '/collections/bath',
        },
        {
          id: 'ff-bundles',
          resourceId: null,
          tags: [],
          title: 'Bundles',
          type: 'HTTP',
          url: '/collections/bundles',
        },
      ],
    },
    {
      id: 'fallback-footer-company',
      resourceId: null,
      tags: [],
      title: 'Company',
      type: 'HTTP',
      url: '/pages/about',
      items: [
        {
          id: 'ff-about',
          resourceId: null,
          tags: [],
          title: 'About Mellow',
          type: 'HTTP',
          url: '/pages/about',
        },
        {
          id: 'ff-search',
          resourceId: null,
          tags: [],
          title: 'Search',
          type: 'HTTP',
          url: '/search',
        },
      ],
    },
    {
      id: 'fallback-footer-support',
      resourceId: null,
      tags: [],
      title: 'Support',
      type: 'HTTP',
      url: '/policies',
      items: [
        {
          id: 'ff-account',
          resourceId: null,
          tags: [],
          title: 'My Account',
          type: 'HTTP',
          url: '/account',
        },
        {
          id: 'ff-policies',
          resourceId: null,
          tags: [],
          title: 'Policies',
          type: 'HTTP',
          url: '/policies',
        },
      ],
    },
  ],
};
