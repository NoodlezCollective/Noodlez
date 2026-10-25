import type {
  ClientReturn,
  ClientVariablesInRestParams,
} from '@shopify/graphql-codegen';
import {
  createStorefrontClient as createStorefrontApiHelpers,
  SHOPIFY_STOREFRONT_ID_HEADER,
  SHOPIFY_UNIQUE_TOKEN_HEADER,
  SHOPIFY_VISIT_TOKEN_HEADER,
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
 * shaping and the same-origin Storefront API proxy.
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
  /** No-op until Phase 4c, which copies Storefront API Set-Cookie headers. */
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
   * Phase 4c (analytics): forward Shopify cookies and visitor tokens and
   * collect Set-Cookie headers. Accepted and ignored until then.
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
 * Our own cookies, which the proxy never passes on: the signed session and
 * the cart id. Shopify's cookies (`_shopify_y`, `_shopify_s`,
 * `_shopify_analytics`, `_shopify_marketing`, …) are forwarded. Any new
 * first-party cookie belongs in this list.
 */
const OWN_COOKIE_NAMES: ReadonlySet<string> = new Set([
  SESSION_COOKIE_NAME,
  CART_COOKIE_NAME,
]);

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
type ClientContext = {
  helpers: StorefrontApiHelpers;
  defaultHeaders: Readonly<Record<string, string>>;
  accessToken: string;
  buyerIp: string;
  i18n: I18n;
  origin: string;
  cache: Cache | undefined;
  waitUntil: (p: Promise<unknown>) => void;
};

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
    setCollectedSubrequestHeaders: () => {},
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
      : await postOperation(request);
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
  const {result} = await withCache(() => postOperation(request), {
    cache: context.cache,
    key,
    strategy,
    waitUntil: context.waitUntil,
    shouldCacheResult: (body) => !body.errors,
  });
  return result;
}

/** POSTs the operation; `fetch` is looked up at call time, as tests stub it. */
async function postOperation(request: OperationRequest): Promise<GraphQLBody> {
  const response = await globalThis.fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: request.body,
    signal: AbortSignal.timeout(STOREFRONT_API_TIMEOUT_MS),
  });
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

function readForwardedHeader(request: Request, name: string): string | null {
  const value = request.headers.get(name);
  return name === COOKIE_HEADER ? withoutOwnCookies(value) : value;
}

/**
 * The Cookie header without our own cookies, or null when nothing is left.
 * Names match exactly once trimmed, the way the app reads its cookies, so a
 * lookalike such as Shopify's `cart_currency` is kept.
 */
function withoutOwnCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const kept = cookieHeader
    .split(';')
    .map((pair) => pair.trim())
    .filter((pair) => pair !== '' && !OWN_COOKIE_NAMES.has(cookieName(pair)));
  return kept.length > 0 ? kept.join('; ') : null;
}

/** The text before `=`, or the whole pair when it has none. */
function cookieName(pair: string): string {
  const separator = pair.indexOf('=');
  return (separator === -1 ? pair : pair.slice(0, separator)).trim();
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
