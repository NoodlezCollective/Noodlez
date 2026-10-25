import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  buildCspHeader,
  createContentSecurityPolicy,
  generateNonce,
  type CspOptions,
} from './csp.server';

/**
 * The options app/entry.server.tsx passes, with the env values of
 * app/lib/__tests__/entry-server.test.ts.
 */
const ENTRY_SERVER_OPTIONS: CspOptions = {
  shop: {
    checkoutDomain: 'checkout.shop.example',
    storeDomain: 'mellow.myshopify.com',
  },
  styleSrc: ['https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.shopify.com'],
  imgSrc: [
    "'self'",
    'data:',
    'blob:',
    'https://cdn.shopify.com',
    'https://shopify.com',
  ],
  mediaSrc: ["'self'", 'blob:', 'https://cdn.shopify.com'],
  frameSrc: [
    "'self'",
    'https://www.youtube.com',
    'https://www.youtube-nocookie.com',
    'https://player.vimeo.com',
  ],
  objectSrc: ["'none'"],
  formAction: ["'self'", 'https://shopify.com'],
};

/**
 * Golden: the header Hydrogen 2026.4.7 returned for ENTRY_SERVER_OPTIONS,
 * captured on 2026-10-25 (before app/entry.server.tsx switched to this
 * module) by calling `createContentSecurityPolicy` from
 * node_modules/@shopify/hydrogen/dist/production/index.js in Node. The
 * production build has no dev sources, so this is the `isDev` false header.
 */
const HYDROGEN_PRODUCTION_HEADER =
  "base-uri 'self'; default-src 'self' https://cdn.shopify.com https://shopify.com 'nonce-dcd728dc71324a7a2bdcaed45eac59b9'; frame-ancestors 'none'; style-src https://fonts.googleapis.com 'self' 'unsafe-inline' https://cdn.shopify.com; connect-src 'self' https://cdn.shopify.com/ https://monorail-edge.shopifysvc.com https://checkout.shop.example https://mellow.myshopify.com; font-src 'self' https://fonts.gstatic.com https://cdn.shopify.com; img-src 'self' data: blob: https://cdn.shopify.com https://shopify.com; media-src 'self' blob: https://cdn.shopify.com; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; object-src 'none'; form-action 'self' https://shopify.com";

/**
 * The same capture from node_modules/@shopify/hydrogen/dist/development/
 * index.js, which always adds the dev sources (the `isDev` true header).
 */
const HYDROGEN_DEVELOPMENT_HEADER =
  "base-uri 'self'; default-src 'self' https://cdn.shopify.com https://shopify.com http://localhost:* 'nonce-57b19ba28cdbb2d50655ae3418de3254'; frame-ancestors 'none'; style-src https://fonts.googleapis.com 'self' 'unsafe-inline' https://cdn.shopify.com http://localhost:*; connect-src 'self' https://cdn.shopify.com/ https://monorail-edge.shopifysvc.com https://checkout.shop.example https://mellow.myshopify.com http://localhost:* ws://localhost:* ws://127.0.0.1:* ws://*.tryhydrogen.dev:*; font-src 'self' https://fonts.gstatic.com https://cdn.shopify.com; img-src 'self' data: blob: https://cdn.shopify.com https://shopify.com; media-src 'self' blob: https://cdn.shopify.com; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; object-src 'none'; form-action 'self' https://shopify.com";

/** Hydrogen's dev source for its tunnel, which we do not use (dropped). */
const HYDROGEN_TUNNEL_SOURCE = ' ws://*.tryhydrogen.dev:*';

/** The nonce embedded in a captured header. */
function nonceOf(header: string): string {
  const nonce = /'nonce-([0-9a-f]{32})'/.exec(header)?.[1];
  if (!nonce) throw new Error(`no nonce in ${header}`);
  return nonce;
}

// The expectations below were checked against Hydrogen 2026.4.7 (both builds)
// with this nonce pinned through crypto.getRandomValues.
const NONCE = '0123456789abcdef0123456789abcdef';
const NONCE_SOURCE = `'nonce-${NONCE}'`;
const BASE_URI = "base-uri 'self'";
const DEFAULT_SRC = `default-src 'self' https://cdn.shopify.com https://shopify.com ${NONCE_SOURCE}`;
const FRAME_ANCESTORS = "frame-ancestors 'none'";
const STYLE_SRC = "style-src 'self' 'unsafe-inline' https://cdn.shopify.com";
const CONNECT_SRC =
  "connect-src 'self' https://cdn.shopify.com/ https://monorail-edge.shopifysvc.com";
const DEFAULT_POLICY = policy(
  BASE_URI,
  DEFAULT_SRC,
  FRAME_ANCESTORS,
  STYLE_SRC,
  CONNECT_SRC,
);

function policy(...directives: string[]): string {
  return directives.join('; ');
}

/** Freezes an options object and its arrays; writes to it then throw. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('buildCspHeader: Hydrogen parity', () => {
  it('reproduces the golden header for the entry.server.tsx options', () => {
    const nonce = nonceOf(HYDROGEN_PRODUCTION_HEADER);

    const header = buildCspHeader(nonce, ENTRY_SERVER_OPTIONS, false);

    expect(header).toBe(HYDROGEN_PRODUCTION_HEADER);
  });

  it('matches Hydrogen in development, without its *.tryhydrogen.dev source', () => {
    expect(HYDROGEN_DEVELOPMENT_HEADER).toContain(HYDROGEN_TUNNEL_SOURCE);
    const nonce = nonceOf(HYDROGEN_DEVELOPMENT_HEADER);

    const header = buildCspHeader(nonce, ENTRY_SERVER_OPTIONS, true);

    expect(header).toBe(
      HYDROGEN_DEVELOPMENT_HEADER.replace(HYDROGEN_TUNNEL_SOURCE, ''),
    );
    expect(header).not.toContain('tryhydrogen');
  });

  it('builds the default policy without options', () => {
    expect(buildCspHeader(NONCE, undefined, false)).toBe(DEFAULT_POLICY);
    expect(buildCspHeader(NONCE, {}, false)).toBe(DEFAULT_POLICY);
  });
});

describe('buildCspHeader: dev sources', () => {
  it('adds localhost to default-src and style-src and HMR sockets to connect-src', () => {
    expect(buildCspHeader(NONCE, undefined, true)).toBe(
      policy(
        BASE_URI,
        `default-src 'self' https://cdn.shopify.com https://shopify.com http://localhost:* ${NONCE_SOURCE}`,
        FRAME_ANCESTORS,
        `${STYLE_SRC} http://localhost:*`,
        `${CONNECT_SRC} http://localhost:* ws://localhost:* ws://127.0.0.1:*`,
      ),
    );
  });

  it('adds no localhost or websocket source outside development', () => {
    const header = buildCspHeader(NONCE, ENTRY_SERVER_OPTIONS, false);

    expect(header).not.toMatch(/localhost|127\.0\.0\.1|ws:/);
  });

  it('defaults to import.meta.env.DEV', () => {
    vi.stubEnv('DEV', false);
    expect(buildCspHeader(NONCE)).toBe(DEFAULT_POLICY);

    vi.stubEnv('DEV', true);
    expect(buildCspHeader(NONCE)).toBe(buildCspHeader(NONCE, {}, true));
  });
});

describe('buildCspHeader: merging', () => {
  it('lists override sources before the defaults', () => {
    const header = buildCspHeader(
      NONCE,
      {styleSrc: ['https://a.example', 'https://b.example']},
      false,
    );

    expect(header).toBe(
      policy(
        BASE_URI,
        DEFAULT_SRC,
        FRAME_ANCESTORS,
        "style-src https://a.example https://b.example 'self' 'unsafe-inline' https://cdn.shopify.com",
        CONNECT_SRC,
      ),
    );
  });

  it('keeps the dev sources after the override', () => {
    const header = buildCspHeader(
      NONCE,
      {styleSrc: ['https://a.example']},
      true,
    );

    expect(header).toContain(
      "style-src https://a.example 'self' 'unsafe-inline' https://cdn.shopify.com http://localhost:*;",
    );
  });

  it('accepts a single source string as an override', () => {
    const header = buildCspHeader(
      NONCE,
      {connectSrc: 'https://api.example'},
      false,
    );

    expect(header).toBe(
      policy(
        BASE_URI,
        DEFAULT_SRC,
        FRAME_ANCESTORS,
        STYLE_SRC,
        "connect-src https://api.example 'self' https://cdn.shopify.com/ https://monorail-edge.shopifysvc.com",
      ),
    );
  });

  it("lets an override replace an all-'none' default", () => {
    expect(
      buildCspHeader(
        NONCE,
        {frameAncestors: ["'self'", 'https://admin.shopify.com']},
        false,
      ),
    ).toBe(
      policy(
        BASE_URI,
        DEFAULT_SRC,
        "frame-ancestors 'self' https://admin.shopify.com",
        STYLE_SRC,
        CONNECT_SRC,
      ),
    );
    expect(buildCspHeader(NONCE, {frameAncestors: "'self'"}, false)).toBe(
      policy(
        BASE_URI,
        DEFAULT_SRC,
        "frame-ancestors 'self'",
        STYLE_SRC,
        CONNECT_SRC,
      ),
    );
  });

  it("merges a 'none' override into a default that has sources", () => {
    const header = buildCspHeader(NONCE, {baseUri: ["'none'"]}, false);

    expect(header.split('; ')[0]).toBe("base-uri 'none' 'self'");
  });

  it('appends other directives after the defaults, in the given order', () => {
    const header = buildCspHeader(
      NONCE,
      {workerSrc: "'self' blob:", imgSrc: ["'self'"], manifestSrc: ["'self'"]},
      false,
    );

    expect(header).toBe(
      policy(
        DEFAULT_POLICY,
        "worker-src 'self' blob:",
        "img-src 'self'",
        "manifest-src 'self'",
      ),
    );
  });

  it('adds the checkout and store domains to connect-src only when set', () => {
    expect(
      buildCspHeader(
        NONCE,
        {shop: {checkoutDomain: 'checkout.example'}},
        false,
      ),
    ).toBe(
      policy(
        BASE_URI,
        DEFAULT_SRC,
        FRAME_ANCESTORS,
        STYLE_SRC,
        `${CONNECT_SRC} https://checkout.example`,
      ),
    );
    expect(
      buildCspHeader(NONCE, {shop: {storeDomain: 'store.example'}}, false),
    ).toBe(
      policy(
        BASE_URI,
        DEFAULT_SRC,
        FRAME_ANCESTORS,
        STYLE_SRC,
        `${CONNECT_SRC} https://store.example`,
      ),
    );
    expect(
      buildCspHeader(
        NONCE,
        {shop: {checkoutDomain: '', storeDomain: ''}},
        false,
      ),
    ).toBe(DEFAULT_POLICY);
  });

  it.each<[string, CspOptions, string]>([
    ['an empty list keeps the defaults', {styleSrc: []}, DEFAULT_POLICY],
    [
      'an empty list elsewhere gives a source-less directive',
      {imgSrc: []},
      policy(DEFAULT_POLICY, 'img-src'),
    ],
    [
      'an empty string clears a default directive',
      {styleSrc: ''},
      policy(BASE_URI, DEFAULT_SRC, FRAME_ANCESTORS, 'style-src', CONNECT_SRC),
    ],
    [
      'an empty default-src string also drops the nonce',
      {defaultSrc: ''},
      policy(BASE_URI, 'default-src', FRAME_ANCESTORS, STYLE_SRC, CONNECT_SRC),
    ],
  ])('matches Hydrogen at the edges: %s', (_name, options, expected) => {
    expect(buildCspHeader(NONCE, options, false)).toBe(expected);
  });

  it('treats an undefined directive as absent (Hydrogen throws a TypeError)', () => {
    const header = buildCspHeader(
      NONCE,
      {styleSrc: undefined, imgSrc: undefined},
      false,
    );

    expect(header).toBe(DEFAULT_POLICY);
  });

  it('does not modify the options it is given', () => {
    const options = deepFreeze(structuredClone(ENTRY_SERVER_OPTIONS));

    expect(() => buildCspHeader(NONCE, options, true)).not.toThrow();
    expect(options).toEqual(ENTRY_SERVER_OPTIONS);
  });
});

describe('buildCspHeader: nonce placement and format', () => {
  it('moves the nonce to the end of default-src when script-src is not a list', () => {
    expect(
      buildCspHeader(
        NONCE,
        {defaultSrc: ["'nonce-stale'", 'https://x.example']},
        false,
      ),
    ).toBe(
      policy(
        BASE_URI,
        `default-src https://x.example 'self' https://cdn.shopify.com https://shopify.com ${NONCE_SOURCE}`,
        FRAME_ANCESTORS,
        STYLE_SRC,
        CONNECT_SRC,
      ),
    );
    expect(buildCspHeader(NONCE, {scriptSrc: "'self'"}, false)).toBe(
      policy(DEFAULT_POLICY, "script-src 'self'"),
    );
  });

  it('appends the nonce to a script-src list, replacing stale nonces', () => {
    const header = buildCspHeader(
      NONCE,
      {scriptSrc: ["'self'", "'nonce-stale'"]},
      false,
    );

    // Hydrogen's default-src keeps its built-in nonce in second place then.
    expect(header).toBe(
      policy(
        BASE_URI,
        `default-src 'self' ${NONCE_SOURCE} https://cdn.shopify.com https://shopify.com`,
        FRAME_ANCESTORS,
        STYLE_SRC,
        CONNECT_SRC,
        `script-src 'self' ${NONCE_SOURCE}`,
      ),
    );
  });

  it('keeps the built-in default-src nonce in development too', () => {
    expect(buildCspHeader(NONCE, {scriptSrc: ["'self'"]}, true)).toContain(
      `default-src 'self' ${NONCE_SOURCE} https://cdn.shopify.com https://shopify.com http://localhost:*;`,
    );
  });

  it.each([
    "abc' 'unsafe-inline",
    'abc; script-src *',
    'abc def',
    '',
    'abc=def',
  ])('rejects %j, which is not a CSP nonce value', (nonce) => {
    expect(() => buildCspHeader(nonce, undefined, false)).toThrow(TypeError);
  });

  it('accepts base64 and base64url nonce values', () => {
    expect(buildCspHeader('aB3+/9_-==', undefined, false)).toContain(
      "'nonce-aB3+/9_-=='",
    );
  });
});

describe('generateNonce', () => {
  it('returns 32 lowercase hex characters that fit the entry-server contract', () => {
    const nonce = generateNonce();

    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(`'nonce-${nonce}'`).toMatch(/^'nonce-[\w-]+'$/);
  });

  it('is unique per call', () => {
    const nonces = new Set(Array.from({length: 1000}, () => generateNonce()));

    expect(nonces.size).toBe(1000);
  });

  it('hex-encodes 16 bytes from crypto.getRandomValues, keeping leading zeros', () => {
    const bytes = [
      0x00, 0x01, 0x0f, 0x10, 0x7f, 0x80, 0xfe, 0xff, 0x0a, 0xa0, 0x5c, 0xc5,
      0x09, 0x90, 0x3e, 0xe3,
    ];
    const getRandomValues = vi
      .spyOn(crypto, 'getRandomValues')
      .mockImplementation((array) => {
        (array as Uint8Array).set(bytes);
        return array;
      });

    expect(generateNonce()).toBe('00010f107f80feff0aa05cc509903ee3');
    expect(getRandomValues).toHaveBeenCalledTimes(1);
    const [array] = getRandomValues.mock.calls[0];
    expect(array).toBeInstanceOf(Uint8Array);
    expect((array as Uint8Array).length).toBe(16);
  });

  it('fails instead of falling back to Math.random without Web Crypto', () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(() => {
      throw new Error('Web Crypto unavailable');
    });
    const random = vi.spyOn(Math, 'random');

    expect(() => generateNonce()).toThrow('Web Crypto unavailable');
    expect(random).not.toHaveBeenCalled();
  });
});

describe('createContentSecurityPolicy', () => {
  it('returns a fresh nonce and the header built with it', () => {
    const first = createContentSecurityPolicy(ENTRY_SERVER_OPTIONS);
    const second = createContentSecurityPolicy(ENTRY_SERVER_OPTIONS);

    expect(first.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(second.nonce).not.toBe(first.nonce);
    expect(first.header).toBe(
      buildCspHeader(first.nonce, ENTRY_SERVER_OPTIONS),
    );
  });

  it('gives the golden header for the entry.server.tsx options in production', () => {
    vi.stubEnv('DEV', false);

    const {nonce, header} = createContentSecurityPolicy(ENTRY_SERVER_OPTIONS);

    expect(header).toBe(
      HYDROGEN_PRODUCTION_HEADER.replace(
        nonceOf(HYDROGEN_PRODUCTION_HEADER),
        nonce,
      ),
    );
  });

  it('builds the default policy without options', () => {
    vi.stubEnv('DEV', false);

    const {nonce, header} = createContentSecurityPolicy();

    expect(header).toBe(DEFAULT_POLICY.replace(NONCE, nonce));
  });
});
