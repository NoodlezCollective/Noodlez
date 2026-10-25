import {describe, expect, it} from 'vitest';
import {
  CART_QUERY_FRAGMENT,
  FOOTER_QUERY,
  HEADER_QUERY,
  PRODUCT_CARD_FRAGMENT,
} from '~/lib/fragments';
import {
  getOperationName,
  isMutationDocument,
  isQueryDocument,
  minifyQuery,
  parseJson,
} from './graphql';

/**
 * Hydrogen 2026.4.7's `minifyQuery`, kept here as the parity oracle.
 *
 * Test documents below are plain strings on purpose: codegen plucks every
 * template literal that starts with the graphql marker, test files included.
 */
function hydrogenMinifyQuery(document: string): string {
  return document
    .replace(/\s*#.*$/gm, '')
    .replace(/\s+/gm, ' ')
    .trim();
}

const SHOP_QUERY = [
  '#graphql',
  '  # The shop name for the header',
  '  query Shop($country: CountryCode, $language: LanguageCode)',
  '  @inContext(country: $country, language: $language) {',
  '    shop {',
  '      name # trailing comment',
  '    }',
  '  }',
  '',
].join('\n');

describe('minifyQuery', () => {
  it('drops the graphql marker and comments and collapses whitespace', () => {
    expect(minifyQuery(SHOP_QUERY)).toBe(
      'query Shop($country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) { shop { name } }',
    );
  });

  it.each([
    ['HEADER_QUERY', HEADER_QUERY],
    ['FOOTER_QUERY', FOOTER_QUERY],
    ['PRODUCT_CARD_FRAGMENT', PRODUCT_CARD_FRAGMENT],
    ['CART_QUERY_FRAGMENT', CART_QUERY_FRAGMENT],
    ['a hand-written document', SHOP_QUERY],
  ])('matches Hydrogen byte for byte on %s', (_name, document) => {
    const minified = minifyQuery(document);

    expect(minified).toBe(hydrogenMinifyQuery(document));
    expect(minified).not.toMatch(/\n|\s{2}|#/);
  });

  it('returns an empty string for an empty or comment-only document', () => {
    expect(minifyQuery('')).toBe('');
    expect(minifyQuery('#graphql\n  # nothing here\n')).toBe('');
  });

  it('keeps Hydrogen treating every # as a comment, so values with # must be variables', () => {
    expect(
      minifyQuery('query Q { products(query: "tag:#sale") { nodes { id } } }'),
    ).toBe('query Q { products(query: "tag:');
  });
});

describe('isQueryDocument and isMutationDocument', () => {
  it.each([
    ['a named query', 'query Shop { shop { name } }'],
    [
      'a query with variables',
      'query Product($handle: String!) { product(handle: $handle) { id } }',
    ],
    ['an anonymous query keyword', 'query { shop { name } }'],
    [
      'an anonymous query with variables',
      'query($id: ID!) { node(id: $id) { id } }',
    ],
    ['an indented document with the graphql marker', SHOP_QUERY],
    [
      'a query after a fragment',
      'fragment ShopName on Shop { name } query Shop { shop { ...ShopName } }',
    ],
    [
      'a query with a field named like a mutation',
      'query Q { shop { mutationCount } }',
    ],
  ])('recognises %s as a query only', (_name, document) => {
    expect(isQueryDocument(document)).toBe(true);
    expect(isMutationDocument(document)).toBe(false);
  });

  it.each([
    ['a named mutation', 'mutation CartCreate { cartCreate { cart { id } } }'],
    [
      'a mutation with variables',
      'mutation M($id: ID!) { cartCreate(input: {}) { cart { id } } }',
    ],
    [
      'an anonymous mutation keyword',
      'mutation { cartCreate { cart { id } } }',
    ],
    [
      'a mutation after a fragment',
      'fragment CartId on Cart { id }\nmutation CartCreate { cartCreate { cart { ...CartId } } }',
    ],
  ])('recognises %s as a mutation only', (_name, document) => {
    expect(isMutationDocument(document)).toBe(true);
    expect(isQueryDocument(document)).toBe(false);
  });

  it.each([
    ['the anonymous { shop } shorthand', '{ shop { name } }'],
    ['a fragment-only document', 'fragment ShopName on Shop { name }'],
    ['an empty document', ''],
    ['a commented-out operation', '# query Shop { shop { name } }'],
  ])(
    'recognises %s as neither, so query() and mutate() both refuse it',
    (_name, document) => {
      expect(isQueryDocument(document)).toBe(false);
      expect(isMutationDocument(document)).toBe(false);
    },
  );
});

describe('getOperationName', () => {
  it.each([
    ['query Shop { shop { name } }', 'Shop'],
    [
      'query Product($handle: String!) { product(handle: $handle) { id } }',
      'Product',
    ],
    ['query Header @inContext(language: EN) { shop { name } }', 'Header'],
    [
      'mutation cartDiscountCodesUpdate($cartId: ID!) { x }',
      'cartDiscountCodesUpdate',
    ],
    ['query _Shop2 { shop { name } }', '_Shop2'],
    [
      'fragment ShopName on Shop { name } query Shop { shop { ...ShopName } }',
      'Shop',
    ],
    ['# query Fake { a }\nquery Real { shop { name } }', 'Real'],
    [SHOP_QUERY, 'Shop'],
    [HEADER_QUERY, 'Header'],
  ])('reads the operation name of %j', (document, name) => {
    expect(getOperationName(document)).toBe(name);
  });

  it.each([
    '{ shop { name } }',
    'query { shop { name } }',
    'query($id: ID!) { node(id: $id) { id } }',
    'mutation { cartCreate { cart { id } } }',
    'fragment ShopName on Shop { name }',
    '',
  ])('returns "anonymous" for %j', (document) => {
    expect(getOperationName(document)).toBe('anonymous');
  });
});

describe('parseJson', () => {
  it('parses JSON like JSON.parse', () => {
    expect(parseJson('{"data":{"shop":{"name":"Mellow"}}}')).toEqual({
      data: {shop: {name: 'Mellow'}},
    });
    expect(parseJson('[1,"two",null]')).toEqual([1, 'two', null]);
    expect(parseJson('42')).toBe(42);
  });

  it('drops "__proto__" keys at every depth', () => {
    const parsed = parseJson<Record<string, Record<string, unknown>>>(
      '{"a":1,"__proto__":{"polluted":true},"nested":{"__proto__":{"polluted":true},"b":2}}',
    );

    expect(parsed).toEqual({a: 1, nested: {b: 2}});
    expect(Object.hasOwn(parsed, '__proto__')).toBe(false);
    expect(Object.hasOwn(parsed.nested, '__proto__')).toBe(false);
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
  });

  it('keeps copies of the result free of injected prototypes', () => {
    // JSON.parse alone creates an own "__proto__" key, which Object.assign
    // then uses as the prototype of the copy.
    const raw = '{"__proto__":{"polluted":true}}';
    expect(
      (Object.assign({}, JSON.parse(raw)) as {polluted?: boolean}).polluted,
    ).toBe(true);

    const copy = Object.assign({}, parseJson(raw)) as {polluted?: boolean};

    expect(copy.polluted).toBeUndefined();
  });

  it.each([
    [
      'one escaped character',
      String.raw`{"\u005f_proto__":{"polluted":true},"a":1}`,
    ],
    [
      'every character escaped',
      String.raw`{"\u005f\u005f\u0070\u0072\u006f\u0074\u006f\u005f\u005f":{"polluted":true},"a":1}`,
    ],
  ])(
    'drops a "__proto__" key written with Unicode escapes (%s)',
    (_name, raw) => {
      // The text never spells the key out; JSON.parse decodes it.
      expect(raw).not.toContain('__proto__');

      const parsed = parseJson<Record<string, unknown>>(raw);

      expect(parsed).toEqual({a: 1});
      expect(Object.hasOwn(parsed, '__proto__')).toBe(false);
      expect(
        (Object.assign({}, parsed) as {polluted?: boolean}).polluted,
      ).toBeUndefined();
    },
  );

  it('drops escaped "__proto__" keys in nested objects', () => {
    const parsed = parseJson<{nested: Record<string, unknown>}>(
      String.raw`{"nested":{"b":2,"\u005f_proto__":{"polluted":true}}}`,
    );

    expect(parsed).toEqual({nested: {b: 2}});
    expect(Object.hasOwn(parsed.nested, '__proto__')).toBe(false);
  });

  it('keeps "__proto__" when it is only a value', () => {
    expect(parseJson('{"note":"__proto__"}')).toEqual({note: '__proto__'});
  });

  it('throws a SyntaxError on invalid JSON', () => {
    expect(() => parseJson('not json')).toThrow(SyntaxError);
    expect(() => parseJson('{"__proto__":')).toThrow(SyntaxError);
  });
});
