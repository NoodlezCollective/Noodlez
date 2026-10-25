import type {Route} from './+types/sitemap.$type.$page[.xml]';
import {isSitemapPage, isSitemapType, sitemapPath} from '~/lib/seo';
import {getSitemap} from '~/lib/sitemap.server';

export async function loader({
  request,
  params,
  context: {storefront},
}: Route.LoaderArgs) {
  // `type` and `page` come from the URL. Serve only the types the sitemap
  // index advertises (Hydrogen would look any other name up on a plain object,
  // where `constructor` or `__proto__` resolve to something truthy) and only
  // page numbers the Storefront API can answer for.
  if (!isSitemapType(params.type) || !isSitemapPage(params.page)) {
    throw new Response('Not found', {status: 404});
  }

  const response = await getSitemap({
    storefront,
    request,
    params,
    // The storefront serves a single locale (see app/lib/context.ts i18n).
    // Hydrogen's stock `/${type}/${handle}` would list `/articles/<blog>/<article>`
    // although articles are served at `/blogs/<blog>/<article>`.
    getLink: ({type, baseUrl, handle}) =>
      `${baseUrl}${sitemapPath(type, handle)}`,
  });

  response.headers.set('Cache-Control', `max-age=${60 * 60 * 24}`);

  return response;
}
