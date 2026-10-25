/**
 * Client-safe cart types shared by the cart service (server), CartForm, the
 * optimistic cart hook and the routes/components that render a cart. Ports of
 * the Hydrogen types the app used before Phase 3 of the Hydrogen removal
 * (docs/hydrogen-removal-plan.md), kept name-compatible so call sites only
 * change their import path.
 */
import type {
  CartLine,
  CartLineInput,
  CartUserError as StorefrontCartUserError,
  CartWarning as StorefrontCartWarning,
} from '@shopify/hydrogen-react/storefront-api-types';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import type {StorefrontApiError} from '~/lib/storefront/types';

/** A user error reported by a cart mutation (`userErrors`). */
export type CartUserError = Pick<StorefrontCartUserError, 'message'> & {
  field?: string[] | null;
  code?: string | null;
};

/** A non-fatal warning reported by a cart mutation (`warnings`). */
export type CartWarning = Pick<
  StorefrontCartWarning,
  'code' | 'message' | 'target'
>;

/** The minimal cart every mutation selects (`CartApiMutation` fragment). */
export type CartMutationCart = {
  id: string;
  totalQuantity: number;
  checkoutUrl: string;
};

/** What every cart mutation resolves to. */
export type CartQueryDataReturn<TCart = CartMutationCart> = {
  cart: TCart | null;
  userErrors?: CartUserError[];
  warnings?: CartWarning[];
  errors?: StorefrontApiError[];
};

/** What `cart.get()` resolves to when a cart exists. */
export type CartReturn = CartApiQueryFragment & {errors?: StorefrontApiError[]};

/** A line to add; `selectedVariant` only feeds the optimistic UI. */
export type OptimisticCartLineInput = CartLineInput & {
  selectedVariant?: unknown;
};

/** Anything with `lines.nodes`, which is all the optimistic helpers need. */
export type CartLike = {
  lines: {nodes: Array<unknown>};
};

/** The shape of a cart line the optimistic helpers read and produce. */
export type CartLineLike = {
  id: string;
  quantity: number;
  merchandise: {id: string};
  isOptimistic?: boolean;
};

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

/**
 * Local stand-in for type-fest's PartialDeep (Hydrogen's dependency), with its
 * default of leaving arrays as they are (`recurseIntoArrays: false`).
 */
export type PartialDeep<T> = T extends Primitive
  ? T
  : T extends ReadonlyArray<unknown>
    ? T
    : T extends object
      ? {[Key in keyof T]?: PartialDeep<T[Key]>}
      : T;

/** A cart line, with `isOptimistic` while a cart action is pending for it. */
export type OptimisticCartLine<T = CartLine | CartReturn> = T extends CartLike
  ? T['lines']['nodes'][number] & {isOptimistic?: boolean}
  : T & {isOptimistic?: boolean};

/** The cart with pending cart actions applied (`useOptimisticCart`). */
export type OptimisticCart<T = CartReturn> = T extends undefined | null
  ? // The cart has yet to be created: optimistic lines on an empty base.
    {
      isOptimistic?: boolean;
      lines: {nodes: Array<OptimisticCartLine>};
      totalQuantity?: number;
    } & Omit<PartialDeep<CartReturn>, 'lines'>
  : Omit<T, 'lines'> & {
      isOptimistic?: boolean;
      lines: {nodes: Array<OptimisticCartLine<T>>};
      totalQuantity?: number;
    };
