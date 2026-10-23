import {describe, expect, it} from 'vitest';
import {parse, validate} from 'graphql';
import {getMockSchema} from '~/lib/mock/schema.server';
import {PRODUCT_CARD_FRAGMENT} from './fragments';

describe('PRODUCT_CARD_FRAGMENT', () => {
  it('truncates the description, which every card would otherwise download in full', () => {
    expect(PRODUCT_CARD_FRAGMENT).toContain('description(truncateAt: 200)');
    expect(PRODUCT_CARD_FRAGMENT).not.toMatch(/^\s*description\s*$/m);
  });

  it('is valid against the Storefront API schema', () => {
    const document = `
      query Cards { products(first: 1) { nodes { ...ProductCard } } }
      ${PRODUCT_CARD_FRAGMENT}
    `;

    const errors = validate(getMockSchema(), parse(document));

    expect(errors.map((error) => error.message)).toEqual([]);
  });
});
