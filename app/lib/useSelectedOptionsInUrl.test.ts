import {describe, expect, it} from 'vitest';
import {searchWithSelectedOptions} from './useSelectedOptionsInUrl';

describe('searchWithSelectedOptions', () => {
  it('returns null when there is nothing to write', () => {
    expect(searchWithSelectedOptions('', [])).toBeNull();
    expect(searchWithSelectedOptions('', null)).toBeNull();
    expect(searchWithSelectedOptions('', undefined)).toBeNull();
  });

  it('adds the selected options to an empty search', () => {
    expect(searchWithSelectedOptions('', [{name: 'Size', value: 'King'}])).toBe(
      '?Size=King',
    );
  });

  it('keeps unrelated parameters and overrides the option parameters', () => {
    expect(
      searchWithSelectedOptions('?utm_source=x&Size=Standard', [
        {name: 'Size', value: 'Full/Queen'},
      ]),
    ).toBe('?utm_source=x&Size=Full%2FQueen');
  });

  it('encodes values the way the server-rendered links do', () => {
    expect(
      searchWithSelectedOptions('', [
        {name: 'Color', value: 'Baby Blue'},
        {name: 'Size', value: 'King'},
      ]),
    ).toBe('?Color=Baby+Blue&Size=King');
  });

  it('keeps the existing search when no options are selected', () => {
    expect(searchWithSelectedOptions('?q=pillow', [])).toBe('?q=pillow');
  });
});
