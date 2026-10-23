import {useEffect, useMemo, useState} from 'react';
import {useLocation, useNavigation} from 'react-router';
import {PAGINATION_PARAMS} from '~/lib/collectionFilters';

/**
 * Lets a control show the params it just submitted before the router has
 * registered the navigation (router state updates are transitions, so a
 * controlled input would otherwise snap back for a frame). The optimistic
 * value is dropped as soon as any navigation lands.
 */
export function useOptimisticParams(params: URLSearchParams) {
  const location = useLocation();
  const [optimistic, setOptimistic] = useState<URLSearchParams | null>(null);
  useEffect(() => setOptimistic(null), [location.key]);
  return [optimistic ?? params, setOptimistic] as const;
}

/**
 * Search params of the listing, optimistically read from the pending
 * navigation while a filter or sort change is loading so controls update
 * instantly. Also exposes whether the grid is being refetched.
 */
export function useListingState() {
  const location = useLocation();
  const navigation = useNavigation();
  const pending =
    navigation.state === 'loading' ? navigation.location : undefined;
  const samePage = pending?.pathname === location.pathname;
  const search = samePage && pending ? pending.search : location.search;
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const isPaginating =
    Boolean(samePage) && PAGINATION_PARAMS.some((param) => params.has(param));

  return {
    params,
    pathname: location.pathname,
    /** A filter or sort change is loading (not a "load more"). */
    isPending: Boolean(samePage) && !isPaginating,
    isPaginating,
  };
}
