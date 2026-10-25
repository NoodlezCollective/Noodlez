import type {Storefront} from '~/lib/storefront/client.server';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  STOREFRONT_API_ERROR_STATUS,
  describeErrors,
  guardStorefrontErrors,
  isErrorsOnlyResult,
} from './storefront-errors';

const ERRORS = [{message: 'Throttled'}, {message: 'Internal error'}];

describe('describeErrors', () => {
  /** Messages echo variables, here a shopper's search term. */
  const API_ERRORS = [
    {
      message: 'Variable $term got invalid value shopper@example.com',
      extensions: {code: 'BAD_USER_INPUT'},
    },
    {message: 'Throttled', extensions: {code: 'THROTTLED'}},
  ];

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('gives only the count and the codes outside development', () => {
    vi.stubEnv('DEV', false);

    const description = describeErrors(API_ERRORS);

    expect(description).toBe('2 error(s) [BAD_USER_INPUT, THROTTLED]');
    expect(description).not.toContain('shopper@example.com');
  });

  it('adds the messages in development', () => {
    expect(describeErrors(API_ERRORS)).toBe(
      '2 error(s) [BAD_USER_INPUT, THROTTLED]: Variable $term got invalid value shopper@example.com; Throttled',
    );
  });

  it('leaves out the brackets when no entry has a code', () => {
    vi.stubEnv('DEV', false);

    expect(describeErrors(ERRORS)).toBe('2 error(s)');
  });

  it.each([
    ['outside development', false, '4 error(s)'],
    [
      'in development',
      true,
      '4 error(s): unknown error; unknown error; unknown error; unknown error',
    ],
  ])(
    'counts null, missing and malformed entries without throwing (%s)',
    (_name, dev, expected) => {
      vi.stubEnv('DEV', dev);
      const malformed = [
        null,
        undefined,
        {extensions: {code: 42}},
        {extensions: null},
      ] as unknown as Parameters<typeof describeErrors>[0];

      expect(describeErrors(malformed)).toBe(expected);
    },
  );

  it('describes an empty list as no errors', () => {
    expect(describeErrors([])).toBe('0 error(s)');
  });
});

describe('isErrorsOnlyResult', () => {
  it('is true when errors are the only key', () => {
    expect(isErrorsOnlyResult({errors: ERRORS})).toBe(true);
  });

  it('is true when every data field is missing or null', () => {
    expect(isErrorsOnlyResult({product: null, errors: ERRORS})).toBe(true);
    expect(isErrorsOnlyResult({product: undefined, errors: ERRORS})).toBe(true);
  });

  it('is false for partial data, which callers can still use', () => {
    expect(isErrorsOnlyResult({shop: {name: 'Mellow'}, errors: ERRORS})).toBe(
      false,
    );
    expect(
      isErrorsOnlyResult({menu: null, shop: {id: '1'}, errors: ERRORS}),
    ).toBe(false);
  });

  it('is false without errors, whatever the data looks like', () => {
    expect(isErrorsOnlyResult({product: null})).toBe(false);
    expect(isErrorsOnlyResult({})).toBe(false);
    expect(isErrorsOnlyResult({errors: []})).toBe(false);
    expect(isErrorsOnlyResult({errors: undefined})).toBe(false);
  });

  it('is false for values that are not Storefront results', () => {
    expect(isErrorsOnlyResult(null)).toBe(false);
    expect(isErrorsOnlyResult(undefined)).toBe(false);
    expect(isErrorsOnlyResult('errors')).toBe(false);
    expect(isErrorsOnlyResult(42)).toBe(false);
    expect(isErrorsOnlyResult({errors: 'boom'})).toBe(false);
  });
});

type Operation = (document: string, options?: unknown) => Promise<unknown>;

/** A storefront whose `query` and `mutate` both resolve to `result`. */
function createFakeStorefront(result: unknown) {
  const query = vi.fn(async (..._args: unknown[]) => result);
  const mutate = vi.fn(async (..._args: unknown[]) => result);
  const fake = {query, mutate, i18n: {language: 'EN'}};
  return {
    storefront: fake as unknown as Storefront,
    // The same object, typed loosely so the tests can call it with any document.
    api: fake as unknown as Record<'query' | 'mutate', Operation>,
    query,
    mutate,
  };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

describe('guardStorefrontErrors', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it.each(['query', 'mutate'] as const)(
    'turns an errors-only %s result into a 502 Response',
    async (method) => {
      // Arrange
      const {storefront, api} = createFakeStorefront({errors: ERRORS});
      guardStorefrontErrors(storefront);

      // Act
      const thrown = await rejection(
        api[method]('query Products { products { id } }'),
      );

      // Assert
      expect(thrown).toBeInstanceOf(Response);
      expect((thrown as Response).status).toBe(STOREFRONT_API_ERROR_STATUS);
      expect(STOREFRONT_API_ERROR_STATUS).toBe(502);
      expect(await (thrown as Response).text()).toBe('Storefront API error');
    },
  );

  it('logs the operation name and GraphQL messages, never the variables', async () => {
    // Arrange
    const {storefront, api} = createFakeStorefront({errors: ERRORS});
    guardStorefrontErrors(storefront);

    // Act
    await rejection(
      api.mutate('mutation CartCreate($input: CartInput!) { x }', {
        variables: {input: {buyerIdentity: {email: 'shopper@example.com'}}},
      }),
    );

    // Assert
    expect(consoleError).toHaveBeenCalledTimes(1);
    const logged = String(consoleError.mock.calls[0][0]);
    expect(logged).toContain('CartCreate');
    expect(logged).toContain('Throttled');
    expect(logged).toContain('Internal error');
    expect(logged).not.toContain('shopper@example.com');
  });

  it('logs "anonymous" for operations without a name', async () => {
    const {storefront, api} = createFakeStorefront({errors: ERRORS});
    guardStorefrontErrors(storefront);

    await rejection(api.query('{ shop { name } }'));

    expect(String(consoleError.mock.calls[0][0])).toContain('anonymous');
  });

  it('reads the operation name the way the client does, ignoring commented-out names', async () => {
    const {storefront, api} = createFakeStorefront({errors: ERRORS});
    guardStorefrontErrors(storefront);

    await rejection(
      api.query(
        '#graphql\n  # query Fake { a }\n  query Real { shop { name } }',
      ),
    );

    const logged = String(consoleError.mock.calls[0][0]);
    expect(logged).toContain('[storefront] Real failed');
    expect(logged).not.toContain('Fake');
  });

  it('logs "anonymous" when the document is not a string', async () => {
    const {storefront, api} = createFakeStorefront({errors: ERRORS});
    guardStorefrontErrors(storefront);

    await rejection(api.query(undefined as unknown as string));

    expect(String(consoleError.mock.calls[0][0])).toContain(
      '[storefront] anonymous failed',
    );
  });

  it('returns partial data with errors unchanged', async () => {
    // Arrange
    const partial = {shop: {name: 'Mellow'}, menu: null, errors: ERRORS};
    const {storefront, api} = createFakeStorefront(partial);
    guardStorefrontErrors(storefront);

    // Act
    const result = await api.query('query Header { shop { name } }');

    // Assert
    expect(result).toBe(partial);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('returns error-free results unchanged, including a null product', async () => {
    const data = {product: null};
    const {storefront, api} = createFakeStorefront(data);
    guardStorefrontErrors(storefront);

    expect(await api.query('query Product { product { id } }')).toBe(data);
  });

  it('forwards the document and options to the original client', async () => {
    // Arrange
    const {storefront, api, query, mutate} = createFakeStorefront({ok: true});
    guardStorefrontErrors(storefront);
    const options = {variables: {handle: 'pillow'}};

    // Act
    await api.query('query A { a }', options);
    await api.mutate('mutation B { b }', options);

    // Assert
    expect(query).toHaveBeenCalledWith('query A { a }', options);
    expect(mutate).toHaveBeenCalledWith('mutation B { b }', options);
  });

  it('lets transport errors through untouched', async () => {
    // Arrange
    const failure = new Error('fetch failed');
    const {storefront, api, query} = createFakeStorefront(null);
    query.mockRejectedValueOnce(failure);
    guardStorefrontErrors(storefront);

    // Act + Assert
    expect(await rejection(api.query('query A { a }'))).toBe(failure);
  });

  it('leaves the rest of the storefront client alone', () => {
    const {storefront} = createFakeStorefront({});
    guardStorefrontErrors(storefront);

    expect(storefront.i18n).toEqual({language: 'EN'});
  });

  it('guards each storefront it is applied to, not all of them', async () => {
    const guarded = createFakeStorefront({errors: ERRORS});
    const untouched = createFakeStorefront({errors: ERRORS});
    guardStorefrontErrors(guarded.storefront);

    expect(await untouched.api.query('query A { a }')).toEqual({
      errors: ERRORS,
    });
  });
});
