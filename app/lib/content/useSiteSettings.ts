import {useRouteLoaderData} from 'react-router';
import type {RootLoader} from '~/root';
import {DEFAULT_SITE_SETTINGS} from './defaults';
import type {SiteSettings} from './types';

/**
 * Global storefront settings (announcements, trust badges, savings copy)
 * resolved by the root loader from the `mellow_settings` metaobject.
 */
export function useSiteSettings(): SiteSettings {
  const data = useRouteLoaderData<RootLoader>('root');
  return data?.siteSettings ?? DEFAULT_SITE_SETTINGS;
}
