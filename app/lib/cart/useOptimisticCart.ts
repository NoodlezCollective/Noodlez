import {useFetchers} from 'react-router';
import {applyOptimisticCartActions} from './optimistic';
import type {CartLike, OptimisticCart} from './types';

/**
 * The cart with the cart actions that are still being submitted applied, so
 * the page reacts before the server has answered. Pass the cart from the
 * loader (`null` while none exists yet). Each line that is not in the cart yet
 * comes back with `isOptimistic`, and so does the cart itself once anything
 * pending changed it; with nothing pending it is the very same cart.
 *
 * Adding a line needs `selectedVariant` on the line input. See
 * `applyOptimisticCartActions` for exactly what each action does.
 */
export function useOptimisticCart<T extends CartLike | null | undefined>(
  cart: T,
): OptimisticCart<T> {
  return applyOptimisticCartActions(cart, useFetchers());
}
