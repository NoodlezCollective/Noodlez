import {describe, expect, it, vi} from 'vitest';
import {isCustomerAccountConfigured} from '~/components/account/AccountUnavailable';
import {loader as orderLoader} from '../../routes/account.orders.$id';
import {action as profileAction} from '../../routes/account.profile';
import {ORIGIN, callRoute, thrownResponse} from './route-test-utils';

describe('isCustomerAccountConfigured', () => {
  it.each([
    [
      {
        SHOP_ID: '68817551382',
        PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID: 'shp_abc',
      },
      true,
    ],
    [
      {SHOP_ID: '68817551382', PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID: ''},
      false,
    ],
    [{SHOP_ID: '', PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID: 'shp_abc'}, false],
    [
      {
        SHOP_ID: '68817551382',
        PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID: undefined,
      },
      false,
    ],
    [
      {SHOP_ID: undefined, PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID: 'shp_abc'},
      false,
    ],
    [{SHOP_ID: '', PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID: ''}, false],
    [
      {SHOP_ID: undefined, PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID: undefined},
      false,
    ],
  ])('%j -> %s (both variables are required)', (env, expected) => {
    expect(isCustomerAccountConfigured(env as never)).toBe(expected);
  });
});

const ORDER_GID = 'gid://shopify/Order/123456789012?key=abcdef0123456789';

describe('account/orders/:id loader', () => {
  const order = {
    id: ORDER_GID,
    name: '#1001',
    lineItems: {nodes: []},
    discountApplications: {nodes: []},
    fulfillments: {nodes: []},
  };

  function load(id: string | undefined) {
    const customerAccount = {
      query: vi.fn(async (..._args: unknown[]) => ({
        data: {order},
        errors: undefined,
      })),
      i18n: {language: 'EN'},
    };
    const promise = callRoute(orderLoader, {
      request: new Request(`${ORIGIN}/account/orders/${id}`),
      context: {customerAccount},
      params: {id},
    });
    return {promise, customerAccount};
  }

  it('decodes the token back to the order id for the Customer Account API', async () => {
    const {promise, customerAccount} = load(btoa(ORDER_GID));

    await promise;

    expect(customerAccount.query).toHaveBeenCalledWith(expect.any(String), {
      variables: {orderId: ORDER_GID, language: 'EN'},
    });
  });

  it.each([
    '!!!',
    'not base64 at all',
    '%',
    'a',
    'a==',
    ORDER_GID,
    'YWJj',
    btoa('gid://shopify/Customer/1'),
    btoa('gid://shopify/Order/'),
    btoa('hello'),
    btoa('<script>alert(1)</script>'),
  ])(
    'answers 404 for the garbage token %j without calling the API',
    async (id) => {
      const {promise, customerAccount} = load(id);

      const response = await thrownResponse(promise);

      expect(response.status).toBe(404);
      expect(customerAccount.query).not.toHaveBeenCalled();
    },
  );

  it('redirects to the order list when the id is missing', async () => {
    const {promise} = load(undefined);
    expect(((await promise) as Response).headers.get('Location')).toBe(
      '/account/orders',
    );
  });
});

describe('account/profile action', () => {
  function submit({
    method = 'PUT',
    fields = {firstName: 'Ada', lastName: 'Lovelace'},
    mutate = vi.fn(async (..._args: unknown[]) => ({
      data: {customerUpdate: {customer: {id: 'c1', firstName: 'Ada'}}},
    })),
  }: {
    method?: string;
    fields?: Record<string, string>;
    mutate?: (...args: unknown[]) => Promise<unknown>;
  } = {}) {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.set(key, value);
    const promise = callRoute(profileAction, {
      request: new Request(`${ORIGIN}/account/profile`, {
        method,
        body: method === 'GET' ? undefined : body,
      }),
      context: {customerAccount: {mutate, i18n: {language: 'EN'}}},
    });
    return {promise, mutate};
  }

  it('saves the name and returns the updated customer', async () => {
    const {promise, mutate} = submit({
      fields: {firstName: 'Ada', lastName: 'Lovelace', isAdmin: 'true'},
    });

    expect(await promise).toEqual({
      error: null,
      customer: {id: 'c1', firstName: 'Ada'},
    });
    expect(mutate).toHaveBeenCalledWith(expect.any(String), {
      variables: {
        customer: {firstName: 'Ada', lastName: 'Lovelace'},
        language: 'EN',
      },
    });
  });

  it('lets the redirect Response of an expired session through', async () => {
    // Hydrogen's customerAccount.mutate throws a redirect to the login page.
    const redirect = new Response(null, {
      status: 302,
      headers: {Location: '/account/login'},
    });
    const {promise} = submit({mutate: vi.fn().mockRejectedValue(redirect)});

    await expect(promise).rejects.toBe(redirect);
  });

  it('turns an Error into a 400 with its message', async () => {
    const {promise} = submit({
      mutate: vi.fn().mockRejectedValue(new Error('First name is too short')),
    });

    const result = (await promise) as {data: unknown; init: {status: number}};

    expect(result.init.status).toBe(400);
    expect(result.data).toEqual({
      error: 'First name is too short',
      customer: null,
    });
  });

  it('turns a thrown non-Error into a generic 400', async () => {
    const {promise} = submit({mutate: vi.fn().mockRejectedValue('boom')});

    const result = (await promise) as {data: unknown; init: {status: number}};

    expect(result.init.status).toBe(400);
    expect(result.data).toEqual({
      error: 'Customer profile update failed.',
      customer: null,
    });
  });

  it('reports API errors from the mutation as a 400', async () => {
    const {promise} = submit({
      mutate: vi.fn(async () => ({
        data: null,
        errors: [{message: 'Name is invalid'}],
      })),
    });

    const result = (await promise) as {data: unknown; init: {status: number}};

    expect(result.init.status).toBe(400);
    expect(result.data).toEqual({error: 'Name is invalid', customer: null});
  });

  it('rejects other methods with 405', async () => {
    const {promise, mutate} = submit({method: 'POST'});

    const result = (await promise) as {init: {status: number}};

    expect(result.init.status).toBe(405);
    expect(mutate).not.toHaveBeenCalled();
  });
});
