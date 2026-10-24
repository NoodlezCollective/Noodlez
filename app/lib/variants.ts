import {useLocation, useNavigation} from 'react-router';
import type {SelectedOption} from '@shopify/hydrogen-react/storefront-api-types';
import {useEffect, useMemo, useState} from 'react';

export type VariantWithOptions = {
  selectedOptions?: Array<{name: string; value: string}> | null;
};

type OptimisticVariant<S> = S & {isOptimistic?: boolean};

const NO_VARIANTS: ReadonlyArray<VariantWithOptions> = [];
const RESOLVE_FAILURE_MESSAGE =
  '[useOptimisticVariant] An error occurred while resolving the variants for the optimistic product hook.';

export function useVariantUrl(
  handle: string,
  selectedOptions?: SelectedOption[],
) {
  const {pathname} = useLocation();

  return useMemo(() => {
    return getVariantUrl({
      handle,
      pathname,
      searchParams: new URLSearchParams(),
      selectedOptions,
    });
  }, [handle, selectedOptions, pathname]);
}

export function getVariantUrl({
  handle,
  pathname,
  searchParams,
  selectedOptions,
}: {
  handle: string;
  pathname: string;
  searchParams: URLSearchParams;
  selectedOptions?: SelectedOption[];
}) {
  const match = /(\/[a-zA-Z]{2}-[a-zA-Z]{2}\/)/g.exec(pathname);
  const isLocalePathname = match && match.length > 0;

  const path = isLocalePathname
    ? `${match![0]}products/${handle}`
    : `/products/${handle}`;

  selectedOptions?.forEach((option) => {
    searchParams.set(option.name, option.value);
  });

  const searchString = searchParams.toString();

  return path + (searchString ? '?' + searchParams.toString() : '');
}

/**
 * Every search parameter of the request as a selected option, ready for the
 * product query's `selectedOptions` variable. Ported from Hydrogen.
 */
export function getSelectedProductOptions(
  request: Request,
): Array<{name: string; value: string}> {
  if (typeof request?.url === 'undefined') {
    throw new TypeError(`Expected a Request instance, got ${typeof request}`);
  }
  const {searchParams} = new URL(request.url);
  return Array.from(searchParams, ([name, value]) => ({name, value}));
}

/**
 * The first variant whose selected options all appear, with the same values,
 * among the search parameters (a navigation's pending `location.search`).
 */
export function findOptimisticVariant<T extends VariantWithOptions>(
  variants: ReadonlyArray<T>,
  search: string,
): T | undefined {
  const params = new URLSearchParams(search);
  return variants.find((variant) =>
    variant.selectedOptions?.every(
      (option) => params.get(option.name) === option.value,
    ),
  );
}

function toVariantList(value: unknown): ReadonlyArray<VariantWithOptions> {
  return Array.isArray(value)
    ? (value as ReadonlyArray<VariantWithOptions>)
    : NO_VARIANTS;
}

/**
 * The variant list a promise delivers (`[]` for anything but a list), or
 * `null` after logging a failure with `console.error` when it rejects.
 */
export async function resolveVariantList(
  variants: PromiseLike<unknown>,
): Promise<ReadonlyArray<VariantWithOptions> | null> {
  try {
    return toVariantList(await variants);
  } catch (cause) {
    console.error(new Error(RESOLVE_FAILURE_MESSAGE, {cause}));
    return null;
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof (value as {then?: unknown} | null | undefined)?.then === 'function'
  );
}

/** A variant list handed over directly is used at once; a promise's list once it settles. */
function useVariantList(variants: unknown): ReadonlyArray<VariantWithOptions> {
  const pending = isPromiseLike(variants) ? variants : null;
  const [settled, setSettled] = useState<{
    source: PromiseLike<unknown>;
    list: ReadonlyArray<VariantWithOptions>;
  } | null>(null);

  useEffect(() => {
    let isCurrent = true;
    if (pending) {
      void resolveVariantList(pending).then((list) => {
        if (isCurrent && list) setSettled({source: pending, list});
      });
    }
    return () => {
      isCurrent = false;
    };
  }, [pending]);

  if (!pending) return toVariantList(variants);
  return settled?.source === pending ? settled.list : NO_VARIANTS;
}

/**
 * While a navigation is loading, the variant its search parameters select
 * (marked `isOptimistic`), so the page can show it before the loader answers;
 * otherwise the variant the server selected. `variants` is the list to choose
 * from, or a promise of it. Ported from Hydrogen.
 */
export function useOptimisticVariant<S, V = ReadonlyArray<VariantWithOptions>>(
  selected: S,
  variants: V | Promise<V>,
): OptimisticVariant<S> {
  const navigation = useNavigation();
  const available = useVariantList(variants);
  if (navigation.state !== 'loading') return selected as OptimisticVariant<S>;

  const match = findOptimisticVariant(available, navigation.location.search);
  return match
    ? ({...match, isOptimistic: true} as unknown as OptimisticVariant<S>)
    : (selected as OptimisticVariant<S>);
}
