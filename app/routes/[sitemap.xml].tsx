import type {Route} from './+types/[sitemap.xml]';
import {getSitemapIndex} from '@shopify/hydrogen';
import {SITEMAP_TYPES} from '~/lib/seo';
import type {HydrogenStorefront} from '~/lib/storefront/hydrogen-compat';

export async function loader({
  request,
  context: {storefront},
}: Route.LoaderArgs) {
  const response = await getSitemapIndex({
    storefront: storefront as unknown as HydrogenStorefront,
    request,
    // Hydrogen's default also lists metaobject sitemaps. The storefront has no
    // metaobject pages, so advertising them would list URLs that 404.
    types: [...SITEMAP_TYPES],
  });

  response.headers.set('Cache-Control', `max-age=${60 * 60 * 24}`);

  return response;
}
