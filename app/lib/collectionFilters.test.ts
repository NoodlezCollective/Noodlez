import {describe, expect, it} from 'vitest';
import {
  CATALOG_SORT_OPTIONS,
  COLLECTION_SORT_OPTIONS,
  applySortParams,
  clearFilterParams,
  countAppliedFilters,
  currencySymbol,
  filterInputToParam,
  formatPrice,
  formatPriceRange,
  getPriceFilter,
  getProductFilters,
  getSortOption,
  getSortVariables,
  isFilterValueActive,
  parseAppliedFilters,
  parseFilterInput,
  pluralize,
  removeFilterParam,
  toPriceFilter,
} from './collectionFilters';

/** Builds search params from raw (already decoded) name/value pairs. */
function params(...pairs: Array<[string, string]>) {
  const search = new URLSearchParams();
  for (const [name, value] of pairs) search.append(name, value);
  return search;
}

const json = JSON.stringify;

describe('toPriceFilter', () => {
  it('builds a range from numbers', () => {
    expect(toPriceFilter(20, 120)).toEqual({min: 20, max: 120});
  });

  it('parses numeric strings, as submitted by the price inputs', () => {
    expect(toPriceFilter('20', '99.5')).toEqual({min: 20, max: 99.5});
    expect(toPriceFilter(' 20 ', '')).toEqual({min: 20});
  });

  it('keeps a single bound', () => {
    expect(toPriceFilter('15', '')).toEqual({min: 15});
    expect(toPriceFilter(null, 80)).toEqual({max: 80});
  });

  it('accepts zero as a bound', () => {
    expect(toPriceFilter(0, 50)).toEqual({min: 0, max: 50});
    expect(toPriceFilter('0', '')).toEqual({min: 0});
  });

  it('swaps an inverted range instead of returning nothing', () => {
    expect(toPriceFilter(120, 20)).toEqual({min: 20, max: 120});
  });

  it.each([
    ['both bounds missing', undefined, undefined],
    ['null bounds', null, null],
    ['empty strings', '', ''],
    ['blank strings', '   ', ' '],
    ['negative numbers', -5, -1],
    ['text', 'cheap', 'expensive'],
    ['NaN', Number.NaN, Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
    ['booleans', true, false],
    ['arrays', [5], [10]],
    ['objects', {amount: 5}, {amount: 10}],
    ['overflowing exponents', '1e999', '-1e999'],
  ])('drops %s', (_label, min, max) => {
    expect(toPriceFilter(min, max)).toBeNull();
  });

  it('drops only the invalid bound', () => {
    expect(toPriceFilter('abc', 40)).toEqual({max: 40});
    expect(toPriceFilter(10, -3)).toEqual({min: 10});
  });
});

describe('parseFilterInput', () => {
  it('parses a JSON string into a plain object', () => {
    expect(parseFilterInput('{"available":true}')).toEqual({available: true});
  });

  it('passes an already parsed object through', () => {
    expect(parseFilterInput({tag: 'new'})).toEqual({tag: 'new'});
  });

  it.each([
    ['invalid JSON', '{nope'],
    ['an array', '[1,2]'],
    ['a string', '"text"'],
    ['null', 'null'],
    ['a number', '5'],
    ['undefined', undefined],
    ['an array object', [1]],
  ])('returns null for %s', (_label, input) => {
    expect(parseFilterInput(input)).toBeNull();
  });
});

describe('filterInputToParam', () => {
  it('turns a variant option into its URL parameter', () => {
    // Arrange
    const input = '{"variantOption":{"name":"Color","value":"Blue"}}';

    // Act
    const param = filterInputToParam(input);

    // Assert
    expect(param).toEqual({
      key: 'variantOption',
      name: 'filter.variantOption',
      value: '{"name":"Color","value":"Blue"}',
    });
  });

  it('accepts the parsed form of the input too', () => {
    expect(filterInputToParam({productType: 'Pillow'})).toEqual({
      key: 'productType',
      name: 'filter.productType',
      value: '"Pillow"',
    });
  });

  it('normalises a price range', () => {
    expect(filterInputToParam({price: {min: '20', max: 120}})?.value).toBe(
      '{"min":20,"max":120}',
    );
  });

  it.each([
    ['unknown key', '{"colour":"Blue"}'],
    ['inherited object key', '{"constructor":{"id":"x"}}'],
    ['prototype key', '{"__proto__":{"id":"x"}}'],
    ['empty object', '{}'],
    ['malformed JSON', '{"tag"'],
    ['a non-object', '"tag"'],
    ['category given as an array', '{"category":[]}'],
    ['metafield given as an array', '{"productMetafield":[1]}'],
    [
      'metafield missing its value',
      '{"variantMetafield":{"namespace":"a","key":"b"}}',
    ],
    ['non-boolean availability', '{"available":"true"}'],
  ])('returns null for %s', (_label, input) => {
    expect(filterInputToParam(input)).toBeNull();
  });
});

describe('parseAppliedFilters', () => {
  describe('valid filters', () => {
    it('reads every supported filter key with its API value', () => {
      // Arrange
      const search = params(
        ['filter.available', 'true'],
        ['filter.productType', '"Pillow"'],
        ['filter.productVendor', '"Mellow"'],
        ['filter.tag', '"bestseller"'],
        ['filter.price', json({min: 20, max: 120})],
        ['filter.variantOption', json({name: 'Color', value: 'Blue'})],
        ['filter.category', json({id: 'gid://shopify/TaxonomyCategory/hg-1'})],
        [
          'filter.productMetafield',
          json({namespace: 'custom', key: 'fill', value: 'Down'}),
        ],
        [
          'filter.taxonomyMetafield',
          json({namespace: 'shopify', key: 'color', value: 'blue'}),
        ],
        [
          'filter.variantMetafield',
          json({namespace: 'custom', key: 'size', value: 'King'}),
        ],
      );

      // Act
      const applied = parseAppliedFilters(search);

      // Assert
      expect(applied.map((filter) => filter.filter)).toEqual([
        {available: true},
        {productType: 'Pillow'},
        {productVendor: 'Mellow'},
        {tag: 'bestseller'},
        {price: {min: 20, max: 120}},
        {variantOption: {name: 'Color', value: 'Blue'}},
        {category: {id: 'gid://shopify/TaxonomyCategory/hg-1'}},
        {productMetafield: {namespace: 'custom', key: 'fill', value: 'Down'}},
        {
          taxonomyMetafield: {
            namespace: 'shopify',
            key: 'color',
            value: 'blue',
          },
        },
        {variantMetafield: {namespace: 'custom', key: 'size', value: 'King'}},
      ]);
    });

    it('keeps repeated values of one key (OR within a group)', () => {
      const search = params(
        ['filter.variantOption', json({name: 'Color', value: 'Blue'})],
        ['filter.variantOption', json({name: 'Color', value: 'Cream'})],
      );

      expect(getProductFilters(search)).toEqual([
        {variantOption: {name: 'Color', value: 'Blue'}},
        {variantOption: {name: 'Color', value: 'Cream'}},
      ]);
    });

    it('records the raw parameter so the filter can be removed again', () => {
      const search = params(['filter.tag', '"a"']);

      expect(parseAppliedFilters(search)).toEqual([
        {
          key: 'tag',
          paramName: 'filter.tag',
          paramValue: '"a"',
          value: 'a',
          filter: {tag: 'a'},
        },
      ]);
    });

    it('ignores parameters that are not filters', () => {
      const search = params(
        ['sort_key', 'PRICE'],
        ['q', 'pillow'],
        ['cursor', 'abc'],
        ['filter', 'true'],
      );

      expect(parseAppliedFilters(search)).toEqual([]);
    });
  });

  describe('hostile query strings', () => {
    it.each([
      ['an empty array', '[]'],
      ['an array of numbers', '[1]'],
      ['an array holding the shape', '[{"id":"gid://x/1"}]'],
      ['a string', '"gid://x/1"'],
      ['a number', '5'],
      ['a boolean', 'true'],
      ['null', 'null'],
      ['an empty object', '{}'],
      ['a missing id', '{"name":"x"}'],
      ['a numeric id', '{"id":123}'],
      ['an object id', '{"id":{"nested":1}}'],
      ['an empty id', '{"id":""}'],
      ['invalid JSON', '{"id":'],
    ])('drops a category given as %s', (_label, value) => {
      expect(parseAppliedFilters(params(['filter.category', value]))).toEqual(
        [],
      );
    });

    it('rebuilds a category so unknown fields never reach GraphQL', () => {
      const search = params([
        'filter.category',
        json({id: 'gid://x/1', evil: {__proto__: 1}, extra: [1, 2]}),
      ]);

      expect(getProductFilters(search)).toEqual([
        {category: {id: 'gid://x/1'}},
      ]);
    });

    describe.each([
      'productMetafield',
      'taxonomyMetafield',
      'variantMetafield',
    ])('%s (namespace, key and value strings)', (key) => {
      const valid = {namespace: 'custom', key: 'fill', value: 'Down'};

      it('accepts a complete filter', () => {
        expect(
          getProductFilters(params([`filter.${key}`, json(valid)])),
        ).toEqual([{[key]: valid}]);
      });

      it.each([
        '[]',
        '[1]',
        json([valid]),
        '"text"',
        '5',
        'null',
        '{}',
        json({namespace: 'custom', key: 'fill'}),
        json({namespace: 'custom', value: 'Down'}),
        json({key: 'fill', value: 'Down'}),
        json({...valid, value: 5}),
        json({...valid, value: true}),
        json({...valid, namespace: ['custom']}),
        json({...valid, key: {a: 1}}),
        json({...valid, namespace: ''}),
        json({...valid, key: ''}),
        json({...valid, value: ''}),
        '{"namespace":"a"',
      ])('drops the value %s', (value) => {
        expect(parseAppliedFilters(params([`filter.${key}`, value]))).toEqual(
          [],
        );
      });
    });

    it('rebuilds a metafield filter without extra fields', () => {
      const search = params([
        'filter.productMetafield',
        json({namespace: 'a', key: 'b', value: 'c', admin: true}),
      ]);

      expect(getProductFilters(search)).toEqual([
        {productMetafield: {namespace: 'a', key: 'b', value: 'c'}},
      ]);
    });

    it.each([
      ['filter.available', '"true"'],
      ['filter.available', '1'],
      ['filter.available', 'null'],
      ['filter.productType', '[]'],
      ['filter.productType', '""'],
      ['filter.productType', '{"a":1}'],
      ['filter.productVendor', '5'],
      ['filter.tag', 'true'],
      ['filter.tag', '["a"]'],
      ['filter.price', '[]'],
      ['filter.price', '{}'],
      ['filter.price', '"20"'],
      ['filter.price', '{"min":-5}'],
      ['filter.price', '{"min":"cheap","max":null}'],
      ['filter.variantOption', '[]'],
      ['filter.variantOption', '{"name":"Color"}'],
      ['filter.variantOption', '{"name":1,"value":2}'],
      ['filter.variantOption', '"Color"'],
    ])('drops %s=%s', (name, value) => {
      expect(parseAppliedFilters(params([name, value]))).toEqual([]);
    });

    it.each([
      'filter.',
      'filter.constructor',
      'filter.toString',
      'filter.__proto__',
      'filter.hasOwnProperty',
      'filter.unknown',
      'filter.available.extra',
      'Filter.available',
      ' filter.available',
    ])('ignores the unsupported parameter %j', (name) => {
      expect(parseAppliedFilters(params([name, 'true']))).toEqual([]);
    });

    it('never throws on undecodable or malformed values', () => {
      const search = new URLSearchParams(
        'filter.tag=%E0%A4%A&filter.price=%7B&filter.available=%00&filter.category=%',
      );

      expect(() => parseAppliedFilters(search)).not.toThrow();
      expect(parseAppliedFilters(search)).toEqual([]);
    });

    it('keeps the valid filters when some are hostile', () => {
      const search = params(
        ['filter.category', '[]'],
        ['filter.tag', '"sale"'],
        ['filter.productMetafield', '[1]'],
        ['filter.available', 'true'],
      );

      expect(getProductFilters(search)).toEqual([
        {tag: 'sale'},
        {available: true},
      ]);
      expect(countAppliedFilters(search)).toBe(2);
    });

    it('survives a very large number of parameters', () => {
      const search = new URLSearchParams();
      for (let i = 0; i < 5000; i += 1) {
        search.append('filter.tag', json(`tag-${i}`));
        search.append('filter.category', '[]');
      }

      const started = performance.now();
      const applied = parseAppliedFilters(search);

      expect(applied).toHaveLength(5000);
      expect(performance.now() - started).toBeLessThan(500);
    });
  });
});

describe('isFilterValueActive', () => {
  it('matches a filter value present in the URL', () => {
    const input = '{"variantOption":{"name":"Color","value":"Blue"}}';
    const search = params([
      'filter.variantOption',
      json({name: 'Color', value: 'Blue'}),
    ]);

    expect(isFilterValueActive(search, input)).toBe(true);
    expect(isFilterValueActive(params(), input)).toBe(false);
  });

  it('is false for an input that is not a valid filter', () => {
    expect(isFilterValueActive(params(['filter.tag', '"a"']), '{"x":1}')).toBe(
      false,
    );
    expect(isFilterValueActive(params(), undefined)).toBe(false);
  });
});

describe('getPriceFilter', () => {
  it('returns the price range from the URL', () => {
    expect(
      getPriceFilter(params(['filter.price', json({min: 10, max: 30})])),
    ).toEqual({min: 10, max: 30});
  });

  it('returns null without a (valid) price', () => {
    expect(getPriceFilter(params())).toBeNull();
    expect(getPriceFilter(params(['filter.price', '[]']))).toBeNull();
  });
});

describe('removeFilterParam', () => {
  it('removes one value of a repeated filter and keeps the rest', () => {
    // Arrange
    const search = params(
      ['filter.tag', '"a"'],
      ['filter.tag', '"b"'],
      ['sort_key', 'PRICE'],
      ['cursor', 'xyz'],
      ['direction', 'next'],
    );

    // Act
    const next = removeFilterParam(search, {
      paramName: 'filter.tag',
      paramValue: '"a"',
    });

    // Assert
    expect(next.getAll('filter.tag')).toEqual(['"b"']);
    expect(next.get('sort_key')).toBe('PRICE');
    expect(next.has('cursor')).toBe(false);
    expect(next.has('direction')).toBe(false);
  });

  it('does not mutate the original params', () => {
    const search = params(['filter.tag', '"a"'], ['cursor', 'xyz']);

    removeFilterParam(search, {paramName: 'filter.tag', paramValue: '"a"'});

    expect(search.toString()).toBe(
      new URLSearchParams('filter.tag=%22a%22&cursor=xyz').toString(),
    );
  });
});

describe('clearFilterParams', () => {
  it('drops every filter and pagination parameter but keeps the sort', () => {
    const search = params(
      ['filter.tag', '"a"'],
      ['filter.available', 'true'],
      ['filter.junk', 'x'],
      ['sort_key', 'PRICE'],
      ['reverse', 'true'],
      ['cursor', 'abc'],
    );

    const next = clearFilterParams(search);

    expect(next.toString()).toBe('sort_key=PRICE&reverse=true');
  });
});

describe('sorting', () => {
  describe('getSortOption (collections)', () => {
    it.each([
      ['no parameters', '', 'featured'],
      ['best selling', 'sort_key=BEST_SELLING', 'best-selling'],
      ['price ascending', 'sort_key=PRICE', 'price-asc'],
      ['price descending', 'sort_key=PRICE&reverse=true', 'price-desc'],
      ['newest first', 'sort_key=CREATED&reverse=true', 'newest'],
      ['title', 'sort_key=TITLE', 'title'],
    ])('resolves %s', (_label, query, expectedId) => {
      const option = getSortOption(
        new URLSearchParams(query),
        COLLECTION_SORT_OPTIONS,
      );

      expect(option.id).toBe(expectedId);
    });

    it.each([
      'sort_key=BOGUS',
      'sort_key=',
      'sort_key=constructor',
      'sort_key=__proto__',
      'sort_key=price',
      'sort_key=PRICE%00',
      'reverse=true',
      'sort_key=%E0%A4%A',
    ])('falls back to the default option for %s', (query) => {
      const option = getSortOption(
        new URLSearchParams(query),
        COLLECTION_SORT_OPTIONS,
      );

      expect(option.id).toBe('featured');
    });

    it('treats any reverse value other than "true" as not reversed', () => {
      const option = getSortOption(
        new URLSearchParams('sort_key=PRICE&reverse=1'),
        COLLECTION_SORT_OPTIONS,
      );

      expect(option.id).toBe('price-asc');
    });

    it('uses the closest option when the direction does not match exactly', () => {
      const option = getSortOption(
        new URLSearchParams('sort_key=CREATED&reverse=false'),
        COLLECTION_SORT_OPTIONS,
      );

      expect(option.id).toBe('newest');
    });
  });

  describe('getSortVariables', () => {
    it('returns the API sort key and direction', () => {
      expect(
        getSortVariables(
          new URLSearchParams('sort_key=PRICE&reverse=true'),
          COLLECTION_SORT_OPTIONS,
        ),
      ).toEqual({sortKey: 'PRICE', reverse: true});
    });

    it('uses the catalog key names for the shop-all listing', () => {
      expect(
        getSortVariables(
          new URLSearchParams('sort_key=CREATED_AT&reverse=true'),
          CATALOG_SORT_OPTIONS,
        ),
      ).toEqual({sortKey: 'CREATED_AT', reverse: true});
    });

    it('defaults to the first option of the list', () => {
      expect(
        getSortVariables(new URLSearchParams(), CATALOG_SORT_OPTIONS),
      ).toEqual({sortKey: 'BEST_SELLING', reverse: false});
      expect(
        getSortVariables(new URLSearchParams(), COLLECTION_SORT_OPTIONS),
      ).toEqual({sortKey: 'COLLECTION_DEFAULT', reverse: false});
    });

    it('does not accept collection-only keys for the catalog', () => {
      expect(
        getSortVariables(
          new URLSearchParams('sort_key=COLLECTION_DEFAULT'),
          CATALOG_SORT_OPTIONS,
        ).sortKey,
      ).toBe('BEST_SELLING');
    });
  });

  describe('applySortParams', () => {
    const priceDesc = COLLECTION_SORT_OPTIONS.find(
      (option) => option.id === 'price-desc',
    )!;
    const priceAsc = COLLECTION_SORT_OPTIONS.find(
      (option) => option.id === 'price-asc',
    )!;

    it('writes the sort key and direction for a non-default option', () => {
      const next = applySortParams(
        new URLSearchParams('filter.tag=%22a%22&cursor=abc&direction=next'),
        priceDesc,
        COLLECTION_SORT_OPTIONS,
      );

      expect(next.get('sort_key')).toBe('PRICE');
      expect(next.get('reverse')).toBe('true');
      expect(next.get('filter.tag')).toBe('"a"');
      expect(next.has('cursor')).toBe(false);
      expect(next.has('direction')).toBe(false);
    });

    it('omits the direction for ascending options and replaces an old one', () => {
      const next = applySortParams(
        new URLSearchParams('sort_key=PRICE&reverse=true'),
        priceAsc,
        COLLECTION_SORT_OPTIONS,
      );

      expect(next.get('sort_key')).toBe('PRICE');
      expect(next.has('reverse')).toBe(false);
    });

    it('clears the sort parameters for the default option', () => {
      const next = applySortParams(
        new URLSearchParams('sort_key=PRICE&reverse=true&filter.tag=%22a%22'),
        COLLECTION_SORT_OPTIONS[0],
        COLLECTION_SORT_OPTIONS,
      );

      expect(next.toString()).toBe('filter.tag=%22a%22');
    });
  });
});

describe('formatPrice', () => {
  it.each([
    [20, '$20'],
    [0, '$0'],
    [1000, '$1,000'],
    [19.5, '$19.50'],
    [19.99, '$19.99'],
    [0.5, '$0.50'],
    [1234.56, '$1,234.56'],
    [0.1 + 0.2, '$0.30'],
    [99.999, '$100.00'],
  ])('formats %d as %s', (amount, expected) => {
    expect(formatPrice(amount)).toBe(expected);
  });

  it('supports other currencies', () => {
    expect(formatPrice(19.5, 'EUR')).toBe('€19.50');
    expect(formatPrice(1500, 'JPY')).toBe('¥1,500');
  });
});

describe('formatPriceRange (filter chip labels)', () => {
  it('labels a closed range', () => {
    expect(formatPriceRange({min: 20, max: 120})).toBe('$20 – $120');
  });

  it('labels an open-ended range', () => {
    expect(formatPriceRange({min: 20})).toBe('From $20');
    expect(formatPriceRange({max: 120})).toBe('Up to $120');
  });

  it('uses two decimals only where needed', () => {
    expect(formatPriceRange({min: 19.5, max: 99})).toBe('$19.50 – $99');
    expect(formatPriceRange({min: 0, max: 49.99})).toBe('$0 – $49.99');
  });

  it('labels an empty range', () => {
    expect(formatPriceRange({})).toBe('Any price');
  });

  it('formats in the given currency', () => {
    expect(formatPriceRange({min: 10}, 'EUR')).toBe('From €10');
  });
});

describe('currencySymbol', () => {
  it('returns the symbol of the currency', () => {
    expect(currencySymbol()).toBe('$');
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('GBP')).toBe('£');
  });
});

describe('pluralize', () => {
  it('uses the singular for exactly one', () => {
    expect(pluralize(1, 'product')).toBe('1 product');
  });

  it('uses the plural for zero and many, with grouping', () => {
    expect(pluralize(0, 'product')).toBe('0 products');
    expect(pluralize(2, 'product')).toBe('2 products');
    expect(pluralize(1234, 'product')).toBe('1,234 products');
  });

  it('accepts an irregular plural', () => {
    expect(pluralize(3, 'category', 'categories')).toBe('3 categories');
  });
});
