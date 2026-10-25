import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import {
  StaticRouterProvider,
  createStaticHandler,
  createStaticRouter,
  type LoaderFunction,
} from 'react-router';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';
import type {
  CustomerDetailsQuery,
  CustomerUpdateMutation,
} from 'customer-accountapi.generated';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';
import {CUSTOMER_UPDATE_MUTATION} from '~/graphql/customer-account/CustomerUpdateMutation';
import {
  ORIGIN,
  callRoute,
  thrownResponse,
} from '~/lib/__tests__/route-test-utils';
import {createAppRouterContext} from '~/lib/context';
import {AppSession} from '~/lib/session';
import {loader as accountCatchAllLoader} from '~/routes/account.$';
import {loader as addressesLoader} from '~/routes/account.addresses';
import {loader as orderLoader} from '~/routes/account.orders.$id';
import {loader as ordersLoader} from '~/routes/account.orders._index';
import {loader as profileLoader} from '~/routes/account.profile';
import {loader as accountLoader} from '~/routes/account';
import {loader as authorizeLoader} from '~/routes/account_.authorize';
import Login, {loader as loginLoader} from '~/routes/account_.login';
import {action as logoutAction} from '~/routes/account_.logout';
import {ACCOUNT_LOGIN_PATH, createCustomerAccountStub} from './stub.server';
import type {CustomerAccount, CustomerAccountApiError} from './types';

const UNAVAILABLE_MESSAGE =
  'Customer accounts are not available on this storefront yet.';
const SECRET = 'test-secret';

/** What Hydrogen's client kept in the session for a signed-in customer. */
const SIGNED_IN_SESSION = {
  customerAccount: {
    accessToken: 'access-token',
    expiresAt: '4102444800000',
    refreshToken: 'refresh-token',
    idToken: 'id-token',
  },
  buyer: {companyLocationId: 'gid://shopify/CompanyLocation/1'},
  note: 'other session data',
};

/** The Customer Account API variables of a store that set them (placeholders). */
const CONFIGURED_ENV = {
  SHOP_ID: '68817551382',
  PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID: 'shp_abc',
  PUBLIC_CUSTOMER_ACCOUNT_API_URL: 'https://shopify.com/68817551382',
};

/**
 * A session as a request loads it: read back from the cookie the storefront
 * issued, so nothing is pending yet.
 */
async function loadSession(
  data: Record<string, unknown> = {},
): Promise<AppSession> {
  const url = `${ORIGIN}/account`;
  const issuer = await AppSession.init(new Request(url), [SECRET]);
  for (const [key, value] of Object.entries(data)) issuer.set(key, value);
  const [cookie] = (await issuer.commit()).split(';');
  return AppSession.init(new Request(url, {headers: {Cookie: cookie}}), [
    SECRET,
  ]);
}

const HOST = new URL(ORIGIN).host;
/** The headers a browser sends with a form POST from this site. */
const SAME_ORIGIN_HEADERS = {Host: HOST, Origin: ORIGIN};

/** A POST to the sign-out route (by default from this site). */
function logoutRequest(headers: Record<string, string> = SAME_ORIGIN_HEADERS) {
  return new Request(`${ORIGIN}/account/logout`, {method: 'POST', headers});
}

async function setup(
  data?: Record<string, unknown>,
  request: Request = logoutRequest(),
) {
  const session = await loadSession(data);
  return {session, account: createCustomerAccountStub({session, request})};
}

/** `[status, Location]` of a redirect Response. */
function redirectOf(response: Response) {
  return [response.status, response.headers.get('Location')];
}

/** Every call that needs a signed-in customer; the stub never has one. */
const PROTECTED_CALLS: ReadonlyArray<
  readonly [name: string, call: (account: CustomerAccount) => Promise<unknown>]
> = [
  ['handleAuthStatus', (account) => account.handleAuthStatus()],
  ['authorize', (account) => account.authorize()],
  [
    'query',
    (account) =>
      account.query(CUSTOMER_DETAILS_QUERY, {variables: {language: 'EN'}}),
  ],
  [
    'mutate',
    (account) =>
      account.mutate(CUSTOMER_UPDATE_MUTATION, {
        variables: {customer: {firstName: 'Ada'}},
      }),
  ],
];

describe('createCustomerAccountStub', () => {
  describe('answers like a signed-out customer', () => {
    it('is never logged in and has no access token, buyer or API URL, even with old Hydrogen tokens in the session', async () => {
      const {account} = await setup(SIGNED_IN_SESSION);

      await expect(account.isLoggedIn()).resolves.toBe(false);
      await expect(account.getAccessToken()).resolves.toBeUndefined();
      await expect(account.getBuyer()).resolves.toBeUndefined();
      expect(account.getApiUrl()).toBe('');
    });

    it('ignores setBuyer, so no buyer is stored', async () => {
      const {session, account} = await setup();

      account.setBuyer({companyLocationId: 'gid://shopify/CompanyLocation/1'});

      expect(session.has('buyer')).toBe(false);
      expect(session.isPending).toBe(false);
      await expect(account.getBuyer()).resolves.toBeUndefined();
    });

    it('never writes the session outside logout, so pages send no session cookie', async () => {
      // root.tsx asks isLoggedIn() on every page.
      const {session, account} = await setup();

      await account.isLoggedIn();
      await account.getAccessToken();
      await account.getBuyer();
      account.getApiUrl();
      await account.login();
      for (const [, call] of PROTECTED_CALLS) {
        await call(account).catch(() => undefined);
      }

      expect(session.isPending).toBe(false);
    });
  });

  describe('calls that need a signed-in customer', () => {
    it.each(PROTECTED_CALLS)(
      '%s throws a 302 redirect to the sign-in page',
      async (_name, call) => {
        const {account} = await setup();

        const response = await thrownResponse(call(account));

        expect(redirectOf(response)).toEqual([302, '/account/login']);
      },
    );

    it.each(PROTECTED_CALLS)(
      '%s throws a new Response on every call',
      async (_name, call) => {
        const {account} = await setup();

        const first = await thrownResponse(call(account));
        const second = await thrownResponse(call(account));

        expect(second).not.toBe(first);
      },
    );

    it('uses the sign-in path it exports', () => {
      expect(ACCOUNT_LOGIN_PATH).toBe('/account/login');
    });
  });

  describe('login', () => {
    it('answers 503 with a plain-text explanation that is never cached', async () => {
      const {account} = await setup();

      const response = await account.login();

      expect(response.status).toBe(503);
      expect(response.headers.get('Content-Type')).toBe(
        'text/plain; charset=utf-8',
      );
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(await response.text()).toBe(UNAVAILABLE_MESSAGE);
    });

    it('answers the same whatever sign-in options it gets, and starts no OAuth flow', async () => {
      const {session, account} = await setup();

      const response = await account.login({
        countryCode: 'US',
        acrValues: 'provider:google',
        loginHint: 'ada@example.com',
        loginHintMode: 'submit',
        locale: 'fr',
        uiLocales: 'fr',
      });

      expect(response.status).toBe(503);
      expect(response.headers.get('Location')).toBeNull();
      expect(await response.text()).toBe(UNAVAILABLE_MESSAGE);
      expect(session.isPending).toBe(false);
    });

    it('returns a new Response on every call', async () => {
      const {account} = await setup();

      const first = await account.login();
      const second = await account.login();

      expect(second).not.toBe(first);
      expect(await first.text()).toBe(UNAVAILABLE_MESSAGE);
      expect(await second.text()).toBe(UNAVAILABLE_MESSAGE);
    });
  });

  describe('logout', () => {
    it('removes the customer and buyer, expires the session cookie and redirects home', async () => {
      const {session, account} = await setup(SIGNED_IN_SESSION);

      const response = await account.logout();

      expect(redirectOf(response)).toEqual([302, '/']);
      expect(session.has('customerAccount')).toBe(false);
      expect(session.has('buyer')).toBe(false);
      const cookies = response.headers.getSetCookie();
      expect(cookies).toHaveLength(1);
      expect(cookies[0]).toMatch(/^session=;/);
      expect(cookies[0]).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
      expect(cookies[0]).toContain('Path=/');
      expect(cookies[0]).toContain('HttpOnly');
      expect(cookies[0]).toContain('SameSite=Lax');
      expect(cookies[0]).toContain('Secure');
    });

    it('resets isPending, so server.ts does not commit the destroyed session again', async () => {
      const {session, account} = await setup(SIGNED_IN_SESSION);
      // An earlier write in the same request.
      session.set('recentlyViewed', ['cloudalign-pillow']);
      expect(session.isPending).toBe(true);

      await account.logout();

      expect(session.isPending).toBe(false);
    });

    it('with keepSession removes only the customer and buyer, for server.ts to commit', async () => {
      const {session, account} = await setup(SIGNED_IN_SESSION);

      const response = await account.logout({keepSession: true});

      expect(redirectOf(response)).toEqual([302, '/']);
      expect(session.has('customerAccount')).toBe(false);
      expect(session.has('buyer')).toBe(false);
      expect(session.get('note')).toBe(SIGNED_IN_SESSION.note);
      expect(session.isPending).toBe(true);
      expect(response.headers.getSetCookie()).toEqual([]);
    });

    it('sends extra headers along, next to the expired session cookie, without changing them', async () => {
      const {account} = await setup(SIGNED_IN_SESSION);
      const clearCart = 'cart=; Path=/; Max-Age=0';
      const headers = new Headers({
        'Set-Cookie': clearCart,
        'X-Signed-Out': '1',
      });

      const response = await account.logout({headers});

      const cookies = response.headers.getSetCookie();
      expect(cookies).toHaveLength(2);
      expect(cookies[0]).toBe(clearCart);
      expect(cookies[1]).toMatch(/^session=;/);
      expect(response.headers.get('X-Signed-Out')).toBe('1');
      expect(headers.getSetCookie()).toEqual([clearCart]);
    });

    it.each([
      ['/collections/all', '/collections/all'],
      ['/pages/about?from=logout#top', '/pages/about?from=logout#top'],
      [`${ORIGIN}/pages/about`, '/pages/about'],
      ['https://evil.example/', '/'],
      ['//evil.example/', '/'],
      ['/\\evil.example', '/'],
      ['javascript:alert(1)', '/'],
      ['', '/'],
    ])(
      'follows postLogoutRedirectUri %j only on this site (Location %j)',
      async (target, location) => {
        const {account} = await setup(SIGNED_IN_SESSION);

        const response = await account.logout({postLogoutRedirectUri: target});

        expect(redirectOf(response)).toEqual([302, location]);
      },
    );

    // /account/logout is a resource route, and React Router 7.16 checks the
    // Origin of document and `.data` actions only, so logout() applies the
    // same rule itself.
    it.each([
      ['another site', {Host: HOST, Origin: 'https://evil.example'}],
      ['a look-alike host', {Host: HOST, Origin: `${ORIGIN}.evil.example`}],
      ['a subdomain', {Host: HOST, Origin: 'https://evil.shop.example'}],
      ['another port', {Host: HOST, Origin: 'https://shop.example:8443'}],
      ['the opaque origin', {Host: HOST, Origin: 'null'}],
      ['an Origin that is not a URL', {Host: HOST, Origin: 'not a url'}],
      [
        'a forwarded host that differs',
        {Host: HOST, 'X-Forwarded-Host': 'other.example', Origin: ORIGIN},
      ],
      ['a request without a host', {Origin: ORIGIN}],
    ])(
      'refuses a sign-out from %s with a 400 and leaves the session alone',
      async (_label, headers) => {
        const {session, account} = await setup(
          SIGNED_IN_SESSION,
          logoutRequest(headers),
        );

        const response = await thrownResponse(account.logout());

        expect(response.status).toBe(400);
        expect(response.headers.getSetCookie()).toEqual([]);
        expect(session.get('customerAccount')).toEqual(
          SIGNED_IN_SESSION.customerAccount,
        );
        expect(session.isPending).toBe(false);
      },
    );

    it.each([
      ['this site', SAME_ORIGIN_HEADERS],
      ['a client that sends no Origin', {Host: HOST}],
      [
        'this site behind a proxy (first forwarded host)',
        {
          Host: 'worker.internal',
          'X-Forwarded-Host': `${HOST}, proxy.internal`,
          Origin: ORIGIN,
        },
      ],
    ])('signs out a request from %s', async (_label, headers) => {
      const {session, account} = await setup(
        SIGNED_IN_SESSION,
        logoutRequest(headers),
      );

      const response = await account.logout();

      expect(redirectOf(response)).toEqual([302, '/']);
      expect(session.has('customerAccount')).toBe(false);
    });
  });

  describe('types', () => {
    it('types query and mutate by document once codegen fills CustomerAccountQueries', async () => {
      const {account} = await setup();

      const details = () => account.query(CUSTOMER_DETAILS_QUERY);
      const update = () =>
        account.mutate(CUSTOMER_UPDATE_MUTATION, {
          variables: {customer: {firstName: 'Ada'}},
        });
      // @ts-expect-error The generated variables are required.
      const withoutVariables = () => account.mutate(CUSTOMER_UPDATE_MUTATION);

      await expect(details()).rejects.toBeInstanceOf(Response);
      await expect(withoutVariables()).rejects.toBeInstanceOf(Response);
      expectTypeOf<
        Awaited<ReturnType<typeof details>>['data']
      >().toEqualTypeOf<CustomerDetailsQuery>();
      expectTypeOf<
        Awaited<ReturnType<typeof update>>['data']
      >().toEqualTypeOf<CustomerUpdateMutation>();
      expectTypeOf<
        Awaited<ReturnType<typeof details>>['errors']
      >().toEqualTypeOf<CustomerAccountApiError[] | undefined>();
    });
  });

  describe('i18n', () => {
    it('defaults to English, like Hydrogen', async () => {
      const {account} = await setup();

      expect(account.i18n).toEqual({language: 'EN'});
    });

    it('uses the language it is given', async () => {
      const session = await loadSession();

      const account = createCustomerAccountStub({
        session,
        request: logoutRequest(),
        language: 'FR',
      });

      expect(account.i18n).toEqual({language: 'FR'});
    });
  });
});

/** The router context the account routes read, carrying the stub. */
function routeContext(
  request: Request,
  session: AppSession,
  env: Record<string, string>,
) {
  return {
    env,
    session,
    customerAccount: createCustomerAccountStub({session, request}),
    storefront: {i18n: {language: 'EN', country: 'US'}},
  };
}

/**
 * Runs the sign-in route through React Router's static handler and renders
 * it, as for a document request.
 */
async function renderLoginPage(env: Record<string, string>) {
  const session = await loadSession();
  const routes = [
    {
      id: 'account-login',
      path: '/account/login',
      loader: loginLoader as unknown as LoaderFunction,
      Component: Login,
    },
  ];
  const handler = createStaticHandler(routes);
  const request = new Request(`${ORIGIN}/account/login`);
  const context = await handler.query(request, {
    requestContext: routeContext(request, session, env),
  });
  if (context instanceof Response) {
    throw new Error(`Expected a rendered page, got a ${context.status}`);
  }
  const router = createStaticRouter(handler.dataRoutes, context);
  const html = renderToString(
    createElement(StaticRouterProvider, {router, context}),
  );
  return {statusCode: context.statusCode, html};
}

describe('account routes on the stub, with the Customer Account variables set', () => {
  it('the sign-in loader answers the stub 503 instead of starting a sign-in', async () => {
    const session = await loadSession();
    const request = new Request(
      `${ORIGIN}/account/login?login_hint=ada%40example.com&locale=fr`,
    );

    const response = (await callRoute(loginLoader, {
      request,
      context: routeContext(request, session, CONFIGURED_ENV),
    })) as Response;

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(503);
    expect(await response.text()).toBe(UNAVAILABLE_MESSAGE);
    expect(session.isPending).toBe(false);
  });

  it.each([
    ['set', CONFIGURED_ENV],
    ['missing', {}],
  ])(
    'with the variables %s, React Router renders the AccountUnavailable page with status 503',
    async (_state, env) => {
      const {statusCode, html} = await renderLoginPage(env);

      expect(statusCode).toBe(503);
      expect(html).toContain('Sign-in isn’t available yet');
      expect(html).toContain('For developers: enabling customer accounts');
    },
  );

  it('keeps what the e2e specs check on that page: four developer steps, the API name and the ways back', async () => {
    const {html} = await renderLoginPage(CONFIGURED_ENV);

    const steps = html.match(/<ol>(.*?)<\/ol>/s)?.[1].match(/<li>.*?<\/li>/gs);
    expect(steps).toHaveLength(4);
    expect(steps?.[0]).toContain('Customer accounts are deferred');
    expect(html).toContain('Customer Account API');
    // A link's label may sit in nested elements (Button wraps it in a span).
    expect(html).toMatch(/<a [^>]*href="\/"[^>]*>(<[^>]+>)*Go to homepage</);
    expect(html).toMatch(
      /<a [^>]*href="\/collections\/all"[^>]*>(<[^>]+>)*Back to shopping</,
    );
  });

  const SIGNED_IN_ONLY: ReadonlyArray<
    readonly [
      path: string,
      loader: (args: never) => Promise<unknown>,
      params: Record<string, string>,
    ]
  > = [
    ['/account', accountLoader, {}],
    ['/account/orders', ordersLoader, {}],
    [
      '/account/orders/:id',
      orderLoader,
      {id: btoa('gid://shopify/Order/1001')},
    ],
    ['/account/profile', profileLoader, {}],
    ['/account/addresses', addressesLoader, {}],
    ['/account/*', accountCatchAllLoader, {'*': 'unknown'}],
    ['/account/authorize', authorizeLoader, {}],
  ];

  it.each(SIGNED_IN_ONLY)(
    '%s redirects to the sign-in page',
    async (path, loader, params) => {
      const session = await loadSession();
      const request = new Request(`${ORIGIN}${path}`);

      const response = await thrownResponse(
        callRoute(loader, {
          request,
          context: routeContext(request, session, CONFIGURED_ENV),
          params,
        }),
      );

      expect(redirectOf(response)).toEqual([302, '/account/login']);
    },
  );

  it('signing out clears the session and redirects home', async () => {
    const session = await loadSession(SIGNED_IN_SESSION);
    const request = logoutRequest();

    const response = (await callRoute(logoutAction, {
      request,
      context: routeContext(request, session, CONFIGURED_ENV),
    })) as Response;

    expect(redirectOf(response)).toEqual([302, '/']);
    expect(response.headers.getSetCookie()[0]).toMatch(/^session=;/);
    expect(session.has('customerAccount')).toBe(false);
    expect(session.isPending).toBe(false);
  });

  it('a sign-out POST from another site is a 400 that sets no cookie (security.spec)', async () => {
    const session = await loadSession(SIGNED_IN_SESSION);
    const request = logoutRequest({Host: HOST, Origin: 'https://evil.example'});

    const response = await thrownResponse(
      callRoute(logoutAction, {
        request,
        context: routeContext(request, session, CONFIGURED_ENV),
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(session.isPending).toBe(false);
  });
});

describe('the router context', () => {
  const ENV = {
    SESSION_SECRET: SECRET,
    PUBLIC_STORE_DOMAIN: 'mellow-test.myshopify.com',
    PUBLIC_STOREFRONT_API_TOKEN: 'a'.repeat(32),
    ...CONFIGURED_ENV,
  } as unknown as Env;
  const EXECUTION_CONTEXT = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  beforeEach(() => {
    vi.stubGlobal('caches', {
      open: async () => ({
        match: async () => undefined,
        put: async () => {},
        delete: async () => false,
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('carries the stub, also when the Customer Account variables are set', async () => {
    const context = await createAppRouterContext(
      new Request(`${ORIGIN}/account/login`),
      ENV,
      EXECUTION_CONTEXT,
    );

    const response = await context.customerAccount.login();

    expect(response.status).toBe(503);
    expect(await response.text()).toBe(UNAVAILABLE_MESSAGE);
    await expect(context.customerAccount.isLoggedIn()).resolves.toBe(false);
    expect(context.customerAccount.i18n).toEqual({language: 'EN'});
  });

  it('hands the request to the stub, which refuses a cross-origin sign-out', async () => {
    const context = await createAppRouterContext(
      logoutRequest({Host: HOST, Origin: 'https://evil.example'}),
      ENV,
      EXECUTION_CONTEXT,
    );

    const response = await thrownResponse(context.customerAccount.logout());

    expect(response.status).toBe(400);
    expect(context.session.isPending).toBe(false);
  });
});
