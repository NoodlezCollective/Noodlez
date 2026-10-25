import type {ComponentType, ReactElement, ReactNode} from 'react';
import type {FetcherWithComponents} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ORIGIN, renderRoute} from '../__tests__/route-test-utils';
import {CartForm} from './CartForm';
import {CART_ACTIONS, CART_FORM_INPUT_NAME, getFormInput} from './form-input';

// Records the options each <CartForm> hands to `useFetcher`; the key never
// reaches the markup. The real hook still runs.
const fetcherOptions = vi.hoisted(() => [] as unknown[]);

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useFetcher: (...args: Parameters<typeof actual.useFetcher>) => {
      fetcherOptions.push(args[0]);
      return actual.useFetcher(...args);
    },
  };
});

beforeEach(() => {
  fetcherOptions.length = 0;
});

const PAGE_URL = `${ORIGIN}/products/cloud-pillow`;

/** <CartForm> without the type-level requirement of an action, for the runtime fallbacks. */
const LooseCartForm = CartForm as unknown as ComponentType<{
  inputs?: unknown;
  children?: ReactNode;
}>;

function render(element: ReactElement, url = PAGE_URL) {
  return renderRoute({
    path: new URL(url).pathname,
    url,
    loaderData: null,
    Component: () => element,
  });
}

function decodeEntities(text: string) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Every attribute of the `<form>` tag, decoded. */
function formAttributes(html: string): Record<string, string> {
  const tag = /<form\b[^>]*>/.exec(html)?.[0] ?? '';
  return Object.fromEntries(
    Array.from(tag.matchAll(/([\w-]+)="([^"]*)"/g), ([, name, value]) => [
      name,
      decodeEntities(value),
    ]),
  );
}

/** The decoded value of the hidden cart input, or `undefined` without one. */
function cartInputValue(html: string): string | undefined {
  const inputs = html.match(/<input\b[^>]*>/g) ?? [];
  const cartInput = inputs.find((tag) =>
    tag.includes(`name="${CART_FORM_INPUT_NAME}"`),
  );
  const value = cartInput && /value="([^"]*)"/.exec(cartInput)?.[1];
  return value === undefined ? undefined : decodeEntities(value);
}

const LINES = [
  {
    merchandiseId: 'gid://shopify/ProductVariant/1',
    quantity: 2,
    selectedVariant: {id: 'gid://shopify/ProductVariant/1', title: 'King'},
  },
];

describe('<CartForm>', () => {
  describe('the form', () => {
    it('posts to the route it is given', async () => {
      const html = await render(
        <CartForm route="/cart" action="LinesAdd" inputs={{lines: LINES}}>
          <button type="submit">Add</button>
        </CartForm>,
      );

      expect(formAttributes(html)).toMatchObject({
        method: 'post',
        action: '/cart',
      });
    });

    it('posts to the current route when no route is given', async () => {
      const html = await render(
        <CartForm action="LinesAdd" inputs={{lines: LINES}}>
          <button type="submit">Add</button>
        </CartForm>,
      );

      expect(formAttributes(html).action).toBe('/products/cloud-pillow');
    });

    it('renders its children inside the form', async () => {
      const html = await render(
        <CartForm route="/cart" action="LinesRemove" inputs={{lineIds: ['a']}}>
          <input type="hidden" name="redirectTo" value="/collections/all" />
          <button type="submit">Clear</button>
        </CartForm>,
      );

      expect(html).toMatch(
        /<form\b[^>]*>.*<input[^>]*name="redirectTo"[^>]*\/?>.*<button type="submit">Clear<\/button><\/form>/,
      );
    });

    it('hands the fetcher to children that are a function', async () => {
      const html = await render(
        <CartForm route="/cart" action="LinesAdd" inputs={{lines: LINES}}>
          {(fetcher: FetcherWithComponents<unknown>) => (
            <button type="submit" data-state={fetcher.state}>
              {fetcher.state === 'idle' ? 'Add to cart' : 'Adding…'}
            </button>
          )}
        </CartForm>,
      );

      expect(html).toContain('data-state="idle"');
      expect(html).toContain('Add to cart');
    });

    it('lets a function child read the typed data of its fetcher', async () => {
      type Answer = {userErrors?: Array<{message: string}>};

      const html = await render(
        <CartForm route="/cart" action="LinesAdd" inputs={{lines: LINES}}>
          {(fetcher: FetcherWithComponents<Answer>) => (
            <p>{fetcher.data?.userErrors?.length ?? 0} errors</p>
          )}
        </CartForm>,
      );

      expect(html).toContain('<p>0 errors</p>');
    });
  });

  describe('the hidden cartFormInput field', () => {
    it('holds the action and the inputs as JSON', async () => {
      const html = await render(
        <CartForm route="/cart" action="LinesAdd" inputs={{lines: LINES}}>
          <button type="submit">Add</button>
        </CartForm>,
      );

      expect(html).toMatch(/<input[^>]*type="hidden"/);
      expect(JSON.parse(cartInputValue(html) ?? 'null')).toEqual({
        action: 'LinesAdd',
        inputs: {lines: LINES},
      });
    });

    it('is written as {"action":…,"inputs":…}, in that order', async () => {
      const html = await render(
        <CartForm
          route="/cart"
          action="LinesRemove"
          inputs={{lineIds: ['gid://shopify/CartLine/a']}}
        >
          <button type="submit">Remove</button>
        </CartForm>,
      );

      expect(cartInputValue(html)).toBe(
        '{"action":"LinesRemove","inputs":{"lineIds":["gid://shopify/CartLine/a"]}}',
      );
    });

    it('leaves inputs out of the JSON when the action has none', async () => {
      const html = await render(
        <CartForm route="/cart" action="GiftCardCodesAdd">
          <input name="giftCardCode" />
        </CartForm>,
      );

      expect(cartInputValue(html)).toBe('{"action":"GiftCardCodesAdd"}');
    });

    it('is read back by getFormInput as the same action and inputs', async () => {
      const inputs = {discountCodes: ['SAVE10', 'FREESHIP']};
      const html = await render(
        <CartForm route="/cart" action="DiscountCodesUpdate" inputs={inputs}>
          <input name="discountCode" />
        </CartForm>,
      );
      const submitted = new FormData();
      submitted.set(CART_FORM_INPUT_NAME, cartInputValue(html) ?? '');
      submitted.set('discountCode', 'NEW');

      const result = getFormInput(submitted);

      expect(result).toEqual({
        action: 'DiscountCodesUpdate',
        inputs: {...inputs, discountCode: 'NEW'},
      });
    });

    it('keeps hostile characters inside the attribute', async () => {
      const hostile = `"><script>alert(1)</script> & 'quotes' é🎉`;
      const html = await render(
        <CartForm
          route="/cart"
          action="DiscountCodesUpdate"
          inputs={{discountCodes: [hostile]}}
        >
          <button type="submit">Apply</button>
        </CartForm>,
      );

      expect(html).not.toContain('<script>alert(1)</script>');
      expect(JSON.parse(cartInputValue(html) ?? 'null')).toEqual({
        action: 'DiscountCodesUpdate',
        inputs: {discountCodes: [hostile]},
      });
    });

    it('is left out when there is neither an action nor inputs', async () => {
      const html = await render(
        <LooseCartForm>
          <button type="submit">Go</button>
        </LooseCartForm>,
      );

      expect(cartInputValue(html)).toBeUndefined();
      expect(html).toContain('<button type="submit">Go</button>');
    });

    it('is written when there are inputs but no action', async () => {
      const html = await render(
        <LooseCartForm inputs={{note: 'hi'}}>
          <button type="submit">Go</button>
        </LooseCartForm>,
      );

      expect(cartInputValue(html)).toBe('{"inputs":{"note":"hi"}}');
    });
  });

  describe('the fetcher key', () => {
    it('is passed on to useFetcher', async () => {
      await render(
        <CartForm
          route="/cart"
          fetcherKey="cart-discount-codes"
          action="DiscountCodesUpdate"
          inputs={{discountCodes: []}}
        >
          <button type="submit">Apply</button>
        </CartForm>,
      );

      expect(fetcherOptions).toContainEqual({key: 'cart-discount-codes'});
    });

    it('is left to React Router when none is given', async () => {
      await render(
        <CartForm route="/cart" action="LinesAdd" inputs={{lines: LINES}}>
          <button type="submit">Add</button>
        </CartForm>,
      );

      expect(fetcherOptions).toEqual([{key: undefined}]);
    });
  });

  describe('the static members', () => {
    it('exposes the action names', () => {
      expect(CartForm.ACTIONS).toBe(CART_ACTIONS);
      expect(CartForm.ACTIONS.LinesAdd).toBe('LinesAdd');
    });

    it('exposes the name of the hidden field', () => {
      expect(CartForm.INPUT_NAME).toBe('cartFormInput');
    });

    it('exposes getFormInput', () => {
      expect(CartForm.getFormInput).toBe(getFormInput);
    });
  });
});
