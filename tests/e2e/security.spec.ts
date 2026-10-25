/**
 * Security: response headers, Content Security Policy (as sent and as
 * enforced), cross-origin request protection, redirect hardening, cookie
 * flags and input validation.
 *
 * Almost everything here is API-level (the `request` fixture): headers and
 * status codes do not need a browser. Two tests use a page to prove the CSP is
 * actually enforced, not merely present. Desktop only.
 *
 * Not covered here: the `session` cookie. Nothing in mock mode writes to the
 * session (it only holds customer-account state), so no response sets it; its
 * HttpOnly/SameSite/Secure flags are unit-tested in app/lib/session.test.ts.
 */
import type {APIResponse} from '@playwright/test';
import {COPY, PRODUCTS} from './support/catalog';
import {seedCart} from './support/cart';
import {expect, test} from './support/fixtures';
import {gotoHydrated} from './support/hydration';

function originOf(baseURL: string | undefined): string {
  if (!baseURL) throw new Error('baseURL is not configured');
  return new URL(baseURL).origin;
}

/** Parsed Content-Security-Policy: directive name -> source list. */
function parseCsp(header: string | undefined): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of (header ?? '').split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) directives.set(name.toLowerCase(), sources);
  }
  return directives;
}

/** Sources that govern a fetch directive: its own list, else `default-src`. */
function effectiveSources(
  csp: Map<string, string[]>,
  directive: string,
): string[] {
  return csp.get(directive) ?? csp.get('default-src') ?? [];
}

function setCookies(response: APIResponse): string[] {
  return response
    .headersArray()
    .filter(({name}) => name.toLowerCase() === 'set-cookie')
    .map(({value}) => value);
}

/**
 * Chromium's wording for CSP violations changes between versions ("Refused to
 * execute inline script ..." vs "Executing inline script violates ..."), so
 * match the stable parts: a Content Security Policy report that names `topic`.
 */
function isCspReport(text: string, topic: RegExp): boolean {
  return /Content Security Policy/.test(text) && topic.test(text);
}

const NOSNIFF = 'nosniff';
const REFERRER_POLICY = 'strict-origin-when-cross-origin';

test.describe('Content-Security-Policy', () => {
  test('documents send a strict policy', async ({request}) => {
    const response = await request.get('/');
    const csp = parseCsp(response.headers()['content-security-policy']);
    expect(csp.size, 'a CSP header is present').toBeGreaterThan(0);

    // Scripts need the per-request nonce; inline and eval are not allowed.
    const scripts = effectiveSources(csp, 'script-src');
    expect(
      scripts.some((source) => /^'nonce-[\w+/=-]{16,}'$/.test(source)),
    ).toBe(true);
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");

    // Third parties the storefront really uses, and nothing else is implied.
    expect(effectiveSources(csp, 'style-src')).toContain(
      'https://fonts.googleapis.com',
    );
    expect(effectiveSources(csp, 'font-src')).toContain(
      'https://fonts.gstatic.com',
    );
    expect(effectiveSources(csp, 'frame-src')).toEqual(
      expect.arrayContaining([
        "'self'",
        'https://www.youtube-nocookie.com',
        'https://player.vimeo.com',
      ]),
    );

    // Hardening directives that do not fall back to default-src.
    expect(csp.get('object-src'), 'no plugins').toEqual(["'none'"]);
    expect(csp.get('form-action'), 'forms post to this site only').toEqual([
      "'self'",
      'https://shopify.com',
    ]);
    expect(csp.get('frame-ancestors'), 'cannot be framed').toEqual(["'none'"]);
    expect(csp.get('base-uri'), 'no <base> hijacking').toEqual(["'self'"]);
  });

  test('every script tag carries the nonce from the header, and it changes per request', async ({
    request,
  }) => {
    const nonceOf = (response: APIResponse) => {
      const csp = parseCsp(response.headers()['content-security-policy']);
      const sources = effectiveSources(csp, 'script-src');
      return /^'nonce-(.+)'$/.exec(
        sources.find((source) => source.startsWith("'nonce-")) ?? '',
      )?.[1];
    };

    const first = await request.get('/products/cloudalign-pillow');
    const second = await request.get('/products/cloudalign-pillow');
    const nonce = nonceOf(first);
    expect(nonce, 'nonce in the header').toBeTruthy();
    expect(nonceOf(second), 'a fresh nonce per request').not.toBe(nonce);

    const tags = (await first.text()).match(/<script\b[^>]*>/g) ?? [];
    expect(tags.length, 'the page has script tags').toBeGreaterThan(0);
    for (const tag of tags) {
      expect(tag, 'script tag without the request nonce').toContain(
        `nonce="${nonce}"`,
      );
    }
  });

  test('inline scripts without the nonce are blocked in the browser', async ({
    page,
    consoleGuard,
  }) => {
    consoleGuard.allow(
      (record) => isCspReport(record.text, /inline script/i),
      'deliberate CSP probe: the browser reports the blocked script',
    );
    await gotoHydrated(page, '/');

    const reported = page.waitForEvent('console', (message) =>
      isCspReport(message.text(), /inline script/i),
    );
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.__cspProbe = "executed"';
      document.head.append(script);
    });
    await reported;

    expect(
      await page.evaluate(
        () => (window as unknown as {__cspProbe?: string}).__cspProbe,
      ),
    ).toBeUndefined();
  });

  test('forms cannot post to a foreign origin in the browser', async ({
    page,
    consoleGuard,
  }) => {
    consoleGuard.allow(
      (record) => isCspReport(record.text, /form-action/),
      'deliberate CSP probe: the browser reports the blocked submission',
    );
    const requested: string[] = [];
    page.on('request', (request) => requested.push(request.url()));
    await gotoHydrated(page, '/');

    const reported = page.waitForEvent('console', (message) =>
      isCspReport(message.text(), /form-action/),
    );
    await page.evaluate(() => {
      const form = document.createElement('form');
      form.method = 'post';
      form.action = 'https://evil.example/steal';
      document.body.append(form);
      form.submit();
    });
    await reported;

    // Third-party requests are answered by a stub, so a request event would
    // show up here if the browser had not blocked the submission.
    expect(requested.filter((url) => url.includes('evil.example'))).toEqual([]);
    expect(new URL(page.url()).pathname).toBe('/');
  });
});

test.describe('security headers', () => {
  const LONG_PATH = `/${Array.from({length: 40}, (_, index) => `s${index}`).join('/')}`;

  interface HeaderCase {
    name: string;
    method?: 'GET' | 'POST';
    path: string;
    /** HTML documents also carry a CSP. */
    document?: boolean;
  }

  const CASES: readonly HeaderCase[] = [
    {name: 'home page', path: '/', document: true},
    {name: 'product page', path: '/products/cloudalign-pillow', document: true},
    {name: '404 page', path: '/this-page-does-not-exist', document: true},
    {name: '503 page', path: '/account/login', document: true},
    {name: 'robots.txt', path: '/robots.txt'},
    {name: 'sitemap.xml', path: '/sitemap.xml'},
    {name: 'single-fetch data request', path: '/cart.data'},
    {name: 'cart permalink redirect', path: '/cart/cloudalign-pillow-1:1'},
    {name: 'discount redirect', path: '/discount/MELLOW10'},
    {name: 'newsletter loader redirect', path: '/newsletter'},
    {name: 'newsletter action error', method: 'POST', path: '/newsletter.data'},
    {name: 'early 404 for a very long path', path: LONG_PATH},
  ];

  for (const {name, method = 'GET', path, document} of CASES) {
    test(`${name} (${method} ${path.length > 60 ? `${path.slice(0, 20)}...` : path})`, async ({
      request,
      baseURL,
    }) => {
      const response = await request.fetch(path, {
        method,
        maxRedirects: 0,
        headers: {Origin: originOf(baseURL)},
        // An invalid address: the action answers 400 and must still send headers.
        form: method === 'POST' ? {email: 'not-an-email'} : undefined,
      });

      expect(response.headers()['x-content-type-options']).toBe(NOSNIFF);
      expect(response.headers()['referrer-policy']).toBe(REFERRER_POLICY);
      if (document) {
        const csp = parseCsp(response.headers()['content-security-policy']);
        expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
        expect(csp.get('object-src')).toEqual(["'none'"]);
      }
    });
  }
});

test.describe('cross-origin requests', () => {
  const cartInput = JSON.stringify({
    action: 'LinesAdd',
    inputs: {
      lines: [
        {
          merchandiseId: `gid://shopify/ProductVariant/${PRODUCTS.cloudAlign.variants[0].id}`,
          quantity: 1,
        },
      ],
    },
  });

  interface Target {
    name: string;
    path: string;
    form: Record<string, string>;
  }

  const TARGETS: readonly Target[] = [
    {
      name: 'newsletter page',
      path: '/newsletter',
      form: {email: 'a@example.com'},
    },
    {
      name: 'newsletter data',
      path: '/newsletter.data',
      form: {email: 'a@example.com'},
    },
    {name: 'cart page', path: '/cart', form: {cartFormInput: cartInput}},
    {name: 'cart data', path: '/cart.data', form: {cartFormInput: cartInput}},
    {name: 'sign out', path: '/account/logout', form: {}},
  ];

  for (const target of TARGETS) {
    test(`POST to ${target.name} from another origin is rejected with 400`, async ({
      request,
      baseURL,
    }) => {
      const origin = originOf(baseURL);
      const foreignOrigins = [
        'https://evil.example',
        // Look-alike hosts that merely start or end like this site's host.
        `${origin}.evil.example`,
        origin.replace('://', '://evil.'),
        // Sandboxed iframes and redirects send the opaque origin.
        'null',
      ];

      for (const foreign of foreignOrigins) {
        const response = await request.post(target.path, {
          headers: {Origin: foreign},
          form: target.form,
          maxRedirects: 0,
        });
        expect(response.status(), `Origin: ${foreign}`).toBe(400);
        expect(
          setCookies(response),
          `a rejected request must not set cookies (Origin: ${foreign})`,
        ).toEqual([]);
      }
    });
  }

  test('a rejected cart POST leaves the cart untouched; the same POST from this origin works', async ({
    page,
    baseURL,
  }) => {
    const origin = originOf(baseURL);
    await seedCart(page, 'cloudalign-pillow-1:1');

    const rejected = await page.request.post('/cart', {
      headers: {Origin: 'https://evil.example'},
      form: {cartFormInput: cartInput},
      maxRedirects: 0,
    });
    expect(rejected.status()).toBe(400);
    await gotoHydrated(page, '/cart');
    await expect(page.getByRole('heading', {level: 1})).toHaveText(
      'Your cart 1 item',
    );

    // Control: identical payload, correct origin.
    const accepted = await page.request.post('/cart', {
      headers: {Origin: origin},
      form: {cartFormInput: cartInput},
      maxRedirects: 0,
    });
    expect(accepted.status()).toBe(200);
    await gotoHydrated(page, '/cart');
    await expect(page.getByRole('heading', {level: 1})).toHaveText(
      'Your cart 2 items',
    );
  });

  test('requests without an Origin header (curl, server-to-server) are not blocked', async ({
    request,
  }) => {
    const response = await request.post('/newsletter.data', {
      form: {email: 'a@example.com'},
    });
    expect(response.status()).toBe(200);
  });
});

test.describe('redirect targets', () => {
  /** Attacker-controlled values that must never leave this site. */
  const HOSTILE = [
    'https://evil.example',
    'https://evil.example/path?x=1',
    'HTTPS://EVIL.EXAMPLE',
    '//evil.example',
    '///evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    'https:\\\\evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    '/\r/evil.example',
    ' //evil.example',
    '/.//evil.example',
    '/..//evil.example',
    'https:evil.example',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://localhost:3100@evil.example',
  ];

  /** Same-origin forms that stay on this site (and are allowed through). */
  const SAME_SITE: ReadonlyArray<[string, string]> = [
    ['/collections/all', '/collections/all'],
    ['/collections/all?sort_key=PRICE', '/collections/all?sort_key=PRICE'],
    [
      '/products/cloudalign-pillow?Size=King#reviews',
      '/products/cloudalign-pillow?Size=King#reviews',
    ],
    ['collections/all', '/collections/all'],
  ];

  function expectStaysOnSite(location: string | undefined, origin: string) {
    expect(location, 'a Location header').toBeTruthy();
    expect(location).not.toMatch(/^\/\//);
    expect(location).not.toContain('\\');
    expect(new URL(location ?? '', origin).origin).toBe(origin);
  }

  test('/discount/<code>?redirect=<hostile> lands on the home page', async ({
    request,
    baseURL,
  }) => {
    const origin = originOf(baseURL);
    for (const param of ['redirect', 'return_to']) {
      for (const value of HOSTILE) {
        const response = await request.get(
          `/discount/MELLOW10?${param}=${encodeURIComponent(value)}`,
          {maxRedirects: 0},
        );
        const label = `${param}=${JSON.stringify(value)}`;
        expect(response.status(), label).toBe(303);
        expect(response.headers()['location'], label).toBe('/');
        expectStaysOnSite(response.headers()['location'], origin);
      }
    }
  });

  test('/discount/<code> keeps same-site targets and carries tracking parameters over', async ({
    request,
  }) => {
    for (const [value, expected] of SAME_SITE) {
      const response = await request.get(
        `/discount/MELLOW10?redirect=${encodeURIComponent(value)}`,
        {maxRedirects: 0},
      );
      expect(response.status(), value).toBe(303);
      expect(response.headers()['location'], value).toBe(expected);
    }

    const tracked = await request.get(
      '/discount/MELLOW10?redirect=/collections/all&utm_source=mail&utm_campaign=autumn',
      {maxRedirects: 0},
    );
    expect(tracked.headers()['location']).toBe(
      '/collections/all?utm_source=mail&utm_campaign=autumn',
    );

    const bare = await request.get('/discount/MELLOW10', {maxRedirects: 0});
    expect(bare.status()).toBe(303);
    expect(bare.headers()['location']).toBe('/');
  });

  test("a discount link applies the code to the visitor's cart", async ({
    page,
  }) => {
    await seedCart(page, 'cloudalign-pillow-1:1');

    const response = await page.request.get(
      '/discount/MELLOW10?redirect=/cart',
      {maxRedirects: 0},
    );
    expect(response.status()).toBe(303);
    expect(response.headers()['location']).toBe('/cart');

    await gotoHydrated(page, '/cart');
    const main = page.getByRole('main');
    await expect(
      main.getByRole('list', {name: 'Applied discount codes'}),
    ).toContainText('MELLOW10');
    await expect(main.getByText(COPY.discountRowMellow10)).toBeVisible();
  });

  test('the cart action follows only same-site redirectTo values', async ({
    request,
    baseURL,
  }) => {
    const origin = originOf(baseURL);
    const post = (redirectTo: string) =>
      request.post('/cart', {
        headers: {Origin: origin},
        form: {
          cartFormInput: JSON.stringify({
            action: 'LinesAdd',
            inputs: {
              lines: [
                {
                  merchandiseId: `gid://shopify/ProductVariant/${PRODUCTS.cloudAlign.variants[0].id}`,
                  quantity: 1,
                },
              ],
            },
          }),
          redirectTo,
        },
        maxRedirects: 0,
      });

    for (const value of HOSTILE) {
      const response = await post(value);
      const label = `redirectTo=${JSON.stringify(value)}`;
      expect(response.status(), label).toBe(303);
      expect(response.headers()['location'], label).toBe('/');
    }
    for (const [value, expected] of SAME_SITE) {
      const response = await post(value);
      expect(response.status(), value).toBe(303);
      expect(response.headers()['location'], value).toBe(expected);
    }
  });

  test('a look-alike path that resolves to a protocol-relative URL stays on this site', async ({
    request,
    baseURL,
  }) => {
    const origin = originOf(baseURL);
    // `http:evil.example` is a relative reference on an http site.
    const response = await request.get(
      `/discount/MELLOW10?redirect=${encodeURIComponent('http:evil.example')}`,
      {maxRedirects: 0},
    );
    expectStaysOnSite(response.headers()['location'], origin);
  });
});

test.describe('404 pages with redirect parameters', () => {
  // Hydrogen's storefrontRedirect follows ?redirect= / ?return_to= on a 404.
  // server.ts first reduces both to a same-origin path (or drops them), so a
  // hostile value can no longer turn a 404 into an open redirect.
  const HOSTILE = [
    '/.//evil.example',
    '/..//evil.example',
    '//evil.example',
    'https://evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
  ];
  const MISSING = ['/nope', '/products/does-not-exist'];

  test('hostile values give a plain 404 without a Location header', async ({
    request,
  }) => {
    for (const path of MISSING) {
      for (const param of ['redirect', 'return_to']) {
        for (const value of HOSTILE) {
          const label = `${path}?${param}=${JSON.stringify(value)}`;
          const response = await request.get(
            `${path}?${param}=${encodeURIComponent(value)}`,
            {maxRedirects: 0},
          );
          expect(response.status(), label).toBe(404);
          expect(response.headers()['location'], label).toBeUndefined();
        }
      }
    }
  });

  test('a same-site value still redirects with a 301', async ({request}) => {
    for (const path of MISSING) {
      for (const param of ['redirect', 'return_to']) {
        const response = await request.get(
          `${path}?${param}=${encodeURIComponent('/collections/all')}`,
          {maxRedirects: 0},
        );
        expect(response.status(), `${path} ${param}`).toBe(301);
        expect(response.headers()['location']).toBe('/collections/all');
      }
    }
    const withQuery = await request.get(
      `/nope?redirect=${encodeURIComponent('/collections/all?sort_key=PRICE')}`,
      {maxRedirects: 0},
    );
    expect(withQuery.status()).toBe(301);
    expect(withQuery.headers()['location']).toBe(
      '/collections/all?sort_key=PRICE',
    );
  });

  test('client-side (.data) requests get the same plain 404', async ({
    request,
  }) => {
    for (const value of HOSTILE) {
      const response = await request.get(
        `/nope.data?redirect=${encodeURIComponent(value)}`,
        {maxRedirects: 0},
      );
      expect(response.status(), value).toBe(404);
      expect(response.headers()['location'], value).toBeUndefined();
    }
  });
});

test.describe('cart action input validation', () => {
  // The body is attacker-controlled: whatever is wrong with it, the answer is
  // a 400 with the standard cart-error shape and no internal detail.
  const lines = [
    {
      merchandiseId: `gid://shopify/ProductVariant/${PRODUCTS.cloudAlign.variants[0].id}`,
      quantity: 1,
    },
  ];
  const input = (action: string, inputs: unknown) => ({
    cartFormInput: JSON.stringify({action, inputs}),
  });

  interface BadRequest {
    name: string;
    headers?: Record<string, string>;
    data?: string;
    form?: Record<string, string>;
  }

  const BAD_REQUESTS: readonly BadRequest[] = [
    {
      name: 'a JSON body instead of a form',
      headers: {'Content-Type': 'application/json'},
      data: '{"action":',
    },
    {
      name: 'a plain-text body',
      headers: {'Content-Type': 'text/plain'},
      data: 'LinesAdd',
    },
    {name: 'a form without cartFormInput', form: {x: '1'}},
    {
      name: 'cartFormInput that is not JSON',
      form: {cartFormInput: '{"action":'},
    },
    {
      name: 'lines that are not an array',
      form: input('LinesAdd', {lines: 'nope'}),
    },
    {
      name: 'update lines that are not an array',
      form: input('LinesUpdate', {lines: {}}),
    },
    {
      name: 'lineIds that are not an array',
      form: input('LinesRemove', {lineIds: 5}),
    },
    {
      name: 'a line that is null',
      form: input('LinesAdd', {lines: [null]}),
    },
    {
      name: 'an update line without an id',
      form: input('LinesUpdate', {lines: [{}]}),
    },
    {
      name: 'a line id that is not a string',
      form: input('LinesRemove', {lineIds: [5]}),
    },
    {name: 'an unknown action', form: input('Bogus', {lines})},
  ];

  for (const bad of BAD_REQUESTS) {
    test(`${bad.name} is answered with 400`, async ({request, baseURL}) => {
      const origin = originOf(baseURL);
      for (const path of ['/cart.data', '/cart']) {
        const response = await request.post(path, {
          headers: {Origin: origin, ...bad.headers},
          data: bad.data,
          form: bad.form,
          maxRedirects: 0,
        });
        const label = `POST ${path}`;
        expect(response.status(), label).toBe(400);
        expect(setCookies(response), `${label} sets no cookie`).toEqual([]);

        const body = await response.text();
        expect(body, label).toContain(COPY.cartInvalidRequest);
        // No stack traces, file paths or framework internals reach the client.
        expect(body, label).not.toMatch(/\/home\/|\n\s+at\s|\bError:\s/);
        if (path === '/cart.data') {
          // Same shape as the 502 answer: cart, errors, userErrors, warnings.
          for (const key of ['cart', 'errors', 'userErrors', 'warnings']) {
            expect(body, `${label} has "${key}"`).toContain(`"${key}"`);
          }
        }
      }
    });
  }

  test('a well-formed request from the same origin is still accepted', async ({
    request,
    baseURL,
  }) => {
    const response = await request.post('/cart.data', {
      headers: {Origin: originOf(baseURL)},
      form: input('LinesAdd', {lines}),
    });
    expect(response.status()).toBe(200);
    expect(await response.text()).not.toContain(COPY.cartInvalidRequest);
  });
});

test.describe('cookies', () => {
  test('the cart cookie is HttpOnly and SameSite=Lax, and Secure only over https', async ({
    page,
    baseURL,
  }) => {
    const secureSite = new URL(baseURL ?? '').protocol === 'https:';

    const response = await page.request.get('/cart/cloudalign-pillow-1:1', {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    const cart = setCookies(response).find((cookie) =>
      cookie.startsWith('cart='),
    );
    expect(cart, 'the permalink sets the cart cookie').toBeTruthy();
    expect(cart).toMatch(/;\s*HttpOnly/i);
    expect(cart).toMatch(/;\s*SameSite=Lax/i);
    expect(cart).toMatch(/;\s*Path=\//i);
    expect(/;\s*Secure/i.test(cart ?? '')).toBe(secureSite);

    // The browser stores it with the same flags and hides it from scripts.
    const [stored] = (await page.context().cookies()).filter(
      (cookie) => cookie.name === 'cart',
    );
    expect(stored).toMatchObject({
      httpOnly: true,
      sameSite: 'Lax',
      secure: secureSite,
    });
    await gotoHydrated(page, '/cart');
    expect(await page.evaluate(() => document.cookie)).not.toContain('cart=');
  });

  test('the cart cookie set by a discount link and by a cart POST has the same flags', async ({
    request,
    baseURL,
  }) => {
    const origin = originOf(baseURL);
    const discount = await request.get('/discount/MELLOW10', {
      maxRedirects: 0,
    });
    const posted = await request.post('/cart', {
      headers: {Origin: origin},
      form: {
        cartFormInput: JSON.stringify({
          action: 'LinesAdd',
          inputs: {
            lines: [
              {
                merchandiseId: `gid://shopify/ProductVariant/${PRODUCTS.cloudAlign.variants[0].id}`,
                quantity: 1,
              },
            ],
          },
        }),
      },
      maxRedirects: 0,
    });

    for (const response of [discount, posted]) {
      const cart = setCookies(response).find((cookie) =>
        cookie.startsWith('cart='),
      );
      expect(cart).toMatch(/;\s*HttpOnly/i);
      expect(cart).toMatch(/;\s*SameSite=Lax/i);
    }
  });
});

test.describe('input validation', () => {
  test('malformed cart permalinks answer 410 and create no cart', async ({
    request,
  }) => {
    const BAD = [
      'not-a-line',
      'cloudalign-pillow-1',
      'cloudalign-pillow-1:0',
      'cloudalign-pillow-1:-1',
      'cloudalign-pillow-1:1:2',
      'cloudalign-pillow-1:10000',
      'cloudalign-pillow-1:1,',
      'UPPER-1:1',
      'a:1,b:x',
      // More lines than any real link carries (limit: 50).
      Array.from({length: 51}, () => 'cloudalign-pillow-1:1').join(','),
    ];
    for (const lines of BAD) {
      const response = await request.get(`/cart/${lines}`, {maxRedirects: 0});
      const label =
        lines.length > 60 ? `${lines.slice(0, 30)}... (51 lines)` : lines;
      expect(response.status(), label).toBe(410);
      expect(setCookies(response), `${label} sets no cookie`).toEqual([]);
    }
  });

  test('well-formed cart permalinks redirect to checkout with a cart cookie', async ({
    request,
  }) => {
    const response = await request.get(
      '/cart/cloudalign-pillow-1:2,pebble-pillow-1:1',
      {maxRedirects: 0},
    );
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toContain(
      '/dev/mock-checkout?cart=',
    );
    expect(setCookies(response).some((c) => c.startsWith('cart='))).toBe(true);
  });

  test('a path with far too many segments is rejected before routing', async ({
    request,
  }) => {
    const deep = `/${Array.from({length: 40}, (_, index) => `s${index}`).join('/')}`;
    for (const path of [deep, `${deep}.data`]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
      expect(response.headers()['content-type']).toContain('text/plain');
      expect(await response.text()).toBe('Not found');
    }

    // Real routes are at most four segments deep and are unaffected: an
    // unknown path of that depth gets the designed HTML 404.
    for (const path of ['/a/b/c/d', '/blogs/news/some-article']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
      expect(response.headers()['content-type']).toContain('text/html');
    }
  });

  test('the search term is escaped when it is reflected', async ({page}) => {
    // No spaces: the %20-in-query hydration defect (see smoke.spec.ts) is a
    // separate matter from escaping.
    const payload = '<img/src=x/onerror=window.__xss=1>';
    await gotoHydrated(page, `/search?q=${encodeURIComponent(payload)}`);

    await expect(page).toHaveTitle(`Search results for “${payload}” | Mellow`);
    await expect(page.getByRole('main').locator('img[src="x"]')).toHaveCount(0);
    expect(
      await page.evaluate(() => (window as unknown as {__xss?: number}).__xss),
    ).toBeUndefined();
    await expect(page.getByRole('main')).toContainText(payload);
  });
});

test.describe('newsletter endpoint', () => {
  async function submit(
    request: import('@playwright/test').APIRequestContext,
    origin: string,
    init: {
      form?: Record<string, string>;
      data?: string | Record<string, string>;
      contentType?: string;
    },
  ) {
    return request.post('/newsletter.data', {
      headers: {
        Origin: origin,
        ...(init.contentType ? {'Content-Type': init.contentType} : {}),
      },
      form: init.form,
      data: init.data,
    });
  }

  test('a valid address is acknowledged as a development mock (200)', async ({
    request,
    baseURL,
  }) => {
    const response = await submit(request, originOf(baseURL), {
      form: {email: 'test@example.com', source: 'footer'},
    });
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain(COPY.newsletterMock);
  });

  test('invalid addresses are rejected with 400', async ({
    request,
    baseURL,
  }) => {
    const origin = originOf(baseURL);
    const tooLong = `${'a'.repeat(250)}@example.com`;
    for (const email of [
      'test@example.c',
      'plainaddress',
      '@example.com',
      '',
      tooLong,
    ]) {
      const response = await submit(request, origin, {form: {email}});
      expect(response.status(), JSON.stringify(email.slice(0, 20))).toBe(400);
      expect(await response.text()).toContain(COPY.newsletterInvalid);
    }
    const missing = await submit(request, origin, {form: {source: 'footer'}});
    expect(missing.status()).toBe(400);
  });

  test('a body that is not a form is rejected with 400', async ({
    request,
    baseURL,
  }) => {
    const origin = originOf(baseURL);
    const json = await submit(request, origin, {
      data: {email: 'test@example.com'},
    });
    expect(json.status()).toBe(400);
    expect(await json.text()).toContain(COPY.newsletterUnreadable);

    const text = await submit(request, origin, {
      data: 'email=test@example.com',
      contentType: 'text/plain',
    });
    expect(text.status()).toBe(400);
    expect(await text.text()).toContain(COPY.newsletterUnreadable);
  });

  test('bodies above 8 KB are rejected with 413 before they are read', async ({
    request,
    baseURL,
  }) => {
    const origin = originOf(baseURL);
    const MAX_BYTES = 8192;
    const bodyOfLength = (length: number) => {
      const prefix = 'email=a%40example.com&pad=';
      return `${prefix}${'x'.repeat(length - prefix.length)}`;
    };
    const post = (length: number) =>
      request.post('/newsletter.data', {
        headers: {
          Origin: origin,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: bodyOfLength(length),
      });

    const atLimit = await post(MAX_BYTES);
    expect(atLimit.status(), 'exactly 8192 bytes is accepted').toBe(200);

    for (const length of [MAX_BYTES + 1, 100 * 1024]) {
      const response = await post(length);
      expect(response.status(), `${length} bytes`).toBe(413);
      expect(await response.text()).toContain(COPY.newsletterTooLarge);
    }
  });

  test('addresses that are payloads for whoever opens the list are rejected', async ({
    request,
    baseURL,
  }) => {
    const origin = originOf(baseURL);
    const PAYLOADS = [
      '=cmd|calc!A1@example.com', // spreadsheet formula
      '+1@example.com',
      '-1@example.com',
      '<script>@example.com', // markup
      'a"b@example.com',
      'a(b)@example.com',
      'a|b@example.com',
      'a\u0007b@example.com', // control characters
      'a\u0000b@example.com',
      'a\u001fb@example.com',
      'a\u007fb@example.com',
    ];
    for (const email of PAYLOADS) {
      const response = await submit(request, origin, {form: {email}});
      const label = JSON.stringify(email);
      expect(response.status(), label).toBe(400);
      expect(await response.text(), label).toContain(COPY.newsletterInvalid);
    }
  });

  test('ordinary and international addresses are still accepted', async ({
    request,
    baseURL,
  }) => {
    const origin = originOf(baseURL);
    for (const email of [
      'josé@ejemplo.es',
      "o'brien@example.com",
      'first.last+tag@example.com',
      'x_y-z@sub.example.co.uk',
    ]) {
      const response = await submit(request, origin, {form: {email}});
      expect(response.status(), email).toBe(200);
      expect(await response.text(), email).toContain(COPY.newsletterMock);
    }
  });

  test('the honeypot field is acknowledged silently', async ({
    request,
    baseURL,
  }) => {
    const response = await submit(request, originOf(baseURL), {
      form: {email: 'bot@example.com', website: 'http://spam.example'},
    });
    expect(response.status()).toBe(200);
    expect(await response.text()).not.toContain(COPY.newsletterMock);
  });
});
