import {useEffect} from 'react';

type SelectedOption = {name: string; value: string};

/**
 * Mirrors the selected variant options into the current URL's search params
 * without a navigation, so a product page link can be shared with its variant.
 *
 * Replaces hydrogen-react's `useSelectedOptionInUrlParam` for two reasons:
 * - it only touches the URL while `pathname` is still the current page. A Back
 *   navigation that cancels a pending variant load would otherwise get the
 *   variant written into the previous page's URL;
 * - it keeps `history.state`, which React Router uses to track its entries.
 */
export function useSelectedOptionsInUrl(
  selectedOptions: SelectedOption[] | null | undefined,
  pathname: string,
): void {
  const serialized = JSON.stringify(selectedOptions ?? []);
  useEffect(() => {
    if (window.location.pathname !== pathname) return;
    const options = JSON.parse(serialized) as SelectedOption[];
    const params = new URLSearchParams(window.location.search);
    for (const {name, value} of options) params.set(name, value);
    const search = params.toString();
    if (!search) return;
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}?${search}`,
    );
  }, [serialized, pathname]);
}
