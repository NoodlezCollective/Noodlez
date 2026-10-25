import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CART_FORM_INPUT_NAME} from './form-input';
import {OPTIMISTIC_LINE_ID_PREFIX} from './optimistic';
import {useOptimisticCart} from './useOptimisticCart';

// The hook only reads the fetchers in flight: stand them in so it can render on
// the server, where no data router has any.
const router = vi.hoisted(() => ({
  fetchers: [] as Array<{formData?: FormData}>,
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {...actual, useFetchers: () => router.fetchers};
});

beforeEach(() => {
  router.fetchers = [];
});

const VARIANT = {id: 'gid://shopify/ProductVariant/1', title: 'Cloud pillow'};

type Cart = {
  totalQuantity: number;
  lines: {
    nodes: Array<{
      id: string;
      quantity: number;
      merchandise: {id: string};
      isOptimistic?: boolean;
    }>;
  };
};

function cartWithOneLine(): Cart {
  return {
    totalQuantity: 2,
    lines: {
      nodes: [
        {
          id: 'gid://shopify/CartLine/a',
          quantity: 2,
          merchandise: {id: 'gid://shopify/ProductVariant/9'},
        },
      ],
    },
  };
}

function submittingAdd(quantity: number) {
  const formData = new FormData();
  formData.set(
    CART_FORM_INPUT_NAME,
    JSON.stringify({
      action: 'LinesAdd',
      inputs: {
        lines: [
          {merchandiseId: VARIANT.id, quantity, selectedVariant: VARIANT},
        ],
      },
    }),
  );
  return {formData};
}

/** Runs the hook once, in a component rendered on the server. */
function runHook<T extends Cart | null | undefined>(cart: T) {
  const seen: unknown[] = [];
  function Probe() {
    seen.push(useOptimisticCart(cart));
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  return seen[0] as (Cart & {isOptimistic?: boolean}) | null | undefined;
}

describe('useOptimisticCart', () => {
  it('returns the cart itself while no fetcher is in flight', () => {
    const cart = cartWithOneLine();

    expect(runHook(cart)).toBe(cart);
  });

  it('applies the cart action a fetcher is submitting', () => {
    router.fetchers = [submittingAdd(3)];

    const result = runHook(cartWithOneLine());

    expect(result?.isOptimistic).toBe(true);
    expect(result?.totalQuantity).toBe(5);
    expect(result?.lines.nodes[0]).toEqual({
      id: `${OPTIMISTIC_LINE_ID_PREFIX}${VARIANT.id}`,
      merchandise: VARIANT,
      isOptimistic: true,
      quantity: 3,
    });
  });

  it('gives a cart that does not exist yet an empty base to add to', () => {
    router.fetchers = [submittingAdd(1)];

    const result = runHook(null);

    expect(result?.totalQuantity).toBe(1);
    expect(result?.lines.nodes).toHaveLength(1);
  });

  it('ignores fetchers that are not submitting a cart form', () => {
    const search = new FormData();
    search.set('q', 'pillow');
    router.fetchers = [{}, {formData: search}];
    const cart = cartWithOneLine();

    expect(runHook(cart)).toBe(cart);
  });
});
