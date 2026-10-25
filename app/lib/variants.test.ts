import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  findOptimisticVariant,
  getSelectedProductOptions,
  resolveVariantList,
  useOptimisticVariant,
} from './variants';

// The hook only reads the navigation: stand it in so the hook can be rendered
// on the server, where there is no data router to navigate with.
const navigation = vi.hoisted(() => ({
  current: {state: 'idle'} as {state: string; location?: {search: string}},
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {...actual, useNavigation: () => navigation.current};
});

const STANDARD = {
  id: 'standard',
  selectedOptions: [{name: 'Size', value: 'Standard'}],
};
const KING = {id: 'king', selectedOptions: [{name: 'Size', value: 'King'}]};
const FULL_QUEEN = {
  id: 'full-queen',
  selectedOptions: [{name: 'Size', value: 'Full/Queen'}],
};

describe('getSelectedProductOptions', () => {
  const requestFor = (search: string) =>
    new Request(`https://shop.example/products/pillow${search}`);

  it('returns every search parameter as a name and value, in order', () => {
    // Act
    const options = getSelectedProductOptions(
      requestFor('?Size=King&Color=Baby+Blue'),
    );

    // Assert
    expect(options).toEqual([
      {name: 'Size', value: 'King'},
      {name: 'Color', value: 'Baby Blue'},
    ]);
  });

  it('decodes percent-encoded values', () => {
    expect(getSelectedProductOptions(requestFor('?Size=Full%2FQueen'))).toEqual(
      [{name: 'Size', value: 'Full/Queen'}],
    );
  });

  it('returns an empty list when there are no parameters', () => {
    expect(getSelectedProductOptions(requestFor(''))).toEqual([]);
  });

  it('includes parameters that are not product options', () => {
    expect(
      getSelectedProductOptions(requestFor('?utm_source=news&Size=King')),
    ).toEqual([
      {name: 'utm_source', value: 'news'},
      {name: 'Size', value: 'King'},
    ]);
  });

  it('keeps a repeated parameter as separate entries', () => {
    expect(
      getSelectedProductOptions(requestFor('?Size=King&Size=Queen')),
    ).toEqual([
      {name: 'Size', value: 'King'},
      {name: 'Size', value: 'Queen'},
    ]);
  });

  it.each([
    [undefined, 'undefined'],
    [null, 'object'],
    [{}, 'object'],
    ['https://shop.example/products/pillow', 'string'],
    [42, 'number'],
  ])('throws a TypeError naming the type when given %j', (value, typeName) => {
    expect(() => getSelectedProductOptions(value as never)).toThrow(
      new TypeError(`Expected a Request instance, got ${typeName}`),
    );
  });
});

describe('findOptimisticVariant', () => {
  const variants = [STANDARD, KING, FULL_QUEEN];

  it('finds the variant whose options match the search', () => {
    expect(findOptimisticVariant(variants, '?Size=King')).toBe(KING);
  });

  it('accepts a search string without the leading question mark', () => {
    expect(findOptimisticVariant(variants, 'Size=King')).toBe(KING);
  });

  it('decodes encoded values', () => {
    expect(findOptimisticVariant(variants, '?Size=Full%2FQueen')).toBe(
      FULL_QUEEN,
    );
  });

  it('ignores parameters that are not options', () => {
    expect(
      findOptimisticVariant(variants, '?utm_source=news&Size=King&ref=x'),
    ).toBe(KING);
  });

  it.each([
    ['no variant matches', '?Size=Huge'],
    ['the search is empty', ''],
    ['the option name differs in case', '?size=King'],
    ['the option value differs in case', '?Size=king'],
  ])('finds nothing when %s', (_label, search) => {
    expect(findOptimisticVariant(variants, search)).toBeUndefined();
  });

  it('finds nothing in an empty list', () => {
    expect(findOptimisticVariant([], '?Size=King')).toBeUndefined();
  });

  it('needs every option of a variant to match', () => {
    const blueKing = {
      id: 'blue-king',
      selectedOptions: [
        {name: 'Size', value: 'King'},
        {name: 'Color', value: 'Blue'},
      ],
    };
    const redKing = {
      id: 'red-king',
      selectedOptions: [
        {name: 'Size', value: 'King'},
        {name: 'Color', value: 'Red'},
      ],
    };

    expect(findOptimisticVariant([blueKing, redKing], '?Size=King')).toBe(
      undefined,
    );
    expect(
      findOptimisticVariant([blueKing, redKing], '?Size=King&Color=Red'),
    ).toBe(redKing);
  });

  it('skips variants that carry no selected options', () => {
    const withoutOptions = [{id: 'a'}, {id: 'b', selectedOptions: null}, KING];

    expect(findOptimisticVariant(withoutOptions, '?Size=King')).toBe(KING);
    expect(findOptimisticVariant(withoutOptions.slice(0, 2), '')).toBe(
      undefined,
    );
  });

  it('returns the first of several variants that match', () => {
    const twin = {id: 'twin', selectedOptions: KING.selectedOptions};

    expect(findOptimisticVariant([KING, twin], '?Size=King')).toBe(KING);
  });

  it('hands back the very variant it was given, whatever else it carries', () => {
    const richKing = {...KING, price: {amount: '49.0', currencyCode: 'USD'}};

    const found = findOptimisticVariant([richKing], '?Size=King');

    expect(found?.price.amount).toBe('49.0');
  });
});

describe('resolveVariantList', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves to the list a promise delivers', async () => {
    await expect(resolveVariantList(Promise.resolve([KING]))).resolves.toEqual([
      KING,
    ]);
  });

  it.each([
    undefined,
    null,
    {},
    'text',
    {product: {variants: {nodes: [KING]}}},
  ])(
    'resolves to no variants when the promise delivers %j',
    async (delivered) => {
      await expect(
        resolveVariantList(Promise.resolve(delivered)),
      ).resolves.toEqual([]);
    },
  );

  it('logs the failure with console.error and resolves to null when the promise rejects', async () => {
    // Arrange
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const cause = new Error('storefront is down');

    // Act
    const result = await resolveVariantList(Promise.reject(cause));

    // Assert
    expect(result).toBeNull();
    expect(consoleError).toHaveBeenCalledTimes(1);
    const [logged] = consoleError.mock.calls[0];
    expect(logged).toBeInstanceOf(Error);
    expect((logged as Error).message).toBe(
      '[useOptimisticVariant] An error occurred while resolving the variants for the optimistic product hook.',
    );
    expect((logged as Error).cause).toBe(cause);
  });
});

describe('useOptimisticVariant', () => {
  const variants = [STANDARD, KING, FULL_QUEEN];

  /** Renders the hook on the server and returns what it answered. */
  function useIt(selected: unknown, available: unknown) {
    let answer: unknown;
    function Probe() {
      answer = useOptimisticVariant(selected, available);
      return null;
    }
    renderToStaticMarkup(createElement(Probe));
    return answer;
  }

  const navigatingTo = (search: string, state = 'loading') => {
    navigation.current = {state, location: {search}};
  };

  beforeEach(() => {
    navigation.current = {state: 'idle'};
  });

  it('returns the variant the server selected while nothing is loading', () => {
    expect(useIt(STANDARD, variants)).toBe(STANDARD);
  });

  it('returns the variant the pending navigation selects, marked as optimistic', () => {
    // Arrange
    navigatingTo('?Size=King');

    // Act
    const answer = useIt(STANDARD, variants);

    // Assert
    expect(answer).toEqual({...KING, isOptimistic: true});
    expect(KING).not.toHaveProperty('isOptimistic');
  });

  it('returns the variant the server selected when the pending navigation selects none of them', () => {
    navigatingTo('?Size=Huge');

    expect(useIt(STANDARD, variants)).toBe(STANDARD);
  });

  it('only anticipates a navigation that is loading, not a submission', () => {
    navigatingTo('?Size=King', 'submitting');

    expect(useIt(STANDARD, variants)).toBe(STANDARD);
  });

  it.each([
    undefined,
    null,
    {},
    'text',
    {product: {variants: {nodes: [KING]}}},
  ])('has nothing to anticipate with %j for variants', (notAList) => {
    navigatingTo('?Size=King');

    expect(useIt(STANDARD, notAList)).toBe(STANDARD);
  });

  it('waits for variants that are still being fetched', () => {
    navigatingTo('?Size=King');

    expect(useIt(STANDARD, Promise.resolve(variants))).toBe(STANDARD);
  });
});
