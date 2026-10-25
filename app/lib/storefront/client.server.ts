import type {
  ClientReturn,
  ClientVariablesInRestParams,
} from '@shopify/graphql-codegen';
import {
  createStorefrontClient as createStorefrontApiHelpers,
  SHOPIFY_S,
  SHOPIFY_STOREFRONT_ID_HEADER,
  SHOPIFY_STOREFRONT_S_HEADER,
  SHOPIFY_STOREFRONT_Y_HEADER,
  SHOPIFY_UNIQUE_TOKEN_HEADER,
  SHOPIFY_VISIT_TOKEN_HEADER,
  SHOPIFY_Y,
} from '@shopify/hydrogen-react';
import {CART_COOKIE_NAME} from '~/lib/cart/cookie';
import {describeErrors, isErrorsOnlyResult} from '~/lib/storefront-errors';
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
} from './cache.server';
import {
  getOperationName,
  isMutationDocument,
  isQueryDocument,
  minifyQuery,
  parseJson,
} from './graphql';
import type {I18n, StorefrontApiError, StorefrontErrors} from './types';

export type {I18n, StorefrontApiError, StorefrontErrors} from './types';

/**
 * Our Storefront API client, replacing Hydrogen's `createStorefrontClient`
 * (ported from node_modules/@shopify/hydrogen/dist/development/index.js).
 * hydrogen-react supplies the URLs and token headers; this module adds the
 * fetch, the `$country` / `$language` injection, the cache layer, error
 * shaping, the same-origin Storefront API proxy and, with analytics on only,
 * the visitor's Shopify cookies and tokens (D-9 in
 * docs/hydrogen-removal-plan.md).
 */

declare global {
  /** Query types by document string; storefrontapi.generated.d.ts extends it. */
  interface StorefrontQueries {}
  /** Mutation types by document string; storefrontapi.generated.d.ts extends it. */
  interface StorefrontMutations {}
}

export const STOREFRONT_API_VERSION = '2026-04';

/**
 * Every Storefront API call is aborted after this long, so a hung upstream
 * cannot hold a request, or a background revalidation and its lock, open.
 */
export const STOREFRONT_API_TIMEOUT_MS = 25_000;

type Common = {
  headers?: HeadersInit;
  storefrontApiVersion?: string;
  /** Accepted for Hydrogen call sites; it only labelled the removed profiler. */
  displayName?: string;
};

export interface Storefront {
  query<OverrideReturnType = never, RawGqlString extends string = string>(
    query: RawGqlString,
    ...options: ClientVariablesInRestParams<
      StorefrontQueries,
      RawGqlString,
      Common & {cache?: CacheStrategy},
      'country' | 'language'
    >
  ): Promise<
    ClientReturn<StorefrontQueries, RawGqlString, OverrideReturnType> &
      StorefrontErrors
  >;
  mutate<OverrideReturnType = never, RawGqlString extends string = string>(
    mutation: RawGqlString,
    ...options: ClientVariablesInRestParams<
      StorefrontMutations,
      RawGqlString,
      Common,
      'country' | 'language'
    >
  ): Promise<
    ClientReturn<StorefrontMutations, RawGqlString, OverrideReturnType> &
      StorefrontErrors
  >;
  readonly i18n: I18n;
  readonly CacheNone: typeof CacheNone;
  readonly CacheShort: typeof CacheShort;
  readonly CacheLong: typeof CacheLong;
  readonly CacheCustom: typeof CacheCustom;
  /** `https://<storeDomain>` */
  getShopifyDomain(): string;
  getApiUrl(options?: {storefrontApiVersion?: string}): string;
  getPublicTokenHeaders(): Record<string, string>;
  /** True for `/api/(unstable|YYYY-MM)/graphql.json`. */
  isStorefrontApiUrl(request: Request): boolean;
  /** Same-origin Storefront API proxy for the browser (public-token scope). */
  forward(request: Request): Promise<Response>;
  /**
   * Appends the Set-Cookie values of the first Storefront API answer to
   * `response`. Only with tracking on; otherwise the response is left alone.
   */
  setCollectedSubrequestHeaders(response: Response): void;
}

export interface CreateStorefrontClientOptions {
  storeDomain: string;
  publicStorefrontToken: string;
  /** Server-side only; switches queries to the private token + buyer IP. */
  privateStorefrontToken?: string;
  storefrontId?: string;
  storefrontApiVersion?: string;
  i18n: I18n;
  /** The incoming request: buyer IP, `cf-ray` and the cache key origin. */
  request: Request;
  cache?: Cache;
  waitUntil: (p: Promise<unknown>) => void;
  /**
   * Analytics is on (`isAnalyticsEnabled`, D-9): queries and mutations carry
   * the visitor's Shopify cookies (never ours) and visitor tokens, and the
   * first answer's Set-Cookie values are kept for
   * `setCollectedSubrequestHeaders`. Off by default.
   */
  trackingEnabled?: boolean;
}

/** A non-2xx Storefront API answer. Carries no variables and no body. */
export class StorefrontApiHttpError extends Error {
  readonly status: number;
  readonly requestId: string | null;
  readonly operationName: string;

  constructor(details: {
    operationName: string;
    status: number;
    requestId: string | null;
  }) {
    super(
      `Storefront API ${details.operationName} failed with HTTP ${details.status}`,
    );
    this.name = 'StorefrontApiHttpError';
    this.status = details.status;
    this.requestId = details.requestId;
    this.operationName = details.operationName;
  }
}

const PUBLIC_TOKEN_HEADER = 'X-Shopify-Storefront-Access-Token';
const CLIENT_IP_HEADER = 'X-Shopify-Client-IP';
const REQUEST_GROUP_ID_HEADER = 'Custom-Storefront-Request-Group-ID';
const CONSENT_MANAGEMENT_HEADER = 'Shopify-Storefront-Consent-Management';
const FORWARDED_FOR_HEADER = 'x-forwarded-for';
const SERVER_TIMING_HEADER = 'server-timing';
const BUYER_IP_REQUEST_HEADER = 'CF-Connecting-IP';
const RAY_ID_REQUEST_HEADER = 'cf-ray';
const REQUEST_ID_RESPONSE_HEADER = 'x-request-id';
const JSON_CONTENT_TYPE = 'application/json';
const STOREFRONT_API_PATH_RE =
  /^\/api\/(unstable|2\d{3}-\d{2})\/graphql\.json$/;
const LOCALE_VARIABLES = ['country', 'language'] as const;
const LOCALE_DECLARATIONS = {country: /\$country\b/, language: /\$language\b/};
const UNREADABLE_RESPONSE_MESSAGE =
  'The Storefront API returned an unreadable response';
const UNREADABLE_RESPONSE_CODE = 'UNREADABLE_RESPONSE';
/**
 * The first part of every cache key. Bump it when the key parts or the stored
 * body change shape, so entries written by an older build are never read.
 */
const CACHE_KEY_FORMAT = 'v1';
const COOKIE_HEADER = 'cookie';
/** The only method the proxy relays; Shopify's scripts send nothing else. */
const PROXY_METHOD = 'POST';
const METHOD_NOT_ALLOWED_STATUS = 405;
/** The name app/lib/session.ts gives the session cookie. */
const SESSION_COOKIE_NAME = 'session';
/**
 * Our own cookies, which never go to the Storefront API: the signed session
 * and the cart id. The proxy passes on every other cookie the browser sends
 * (Shopify's `_shopify_y`, `_shopify_s`, `_shopify_analytics`,
 * `_shopify_marketing`, …). Any new first-party cookie belongs in this list.
 */
const OWN_COOKIE_NAMES: ReadonlySet<string> = new Set([
  SESSION_COOKIE_NAME,
  CART_COOKIE_NAME,
]);
/**
 * Every Shopify cookie name starts with this. Queries and mutations carry
 * these cookies only, and only with tracking on.
 */
const SHOPIFY_COOKIE_PREFIX = '_shopify_';
/**
 * The visitor cookies that replaced `_shopify_y` / `_shopify_s`. Shopify
 * reads the visitor from them, so while either is set no visitor token
 * headers are sent (Hydrogen parity).
 */
const VISITOR_COOKIE_NAMES: ReadonlySet<string> = new Set([
  '_shopify_analytics',
  '_shopify_marketing',
]);
const SET_COOKIE_HEADER = 'Set-Cookie';

/** Browser headers the proxy passes on (Hydrogen's allowlist). */
const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'accept-encoding',
  'accept-language',
  'access-control-request-headers',
  'access-control-request-method',
  'content-type',
  'content-length',
  COOKIE_HEADER,
  'origin',
  'referer',
  'user-agent',
  CONSENT_MANAGEMENT_HEADER,
  PUBLIC_TOKEN_HEADER,
  SHOPIFY_UNIQUE_TOKEN_HEADER,
  SHOPIFY_VISIT_TOKEN_HEADER,
] as const;

/** Our own headers the proxy adds; never a token. */
const FORWARDED_CLIENT_HEADERS = [
  CLIENT_IP_HEADER,
  SHOPIFY_STOREFRONT_ID_HEADER,
  REQUEST_GROUP_ID_HEADER,
] as const;

type OperationKind = 'query' | 'mutation';
type OperationOptions = Common & {
  variables?: Record<string, unknown>;
  cache?: CacheStrategy;
};
type OperationResult = Record<string, unknown> & StorefrontErrors;
type Operation = (
  document: string,
  options?: OperationOptions,
) => Promise<OperationResult>;
type GraphQLBody = {
  data: Record<string, unknown> | null;
  errors?: StorefrontApiError[];
};
type OperationRequest = {
  operationName: string;
  url: string;
  headers: Headers;
  body: string;
};
type StorefrontImplementation = Omit<Storefront, 'query' | 'mutate'> & {
  query: Operation;
  mutate: Operation;
};
type StorefrontApiHelpers = ReturnType<typeof createStorefrontApiHelpers>;
/** Where the Set-Cookie values of the Storefront API's answers go. */
type SetCookieCollector = {
  collect(answer: Headers): void;
  appendTo(response: Response): void;
};
type ClientContext = {
  helpers: StorefrontApiHelpers;
  defaultHeaders: Readonly<Record<string, string>>;
  accessToken: string;
  buyerIp: string;
  i18n: I18n;
  origin: string;
  cache: Cache | undefined;
  waitUntil: (p: Promise<unknown>) => void;
  subrequestCookies: SetCookieCollector;
};
/** One cookie of a Cookie header: its trimmed `name=value` text and parts. */
type CookiePair = {name: string; value: string; text: string};

/** Tracking off: nothing is kept and nothing is appended. */
const IGNORED_SET_COOKIES: SetCookieCollector = Object.freeze({
  collect: () => {},
  appendTo: () => {},
});

/**
 * Builds the per-request client. `query` and `mutate` are own, writable
 * properties that never use `this`, so the development mock and
 * guardStorefrontErrors can replace them on the same object.
 */
export function createStorefrontClient(
  options: CreateStorefrontClientOptions,
): Storefront {
  const helpers = createStorefrontApiHelpers({
    storeDomain: options.storeDomain,
    publicStorefrontToken: options.publicStorefrontToken,
    privateStorefrontToken: options.privateStorefrontToken,
    storefrontApiVersion:
      options.storefrontApiVersion ?? STOREFRONT_API_VERSION,
    contentType: 'json',
  });
  const buyerIp = options.request.headers.get(BUYER_IP_REQUEST_HEADER) ?? '';
  const context: ClientContext = {
    helpers,
    defaultHeaders: createDefaultHeaders(helpers, options, buyerIp),
    accessToken:
      options.privateStorefrontToken || options.publicStorefrontToken,
    buyerIp,
    i18n: Object.freeze({...options.i18n}),
    origin: new URL(options.request.url).origin,
    cache: options.cache,
    waitUntil: options.waitUntil,
    subrequestCookies: options.trackingEnabled
      ? createSetCookieCollector()
      : IGNORED_SET_COOKIES,
  };

  const storefront: StorefrontImplementation = {
    query: (document, queryOptions) =>
      runOperation(context, 'query', document, queryOptions),
    mutate: (document, mutationOptions) =>
      runOperation(context, 'mutation', document, mutationOptions),
    i18n: context.i18n,
    CacheNone,
    CacheShort,
    CacheLong,
    CacheCustom,
    getShopifyDomain: () => helpers.getShopifyDomain(),
    getApiUrl: (urlOptions) =>
      helpers.getStorefrontApiUrl({
        storefrontApiVersion: urlOptions?.storefrontApiVersion,
      }),
    getPublicTokenHeaders: () => helpers.getPublicTokenHeaders(),
    isStorefrontApiUrl,
    forward: (request) => forwardToStorefrontApi(request, context),
    setCollectedSubrequestHeaders: (response) =>
      context.subrequestCookies.appendTo(response),
  };
  // The generic, codegen-typed signatures cannot be checked against the
  // runtime functions; the shapes match.
  return storefront as unknown as Storefront;
}

function createDefaultHeaders(
  helpers: StorefrontApiHelpers,
  options: CreateStorefrontClientOptions,
  buyerIp: string,
): Readonly<Record<string, string>> {
  const tokenHeaders = options.privateStorefrontToken
    ? helpers.getPrivateTokenHeaders({buyerIp})
    : helpers.getPublicTokenHeaders();
  return {
    ...tokenHeaders,
    accept: JSON_CONTENT_TYPE,
    ...(buyerIp ? {[CLIENT_IP_HEADER]: buyerIp} : {}),
    ...(options.storefrontId
      ? {[SHOPIFY_STOREFRONT_ID_HEADER]: options.storefrontId}
      : {}),
    [REQUEST_GROUP_ID_HEADER]:
      options.request.headers.get(RAY_ID_REQUEST_HEADER) || crypto.randomUUID(),
    ...(options.trackingEnabled ? createVisitorHeaders(options.request) : {}),
  };
}

/**
 * Hydrogen's visitor headers (h:1874-1891), with tracking on only: the
 * request's Shopify cookies and, until the visitor has one of the newer
 * visitor cookies, visitor tokens. They are client defaults, computed once
 * per request, so queries stay cacheable (per-call headers bypass the cache).
 */
function createVisitorHeaders(request: Request): Record<string, string> {
  const cookies = readCookies(
    request.headers.get(COOKIE_HEADER),
    isShopifyCookie,
  );
  const cookieHeader = toCookieHeader(cookies);
  const forwarded: Record<string, string> = cookieHeader
    ? {[COOKIE_HEADER]: cookieHeader}
    : {};
  if (cookies.some(({name}) => VISITOR_COOKIE_NAMES.has(name))) {
    return forwarded;
  }
  return {...forwarded, ...createVisitorTokenHeaders(cookies)};
}

/**
 * The unique and visit tokens from the deprecated `_shopify_y` /
 * `_shopify_s` cookies, or random ones for a visitor without them. A cookie
 * value is also repeated in hydrogen-react's `Shopify-Storefront-Y` / `-S`
 * header, as Hydrogen does.
 */
function createVisitorTokenHeaders(
  cookies: readonly CookiePair[],
): Record<string, string> {
  const uniqueToken = cookieValue(cookies, SHOPIFY_Y);
  const visitToken = cookieValue(cookies, SHOPIFY_S);
  return {
    ...(uniqueToken ? {[SHOPIFY_STOREFRONT_Y_HEADER]: uniqueToken} : {}),
    ...(visitToken ? {[SHOPIFY_STOREFRONT_S_HEADER]: visitToken} : {}),
    [SHOPIFY_UNIQUE_TOKEN_HEADER]: uniqueToken || crypto.randomUUID(),
    [SHOPIFY_VISIT_TOKEN_HEADER]: visitToken || crypto.randomUUID(),
  };
}

/**
 * Keeps the Set-Cookie values of the first answer the Storefront API gives
 * this request, whatever its status (Hydrogen parity: the answers to one
 * request carry the same visitor cookies, so one copy is enough). Only real
 * answers are seen, including a stale entry's background refresh: a cache
 * hit fetches nothing, and the cache never stores response headers.
 */
function createSetCookieCollector(): SetCookieCollector {
  let collected: readonly string[] | undefined;
  return {
    collect: (answer) => {
      collected ??= answer.getSetCookie();
    },
    appendTo: (response) => {
      for (const value of collected ?? []) {
        response.headers.append(SET_COOKIE_HEADER, value);
      }
    },
  };
}

async function runOperation(
  context: ClientContext,
  kind: OperationKind,
  document: string,
  options: OperationOptions = {},
): Promise<OperationResult> {
  const minified = minifyQuery(document);
  assertOperationKind(kind, minified);
  const callHeaders = new Headers(options.headers);
  const request: OperationRequest = {
    operationName: getOperationName(minified),
    url: context.helpers.getStorefrontApiUrl({
      storefrontApiVersion: options.storefrontApiVersion,
    }),
    headers: mergeHeaders(context.defaultHeaders, callHeaders),
    body: JSON.stringify({
      query: minified,
      variables: withLocaleVariables(minified, context.i18n, options.variables),
    }),
  };
  const strategy = options.cache ?? CacheDefault();
  const body =
    kind === 'query' && usesCache(context, strategy, callHeaders)
      ? await queryThroughCache(context, request, strategy)
      : await postOperation(request, context.subrequestCookies);
  return toOperationResult(body, request.operationName);
}

function assertOperationKind(kind: OperationKind, document: string): void {
  if (kind === 'query' && !isQueryDocument(document)) {
    throw new Error('[storefront.query] Can only execute queries');
  }
  if (kind === 'mutation' && !isMutationDocument(document)) {
    throw new Error('[storefront.mutate] Can only execute mutations');
  }
}

/** Adds `$country` / `$language` from i18n when declared and not passed. */
function withLocaleVariables(
  document: string,
  i18n: I18n,
  variables: Record<string, unknown> = {},
): Record<string, unknown> {
  const injected = LOCALE_VARIABLES.filter(
    (name) => !variables[name] && LOCALE_DECLARATIONS[name].test(document),
  ).map((name) => [name, i18n[name]]);
  return {...variables, ...Object.fromEntries(injected)};
}

function mergeHeaders(
  defaults: Readonly<Record<string, string>>,
  overrides: Headers,
): Headers {
  const headers = new Headers(defaults);
  overrides.forEach((value, name) => headers.set(name, value));
  return headers;
}

/**
 * Whether a query is read from and stored in the cache, decided before any
 * key is hashed. Per-call headers are not part of the key and can make an
 * answer buyer-specific (a buyer IP, a customer token), so a query that sets
 * any bypasses the cache, as `no-store` and `private` strategies do.
 */
function usesCache(
  context: ClientContext,
  strategy: CacheStrategy,
  callHeaders: Headers,
): boolean {
  return (
    context.cache !== undefined &&
    isCacheable(strategy) &&
    callHeaders.keys().next().done === true
  );
}

/** Key parts: the format marker, then URL, token and body (never headers). */
async function queryThroughCache(
  context: ClientContext,
  request: OperationRequest,
  strategy: CacheStrategy,
): Promise<GraphQLBody> {
  const key = await createCacheKey(context.origin, [
    CACHE_KEY_FORMAT,
    request.url,
    context.accessToken,
    request.body,
  ]);
  const fetchAnswer = () => postOperation(request, context.subrequestCookies);
  const {result} = await withCache(fetchAnswer, {
    cache: context.cache,
    key,
    strategy,
    waitUntil: context.waitUntil,
    shouldCacheResult: (body) => !body.errors,
  });
  return result;
}

/**
 * POSTs the operation; `fetch` is looked up at call time, as tests stub it.
 * A redirect is never followed, so the token, the visitor's cookies and the
 * body are not re-sent to its target: the 3xx is an HTTP error like any
 * other non-2xx. Every answer's Set-Cookie values are offered to
 * `setCookies` before its status is checked, as Hydrogen did.
 */
async function postOperation(
  request: OperationRequest,
  setCookies: SetCookieCollector,
): Promise<GraphQLBody> {
  const response = await globalThis.fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: request.body,
    redirect: 'manual',
    signal: AbortSignal.timeout(STOREFRONT_API_TIMEOUT_MS),
  });
  setCookies.collect(response.headers);
  if (!response.ok) {
    const requestId = response.headers.get(REQUEST_ID_RESPONSE_HEADER);
    console.error(
      `[storefront] ${request.operationName} failed: HTTP ${response.status} (request id ${requestId ?? 'none'})`,
    );
    throw new StorefrontApiHttpError({
      operationName: request.operationName,
      status: response.status,
      requestId,
    });
  }
  const parsed = await response
    .text()
    .then((text) => parseJson(text))
    .catch(() => undefined);
  return toGraphQLBody(parsed) ?? unreadableResponse();
}

/** Normalises a parsed body; undefined when it is not a GraphQL response. */
function toGraphQLBody(parsed: unknown): GraphQLBody | undefined {
  if (!isRecord(parsed)) return undefined;
  const data = parsed.data ?? null;
  if (data !== null && !isRecord(data)) return undefined;
  const errors = toErrorList(parsed.errors);
  return errors ? {data, errors} : {data};
}

/** Hydrogen parity: a single error object becomes a list; empty means none. */
function toErrorList(errors: unknown): StorefrontApiError[] | undefined {
  if (errors == null) return undefined;
  const list = (
    Array.isArray(errors) ? errors : [errors]
  ) as StorefrontApiError[];
  return list.length > 0 ? list : undefined;
}

function unreadableResponse(): GraphQLBody {
  return {
    data: null,
    errors: [
      {
        message: UNREADABLE_RESPONSE_MESSAGE,
        extensions: {code: UNREADABLE_RESPONSE_CODE},
      },
    ],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `{...data, errors}`, with `errors` only when there are some. Partial data
 * is logged here, redacted by `describeErrors` (count and codes; messages only
 * in development); errors-only results are left to guardStorefrontErrors,
 * which turns them into a 502.
 */
function toOperationResult(
  body: GraphQLBody,
  operationName: string,
): OperationResult {
  const result: OperationResult = body.errors
    ? {...body.data, errors: body.errors}
    : {...body.data};
  if (result.errors && !isErrorsOnlyResult(result)) {
    console.error(
      `[storefront] ${operationName} returned partial data: ${describeErrors(result.errors)}`,
    );
  }
  return result;
}

function isStorefrontApiUrl(request: Request): boolean {
  return STOREFRONT_API_PATH_RE.test(new URL(request.url).pathname);
}

/**
 * Hydrogen's same-origin proxy: only allowlisted browser headers (without our
 * own cookies) plus our IP, storefront id and request group id. The browser
 * supplies its own (public) token; no server token is ever added. Only POST is
 * relayed, its body streamed through; a redirect goes back to the browser
 * instead of being followed here with the buyer's cookies and token.
 */
async function forwardToStorefrontApi(
  request: Request,
  context: ClientContext,
): Promise<Response> {
  if (request.method !== PROXY_METHOD) return methodNotAllowed();

  const headers = new Headers();
  copyHeaders(headers, FORWARDED_REQUEST_HEADERS, (name) =>
    readForwardedHeader(request, name),
  );
  copyHeaders(
    headers,
    FORWARDED_CLIENT_HEADERS,
    (name) => context.defaultHeaders[name],
  );
  if (context.buyerIp) headers.set(FORWARDED_FOR_HEADER, context.buyerIp);

  const storefrontApiVersion = STOREFRONT_API_PATH_RE.exec(
    new URL(request.url).pathname,
  )?.[1];
  const upstream = await globalThis.fetch(
    context.helpers.getStorefrontApiUrl({storefrontApiVersion}),
    {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'manual',
      signal: AbortSignal.timeout(STOREFRONT_API_TIMEOUT_MS),
    },
  );
  const response = new Response(upstream.body, upstream);
  response.headers.delete(SERVER_TIMING_HEADER);
  return response;
}

function methodNotAllowed(): Response {
  return new Response('Method Not Allowed', {
    status: METHOD_NOT_ALLOWED_STATUS,
    headers: {Allow: PROXY_METHOD},
  });
}

/** A browser header for the proxy; the Cookie header loses our own cookies. */
function readForwardedHeader(request: Request, name: string): string | null {
  const value = request.headers.get(name);
  return name === COOKIE_HEADER
    ? toCookieHeader(readCookies(value, isNotOwnCookie))
    : value;
}

/**
 * The cookies of a Cookie header whose name `keep` accepts, in order, with
 * empty pairs dropped. Names match exactly once trimmed, the way the app
 * reads its cookies, so a lookalike such as Shopify's `cart_currency` is
 * never taken for our `cart`.
 */
function readCookies(
  cookieHeader: string | null,
  keep: (name: string) => boolean,
): CookiePair[] {
  return (cookieHeader ?? '')
    .split(';')
    .map((text) => text.trim())
    .filter((text) => text !== '')
    .map(toCookiePair)
    .filter(({name}) => keep(name));
}

/** Splits a trimmed pair at its first `=`; one without `=` is all name. */
function toCookiePair(text: string): CookiePair {
  const separator = text.indexOf('=');
  if (separator === -1) return {name: text, value: '', text};
  return {
    name: text.slice(0, separator).trim(),
    value: text.slice(separator + 1).trim(),
    text,
  };
}

/** The cookies as a Cookie header, or null when there are none. */
function toCookieHeader(cookies: readonly CookiePair[]): string | null {
  return cookies.length > 0 ? cookies.map(({text}) => text).join('; ') : null;
}

/** The value of the first cookie called `name`; empty when there is none. */
function cookieValue(cookies: readonly CookiePair[], name: string): string {
  return cookies.find((cookie) => cookie.name === name)?.value ?? '';
}

/** The proxy passes on every cookie except ours. */
function isNotOwnCookie(name: string): boolean {
  return !OWN_COOKIE_NAMES.has(name);
}

/** Queries and mutations carry Shopify's cookies only. */
function isShopifyCookie(name: string): boolean {
  return name.startsWith(SHOPIFY_COOKIE_PREFIX);
}

function copyHeaders(
  target: Headers,
  names: readonly string[],
  read: (name: string) => string | null | undefined,
): void {
  for (const name of names) {
    const value = read(name);
    if (value) target.set(name, value);
  }
}
