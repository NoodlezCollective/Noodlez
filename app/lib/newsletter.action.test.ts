import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {action, loader} from '~/routes/newsletter';

type ActionArgs = Parameters<typeof action>[0];

const WEBHOOK_URL = 'https://hooks.example/newsletter';

function makeContext(overrides: Partial<Env> = {}) {
  return {
    env: {PUBLIC_STORE_DOMAIN: 'mellow.example', ...overrides} as Env,
  };
}

function formRequest(fields: Record<string, string>) {
  return new Request('https://mellow.example/newsletter', {
    method: 'POST',
    body: new URLSearchParams(fields),
  });
}

function run(request: Request, env: Partial<Env> = {}) {
  const args = {
    request,
    params: {},
    context: makeContext(env),
  } as unknown as ActionArgs;
  return action(args);
}

describe('/newsletter action', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('ok', {status: 200}));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('DEV', true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('answers 200 with the "subscribed" result for a valid signup', async () => {
    // Arrange
    const request = formRequest({
      email: 'shopper@example.com',
      source: 'footer',
      website: '',
    });

    // Act
    const result = await run(request, {NEWSLETTER_WEBHOOK_URL: WEBHOOK_URL});

    // Assert
    expect(result.init?.status).toBe(200);
    expect(result.data).toEqual({
      ok: true,
      status: 'subscribed',
      message: "You're on the list. Welcome to {AppName}.",
    });
  });

  it('keeps the response shape the newsletter form reads', async () => {
    const result = await run(formRequest({email: 'nope'}));

    expect(Object.keys(result.data).sort()).toEqual([
      'message',
      'ok',
      'status',
    ]);
  });

  it('answers 400 for an invalid email', async () => {
    const result = await run(formRequest({email: 'not-an-email'}), {
      NEWSLETTER_WEBHOOK_URL: WEBHOOK_URL,
    });

    expect(result.init?.status).toBe(400);
    expect(result.data).toMatchObject({ok: false, status: 'invalid'});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 400 when the form has no fields at all', async () => {
    const result = await run(formRequest({}));

    expect(result.init?.status).toBe(400);
    expect(result.data).toMatchObject({status: 'invalid'});
  });

  it('answers 502 when the webhook fails', async () => {
    // Arrange
    fetchMock.mockResolvedValue(new Response('boom', {status: 500}));

    // Act
    const result = await run(formRequest({email: 'shopper@example.com'}), {
      NEWSLETTER_WEBHOOK_URL: WEBHOOK_URL,
    });

    // Assert
    expect(result.init?.status).toBe(502);
    expect(result.data).toMatchObject({ok: false, status: 'error'});
  });

  it('answers 503 when no newsletter service is connected', async () => {
    const result = await run(formRequest({email: 'shopper@example.com'}));

    expect(result.init?.status).toBe(503);
    expect(result.data).toMatchObject({ok: false, status: 'not_configured'});
  });

  it('answers 200 with the "mock" result in the development mock', async () => {
    const result = await run(formRequest({email: 'shopper@example.com'}), {
      MOCK_STOREFRONT: 'true',
    });

    expect(result.init?.status).toBe(200);
    expect(result.data).toMatchObject({ok: true, status: 'mock'});
  });

  it('acknowledges a filled honeypot silently without contacting the webhook', async () => {
    // Arrange: a bot fills the hidden "website" field (and may send garbage).
    const request = formRequest({
      email: 'not-an-email',
      website: 'https://spam.example',
    });

    // Act
    const result = await run(request, {NEWSLETTER_WEBHOOK_URL: WEBHOOK_URL});

    // Assert
    expect(result.init?.status).toBe(200);
    expect(result.data).toEqual({
      ok: true,
      status: 'subscribed',
      message: 'Thanks!',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards only an allowlisted source to the webhook', async () => {
    await run(
      formRequest({email: 'shopper@example.com', source: 'Footer <b>'}),
      {NEWSLETTER_WEBHOOK_URL: WEBHOOK_URL},
    );
    await run(formRequest({email: 'shopper@example.com'}), {
      NEWSLETTER_WEBHOOK_URL: WEBHOOK_URL,
    });
    await run(formRequest({email: 'shopper@example.com', source: 'homepage'}), {
      NEWSLETTER_WEBHOOK_URL: WEBHOOK_URL,
    });

    const sources = fetchMock.mock.calls.map(
      ([, init]) => (JSON.parse(String(init?.body)) as {source: string}).source,
    );
    expect(sources).toEqual(['storefront', 'storefront', 'homepage']);
  });

  describe('requests that are not a form submission', () => {
    it.each([
      ['a JSON body', 'application/json', '{"email":"shopper@example.com"}'],
      ['a plain text body', 'text/plain', 'email=shopper@example.com'],
      ['a multipart body without a boundary', 'multipart/form-data', 'x'],
      [
        'a multipart body that is cut off',
        'multipart/form-data; boundary=abc',
        '--abc\r\nContent-Disposition: form-data; name="email"\r\n\r\nshop',
      ],
    ])('answers 400 instead of throwing for %s', async (_label, type, body) => {
      // Arrange
      const request = new Request('https://mellow.example/newsletter', {
        method: 'POST',
        headers: {'content-type': type},
        body,
      });

      // Act
      const result = await run(request, {
        NEWSLETTER_WEBHOOK_URL: WEBHOOK_URL,
      });

      // Assert
      expect(result.init?.status).toBe(400);
      expect(result.data).toMatchObject({ok: false, status: 'invalid'});
      expect(typeof result.data.message).toBe('string');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('answers 400 for a POST without any body', async () => {
      const request = new Request('https://mellow.example/newsletter', {
        method: 'POST',
      });

      const result = await run(request);

      expect(result.init?.status).toBe(400);
    });
  });

  it('rejects an oversized email field quickly', async () => {
    // Arrange
    const request = formRequest({email: `a@${'b.'.repeat(32_000)}@`});

    // Act
    const started = performance.now();
    const result = await run(request, {NEWSLETTER_WEBHOOK_URL: WEBHOOK_URL});
    const elapsed = performance.now() - started;

    // Assert
    expect(result.init?.status).toBe(400);
    expect(elapsed).toBeLessThan(250);
  });
});

describe('/newsletter loader', () => {
  it('redirects direct visits to the homepage', async () => {
    const response = await loader();

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/');
  });
});
