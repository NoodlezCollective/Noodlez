import type {Storefront} from '~/lib/storefront/client.server';
import {safeRedirectPath} from '~/lib/urls';

/**
 * Redirects for requests the app answered with a 404, ported from Hydrogen
 * 2026.4.7's `storefrontRedirect` (its src/routing/redirect.ts, bundled in
 * the package's development build). In order: `/admin` goes to the shop
 * admin; then the first Storefront API URL redirect for the lowercased path;
 * then a same-origin `return_to` / `redirect` parameter. Single-fetch
 * (`.data`) requests get React Router's 204 redirect, other requests a 301,
 * and every request parameter except `redirect`, `return_to` and `_routes`
 * is carried over to the target.
 *
 * One deliberate difference: the parameter target must pass
 * `safeRedirectPath`. Hydrogen's same-origin check accepted dot-segment forms
 * such as `/.//evil.example`, which it then wrote out as `//evil.example`.
 * server.ts reduces both parameters to such safe paths first
 * (`withSafeRedirectParams`), so its responses are Hydrogen's; called directly,
 * a hostile value keeps the 404.
 */

type StorefrontRedirectOptions = {
  storefront: Pick<Storefront, 'query' | 'getShopifyDomain'>;
  request: Request;
  /** The app's 404, returned when there is nowhere to go. */
  response?: Response;
  /** Leaves `/admin` to the URL redirect lookup. */
  noAdminRedirect?: boolean;
  /** Matches URL redirects on the query string too, then carries none over. */
  matchQueryParams?: boolean;
};

type SingleFetchPathname = {pathname: string; isSoftNavigation: boolean};

type SearchParamEntries = ReadonlyArray<[string, string]>;

type UrlRedirectsData = {
  urlRedirects?: {
    edges?: ReadonlyArray<{node?: {target?: string | null} | null}> | null;
  } | null;
};

const SINGLE_FETCH_DATA_SUFFIX = '.data';
const SINGLE_FETCH_ROOT_SEGMENT = '_root.data';
const SINGLE_FETCH_TRAILING_SLASH_SEGMENT = '_.data';
const ADMIN_PATH = '/admin';
/** Parameters that steer this lookup (or React Router's), never carried. */
const STRIPPED_PARAMS = new Set(['redirect', 'return_to', '_routes']);
const PERMANENT_REDIRECT_STATUS = 301;
const SINGLE_FETCH_REDIRECT_STATUS = 204;
/** Resolves relative targets; removed again from the written location. */
const TEMP_DOMAIN = 'https://example.com';

// Hydrogen's query, verbatim.
const REDIRECT_QUERY = `#graphql
  query redirects($query: String) {
    urlRedirects(first: 1, query: $query) {
      edges {
        node {
          target
        }
      }
    }
  }
`;

/**
 * Finds where a 404 should go, or returns `response` (by default a plain
 * `Not Found` 404). A failed Storefront API lookup is logged and also returns
 * `response`, without trying the redirect parameters.
 */
export async function storefrontRedirect(
  options: StorefrontRedirectOptions,
): Promise<Response> {
  const {
    storefront,
    request,
    noAdminRedirect,
    matchQueryParams,
    response = new Response('Not Found', {status: 404}),
  } = options;
  const url = new URL(request.url);
  const {pathname, isSoftNavigation} = parseSingleFetchPathname(url.pathname);
  const carriedParams = withoutStrippedParams(url.searchParams);
  const redirectTo = (location: string) =>
    createRedirectResponse(
      location,
      isSoftNavigation,
      matchQueryParams ? [] : carriedParams,
    );

  if (pathname === ADMIN_PATH && !noAdminRedirect) {
    return redirectTo(`${storefront.getShopifyDomain()}${ADMIN_PATH}`);
  }

  const redirectFrom = (
    matchQueryParams ? `${pathname}${toSearch(carriedParams)}` : pathname
  ).toLowerCase();
  try {
    const location =
      (await findUrlRedirect(storefront, redirectFrom)) ||
      findRedirectParameter(url);
    if (location) return redirectTo(location);
  } catch (error) {
    console.error(
      `[storefront-redirect] Failed to fetch redirects from the Storefront API for route ${redirectFrom}`,
      error,
    );
  }

  return response;
}

/**
 * The route path of a React Router single-fetch request: `/x.data` is `/x`,
 * `/_root.data` is `/` and `/x/_.data` (trailing-slash form) is `/x/`.
 */
export function parseSingleFetchPathname(
  pathname: string,
): SingleFetchPathname {
  if (!pathname.endsWith(SINGLE_FETCH_DATA_SUFFIX)) {
    return {pathname, isSoftNavigation: false};
  }
  if (pathname.endsWith('/' + SINGLE_FETCH_TRAILING_SLASH_SEGMENT)) {
    return {
      pathname: pathname.slice(0, -SINGLE_FETCH_TRAILING_SLASH_SEGMENT.length),
      isSoftNavigation: true,
    };
  }
  // Hydrogen also tests for exactly `/_root.data` and falls back to `/` for
  // an empty prefix; both are covered here, as the prefix keeps its `/`.
  if (pathname.endsWith('/' + SINGLE_FETCH_ROOT_SEGMENT)) {
    return {
      pathname: pathname.slice(0, -SINGLE_FETCH_ROOT_SEGMENT.length),
      isSoftNavigation: true,
    };
  }
  return {
    pathname: pathname.slice(0, -SINGLE_FETCH_DATA_SUFFIX.length),
    isSoftNavigation: true,
  };
}

function withoutStrippedParams(params: URLSearchParams): SearchParamEntries {
  return [...params].filter(([key]) => !STRIPPED_PARAMS.has(key));
}

/** `url.search` after Hydrogen deleted the stripped parameters. */
function toSearch(params: SearchParamEntries): string {
  const query = new URLSearchParams([...params]).toString();
  return query ? `?${query}` : '';
}

/** The target of the first Storefront API URL redirect for the path. */
async function findUrlRedirect(
  storefront: StorefrontRedirectOptions['storefront'],
  redirectFrom: string,
): Promise<string | null | undefined> {
  const {urlRedirects} = await storefront.query<UrlRedirectsData>(
    REDIRECT_QUERY,
    {
      // The admin doesn't allow redirects to have a trailing slash, so strip
      // them all off.
      variables: {query: 'path:' + redirectFrom.replace(/\/+$/, '')},
    },
  );
  return urlRedirects?.edges?.[0]?.node?.target;
}

/** `return_to`, or else `redirect`, when it resolves to a same-origin path. */
function findRedirectParameter(url: URL): string {
  const value =
    url.searchParams.get('return_to') || url.searchParams.get('redirect');
  return safeRedirectPath(value, url.origin, '');
}

/**
 * Hydrogen's `createRedirectResponse`. Appending re-encodes the target's own
 * query, exactly as Hydrogen's `searchParams.append` did; without carried
 * parameters the target is written as given.
 */
function createRedirectResponse(
  location: string,
  isSoftNavigation: boolean,
  carriedParams: SearchParamEntries,
): Response {
  const target = new URL(location, TEMP_DOMAIN);
  for (const [key, value] of carriedParams) {
    target.searchParams.append(key, value);
  }
  const written = target.toString().replace(TEMP_DOMAIN, '');

  if (isSoftNavigation) {
    return new Response(null, {
      status: SINGLE_FETCH_REDIRECT_STATUS,
      headers: {
        'X-Remix-Redirect': written,
        'X-Remix-Status': String(PERMANENT_REDIRECT_STATUS),
      },
    });
  }
  return new Response(null, {
    status: PERMANENT_REDIRECT_STATUS,
    headers: {location: written},
  });
}
