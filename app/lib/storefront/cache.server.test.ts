import {createHash} from 'node:crypto';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  CacheCustom,
  CacheDefault,
  CacheLong,
  CacheNone,
  CacheShort,
  createCacheKey,
  isCacheable,
  withCache,
  type CacheStrategy,
  type ExpirableCacheOverrides,
  type WithCacheOptions,
} from './cache.server';

const ORIGIN = 'https://shop.example';
const START = Date.UTC(2026, 9, 24, 12, 0, 0);
const SECOND = 1000;

type StoredEntry = {body: string; headers: Record<string, string>};
type Body = {value: string; errors?: unknown[]};

/** A Cache API stand-in that keeps bodies and headers, like the real one. */
function createMemoryCache() {
  const entries = new Map<string, StoredEntry>();
  const match = vi.fn(async (request: Request) => {
    const entry = entries.get(request.url);
    return entry
      ? new Response(entry.body, {headers: entry.headers})
      : undefined;
  });
  const put = vi.fn(async (request: Request, response: Response) => {
    entries.set(request.url, {
      body: await response.text(),
      headers: Object.fromEntries(response.headers),
    });
  });
  const remove = vi.fn(async (request: Request) => entries.delete(request.url));
  const cache = {match, put, delete: remove} as unknown as Cache;
  return {cache, match, put, entries};
}

let keyCount = 0;

/** A fresh cache, clock, waitUntil queue and key for one test. */
async function setup(strategy: CacheStrategy = CacheShort()) {
  const memory = createMemoryCache();
  const pending: Promise<unknown>[] = [];
  let clock = START;
  keyCount += 1;
  const key = await createCacheKey(ORIGIN, [
    'https://api',
    'token',
    `{"n":${keyCount}}`,
  ]);
  const options: WithCacheOptions<Body> = {
    cache: memory.cache,
    key,
    strategy,
    waitUntil: (promise) => {
      pending.push(promise);
    },
    shouldCacheResult: (body) => !body.errors,
    now: () => clock,
  };
  return {
    ...memory,
    key,
    pending,
    advance(seconds: number) {
      clock += seconds * SECOND;
    },
    async flush() {
      await Promise.all(pending.splice(0));
    },
    run(
      fetcher: () => Promise<Body>,
      overrides: Partial<WithCacheOptions<Body>> = {},
    ) {
      return withCache(fetcher, {...options, ...overrides});
    },
  };
}

/** Stores `value` the way a first MISS does, then lets `seconds` pass. */
async function primed(seconds: number, strategy?: CacheStrategy) {
  const test = await setup(strategy);
  await test.run(async () => ({value: 'v1'}));
  await test.flush();
  test.advance(seconds);
  return test;
}

let consoleError: ReturnType<typeof vi.spyOn>;
let consoleWarn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const EXPIRABLE = [
  ['CacheShort', CacheShort],
  ['CacheLong', CacheLong],
  ['CacheDefault', CacheDefault],
] as const;

describe('cache strategies', () => {
  it('CacheNone stores nothing', () => {
    expect(CacheNone()).toEqual({mode: 'no-store'});
  });

  it.each([
    [CacheShort, {mode: 'public', maxAge: 1, staleWhileRevalidate: 9}],
    [CacheLong, {mode: 'public', maxAge: 3600, staleWhileRevalidate: 82800}],
    [CacheDefault, {mode: 'public', maxAge: 1, staleWhileRevalidate: 86399}],
  ] as const)("%o keeps Hydrogen's timings", (strategy, values) => {
    expect(strategy()).toEqual(values);
  });

  it.each(EXPIRABLE)('%s applies overrides', (_name, strategy) => {
    expect(strategy({maxAge: 30, mode: 'private'})).toMatchObject({
      mode: 'private',
      maxAge: 30,
    });
    expect(strategy({sMaxAge: 60})).toMatchObject({
      mode: 'public',
      sMaxAge: 60,
    });
  });

  it.each(EXPIRABLE)(
    '%s rejects modes other than public and private',
    (_name, strategy) => {
      const overrides = {
        mode: 'no-store',
      } as unknown as ExpirableCacheOverrides;

      expect(() => strategy(overrides)).toThrow(
        "'mode' must be either 'public' or 'private'",
      );
    },
  );

  it('CacheCustom returns the strategy as given', () => {
    const custom: CacheStrategy = {
      mode: 'private',
      maxAge: 5,
      staleIfError: 60,
    };

    expect(CacheCustom(custom)).toEqual(custom);
  });
});

describe('isCacheable', () => {
  it.each([
    ['CacheNone', CacheNone()],
    ['a private strategy', CacheShort({mode: 'private'})],
    ['a private custom strategy', CacheCustom({mode: 'private', maxAge: 60})],
  ])('is false for %s', (_name, strategy) => {
    expect(isCacheable(strategy)).toBe(false);
  });

  it('is false when the strategy would keep nothing', () => {
    expect(isCacheable(CacheCustom({mode: 'public'}))).toBe(false);
    expect(isCacheable({maxAge: 0, staleWhileRevalidate: 0})).toBe(false);
  });

  it.each([
    ['CacheShort', CacheShort()],
    ['CacheLong', CacheLong()],
    ['CacheDefault', CacheDefault()],
    ['a custom strategy without a mode', CacheCustom({maxAge: 60})],
    ['a strategy that is only ever stale', {staleWhileRevalidate: 60}],
  ])('is true for %s', (_name, strategy) => {
    expect(isCacheable(strategy)).toBe(true);
  });
});

describe('createCacheKey', () => {
  const PARTS = [
    'https://mellow-test.myshopify.com/api/2026-04/graphql.json',
    'public-token',
    '{"query":"query Shop { shop { name } }","variables":{}}',
  ] as const;

  it('is a GET request under /__storefront-cache/ named by the SHA-256 of the parts', async () => {
    const key = await createCacheKey(ORIGIN, PARTS);

    const digest = createHash('sha256').update(PARTS.join('\n')).digest('hex');
    expect(key).toBeInstanceOf(Request);
    expect(key.method).toBe('GET');
    expect(key.url).toBe(`${ORIGIN}/__storefront-cache/${digest}`);
  });

  it('is the same for the same parts', async () => {
    const first = await createCacheKey(ORIGIN, PARTS);
    const second = await createCacheKey(`${ORIGIN}/`, [...PARTS]);

    expect(second.url).toBe(first.url);
  });

  it.each([
    ['the API URL', 0],
    ['the access token', 1],
    ['the request body', 2],
  ])('changes with %s', async (_name, index) => {
    const changed = PARTS.map((part, i) => (i === index ? `${part}x` : part));

    const original = await createCacheKey(ORIGIN, PARTS);
    const other = await createCacheKey(ORIGIN, changed);

    expect(other.url).not.toBe(original.url);
  });
});

describe('withCache', () => {
  it('MISS: fetches, returns the result and stores it through waitUntil', async () => {
    // Arrange
    const test = await setup(CacheShort());
    const fetcher = vi.fn(async () => ({value: 'v1'}));

    // Act
    const outcome = await test.run(fetcher);

    // Assert
    expect(outcome).toEqual({result: {value: 'v1'}, status: 'MISS'});
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(test.pending).toHaveLength(1);
    await test.flush();
    expect(test.entries.get(test.key.url)).toEqual({
      body: '{"value":"v1"}',
      headers: {
        'cache-control': 'public, max-age=10',
        'content-type': 'application/json',
        'x-storefront-cache-max-age': '1',
        'x-storefront-cache-put-date': String(START),
      },
    });
  });

  it('HIT: serves an entry up to maxAge old without fetching', async () => {
    const test = await primed(1);
    const fetcher = vi.fn(async () => ({value: 'v2'}));

    expect(await test.run(fetcher)).toEqual({
      result: {value: 'v1'},
      status: 'HIT',
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(test.pending).toHaveLength(0);
  });

  it('STALE: serves the old entry, revalidates once through waitUntil, then stores the update', async () => {
    // Arrange: CacheShort is fresh for 1 s and stale for 9 s more.
    const test = await primed(5);
    const fetcher = vi.fn(async () => ({value: 'v2'}));

    // Act: two concurrent reads of the same stale entry.
    const [first, second] = await Promise.all([
      test.run(fetcher),
      test.run(fetcher),
    ]);

    // Assert
    expect(first).toEqual({result: {value: 'v1'}, status: 'STALE'});
    expect(second).toEqual({result: {value: 'v1'}, status: 'STALE'});
    expect(test.pending).toHaveLength(1);
    await test.flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(test.put).toHaveBeenCalledTimes(2);
    expect(
      test.entries.get(test.key.url)?.headers['x-storefront-cache-put-date'],
    ).toBe(String(START + 5 * SECOND));
    expect(await test.run(fetcher)).toEqual({
      result: {value: 'v2'},
      status: 'HIT',
    });
  });

  it('STALE until exactly maxAge + staleWhileRevalidate, then expired (a MISS)', async () => {
    const test = await primed(10);
    const fetcher = vi.fn(async () => ({value: 'v2'}));

    expect((await test.run(fetcher)).status).toBe('STALE');
    await test.flush();
    test.advance(10.001);

    expect(await test.run(fetcher)).toEqual({
      result: {value: 'v2'},
      status: 'MISS',
    });
  });

  it('expired: an entry older than maxAge + staleWhileRevalidate is a MISS', async () => {
    const test = await primed(11);
    const fetcher = vi.fn(async () => ({value: 'v2'}));

    expect(await test.run(fetcher)).toEqual({
      result: {value: 'v2'},
      status: 'MISS',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('never stores a result that fails shouldCacheResult, such as one with GraphQL errors', async () => {
    const test = await setup();
    const fetcher = vi.fn(async () => ({
      value: 'partial',
      errors: [{message: 'Throttled'}],
    }));

    expect((await test.run(fetcher)).status).toBe('MISS');
    expect((await test.run(fetcher)).status).toBe('MISS');

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(test.pending).toHaveLength(0);
    expect(test.put).not.toHaveBeenCalled();
  });

  it('keeps the stale entry when the revalidated result has errors', async () => {
    const test = await primed(5);

    await test.run(async () => ({
      value: 'v2',
      errors: [{message: 'Throttled'}],
    }));
    await test.flush();

    expect(test.put).toHaveBeenCalledTimes(1);
    expect(await test.run(async () => ({value: 'v3'}))).toEqual({
      result: {value: 'v1'},
      status: 'STALE',
    });
    await test.flush();
  });

  it('logs a failed revalidation, never rejects it and releases the lock', async () => {
    // Arrange
    const test = await primed(5);
    const failing = vi.fn(async (): Promise<Body> => {
      throw new Error('fetch failed');
    });

    // Act
    const outcome = await test.run(failing);

    // Assert
    expect(outcome).toEqual({result: {value: 'v1'}, status: 'STALE'});
    await expect(Promise.all(test.pending)).resolves.toEqual([undefined]);
    await test.flush();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0][0])).toContain('fetch failed');
    // The next stale read revalidates again.
    await test.run(failing);
    expect(test.pending).toHaveLength(1);
    await test.flush();
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('replaces a revalidation lock that never settles once it is older than 35 s', async () => {
    // Arrange: an entry that stays stale for a day, and a revalidation that
    // never settles (a hung upstream, or the waitUntil budget ran out).
    const test = await primed(5, CacheDefault());
    await test.run(() => new Promise<Body>(() => {}));
    const stuck = test.pending.splice(0);
    expect(stuck).toHaveLength(1);
    const fetcher = vi.fn(async () => ({value: 'v2'}));

    // Act + Assert: for 35 s the stuck lock still holds...
    test.advance(35);
    expect((await test.run(fetcher)).status).toBe('STALE');
    expect(test.pending).toHaveLength(0);

    // ...then the next stale read replaces it and revalidates.
    test.advance(1);
    expect(await test.run(fetcher)).toEqual({
      result: {value: 'v1'},
      status: 'STALE',
    });
    expect(test.pending).toHaveLength(1);
    await test.flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await test.run(fetcher)).toEqual({
      result: {value: 'v2'},
      status: 'HIT',
    });
  });

  it('keeps the newer lock when a replaced revalidation settles late', async () => {
    // Arrange: a stuck revalidation, replaced after the expiry by a second one.
    const test = await primed(5, CacheDefault());
    let failLate!: (error: Error) => void;
    await test.run(
      () =>
        new Promise<Body>((_resolve, reject) => {
          failLate = reject;
        }),
    );
    const late = test.pending.splice(0);
    test.advance(36);
    let finishSecond!: (body: Body) => void;
    await test.run(
      () =>
        new Promise<Body>((resolve) => {
          finishSecond = resolve;
        }),
    );
    const second = test.pending.splice(0);

    // Act: the replaced revalidation fails long after its lock expired.
    failLate(new Error('timed out'));
    await Promise.all(late);

    // Assert: the second revalidation still holds the lock.
    const third = vi.fn(async () => ({value: 'v3'}));
    expect((await test.run(third)).status).toBe('STALE');
    expect(test.pending).toHaveLength(0);
    expect(third).not.toHaveBeenCalled();
    finishSecond({value: 'v2'});
    await Promise.all(second);
  });

  it.each([
    ['CacheNone', CacheNone()],
    ['a private strategy', CacheShort({mode: 'private'})],
  ])('BYPASS: %s never touches the cache', async (_name, strategy) => {
    const test = await setup(strategy);
    const fetcher = vi.fn(async () => ({value: 'v1'}));

    expect(await test.run(fetcher)).toEqual({
      result: {value: 'v1'},
      status: 'BYPASS',
    });
    expect(await test.run(fetcher)).toEqual({
      result: {value: 'v1'},
      status: 'BYPASS',
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(test.match).not.toHaveBeenCalled();
    expect(test.put).not.toHaveBeenCalled();
    expect(test.pending).toHaveLength(0);
  });

  it('BYPASS: without a cache instance', async () => {
    const test = await setup();

    const outcome = await test.run(async () => ({value: 'v1'}), {
      cache: undefined,
    });

    expect(outcome).toEqual({result: {value: 'v1'}, status: 'BYPASS'});
    expect(test.pending).toHaveLength(0);
  });

  it('treats an unreadable body as a MISS', async () => {
    // Arrange
    const test = await setup();
    test.entries.set(test.key.url, {
      body: '{"value":',
      headers: {
        'cache-control': 'public, max-age=10',
        'x-storefront-cache-put-date': String(START),
        'x-storefront-cache-max-age': '1',
      },
    });
    const fetcher = vi.fn(async () => ({value: 'v2'}));

    // Act
    const outcome = await test.run(fetcher);

    // Assert
    expect(outcome).toEqual({result: {value: 'v2'}, status: 'MISS'});
    expect(consoleWarn).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['no timing headers', {}],
    [
      'no put date',
      {
        'cache-control': 'public, max-age=10',
        'x-storefront-cache-max-age': '1',
      },
    ],
    [
      'a put date that is not a number',
      {
        'cache-control': 'public, max-age=10',
        'x-storefront-cache-put-date': 'yesterday',
        'x-storefront-cache-max-age': '1',
      },
    ],
    [
      'no max-age in cache-control',
      {
        'cache-control': 'public',
        'x-storefront-cache-put-date': String(START),
        'x-storefront-cache-max-age': '1',
      },
    ],
    [
      'no cache-control',
      {
        'x-storefront-cache-put-date': String(START),
        'x-storefront-cache-max-age': '1',
      },
    ],
  ])('treats an entry with %s as a MISS', async (_name, headers) => {
    const test = await setup();
    test.entries.set(test.key.url, {body: '{"value":"old"}', headers});

    expect(await test.run(async () => ({value: 'v2'}))).toEqual({
      result: {value: 'v2'},
      status: 'MISS',
    });
  });

  it('treats a failing cache read as a MISS', async () => {
    const test = await setup();
    test.match.mockRejectedValueOnce(new Error('cache unavailable'));

    expect(await test.run(async () => ({value: 'v1'}))).toEqual({
      result: {value: 'v1'},
      status: 'MISS',
    });
    expect(String(consoleWarn.mock.calls[0][0])).toContain('cache unavailable');
  });

  it('logs a failing cache write without failing the request', async () => {
    const test = await setup();
    // Not every runtime rejects with an Error instance.
    test.put.mockRejectedValueOnce('quota exceeded');

    const outcome = await test.run(async () => ({value: 'v1'}));

    expect(outcome).toEqual({result: {value: 'v1'}, status: 'MISS'});
    await expect(test.flush()).resolves.toBeUndefined();
    expect(String(consoleError.mock.calls[0][0])).toContain('quota exceeded');
  });

  it('propagates a failed fetch on a MISS and stores nothing', async () => {
    const test = await setup();

    await expect(
      test.run(async () => {
        throw new Error('HTTP 500');
      }),
    ).rejects.toThrow('HTTP 500');
    expect(test.pending).toHaveLength(0);
    expect(test.put).not.toHaveBeenCalled();
  });

  it('falls back to Date.now without an injected clock', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(START + 42);
    const test = await setup();

    await test.run(async () => ({value: 'v1'}), {now: undefined});
    await test.flush();

    expect(
      test.entries.get(test.key.url)?.headers['x-storefront-cache-put-date'],
    ).toBe(String(START + 42));
  });
});
