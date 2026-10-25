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
import {CART_QUERY_FRAGMENT} from '~/lib/fragments';
import {installMockStorefront} from '~/lib/mock/install.server';
import {getMockSchema} from '~/lib/mock/schema.server';
import {minifyQuery} from '~/lib/storefront/graphql';
import {
  CART_API_ERROR_FRAGMENT,
  CART_API_MUTATION_FRAGMENT,
  CART_API_WARNING_FRAGMENT,
  CART_BUYER_IDENTITY_UPDATE_MUTATION,
  CART_CREATE_MUTATION,
  CART_DISCOUNT_CODES_UPDATE_MUTATION,
  CART_GIFT_CARD_CODES_ADD_MUTATION,
  CART_GIFT_CARD_CODES_REMOVE_MUTATION,
  CART_LINES_ADD_MUTATION,
  CART_LINES_REMOVE_MUTATION,
  CART_LINES_UPDATE_MUTATION,
  CART_QUERY,
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

function directivesIn(document: DocumentNode): string[] {
  const directives: string[] = [];
  visit(document, {
    Directive(node) {
      directives.push(node.name.value);
    },
  });
  return directives;
}

type Variables = Record<string, unknown>;
type MockOperation = (
  document: string,
  options?: {variables?: Variables},
) => Promise<Record<string, unknown>>;

/** A storefront whose query/mutate run in-process against the e2e mock. */
function createMockStorefront() {
  const storefront = {} as {query: MockOperation; mutate: MockOperation};
  installMockStorefront(
    storefront as unknown as Parameters<typeof installMockStorefront>[0],
    new Request('http://localhost:3000/'),
  );
  return storefront;
}

const MOCK_VARIANT_ID = 'gid://shopify/ProductVariant/cloudalign-pillow-1';
const LOCALE_VARIABLES = [
  '$country: CountryCode = ZZ',
  '$language: LanguageCode',
] as const;
const IN_CONTEXT = '@inContext(country: $country, language: $language)';
const MOCK_UNSUPPORTED_GIFT_CARDS = [
  {
    message: 'Gift cards are not supported by the development mock.',
    field: null,
    code: 'INVALID',
  },
];
/** Ids of carts the mock creates (app/lib/mock/cart.server.ts). */
const MOCK_CREATED_CART_ID = /^gid:\/\/shopify\/Cart\/mock/;

/** The payload a cart mutation answers through the CartApi fragments. */
function mockPayload(
  cartId: unknown,
  totalQuantity: number,
  userErrors: unknown[] = [],
) {
  return {
    cart: {id: cartId, totalQuantity, checkoutUrl: expect.any(String)},
    userErrors,
    warnings: [],
  };
}

type MutationCase = {
  name: string;
  document: string;
  /** Hydrogen's operation name, which is also the mutation field. */
  operation: string;
  variables: readonly string[];
  arguments: readonly string[];
  /** Variables for a run against the mock, given an existing cart id. */
  mockVariables: (cartId: string) => Variables;
  /** What the mock answers for that run. */
  mockResult: (cartId: string) => ReturnType<typeof mockPayload>;
};

const MUTATIONS: readonly MutationCase[] = [
  {
    name: 'CART_CREATE_MUTATION',
    document: CART_CREATE_MUTATION,
    operation: 'cartCreate',
    variables: ['$input: CartInput!', ...LOCALE_VARIABLES],
    arguments: ['input: $input'],
    mockVariables: () => ({
      input: {
        lines: [{merchandiseId: MOCK_VARIANT_ID, quantity: 2}],
        buyerIdentity: {},
      },
    }),
    mockResult: () =>
      mockPayload(expect.stringMatching(MOCK_CREATED_CART_ID), 2),
  },
  {
    name: 'CART_LINES_ADD_MUTATION',
    document: CART_LINES_ADD_MUTATION,
    operation: 'cartLinesAdd',
    variables: [
      '$cartId: ID!',
      '$lines: [CartLineInput!]!',
      ...LOCALE_VARIABLES,
    ],
    arguments: ['cartId: $cartId', 'lines: $lines'],
    mockVariables: (cartId) => ({
      cartId,
      lines: [{merchandiseId: MOCK_VARIANT_ID, quantity: 1}],
    }),
    mockResult: (cartId) => mockPayload(cartId, 1),
  },
  {
    name: 'CART_LINES_UPDATE_MUTATION',
    document: CART_LINES_UPDATE_MUTATION,
    operation: 'cartLinesUpdate',
    variables: [
      '$cartId: ID!',
      '$lines: [CartLineUpdateInput!]!',
      ...LOCALE_VARIABLES,
    ],
    arguments: ['cartId: $cartId', 'lines: $lines'],
    mockVariables: (cartId) => ({
      cartId,
      lines: [{id: 'gid://shopify/CartLine/unknown', quantity: 3}],
    }),
    mockResult: (cartId) => mockPayload(cartId, 0),
  },
  {
    name: 'CART_LINES_REMOVE_MUTATION',
    document: CART_LINES_REMOVE_MUTATION,
    operation: 'cartLinesRemove',
    variables: ['$cartId: ID!', '$lineIds: [ID!]!', ...LOCALE_VARIABLES],
    arguments: ['cartId: $cartId', 'lineIds: $lineIds'],
    mockVariables: (cartId) => ({
      cartId,
      lineIds: ['gid://shopify/CartLine/unknown'],
    }),
    mockResult: (cartId) => mockPayload(cartId, 0),
  },
  {
    name: 'CART_DISCOUNT_CODES_UPDATE_MUTATION',
    document: CART_DISCOUNT_CODES_UPDATE_MUTATION,
    operation: 'cartDiscountCodesUpdate',
    variables: [
      '$cartId: ID!',
      '$discountCodes: [String!]!',
      ...LOCALE_VARIABLES,
    ],
    arguments: ['cartId: $cartId', 'discountCodes: $discountCodes'],
    mockVariables: (cartId) => ({cartId, discountCodes: ['MELLOW10']}),
    mockResult: (cartId) => mockPayload(cartId, 0),
  },
  {
    name: 'CART_GIFT_CARD_CODES_ADD_MUTATION',
    document: CART_GIFT_CARD_CODES_ADD_MUTATION,
    operation: 'cartGiftCardCodesAdd',
    variables: [
      '$cartId: ID!',
      '$giftCardCodes: [String!]!',
      ...LOCALE_VARIABLES,
    ],
    arguments: ['cartId: $cartId', 'giftCardCodes: $giftCardCodes'],
    mockVariables: (cartId) => ({cartId, giftCardCodes: ['GIFT-1234']}),
    mockResult: (cartId) => mockPayload(cartId, 0, MOCK_UNSUPPORTED_GIFT_CARDS),
  },
  {
    name: 'CART_GIFT_CARD_CODES_REMOVE_MUTATION',
    document: CART_GIFT_CARD_CODES_REMOVE_MUTATION,
    operation: 'cartGiftCardCodesRemove',
    variables: [
      '$cartId: ID!',
      '$appliedGiftCardIds: [ID!]!',
      ...LOCALE_VARIABLES,
    ],
    arguments: ['cartId: $cartId', 'appliedGiftCardIds: $appliedGiftCardIds'],
    mockVariables: (cartId) => ({
      cartId,
      appliedGiftCardIds: ['gid://shopify/AppliedGiftCard/1'],
    }),
    mockResult: (cartId) => mockPayload(cartId, 0, MOCK_UNSUPPORTED_GIFT_CARDS),
  },
  {
    name: 'CART_BUYER_IDENTITY_UPDATE_MUTATION',
    document: CART_BUYER_IDENTITY_UPDATE_MUTATION,
    operation: 'cartBuyerIdentityUpdate',
    variables: [
      '$cartId: ID!',
      '$buyerIdentity: CartBuyerIdentityInput!',
      ...LOCALE_VARIABLES,
    ],
    arguments: ['cartId: $cartId', 'buyerIdentity: $buyerIdentity'],
    mockVariables: (cartId) => ({cartId, buyerIdentity: {countryCode: 'CA'}}),
    mockResult: (cartId) => mockPayload(cartId, 0),
  },
];

/** Every Storefront API document this module exports, with its operation. */
const DOCUMENTS: ReadonlyArray<
  [name: string, document: string, operation: string, kind: string]
> = [
  ['CART_QUERY', CART_QUERY, 'CartQuery', 'query'],
  ...MUTATIONS.map(
    ({name, document, operation}) =>
      [name, document, operation, 'mutation'] as [
        string,
        string,
        string,
        string,
      ],
  ),
];

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

describe('cart documents', () => {
  it.each(DOCUMENTS)(
    '%s is valid against the Storefront API schema',
    (_name, document) => {
      const errors = validate(getMockSchema(), parse(document));

      expect(errors.map((error) => error.message)).toEqual([]);
    },
  );

  it.each(DOCUMENTS)(
    '%s does not use @defer, which our plain-JSON client cannot stream',
    (_name, document) => {
      expect(document).not.toContain('@defer');
      expect(directivesIn(parse(document))).toEqual(['inContext']);
    },
  );

  it.each(DOCUMENTS)(
    "%s is a single operation named like Hydrogen's (%s)",
    (_name, document, operation, kind) => {
      const operations = operationsOf(parse(document));

      expect(operations).toHaveLength(1);
      expect(operations[0].operation).toBe(kind);
      expect(operations[0].name?.value).toBe(operation);
    },
  );

  it('are all the operations this module defines, each named once in the app, as codegen requires', () => {
    // Arrange
    const expected = DOCUMENTS.map(([, , operation]) => operation);

    // Act
    const ownNames = operationNamesIn(STOREFRONT_SOURCES[QUERIES_FILE]);
    const allNames =
      Object.values(STOREFRONT_SOURCES).flatMap(operationNamesIn);

    // Assert
    expect([...ownNames].sort()).toEqual([...expected].sort());
    for (const name of expected) {
      expect(allNames.filter((other) => other === name)).toEqual([name]);
    }
  });
});

describe('CART_QUERY', () => {
  const document = parse(CART_QUERY);

  it("declares Hydrogen's variables, including 100 cart lines, and @inContext", () => {
    const [operation] = operationsOf(document);

    expect(
      operation.variableDefinitions?.map((definition) => print(definition)),
    ).toEqual([
      '$cartId: ID!',
      '$numCartLines: Int = 100',
      ...LOCALE_VARIABLES,
    ]);
    expect(operation.directives?.map((directive) => print(directive))).toEqual([
      IN_CONTEXT,
    ]);
  });

  it("selects the cart by id through the app's CartApiQuery fragment", () => {
    // Arrange
    const [operation] = operationsOf(document);

    // Act
    const cart = fieldIn(operation.selectionSet, 'cart');

    // Assert
    expect(selectionsOf(operation.selectionSet)).toEqual(['cart']);
    expect(cart.arguments?.map((argument) => print(argument))).toEqual([
      'id: $cartId',
    ]);
    expect(selectionsOf(cart.selectionSet)).toEqual(['...CartApiQuery']);
  });

  it('appends CART_QUERY_FRAGMENT from app/lib/fragments.ts', () => {
    expect(CART_QUERY).toContain(CART_QUERY_FRAGMENT);
    expect(fragmentOf(document, 'CartApiQuery').on).toBe('Cart');
  });

  it('reads a cart that the development mock created', async () => {
    // Arrange
    const storefront = createMockStorefront();
    const {cartCreate} = (await storefront.mutate(CART_CREATE_MUTATION, {
      variables: {
        input: {lines: [{merchandiseId: MOCK_VARIANT_ID, quantity: 2}]},
      },
    })) as {cartCreate: {cart: {id: string}}};

    // Act
    const result = await storefront.query(CART_QUERY, {
      variables: {cartId: cartCreate.cart.id},
    });

    // Assert
    expect(result).toEqual({
      cart: expect.objectContaining({
        id: cartCreate.cart.id,
        totalQuantity: 2,
        checkoutUrl: expect.any(String),
        lines: {
          nodes: [
            expect.objectContaining({
              quantity: 2,
              merchandise: expect.objectContaining({id: MOCK_VARIANT_ID}),
            }),
          ],
        },
      }),
    });
  });
});

describe('cart mutations', () => {
  it.each(MUTATIONS)(
    "$name declares Hydrogen's variables and @inContext",
    ({document, variables}) => {
      const [operation] = operationsOf(parse(document));

      expect(
        operation.variableDefinitions?.map((definition) => print(definition)),
      ).toEqual(variables);
      expect(
        operation.directives?.map((directive) => print(directive)),
      ).toEqual([IN_CONTEXT]);
    },
  );

  it.each(MUTATIONS)(
    '$name selects the cart, userErrors and warnings through the CartApi fragments',
    ({document, operation: name, arguments: args}) => {
      // Arrange
      const parsed = parse(document);
      const [operation] = operationsOf(parsed);

      // Act
      const payload = fieldIn(operation.selectionSet, name);

      // Assert
      expect(selectionsOf(operation.selectionSet)).toEqual([name]);
      expect(payload.arguments?.map((argument) => print(argument))).toEqual(
        args,
      );
      expect(selectionsOf(payload.selectionSet)).toEqual([
        'cart',
        'userErrors',
        'warnings',
      ]);
      expect(
        selectionsOf(fieldIn(payload.selectionSet, 'cart').selectionSet),
      ).toEqual(['...CartApiMutation']);
      expect(
        selectionsOf(fieldIn(payload.selectionSet, 'userErrors').selectionSet),
      ).toEqual(['...CartApiError']);
      expect(
        selectionsOf(fieldIn(payload.selectionSet, 'warnings').selectionSet),
      ).toEqual(['...CartApiWarning']);
    },
  );

  it.each(MUTATIONS)(
    '$name embeds the shared CartApi fragments',
    ({document}) => {
      expect(document).toContain(CART_API_MUTATION_FRAGMENT);
      expect(document).toContain(CART_API_ERROR_FRAGMENT);
      expect(document).toContain(CART_API_WARNING_FRAGMENT);
    },
  );

  it.each(MUTATIONS)(
    '$name runs against the development mock that the e2e suite uses',
    async ({document, operation, mockVariables, mockResult}) => {
      // Arrange
      const storefront = createMockStorefront();
      const cartId = `gid://shopify/Cart/c1-${operation}-test`;

      // Act
      const result = await storefront.mutate(document, {
        variables: mockVariables(cartId),
      });

      // Assert
      expect(result).toEqual({[operation]: mockResult(cartId)});
    },
  );
});
