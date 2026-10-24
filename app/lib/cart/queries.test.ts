import {
  Kind,
  parse,
  print,
  validate,
  visit,
  type DocumentNode,
  type FieldNode,
  type OperationDefinitionNode,
  type SelectionSetNode,
} from 'graphql';
import {describe, expect, it} from 'vitest';
import {installMockStorefront} from '~/lib/mock/install.server';
import {getMockSchema} from '~/lib/mock/schema.server';
import {minifyQuery} from '~/lib/storefront/graphql';
import {
  CART_API_ERROR_FRAGMENT,
  CART_API_MUTATION_FRAGMENT,
  CART_API_WARNING_FRAGMENT,
  CART_DISCOUNT_CODES_UPDATE_MUTATION,
} from './queries';

/**
 * Every file codegen searches for Storefront API documents (codegen.ts,
 * STOREFRONT_DOCUMENTS), as raw text.
 *
 * Keep the call spelled exactly `import.meta.glob(`, without a type argument:
 * Vitest's file-system module cache only skips files containing that text,
 * and a cached copy would keep a stale list of files.
 */
const STOREFRONT_SOURCES = import.meta.glob(
  ['/app/**/*.{ts,tsx,js,jsx}', '!/app/graphql/**'],
  {query: '?raw', import: 'default', eager: true},
) as Record<string, string>;
const QUERIES_FILE = '/app/lib/cart/queries.ts';

/** The template literals codegen plucks: those opening with the graphql marker. */
const GRAPHQL_TEMPLATE_RE = /`\s*#graphql\s*\n([^`]*)`/gi;
const OPERATION_RE = /(?:^|}\s)(?:query|mutation)\s+([_A-Za-z][_0-9A-Za-z]*)/g;

function operationNamesIn(source: string): string[] {
  return [...source.matchAll(GRAPHQL_TEMPLATE_RE)].flatMap(([, document]) =>
    [...minifyQuery(document).matchAll(OPERATION_RE)].map(([, name]) => name),
  );
}

/** Selected field names, with fragment spreads written as `...Name`. */
function selectionsOf(selectionSet: SelectionSetNode | undefined): string[] {
  return (selectionSet?.selections ?? []).map((selection) => {
    if (selection.kind === Kind.FIELD) return selection.name.value;
    if (selection.kind === Kind.FRAGMENT_SPREAD)
      return `...${selection.name.value}`;
    return '... (inline fragment)';
  });
}

function fieldIn(
  selectionSet: SelectionSetNode | undefined,
  name: string,
): FieldNode {
  const field = selectionSet?.selections.find(
    (selection): selection is FieldNode =>
      selection.kind === Kind.FIELD && selection.name.value === name,
  );
  if (!field) throw new Error(`No ${name} selection`);
  return field;
}

function fragmentOf(document: DocumentNode, name: string) {
  const fragment = document.definitions.find(
    (definition) =>
      definition.kind === Kind.FRAGMENT_DEFINITION &&
      definition.name.value === name,
  );
  if (fragment?.kind !== Kind.FRAGMENT_DEFINITION)
    throw new Error(`No fragment ${name}`);
  return {
    on: fragment.typeCondition.name.value,
    fields: selectionsOf(fragment.selectionSet),
  };
}

function operationsOf(document: DocumentNode): OperationDefinitionNode[] {
  return document.definitions.filter(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === Kind.OPERATION_DEFINITION,
  );
}

describe('CART_DISCOUNT_CODES_UPDATE_MUTATION', () => {
  const document = parse(CART_DISCOUNT_CODES_UPDATE_MUTATION);

  it('is valid against the Storefront API schema', () => {
    const errors = validate(getMockSchema(), document);

    expect(errors.map((error) => error.message)).toEqual([]);
  });

  it('does not use @defer, which our plain-JSON client cannot stream (D-8)', () => {
    const directives: string[] = [];
    visit(document, {
      Directive(node) {
        directives.push(node.name.value);
      },
    });

    expect(CART_DISCOUNT_CODES_UPDATE_MUTATION).not.toContain('@defer');
    expect(directives).toEqual(['inContext']);
  });

  it("is a single mutation named like Hydrogen's cartDiscountCodesUpdate", () => {
    const operations = operationsOf(document);

    expect(operations).toHaveLength(1);
    expect(operations[0].operation).toBe('mutation');
    expect(operations[0].name?.value).toBe('cartDiscountCodesUpdate');
  });

  it('has an operation name no other Storefront API document uses, as codegen requires', () => {
    // Arrange
    const ownNames = operationNamesIn(STOREFRONT_SOURCES[QUERIES_FILE]);

    // Act
    const allNames =
      Object.values(STOREFRONT_SOURCES).flatMap(operationNamesIn);

    // Assert: the scan sees the app's other documents, and ours exactly once.
    expect(allNames).toEqual(expect.arrayContaining(['Header', 'Footer']));
    expect(ownNames).toContain('cartDiscountCodesUpdate');
    for (const name of ownNames) {
      expect(allNames.filter((other) => other === name)).toEqual([name]);
    }
  });

  it("declares Hydrogen's variables and @inContext", () => {
    const [operation] = operationsOf(document);

    expect(
      operation.variableDefinitions?.map((definition) => print(definition)),
    ).toEqual([
      '$cartId: ID!',
      '$discountCodes: [String!]!',
      '$country: CountryCode = ZZ',
      '$language: LanguageCode',
    ]);
    expect(operation.directives?.map((directive) => print(directive))).toEqual([
      '@inContext(country: $country, language: $language)',
    ]);
  });

  it('selects the cart, userErrors and warnings through the CartApi fragments', () => {
    // Arrange
    const [operation] = operationsOf(document);

    // Act
    const update = fieldIn(operation.selectionSet, 'cartDiscountCodesUpdate');

    // Assert
    expect(selectionsOf(update.selectionSet)).toEqual([
      'cart',
      'userErrors',
      'warnings',
    ]);
    expect(
      selectionsOf(fieldIn(update.selectionSet, 'cart').selectionSet),
    ).toEqual(['...CartApiMutation']);
    expect(
      selectionsOf(fieldIn(update.selectionSet, 'userErrors').selectionSet),
    ).toEqual(['...CartApiError']);
    expect(
      selectionsOf(fieldIn(update.selectionSet, 'warnings').selectionSet),
    ).toEqual(['...CartApiWarning']);
    expect(fragmentOf(document, 'CartApiMutation')).toEqual({
      on: 'Cart',
      fields: ['id', 'totalQuantity', 'checkoutUrl'],
    });
    expect(fragmentOf(document, 'CartApiError')).toEqual({
      on: 'CartUserError',
      fields: ['message', 'field', 'code'],
    });
    expect(fragmentOf(document, 'CartApiWarning')).toEqual({
      on: 'CartWarning',
      fields: ['code', 'message', 'target'],
    });
  });

  it('embeds the exported fragments, which the Phase 3 mutations share', () => {
    expect(CART_DISCOUNT_CODES_UPDATE_MUTATION).toContain(
      CART_API_MUTATION_FRAGMENT,
    );
    expect(CART_DISCOUNT_CODES_UPDATE_MUTATION).toContain(
      CART_API_ERROR_FRAGMENT,
    );
    expect(CART_DISCOUNT_CODES_UPDATE_MUTATION).toContain(
      CART_API_WARNING_FRAGMENT,
    );
  });

  it('runs against the development mock that the e2e suite uses', async () => {
    // Arrange
    const storefront = {} as {
      mutate: (
        document: string,
        options?: {variables?: Record<string, unknown>},
      ) => Promise<unknown>;
    };
    installMockStorefront(
      storefront as unknown as Parameters<typeof installMockStorefront>[0],
      new Request('http://localhost:3000/'),
    );
    const cartId = 'gid://shopify/Cart/c1-discount-test';

    // Act
    const result = await storefront.mutate(
      CART_DISCOUNT_CODES_UPDATE_MUTATION,
      {
        variables: {cartId, discountCodes: ['welcome10']},
      },
    );

    // Assert
    expect(result).toEqual({
      cartDiscountCodesUpdate: {
        cart: {id: cartId, totalQuantity: 0, checkoutUrl: expect.any(String)},
        userErrors: [],
        warnings: [],
      },
    });
  });
});
