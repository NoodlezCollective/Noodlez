import {parseJson} from './graphql';

/**
 * Cache layer for Storefront API queries on the Workers Cache API, ported from
 * Hydrogen 2026.4.7's strategies and sub-request cache (`CacheShort` & co.,
 * `runWithCache`).
 *
 * Entries live under a synthetic GET key and store only the JSON result plus
 * our timing headers, so nothing from the Storefront API response (Set-Cookie,
 * Server-Timing) is ever kept. Results with errors, mutations (the client
 * never routes them here) and `no-store` / `private` strategies are never
 * cached.
 */

export interface CacheStrategy {
  mode?: 'public' | 'private' | 'no-store';
  maxAge?: number;
  staleWhileRevalidate?: number;
  sMaxAge?: number;
  staleIfError?: number;
}

/** Overrides for the expiring presets; any other `mode` throws (Hydrogen parity). */
export type ExpirableCacheOverrides = Omit<CacheStrategy, 'mode'> & {
  mode?: 'public' | 'private';
};

export type CacheStatus = 'BYPASS' | 'MISS' | 'HIT' | 'STALE';

export interface WithCacheOptions<T> {
  cache: Cache | undefined;
  key: Request;
  strategy: CacheStrategy;
  waitUntil: (p: Promise<unknown>) => void;
  shouldCacheResult: (result: T) => boolean;
  /** Clock in milliseconds; defaults to `Date.now` (tests inject one). */
  now?: () => number;
}

const PUBLIC = 'public';
const PRIVATE = 'private';
const NO_STORE = 'no-store';

/** Hydrogen's timings, in seconds. */
const SHORT_TIMING = {maxAge: 1, staleWhileRevalidate: 9} as const;
const LONG_TIMING = {maxAge: 3600, staleWhileRevalidate: 82800} as const;
const DEFAULT_TIMING = {maxAge: 1, staleWhileRevalidate: 86399} as const;

const KEY_PATH = '/__storefront-cache/';
const PUT_DATE_HEADER = 'x-storefront-cache-put-date';
const MAX_AGE_HEADER = 'x-storefront-cache-max-age';
const MAX_AGE_DIRECTIVE_RE = /\bmax-age=([\d.]+)/;
const MS_PER_SECOND = 1000;
const LOG_PREFIX = '[storefront-cache]';

/**
 * No revalidation can still be running after this long: the client aborts
 * Storefront API calls after 25 s and Workers ends `waitUntil` work 30 s after
 * the response. An older lock was left by one that never settled.
 */
const REVALIDATION_LOCK_TTL_MS = 35 * MS_PER_SECOND;

/**
 * Per-isolate lock: at most one revalidation per key at a time. Each key maps
 * to the time its revalidation started, so a lock that is never released
 * expires and is replaced.
 */
const revalidating = new Map<string, number>();

export function CacheNone(): CacheStrategy {
  return {mode: NO_STORE};
}

/** Fresh for 1 s, then served stale for 9 s while it revalidates. */
export function CacheShort(overrides?: ExpirableCacheOverrides): CacheStrategy {
  return expiring(SHORT_TIMING, overrides);
}

/** Fresh for 1 hour, then served stale for 23 hours while it revalidates. */
export function CacheLong(overrides?: ExpirableCacheOverrides): CacheStrategy {
  return expiring(LONG_TIMING, overrides);
}

/** Queries without a cache hint: fresh for 1 s, stale for a day less 1 s. */
export function CacheDefault(
  overrides?: ExpirableCacheOverrides,
): CacheStrategy {
  return expiring(DEFAULT_TIMING, overrides);
}

export function CacheCustom(strategy: CacheStrategy): CacheStrategy {
  return {...strategy};
}

/** False for `no-store`, `private` and strategies that would keep nothing. */
export function isCacheable(strategy: CacheStrategy): boolean {
  return (
    strategy.mode !== NO_STORE &&
    strategy.mode !== PRIVATE &&
    timingOf(strategy).lifetime > 0
  );
}

/**
 * The synthetic GET request an entry is stored under:
 * `${origin}/__storefront-cache/<sha256 hex of parts joined by "\n">`,
 * where the client passes `[apiUrl, accessToken, body]`.
 */
export async function createCacheKey(
  origin: string,
  parts: readonly string[],
): Promise<Request> {
  const bytes = new TextEncoder().encode(parts.join('\n'));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return new Request(new URL(`${KEY_PATH}${toHex(digest)}`, origin), {
    method: 'GET',
  });
}

/**
 * Runs `fetcher` through the cache with stale-while-revalidate:
 * - BYPASS: no cache, or a strategy `isCacheable` rejects (`no-store`,
 *   `private`, or nothing to keep).
 * - HIT: the entry is at most `maxAge` seconds old.
 * - STALE: older, but within `maxAge + staleWhileRevalidate`. The entry is
 *   served and refreshed once in the background through `waitUntil`; a
 *   failed refresh is logged, never thrown.
 * - MISS: no entry, an expired one or an unreadable one. The result is stored
 *   through `waitUntil` when `shouldCacheResult` accepts it.
 */
export async function withCache<T>(
  fetcher: () => Promise<T>,
  options: WithCacheOptions<T>,
): Promise<{result: T; status: CacheStatus}> {
  const {cache, key, strategy} = options;
  if (!cache || !isCacheable(strategy)) {
    return {result: await fetcher(), status: 'BYPASS'};
  }

  const now = options.now ?? Date.now;
  const cached = await readEntry<T>(cache, key, now());
  if (cached?.fresh) return {result: cached.value, status: 'HIT'};
  if (cached) {
    revalidateOnce(fetcher, {...options, cache, now});
    return {result: cached.value, status: 'STALE'};
  }

  const result = await fetcher();
  if (options.shouldCacheResult(result)) {
    options.waitUntil(storeEntry(cache, key, result, strategy, now()));
  }
  return {result, status: 'MISS'};
}

type RevalidationOptions<T> = WithCacheOptions<T> & {
  cache: Cache;
  now: () => number;
};

type EntryTiming = {putDate: number; maxAge: number; lifetime: number};

function expiring(
  timing: {maxAge: number; staleWhileRevalidate: number},
  overrides?: ExpirableCacheOverrides,
): CacheStrategy {
  const mode = overrides?.mode;
  if (mode && mode !== PUBLIC && mode !== PRIVATE) {
    throw new Error("'mode' must be either 'public' or 'private'");
  }
  return {mode: PUBLIC, ...timing, ...overrides};
}

function timingOf(strategy: CacheStrategy): {maxAge: number; lifetime: number} {
  const maxAge = strategy.maxAge ?? 0;
  return {maxAge, lifetime: maxAge + (strategy.staleWhileRevalidate ?? 0)};
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

/** The cached value, or undefined for a missing, expired or unreadable entry. */
async function readEntry<T>(
  cache: Cache,
  key: Request,
  nowMs: number,
): Promise<{value: T; fresh: boolean} | undefined> {
  try {
    const response = await cache.match(key);
    if (!response) return undefined;
    const {putDate, maxAge, lifetime} = readTiming(response.headers);
    const ageSeconds = (nowMs - putDate) / MS_PER_SECOND;
    if (ageSeconds > lifetime) return undefined;
    const value = parseJson<T>(await response.text());
    return {value, fresh: ageSeconds <= maxAge};
  } catch (error) {
    console.warn(
      `${LOG_PREFIX} Ignoring an unreadable entry: ${describeError(error)}`,
    );
    return undefined;
  }
}

function readTiming(headers: Headers): EntryTiming {
  const cacheControl = headers.get('cache-control') ?? '';
  return {
    putDate: requireNumber(headers.get(PUT_DATE_HEADER), PUT_DATE_HEADER),
    maxAge: requireNumber(headers.get(MAX_AGE_HEADER), MAX_AGE_HEADER),
    lifetime: requireNumber(
      MAX_AGE_DIRECTIVE_RE.exec(cacheControl)?.[1],
      'cache-control max-age',
    ),
  };
}

function requireNumber(value: string | null | undefined, name: string): number {
  const number = value ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) throw new Error(`missing or invalid ${name}`);
  return number;
}

/** Stores the JSON result; never rejects, so it is safe to hand to waitUntil. */
async function storeEntry<T>(
  cache: Cache,
  key: Request,
  value: T,
  strategy: CacheStrategy,
  putDate: number,
): Promise<void> {
  try {
    const {maxAge, lifetime} = timingOf(strategy);
    const entry = new Response(JSON.stringify(value), {
      headers: {
        'content-type': 'application/json',
        'cache-control': `public, max-age=${lifetime}`,
        [PUT_DATE_HEADER]: String(putDate),
        [MAX_AGE_HEADER]: String(maxAge),
      },
    });
    await cache.put(key, entry);
  } catch (error) {
    console.error(
      `${LOG_PREFIX} Could not store an entry: ${describeError(error)}`,
    );
  }
}

function revalidateOnce<T>(
  fetcher: () => Promise<T>,
  options: RevalidationOptions<T>,
): void {
  const lock = options.key.url;
  const startedAt = options.now();
  const heldSince = revalidating.get(lock);
  if (
    heldSince !== undefined &&
    startedAt - heldSince <= REVALIDATION_LOCK_TTL_MS
  ) {
    return;
  }
  revalidating.set(lock, startedAt);
  options.waitUntil(
    revalidate(fetcher, options).finally(() => {
      // After an expiry the key is locked by a newer revalidation, whose
      // start time is at least the expiry later; leave that lock alone.
      if (revalidating.get(lock) === startedAt) revalidating.delete(lock);
    }),
  );
}

async function revalidate<T>(
  fetcher: () => Promise<T>,
  options: RevalidationOptions<T>,
): Promise<void> {
  try {
    const result = await fetcher();
    if (options.shouldCacheResult(result)) {
      await storeEntry(
        options.cache,
        options.key,
        result,
        options.strategy,
        options.now(),
      );
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Revalidation failed: ${describeError(error)}`);
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
