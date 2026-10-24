import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  getNewsletterHttpStatus,
  isValidEmail,
  normalizeNewsletterSource,
  subscribeToNewsletter,
  type NewsletterResult,
} from './newsletter.server';

const WEBHOOK_URL = 'https://hooks.example/newsletter';
const STORE_DOMAIN = 'mellow.example';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {PUBLIC_STORE_DOMAIN: STORE_DOMAIN, ...overrides} as Env;
}

/** Builds an address with a total length of exactly `length` characters. */
function emailOfLength(length: number) {
  const local = 'a'.repeat(64);
  const tld = '.com';
  const labelBudget = length - local.length - 1 - tld.length;
  const first = 'b'.repeat(63);
  const second = 'c'.repeat(labelBudget - first.length - 1);
  return `${local}@${first}.${second}${tld}`;
}

describe('isValidEmail', () => {
  it.each([
    'shopper@example.com',
    'first.last+newsletter@mail.example.co.uk',
    'josé@ejemplo.es',
    '  padded@example.com  ',
    'user@example.com\n',
  ])('accepts %j', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each([
    ['empty string', ''],
    ['blank string', '   '],
    ['no at sign', 'plainaddress'],
    ['no local part', '@example.com'],
    ['no domain', 'user@'],
    ['no dot in the domain', 'user@localhost'],
    ['one-letter top-level domain', 'user@example.c'],
    ['two at signs', 'user@@example.com'],
    ['at sign in the local part', 'a@b@example.com'],
    ['space in the local part', 'user name@example.com'],
    ['space in the domain', 'user@exa mple.com'],
    ['tab in the middle', 'user\t@example.com'],
    ['header injection', 'a@example.com\r\nBcc: victim@example.org'],
    ['domain starting with a dot', 'user@.example.com'],
    ['domain ending with a dot', 'user@example.com.'],
    ['empty domain label', 'user@example..com'],
  ])('rejects %s', (_label, email) => {
    expect(isValidEmail(email)).toBe(false);
  });

  it('rejects values that are not strings', () => {
    expect(isValidEmail(undefined as unknown as string)).toBe(false);
    expect(isValidEmail(null as unknown as string)).toBe(false);
    expect(isValidEmail(42 as unknown as string)).toBe(false);
  });

  it('accepts an address of exactly 254 characters and rejects 255', () => {
    expect(emailOfLength(254)).toHaveLength(254);
    expect(isValidEmail(emailOfLength(254))).toBe(true);
    expect(emailOfLength(255)).toHaveLength(255);
    expect(isValidEmail(emailOfLength(255))).toBe(false);
  });

  it('rejects hostile input in linear time (no regex backtracking)', () => {
    // Arrange: the original quadratic regex needed ~2.5 s for the first one.
    const hostile = [
      `a@${'b.'.repeat(32_000)}@`,
      `a@${'b'.repeat(100_000)}`,
      `${'a'.repeat(100_000)}@`,
      '@'.repeat(100_000),
      ' '.repeat(100_000),
      `a@${'b.'.repeat(120)}@`,
      `a@${'b@'.repeat(100)}`,
    ];

    // Act
    const started = performance.now();
    const results = hostile.map((value) => isValidEmail(value));
    const elapsed = performance.now() - started;

    // Assert
    expect(results.every((result) => result === false)).toBe(true);
    expect(elapsed).toBeLessThan(250);
  });
});

describe('normalizeNewsletterSource', () => {
  it.each([
    'footer',
    'homepage',
    'popup-2',
    'exit_intent',
    'a',
    'x'.repeat(32),
  ])('keeps the allowed source %j', (source) => {
    expect(normalizeNewsletterSource(source)).toBe(source);
  });

  it.each([
    ['empty', ''],
    ['too long', 'x'.repeat(33)],
    ['upper case', 'Footer'],
    ['containing a space', 'home page'],
    ['containing a newline', 'footer\nBcc: x'],
    ['containing markup', '<script>alert(1)</script>'],
    ['containing a path', '../../etc/passwd'],
    ['non-ASCII', 'fußzeile'],
    ['a huge string', 'x'.repeat(100_000)],
  ])('replaces a source that is %s with "storefront"', (_label, source) => {
    expect(normalizeNewsletterSource(source)).toBe('storefront');
  });

  it('falls back for values that are not strings', () => {
    expect(normalizeNewsletterSource(undefined as unknown as string)).toBe(
      'storefront',
    );
    expect(normalizeNewsletterSource(null as unknown as string)).toBe(
      'storefront',
    );
  });
});

describe('getNewsletterHttpStatus', () => {
  it.each([
    ['subscribed', 200],
    ['mock', 200],
    ['invalid', 400],
    ['error', 502],
    ['not_configured', 503],
  ] as const)('maps %s to %i', (status, expected) => {
    const result: NewsletterResult = {
      ok: status === 'subscribed' || status === 'mock',
      status,
      message: 'message',
    };

    expect(getNewsletterHttpStatus(result)).toBe(expected);
  });
});

describe('subscribeToNewsletter', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe('validation', () => {
    it('rejects an invalid email without calling the webhook', async () => {
      // Arrange
      const env = makeEnv({NEWSLETTER_WEBHOOK_URL: WEBHOOK_URL});

      // Act
      const result = await subscribeToNewsletter({
        email: 'not-an-email',
        source: 'footer',
        env,
      });

      // Assert
      expect(result).toEqual({
        ok: false,
        status: 'invalid',
        message: 'Enter a valid email address.',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects an address longer than 254 characters without calling the webhook', async () => {
      const result = await subscribeToNewsletter({
        email: emailOfLength(255),
        source: 'footer',
        env: makeEnv({NEWSLETTER_WEBHOOK_URL: WEBHOOK_URL}),
      });

      expect(result.status).toBe('invalid');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('answers a ReDoS payload immediately', async () => {
      // Arrange
      const email = `a@${'b.'.repeat(32_000)}@`;

      // Act
      const started = performance.now();
      const result = await subscribeToNewsletter({
        email,
        source: 'footer',
        env: makeEnv({NEWSLETTER_WEBHOOK_URL: WEBHOOK_URL}),
      });
      const elapsed = performance.now() - started;

      // Assert
      expect(result.status).toBe('invalid');
      expect(elapsed).toBeLessThan(250);
    });
  });

  describe('with a webhook configured', () => {
    const env = makeEnv({NEWSLETTER_WEBHOOK_URL: WEBHOOK_URL});

    it('posts the trimmed email as JSON and reports success', async () => {
      // Arrange
      fetchMock.mockResolvedValue(new Response('ok', {status: 200}));

      // Act
      const result = await subscribeToNewsletter({
        email: '  shopper@example.com ',
        source: 'footer',
        env,
      });

      // Assert
      expect(result).toEqual({
        ok: true,
        status: 'subscribed',
        message: "You're on the list. Welcome to Mellow.",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(WEBHOOK_URL);
      expect(init?.method).toBe('POST');
      expect(init?.headers).toEqual({'content-type': 'application/json'});
      expect(JSON.parse(String(init?.body))).toEqual({
        email: 'shopper@example.com',
        source: 'footer',
        storefront: STORE_DOMAIN,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/),
      });
    });

    it('sends "storefront" instead of a source that is not on the allowlist', async () => {
      fetchMock.mockResolvedValue(new Response('ok', {status: 200}));

      await subscribeToNewsletter({
        email: 'shopper@example.com',
        source: '<script>alert(1)</script>'.repeat(50),
        env,
      });

      const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
        source: string;
      };
      expect(body.source).toBe('storefront');
    });

    it('gives the webhook request a 5 second timeout signal', async () => {
      // Arrange
      fetchMock.mockResolvedValue(new Response('ok', {status: 200}));
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

      // Act
      await subscribeToNewsletter({
        email: 'shopper@example.com',
        source: 'footer',
        env,
      });

      // Assert
      expect(timeoutSpy).toHaveBeenCalledWith(5000);
      const signal = fetchMock.mock.calls[0][1]?.signal;
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal).toBe(timeoutSpy.mock.results[0].value);
    });

    it('reports an error when the webhook times out', async () => {
      // Arrange: a signal we can abort, standing in for AbortSignal.timeout.
      const controller = new AbortController();
      vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
      fetchMock.mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            const signal = init?.signal;
            if (!signal) {
              reject(new Error('the request has no timeout signal'));
              return;
            }
            signal.addEventListener('abort', () => reject(signal.reason));
          }),
      );

      // Act
      const pending = subscribeToNewsletter({
        email: 'shopper@example.com',
        source: 'footer',
        env,
      });
      controller.abort(
        new DOMException('The operation timed out.', 'TimeoutError'),
      );
      const result = await pending;

      // Assert
      expect(result.ok).toBe(false);
      expect(result.status).toBe('error');
      expect(console.error).toHaveBeenCalled();
    });

    it('reports an error when the webhook answers with a failure status', async () => {
      // Arrange
      fetchMock.mockResolvedValue(new Response('boom', {status: 500}));

      // Act
      const result = await subscribeToNewsletter({
        email: 'shopper@example.com',
        source: 'footer',
        env,
      });

      // Assert
      expect(result).toEqual({
        ok: false,
        status: 'error',
        message: 'We could not sign you up right now. Please try again.',
      });
      expect(console.error).toHaveBeenCalled();
    });

    it('reports an error when the network request fails, without leaking details', async () => {
      // Arrange
      fetchMock.mockRejectedValue(
        new TypeError(`fetch failed: ${WEBHOOK_URL}`),
      );

      // Act
      const result = await subscribeToNewsletter({
        email: 'shopper@example.com',
        source: 'footer',
        env,
      });

      // Assert
      expect(result.status).toBe('error');
      expect(result.message).not.toContain('hooks.example');
      expect(result.message).not.toContain('fetch failed');
    });

    it('prefers the webhook over the development mock', async () => {
      fetchMock.mockResolvedValue(new Response('ok', {status: 200}));

      const result = await subscribeToNewsletter({
        email: 'shopper@example.com',
        source: 'footer',
        env: makeEnv({
          NEWSLETTER_WEBHOOK_URL: WEBHOOK_URL,
          MOCK_STOREFRONT: 'true',
        }),
      });

      expect(result.status).toBe('subscribed');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('without a webhook', () => {
    it('answers "mock" in the development mock and records nothing', async () => {
      // Arrange
      vi.stubEnv('DEV', true);

      // Act
      const result = await subscribeToNewsletter({
        email: 'shopper@example.com',
        source: 'footer',
        env: makeEnv({MOCK_STOREFRONT: 'true'}),
      });

      // Assert
      expect(result.ok).toBe(true);
      expect(result.status).toBe('mock');
      expect(result.message).toMatch(/not recorded/i);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports "not_configured" when the mock flag is off', async () => {
      vi.stubEnv('DEV', true);

      const result = await subscribeToNewsletter({
        email: 'shopper@example.com',
        source: 'footer',
        env: makeEnv(),
      });

      expect(result).toEqual({
        ok: false,
        status: 'not_configured',
        message:
          'Newsletter signup is not connected yet. Please check back soon.',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('ignores MOCK_STOREFRONT outside development builds', async () => {
      // Arrange: production bundles must never honour the mock flag.
      vi.stubEnv('DEV', false);

      // Act
      const result = await subscribeToNewsletter({
        email: 'shopper@example.com',
        source: 'footer',
        env: makeEnv({MOCK_STOREFRONT: 'true'}),
      });

      // Assert
      expect(result.status).toBe('not_configured');
    });
  });
});

describe('isValidEmail rejects local parts that are payloads for downstream tools', () => {
  it.each([
    ['spreadsheet formula', '=cmd|calc!A1@example.com'],
    ['leading plus formula', '+SUM(1)@example.com'],
    ['leading minus formula', '-1+1@example.com'],
    ['markup', '<script>alert(1)</script>@example.com'],
    ['NUL byte', 'a\u0000b@example.com'],
    ['quotes and semicolons', '"a";b@example.com'],
  ])('%s', (_label, value) => {
    expect(isValidEmail(value)).toBe(false);
  });

  it('still accepts ordinary addresses', () => {
    expect(isValidEmail('first.last+news@example.co.uk')).toBe(true);
    expect(isValidEmail("o'brien@example.com")).toBe(true);
    expect(isValidEmail('josé@ejemplo.es')).toBe(true);
  });
});
