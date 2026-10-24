import {describe, expect, it} from 'vitest';
import {FEATURE_ICONS} from '~/components/ui/Icons';
import {
  mapReviewMetaobjects,
  parseFeatures,
  parseInteger,
  parseJson,
  parseParagraphs,
  parseRating,
  parseStringList,
  parseSwatchGroups,
} from './metafields';

const field = (value: string | null | undefined, type?: string) => ({
  value,
  type,
});

describe('parseRating', () => {
  it.each([
    ['a plain number', '4.8', 4.8],
    ['an integer', '5', 5],
    ['zero', '0', 0],
    ['a padded number', '  3.5  ', 3.5],
    [
      'Shopify rating JSON',
      '{"scale_min":"1.0","scale_max":"5.0","value":"4.8"}',
      4.8,
    ],
    ['JSON with a numeric value', '{"value":4.2}', 4.2],
    ['JSON without a scale', '{"value":"4.2"}', 4.2],
    ['padded JSON', '  {"value":"3"}  ', 3],
  ])('reads %s', (_label, value, expected) => {
    expect(parseRating(field(value))).toBe(expected);
  });

  describe('scale_max', () => {
    it.each([
      ['a 10 point scale', '{"value":"8","scale_max":"10"}', 4],
      [
        'a fractional value on a 10 point scale',
        '{"value":"9.5","scale_max":"10"}',
        4.75,
      ],
      ['a 100 point scale', '{"value":"84","scale_max":"100"}', 4.2],
      ['a 3 point scale', '{"value":"1.5","scale_max":"3"}', 2.5],
      ['a numeric scale_max', '{"value":7,"scale_max":7}', 5],
      ['an explicit 5 point scale', '{"value":"4.5","scale_max":"5.0"}', 4.5],
      ['the lowest value on any scale', '{"value":"0","scale_max":"10"}', 0],
    ])('normalises %s to a 0 to 5 scale', (_label, value, expected) => {
      expect(parseRating(field(value))).toBeCloseTo(expected, 10);
    });

    it('never exceeds 5 for a full score on an awkward scale', () => {
      expect(parseRating(field('{"value":"4.7","scale_max":"4.7"}'))).toBe(5);
      expect(parseRating(field('{"value":"3","scale_max":"7"}'))).toBeLessThan(
        5,
      );
    });

    it.each(['0', '-5', 'abc', '', 'null'])(
      'ignores an unusable scale_max (%j) and keeps the 5 point scale',
      (scale) => {
        expect(
          parseRating(
            field(`{"value":"4","scale_max":${JSON.stringify(scale)}}`),
          ),
        ).toBe(4);
      },
    );
  });

  it.each([
    ['null field', null],
    ['undefined field', undefined],
    ['empty object', {}],
    ['null value', field(null)],
    ['undefined value', field(undefined)],
    ['empty string', field('')],
    ['blank string', field('   ')],
    ['text', field('five stars')],
    ['not a number', field('NaN')],
    ['invalid JSON', field('{"value":')],
    ['JSON without a value', field('{}')],
    ['JSON with a null value', field('{"value":null}')],
    ['JSON with an empty value', field('{"value":""}')],
    ['JSON with a text value', field('{"value":"great"}')],
    ['JSON with an object value', field('{"value":{"a":1}}')],
    ['JSON with an array value', field('{"value":[5]}')],
    ['JSON with a boolean value', field('{"value":true}')],
  ])('returns null for %s', (_label, input) => {
    expect(parseRating(input)).toBeNull();
  });

  it.each([
    ['above the scale', '7'],
    ['negative', '-1'],
    ['above a custom scale', '{"value":"11","scale_max":"10"}'],
    ['infinite', 'Infinity'],
  ])('returns null for a rating that is %s', (_label, value) => {
    expect(parseRating(field(value))).toBeNull();
  });
});

describe('parseInteger', () => {
  it.each([
    ['51644', 51644],
    ['  42 ', 42],
    ['12.7', 12],
  ])('reads %j as %d', (value, expected) => {
    expect(parseInteger(field(value))).toBe(expected);
  });

  it.each([null, undefined, '', 'abc'])('returns null for %j', (value) => {
    expect(parseInteger(field(value))).toBeNull();
    expect(parseInteger(null)).toBeNull();
  });
});

describe('parseJson', () => {
  it('returns the parsed value as unknown', () => {
    const parsed: unknown = parseJson(field('{"a":[1,2]}'));

    expect(parsed).toEqual({a: [1, 2]});
  });

  it('does not take a type argument, so callers must narrow the result', () => {
    // @ts-expect-error parseJson returns `unknown`; it is not generic.
    parseJson<{a: number}>(field('{"a":1}'));

    expect(parseJson(field('[1,"x",null]'))).toEqual([1, 'x', null]);
  });

  it.each([
    ['null field', null],
    ['undefined field', undefined],
    ['null value', field(null)],
    ['empty value', field('')],
    ['invalid JSON', field('{nope')],
    ['truncated JSON', field('{"a":')],
  ])('returns null for %s', (_label, input) => {
    expect(parseJson(input)).toBeNull();
  });

  it('keeps JSON primitives', () => {
    expect(parseJson(field('5'))).toBe(5);
    expect(parseJson(field('"text"'))).toBe('text');
    expect(parseJson(field('false'))).toBe(false);
  });
});

describe('parseStringList', () => {
  it('reads a JSON list metafield and keeps only non-empty strings', () => {
    expect(parseStringList(field('["a","","b",1,null,{"x":1},"c"]'))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('reads newline separated text, trimming and dropping blank lines', () => {
    expect(parseStringList(field(' one \r\n\r\n two\n   \nthree '))).toEqual([
      'one',
      'two',
      'three',
    ]);
  });

  it('keeps text that merely starts with a bracket', () => {
    expect(parseStringList(field('[New] Cooler cover'))).toEqual([
      '[New] Cooler cover',
    ]);
  });

  it('returns an empty list for a JSON value that is not an array', () => {
    expect(parseStringList(field('[]'))).toEqual([]);
  });

  it.each([null, undefined, '', '   \n  '])('returns [] for %j', (value) => {
    expect(parseStringList(field(value))).toEqual([]);
    expect(parseStringList(null)).toEqual([]);
  });
});

describe('parseFeatures', () => {
  it('reads "icon|text" entries from a list metafield', () => {
    // Arrange
    const input = field(
      JSON.stringify(['snowflake|Cool to the touch', 'wash|Machine washable']),
    );

    // Act
    const features = parseFeatures(input);

    // Assert
    expect(features).toEqual([
      {icon: 'snowflake', text: 'Cool to the touch'},
      {icon: 'wash', text: 'Machine washable'},
    ]);
  });

  it('normalises the case and padding of the icon key', () => {
    expect(parseFeatures(field('  Feather | Light as air '))).toEqual([
      {icon: 'feather', text: 'Light as air'},
    ]);
  });

  it('accepts every icon the storefront ships', () => {
    for (const key of Object.keys(FEATURE_ICONS)) {
      expect(parseFeatures(field(`${key}|Text`))).toEqual([
        {icon: key, text: 'Text'},
      ]);
    }
  });

  it('rotates default icons through entries without an icon', () => {
    // Arrange
    const lines = Array.from({length: 8}, (_, index) => `Feature ${index}`);

    // Act
    const icons = parseFeatures(field(lines.join('\n'))).map(
      (feature) => feature.icon,
    );

    // Assert
    expect(icons).toEqual([
      'snowflake',
      'heat',
      'couch',
      'wash',
      'feather',
      'moon',
      'snowflake',
      'heat',
    ]);
  });

  it('splits at the first pipe only', () => {
    expect(
      parseFeatures(field('wash|Machine washable | tumble dry low')),
    ).toEqual([{icon: 'wash', text: 'Machine washable | tumble dry low'}]);
  });

  it('does not truncate text whose prefix is not an icon', () => {
    // Arrange
    const input = field('Machine washable | tumble dry low');

    // Act
    const [feature] = parseFeatures(input);

    // Assert
    expect(feature).toEqual({
      icon: 'snowflake',
      text: 'Machine washable | tumble dry low',
    });
  });

  it.each([
    'constructor',
    'toString',
    'valueOf',
    '__proto__',
    'hasOwnProperty',
    'isPrototypeOf',
    '__defineGetter__',
  ])('never treats the inherited property "%s" as an icon', (key) => {
    // Arrange
    const input = field(`${key}|Soft`);

    // Act
    const [feature] = parseFeatures(input);

    // Assert: the whole line is kept and a real icon is used.
    expect(feature.text).toBe(`${key}|Soft`);
    expect(Object.hasOwn(FEATURE_ICONS, feature.icon)).toBe(true);
  });

  it('keeps a line that starts with a pipe as plain text', () => {
    expect(parseFeatures(field('|Orphan'))).toEqual([
      {icon: 'snowflake', text: '|Orphan'},
    ]);
  });

  it('drops an entry that has an icon but no text', () => {
    expect(parseFeatures(field('snowflake|  \nheat|Warm'))).toEqual([
      {icon: 'heat', text: 'Warm'},
    ]);
  });

  it.each([null, undefined, '', '[]'])('returns [] for %j', (value) => {
    expect(parseFeatures(field(value))).toEqual([]);
  });
});

describe('parseSwatchGroups', () => {
  it('reads groups of option values', () => {
    expect(
      parseSwatchGroups(
        field('{"Neutrals":["Cream","Stone"],"Brights":["Coral"]}'),
      ),
    ).toEqual({Neutrals: ['Cream', 'Stone'], Brights: ['Coral']});
  });

  it('keeps only string values and drops groups left empty', () => {
    expect(
      parseSwatchGroups(
        field('{"A":["x",1,null,"y"],"B":[],"C":[2],"D":"z","E":{"k":"v"}}'),
      ),
    ).toEqual({A: ['x', 'y']});
  });

  it.each([
    ['null', null],
    ['an empty value', field('')],
    ['invalid JSON', field('{"A":')],
    ['an array', field('["Cream"]')],
    ['a string', field('"Cream"')],
    ['a number', field('5')],
    ['JSON null', field('null')],
    ['an empty object', field('{}')],
    ['only invalid groups', field('{"A":[1],"B":"x"}')],
  ])('returns null for %s', (_label, input) => {
    expect(parseSwatchGroups(input)).toBeNull();
  });

  it('ignores a "__proto__" group instead of replacing the prototype', () => {
    // Arrange
    const input = field('{"__proto__":["polluted"],"Real":["Cream"]}');

    // Act
    const groups = parseSwatchGroups(input);

    // Assert
    expect(groups).toEqual({Real: ['Cream']});
    expect(Object.getPrototypeOf(groups)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('parseParagraphs', () => {
  it('splits multi-line text into trimmed paragraphs', () => {
    expect(parseParagraphs(field(' First.\n\n  Second.\r\nThird. \n'))).toEqual(
      ['First.', 'Second.', 'Third.'],
    );
  });

  it('flattens Shopify rich text into paragraphs', () => {
    // Arrange
    const doc = {
      type: 'root',
      children: [
        {
          type: 'heading',
          level: 2,
          children: [{type: 'text', value: 'Materials', bold: true}],
        },
        {
          type: 'paragraph',
          children: [
            {type: 'text', value: '100% '},
            {
              type: 'link',
              url: 'https://example.com',
              children: [{type: 'text', value: 'recycled'}],
            },
            {type: 'text', value: ' fill.'},
          ],
        },
        {
          type: 'list',
          listType: 'unordered',
          children: [
            {type: 'list-item', children: [{type: 'text', value: 'Soft'}]},
            {type: 'list-item', children: [{type: 'text', value: 'Light'}]},
          ],
        },
      ],
    };

    // Act
    const paragraphs = parseParagraphs(
      field(JSON.stringify(doc), 'rich_text_field'),
    );

    // Assert
    expect(paragraphs).toEqual([
      'Materials',
      '100% recycled fill.',
      '• Soft',
      '• Light',
    ]);
  });

  it('recognises rich text by its root even without the field type', () => {
    const doc =
      '{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","value":"Hi"}]}]}';

    expect(parseParagraphs(field(doc))).toEqual(['Hi']);
  });

  describe('malformed rich text', () => {
    it.each([
      ['string children', '{"type":"root","children":"oops"}'],
      ['object children', '{"type":"root","children":{"type":"text"}}'],
      ['numeric children', '{"type":"root","children":5}'],
      ['null children', '{"type":"root","children":null}'],
      ['missing children', '{"type":"root"}'],
      [
        'a list with string children',
        '{"type":"root","children":[{"type":"list","children":"x"}]}',
      ],
      [
        'a paragraph with string children',
        '{"type":"root","children":[{"type":"paragraph","children":"x"}]}',
      ],
      ['null nodes', '{"type":"root","children":[null,5,"x",[]]}'],
      ['a root that is an array', '[1,2,3]'],
      ['a root that is a string', '"text"'],
      ['a root that is null', 'null'],
      [
        'a non-string text value',
        '{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","value":{"a":1}}]}]}',
      ],
    ])('returns no paragraphs instead of throwing for %s', (_label, doc) => {
      expect(() =>
        parseParagraphs(field(doc, 'rich_text_field')),
      ).not.toThrow();
      expect(parseParagraphs(field(doc, 'rich_text_field'))).toEqual([]);
    });

    it('keeps the well-formed parts of a partly broken document', () => {
      const doc = JSON.stringify({
        type: 'root',
        children: [
          {type: 'paragraph', children: 'broken'},
          {type: 'paragraph', children: [{type: 'text', value: 'Kept'}]},
          null,
        ],
      });

      expect(parseParagraphs(field(doc, 'rich_text_field'))).toEqual(['Kept']);
    });

    it('does not overflow the stack on a deeply nested document', () => {
      // Arrange: built as text, because JSON.stringify would overflow itself.
      const depth = 20_000;
      const doc =
        '{"type":"root","children":[' +
        '{"type":"paragraph","children":['.repeat(depth) +
        '{"type":"text","value":"deep"}' +
        ']}'.repeat(depth) +
        ']}';

      // Act + Assert
      expect(() =>
        parseParagraphs(field(doc, 'rich_text_field')),
      ).not.toThrow();
      expect(parseParagraphs(field(doc, 'rich_text_field'))).toEqual([]);
    });

    it('returns no paragraphs for invalid JSON', () => {
      expect(
        parseParagraphs(
          field('{"type":"root","children":[', 'rich_text_field'),
        ),
      ).toEqual([]);
    });
  });

  it.each([null, undefined, '', '  \n '])('returns [] for %j', (value) => {
    expect(parseParagraphs(field(value))).toEqual([]);
    expect(parseParagraphs(null)).toEqual([]);
  });
});

describe('mapReviewMetaobjects', () => {
  const review = (
    fields: Record<string, string | null>,
    id = 'gid://shopify/Metaobject/1',
  ) => ({
    id,
    fields: Object.entries(fields).map(([key, value]) => ({key, value})),
  });

  it('maps a complete review', () => {
    // Arrange
    const node = review({
      rating: '4',
      title: 'Cosy',
      body: 'Slept great.',
      author: 'Sam O.',
      verified: 'true',
      date: '2026-09-12',
    });

    // Act
    const [mapped] = mapReviewMetaobjects([node]);

    // Assert
    expect(mapped).toEqual({
      id: 'gid://shopify/Metaobject/1',
      rating: 4,
      title: 'Cosy',
      body: 'Slept great.',
      author: 'Sam O.',
      verified: true,
      date: '2026-09-12',
    });
  });

  describe('rating', () => {
    it('is null when the field is missing (never an invented 5 stars)', () => {
      const [mapped] = mapReviewMetaobjects([review({body: 'Fine.'})]);

      expect(mapped.rating).toBeNull();
    });

    it.each(['', '   ', 'five', 'N/A', '{"value":null}', '9'])(
      'is null when the field is %j',
      (value) => {
        const [mapped] = mapReviewMetaobjects([
          review({body: 'Fine.', rating: value}),
        ]);

        expect(mapped.rating).toBeNull();
      },
    );

    it('honours the scale of Shopify rating JSON', () => {
      const [mapped] = mapReviewMetaobjects([
        review({
          body: 'Fine.',
          rating: '{"value":"8","scale_min":"1","scale_max":"10"}',
        }),
      ]);

      expect(mapped.rating).toBe(4);
    });

    it('keeps a genuine rating of zero', () => {
      const [mapped] = mapReviewMetaobjects([
        review({body: 'Awful.', rating: '0'}),
      ]);

      expect(mapped.rating).toBe(0);
    });
  });

  describe('verified', () => {
    it('is true only for exactly "true"', () => {
      const [mapped] = mapReviewMetaobjects([
        review({body: 'Fine.', verified: 'true'}),
      ]);

      expect(mapped.verified).toBe(true);
    });

    it.each([
      ['missing', null],
      ['empty', ''],
      ['"false"', 'false'],
      ['"TRUE"', 'TRUE'],
      ['"True"', 'True'],
      ['"1"', '1'],
      ['"yes"', 'yes'],
      ['padded', ' true '],
    ])('is false when the field is %s', (_label, value) => {
      const fields: Record<string, string | null> = {body: 'Fine.'};
      if (value !== null) fields.verified = value;

      const [mapped] = mapReviewMetaobjects([review(fields)]);

      expect(mapped.verified).toBe(false);
    });

    it('is false when the field is absent altogether', () => {
      const [mapped] = mapReviewMetaobjects([review({body: 'Fine.'})]);

      expect(mapped.verified).toBe(false);
    });
  });

  it('does not credit a missing author as a verified buyer', () => {
    const [mapped] = mapReviewMetaobjects([review({body: 'Fine.'})]);

    expect(mapped.author).toBe('Customer');
    expect(mapped.verified).toBe(false);
  });

  it('keeps title and date null when they are absent', () => {
    const [mapped] = mapReviewMetaobjects([review({body: 'Fine.'})]);

    expect(mapped.title).toBeNull();
    expect(mapped.date).toBeNull();
  });

  it('skips nodes without a body, including blank ones', () => {
    const mapped = mapReviewMetaobjects([
      review({title: 'No body'}, 'a'),
      review({body: '   '}, 'b'),
      review({body: ''}, 'c'),
      review({body: 'Kept'}, 'd'),
    ]);

    expect(mapped.map((item) => item.id)).toEqual(['d']);
  });

  it('skips null and undefined nodes', () => {
    const mapped = mapReviewMetaobjects([
      null,
      undefined,
      review({body: 'Kept'}),
    ]);

    expect(mapped).toHaveLength(1);
  });

  it.each([null, undefined, []])('returns [] for %j', (nodes) => {
    expect(mapReviewMetaobjects(nodes)).toEqual([]);
  });
});
