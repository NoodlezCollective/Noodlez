import {describe, expect, it} from 'vitest';
import {isNonEmptyString, isRecord, isString} from './guards';

/** Values that are not strings, whatever else they are. */
const NON_STRINGS: Array<[string, unknown]> = [
  ['null', null],
  ['undefined', undefined],
  ['a number', 1],
  ['a boolean', true],
  ['an object', {}],
  ['an array of strings', ['a']],
];

describe('isRecord', () => {
  it('accepts plain objects, including empty ones', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({a: 1})).toBe(true);
    expect(isRecord(Object.create(null))).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an array', [1, 2]],
    ['an empty array', []],
    ['a string', 'text'],
    ['a number', 1],
    ['zero', 0],
    ['a boolean', true],
    ['a function', () => ({})],
  ])('rejects %s', (_name, value) => {
    expect(isRecord(value)).toBe(false);
  });
});

describe('isString', () => {
  it('accepts every string, including the empty one', () => {
    expect(isString('text')).toBe(true);
    expect(isString('')).toBe(true);
  });

  it.each(NON_STRINGS)('rejects %s', (_name, value) => {
    expect(isString(value)).toBe(false);
  });
});

describe('isNonEmptyString', () => {
  it('accepts strings with at least one character', () => {
    expect(isNonEmptyString('a')).toBe(true);
    // Whitespace is not trimmed: callers that care trim first.
    expect(isNonEmptyString(' ')).toBe(true);
  });

  it.each([['an empty string', ''], ...NON_STRINGS])(
    'rejects %s',
    (_name, value) => {
      expect(isNonEmptyString(value)).toBe(false);
    },
  );
});
