/**
 * The document Content-Security-Policy, ported from Hydrogen 2026.4.7's
 * `generateNonce`, `createContentSecurityPolicy` and `createCSPHeader`. The
 * header is byte-identical to Hydrogen's (see csp.server.test.ts), and
 * serialisation matches `content-security-policy-builder` 2.3.0, which
 * Hydrogen uses.
 *
 * Deliberate differences: the dev sources leave out `ws://*.tryhydrogen.dev:*`,
 * an undefined directive counts as absent (Hydrogen throws), a nonce that is
 * not a CSP base64 value is rejected, and `generateNonce` has no
 * `Math.random` fallback.
 */

export type CspDirective =
  | 'defaultSrc'
  | 'scriptSrc'
  | 'styleSrc'
  | 'imgSrc'
  | 'fontSrc'
  | 'connectSrc'
  | 'mediaSrc'
  | 'frameSrc'
  | 'frameAncestors'
  | 'objectSrc'
  | 'formAction'
  | 'baseUri'
  | 'workerSrc'
  | 'manifestSrc';

export type CspOptions = Partial<Record<CspDirective, string | string[]>> & {
  shop?: {checkoutDomain?: string; storeDomain?: string};
};

/** One directive's sources: a list, or a string used as is. */
type Sources = string | readonly string[];
/** Directive name (camelCase) to sources, in header order. */
type Directives = ReadonlyMap<string, Sources>;

/** 16 random bytes, written as 32 lowercase hex characters (plan D-2). */
const NONCE_BYTE_LENGTH = 16;
const HEX_RADIX = 16;
const HEX_DIGITS_PER_BYTE = 2;
/** CSP3 base64-value, the only thing allowed after `'nonce-`. */
const NONCE_VALUE_RE = /^[A-Za-z0-9+/_-]+={0,2}$/;
/** Hydrogen parity: any source starting with this is an old nonce. */
const NONCE_SOURCE_PREFIX = "'nonce";
/** The nonce goes to the first of these that is a list. */
const NONCE_DIRECTIVES = ['scriptSrc', 'defaultSrc'] as const;

const SELF = "'self'";
const NONE = "'none'";
const UNSAFE_INLINE = "'unsafe-inline'";
const SHOPIFY_CDN = 'https://cdn.shopify.com';
/** connect-src lists the CDN with a trailing slash, as Hydrogen does. */
const SHOPIFY_CDN_CONNECT = 'https://cdn.shopify.com/';
/** Used by the Customer Account API. */
const SHOPIFY_ACCOUNTS = 'https://shopify.com';
const SHOPIFY_MONORAIL = 'https://monorail-edge.shopifysvc.com';

/** Vite's dev server and its HMR sockets (Hydrogen's tunnel host dropped). */
const DEV_LOCALHOST = 'http://localhost:*';
const DEV_CONNECT_SOURCES = [
  DEV_LOCALHOST,
  'ws://localhost:*',
  'ws://127.0.0.1:*',
] as const;

const CAMEL_CASE_BOUNDARY_RE = /([a-z])([A-Z])/g;
const SOURCE_SEPARATOR = ' ';
const DIRECTIVE_SEPARATOR = '; ';

/** A fresh nonce from Web Crypto. Throws when Web Crypto is unavailable. */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTE_LENGTH));
  return Array.from(bytes, toHex).join('');
}

/**
 * The Content-Security-Policy header value for `nonce`. Overrides for
 * directives with defaults are listed before the defaults, except that an
 * override replaces an all-`'none'` default; other directives follow in the
 * given order. The nonce goes last in script-src when that is a list,
 * otherwise last in default-src.
 */
export function buildCspHeader(
  nonce: string,
  options: CspOptions = {},
  isDev: boolean = import.meta.env.DEV,
): string {
  if (!NONCE_VALUE_RE.test(nonce)) {
    throw new TypeError('A CSP nonce must be a base64 value');
  }
  const {shop, ...overrides} = options;
  const nonceSource = `'nonce-${nonce}'`;
  const directives = mergeDirectives(
    defaultDirectives(nonceSource, shop, isDev),
    definedDirectives(overrides),
  );
  return serializeDirectives(placeNonce(directives, nonceSource));
}

/** A fresh nonce and the header that allows it. */
export function createContentSecurityPolicy(options?: CspOptions): {
  nonce: string;
  header: string;
} {
  const nonce = generateNonce();
  return {nonce, header: buildCspHeader(nonce, options)};
}

function toHex(byte: number): string {
  return byte.toString(HEX_RADIX).padStart(HEX_DIGITS_PER_BYTE, '0');
}

/** Hydrogen's defaults, in Hydrogen's order. */
function defaultDirectives(
  nonceSource: string,
  shop: CspOptions['shop'],
  isDev: boolean,
): ReadonlyMap<string, readonly string[]> {
  const dev = (...sources: readonly string[]) => (isDev ? sources : []);
  const shopSources = [shop?.checkoutDomain, shop?.storeDomain]
    .filter((domain): domain is string => Boolean(domain))
    .map((domain) => `https://${domain}`);

  return new Map<string, readonly string[]>([
    ['baseUri', [SELF]],
    [
      'defaultSrc',
      [SELF, nonceSource, SHOPIFY_CDN, SHOPIFY_ACCOUNTS, ...dev(DEV_LOCALHOST)],
    ],
    ['frameAncestors', [NONE]],
    ['styleSrc', [SELF, UNSAFE_INLINE, SHOPIFY_CDN, ...dev(DEV_LOCALHOST)]],
    [
      'connectSrc',
      [
        SELF,
        SHOPIFY_CDN_CONNECT,
        SHOPIFY_MONORAIL,
        ...shopSources,
        ...dev(...DEV_CONNECT_SOURCES),
      ],
    ],
  ]);
}

/** The overrides that have a value; an undefined one keeps the default. */
function definedDirectives(overrides: Omit<CspOptions, 'shop'>): Directives {
  const entries: ReadonlyArray<[string, Sources | undefined]> =
    Object.entries(overrides);
  return new Map(
    entries.filter(
      (entry): entry is [string, Sources] => entry[1] !== undefined,
    ),
  );
}

/** Hydrogen's `Object.assign({}, defaults, overrides)` plus its merge loop. */
function mergeDirectives(
  defaults: ReadonlyMap<string, readonly string[]>,
  overrides: Directives,
): Directives {
  const merged = Array.from(
    defaults,
    ([name, sources]) =>
      [name, mergeSources(sources, overrides.get(name))] as const,
  );
  const added = Array.from(overrides).filter(([name]) => !defaults.has(name));
  return new Map([...merged, ...added]);
}

function mergeSources(
  defaults: readonly string[],
  override: Sources | undefined,
): Sources {
  if (override === undefined) return defaults;
  // Hydrogen parity: an empty string skips the merge and clears the sources.
  if (override === '') return override;
  const overrideSources = typeof override === 'string' ? [override] : override;
  return defaults.every((source) => source === NONE)
    ? overrideSources
    : [...overrideSources, ...defaults];
}

/** Drops old nonces and appends `nonceSource` to script-src or default-src. */
function placeNonce(directives: Directives, nonceSource: string): Directives {
  for (const name of NONCE_DIRECTIVES) {
    const sources = directives.get(name);
    if (sources === undefined || typeof sources === 'string') continue;
    const withoutNonces = sources.filter(
      (source) => !source.startsWith(NONCE_SOURCE_PREFIX),
    );
    return new Map(directives).set(name, [...withoutNonces, nonceSource]);
  }
  return directives;
}

/** `content-security-policy-builder` output: kebab-case names, `; ` between. */
function serializeDirectives(directives: Directives): string {
  return Array.from(directives, ([name, sources]) => {
    const directiveName = name
      .replace(CAMEL_CASE_BOUNDARY_RE, '$1-$2')
      .toLowerCase();
    const value =
      typeof sources === 'string' ? sources : sources.join(SOURCE_SEPARATOR);
    return value ? `${directiveName} ${value}` : directiveName;
  }).join(DIRECTIVE_SEPARATOR);
}
