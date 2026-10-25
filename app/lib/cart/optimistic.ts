import {CART_ACTIONS, getFormInput, type CartFormInput} from './form-input';
import type {CartLike, CartLineLike, OptimisticCart} from './types';

/**
 * The optimistic cart: the cart as it will look once the cart actions that are
 * still being submitted have been answered. Ported from Hydrogen's
 * `useOptimisticCart`; pure and client-safe, so the `useOptimisticCart` hook
 * stays a thin wrapper and the logic is unit-tested without a browser.
 */

/** Starts the id of a line that exists only in the browser until the server answers. */
export const OPTIMISTIC_LINE_ID_PREFIX = '__h_pending_';

const LOG_PREFIX = '[useOptimisticCart]';
const DEFAULT_QUANTITY = 1;

type PlainRecord = Record<string, unknown>;

/** The part of a React Router fetcher this module reads. */
export type OptimisticFetcher = {formData?: FormData | null};

type LinesState = {
  readonly lines: ReadonlyArray<CartLineLike>;
  /** True once a pending action has changed the lines. */
  readonly isOptimistic: boolean;
};

type SelectedVariant = PlainRecord & {id: string};

/** What stands in for a cart that has not been created yet. */
const EMPTY_CART: CartLike = {lines: {nodes: []}};

/** True for the id of a line that has not been added to the cart on the server yet. */
export function isOptimisticLineId(id: string): boolean {
  return typeof id === 'string' && id.startsWith(OPTIMISTIC_LINE_ID_PREFIX);
}

function asRecord(value: unknown): PlainRecord {
  return typeof value === 'object' && value !== null
    ? (value as PlainRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** A quantity to add: a positive whole number, otherwise one item. */
function quantityOrOne(value: unknown): number {
  return isWholeNumber(value) && value > 0 ? value : DEFAULT_QUANTITY;
}

function isSelectedVariant(value: unknown): value is SelectedVariant {
  return typeof asRecord(value).id === 'string';
}

function replaceAt(
  lines: ReadonlyArray<CartLineLike>,
  index: number,
  line: CartLineLike,
): CartLineLike[] {
  return lines.map((existing, position) =>
    position === index ? line : existing,
  );
}

function removeAt(
  lines: ReadonlyArray<CartLineLike>,
  index: number,
): CartLineLike[] {
  return lines.filter((_, position) => position !== index);
}

function addLine(state: LinesState, input: unknown): LinesState {
  const {selectedVariant: variant, quantity: requested} = asRecord(input);
  if (!isSelectedVariant(variant)) {
    console.error(
      `${LOG_PREFIX} No selected variant was passed in the cart action. Pass the selected variant to get an optimistic cart.`,
    );
    return state;
  }

  const quantity = quantityOrOne(requested);
  const index = state.lines.findIndex(
    (line) => line.merchandise.id === variant.id,
  );
  if (index === -1) {
    const pending: CartLineLike = {
      id: `${OPTIMISTIC_LINE_ID_PREFIX}${variant.id}`,
      merchandise: variant,
      isOptimistic: true,
      quantity,
    };
    return {lines: [pending, ...state.lines], isOptimistic: true};
  }

  const existing = state.lines[index];
  const merged = {
    ...existing,
    quantity: quantityOrOne(existing.quantity) + quantity,
    isOptimistic: true,
  };
  return {lines: replaceAt(state.lines, index, merged), isOptimistic: true};
}

function removeLine(state: LinesState, lineId: unknown): LinesState {
  if (typeof lineId !== 'string') return state;

  const index = state.lines.findIndex((line) => line.id === lineId);
  if (index === -1) {
    console.warn(
      `${LOG_PREFIX} Tried to remove line '${lineId}' but it doesn't exist in the cart.`,
    );
    return state;
  }
  if (isOptimisticLineId(state.lines[index].id)) {
    console.error(
      `${LOG_PREFIX} Tried to remove an optimistic line that has not been added to the cart yet.`,
    );
    return state;
  }
  return {lines: removeAt(state.lines, index), isOptimistic: true};
}

function updateLine(state: LinesState, update: unknown): LinesState {
  const {id, quantity} = asRecord(update);
  if (typeof id !== 'string' || !isWholeNumber(quantity)) return state;

  const index = state.lines.findIndex((line) => line.id === id);
  if (index === -1) {
    console.warn(
      `${LOG_PREFIX} Tried to update line '${id}' but it doesn't exist in the cart.`,
    );
    return state;
  }
  if (isOptimisticLineId(state.lines[index].id)) {
    console.error(
      `${LOG_PREFIX} Tried to update an optimistic line that has not been added to the cart yet.`,
    );
    return state;
  }

  const lines =
    quantity === 0
      ? removeAt(state.lines, index)
      : replaceAt(state.lines, index, {...state.lines[index], quantity});
  return {lines, isOptimistic: true};
}

/** Applies one pending cart form; forms that do not change lines leave the state alone. */
function applyCartInput(
  state: LinesState,
  {action, inputs}: CartFormInput,
): LinesState {
  switch (action) {
    case CART_ACTIONS.LinesAdd:
      return asArray(inputs.lines).reduce<LinesState>(addLine, state);
    case CART_ACTIONS.LinesRemove:
      return asArray(inputs.lineIds).reduce<LinesState>(removeLine, state);
    case CART_ACTIONS.LinesUpdate:
      return asArray(inputs.lines).reduce<LinesState>(updateLine, state);
    default:
      return state;
  }
}

function readFormInput(formData: FormData): CartFormInput | undefined {
  try {
    return getFormInput(formData);
  } catch {
    // A form that cannot be read is not one to apply; the server answers it
    // (with a 400), so there is nothing optimistic to show for it.
    return undefined;
  }
}

/** The cart forms the fetchers are submitting, in the order the fetchers started. */
function readPendingCartInputs(
  fetchers: ReadonlyArray<OptimisticFetcher>,
): CartFormInput[] {
  return fetchers.flatMap(({formData}) => {
    const input = formData ? readFormInput(formData) : undefined;
    return input ? [input] : [];
  });
}

function linesOf(cart: CartLike | null | undefined) {
  return (cart?.lines?.nodes ?? []) as ReadonlyArray<CartLineLike>;
}

function withLines(
  cart: CartLike | null | undefined,
  lines: ReadonlyArray<CartLineLike>,
) {
  const base = cart?.lines ? cart : EMPTY_CART;
  return {
    ...base,
    lines: {...base.lines, nodes: lines},
    totalQuantity: lines.reduce((total, line) => total + line.quantity, 0),
    isOptimistic: true,
  };
}

/**
 * The cart with the pending `LinesAdd`, `LinesRemove` and `LinesUpdate`
 * actions applied, in the order the fetchers started.
 *
 * - A new variant becomes a line at the front with a pending id
 *   (`OPTIMISTIC_LINE_ID_PREFIX`) and `isOptimistic`; a variant already in the
 *   cart gets its quantity raised and `isOptimistic`.
 * - A removed line, or one updated to quantity 0, is dropped.
 * - `totalQuantity` is recomputed from the lines, and `isOptimistic` is set.
 * - A cart that does not exist yet (`null` or `undefined`) starts empty.
 * - When no pending action changes the lines, `cart` itself is returned.
 *
 * The cart is never mutated: changed lines are copies and the rest is shared.
 */
export function applyOptimisticCartActions<
  T extends CartLike | null | undefined,
>(cart: T, fetchers: ReadonlyArray<OptimisticFetcher>): OptimisticCart<T> {
  const pending = readPendingCartInputs(fetchers ?? []).reduce(applyCartInput, {
    lines: linesOf(cart),
    isOptimistic: false,
  });
  const result = pending.isOptimistic ? withLines(cart, pending.lines) : cart;
  // The generic `OptimisticCart<T>` cannot be built from the runtime shapes.
  return result as unknown as OptimisticCart<T>;
}
