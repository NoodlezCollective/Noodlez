#!/usr/bin/env node
/**
 * Connection and readiness check for the Shopify store behind this storefront.
 *
 *   npm run store:check                  # report
 *   npm run store:check -- --write-dev-vars
 *                                        # also write .dev.vars from the
 *                                        # variables in the environment
 *
 * Variables are read from the process environment first (cloud sessions,
 * CI, Cloudflare), then from .dev.vars (local development). The script calls
 * the Storefront API with the same version and token the Worker uses, then
 * lists, per docs/shopify-setup.md section, what the store already has and
 * what still falls back to the storefront's built-in copy. It never changes
 * anything in Shopify. Exit code 1 means the storefront cannot reach the
 * store with these values; missing content is reported but is not a failure.
 */
import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';

// Node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY is set, so behind
// a proxy (cloud sessions, CI) the script re-runs itself with it set.
if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
  const child = spawnSync(
    process.execPath,
    ['--no-warnings', ...process.argv.slice(1)],
    {stdio: 'inherit', env: {...process.env, NODE_USE_ENV_PROXY: '1'}},
  );
  process.exit(child.status ?? 1);
}

const API_VERSION = '2026-04';
const ROOT = resolve(new URL('..', import.meta.url).pathname);
const DEV_VARS = resolve(ROOT, '.dev.vars');

const REQUIRED = [
  'PUBLIC_STORE_DOMAIN',
  'PUBLIC_STOREFRONT_API_TOKEN',
  'SESSION_SECRET',
];
const OPTIONAL = [
  'PRIVATE_STOREFRONT_API_TOKEN',
  'PUBLIC_STOREFRONT_ID',
  'PUBLIC_CHECKOUT_DOMAIN',
  'PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID',
  'PUBLIC_CUSTOMER_ACCOUNT_API_URL',
  'SHOP_ID',
  'NEWSLETTER_WEBHOOK_URL',
];

const METAOBJECTS = [
  [
    'mellow_settings',
    'one entry',
    'announcements, trust badges, footer card, free gift, proof rings',
  ],
  ['mellow_hero', 'one entry', 'homepage hero'],
  ['mellow_press_logo', 'list', '"As seen in" marquee'],
  ['mellow_story', 'one entry', 'story video section'],
  ['mellow_ugc_video', 'list', 'video grid'],
  ['mellow_lifestyle_image', 'list', 'lifestyle image pair'],
  ['mellow_testimonial', 'list', 'reviews section'],
  ['mellow_faq', 'list', 'FAQ accordion'],
  ['mellow_about', 'one entry', '/pages/about'],
  ['mellow_review', 'list', 'product review carousel'],
];
const PRODUCT_METAFIELDS = [
  ['reviews', 'rating'],
  ['reviews', 'rating_count'],
  ['mellow', 'badge'],
  ['mellow', 'short_description'],
  ['mellow', 'features'],
  ['mellow', 'materials'],
  ['mellow', 'care'],
  ['mellow', 'swatch_groups'],
  ['mellow', 'savings_note'],
  ['mellow', 'featured_reviews'],
  ['mellow', 'sold_recently'],
  ['mellow', 'size_guide'],
  ['mellow', 'pack_tiers'],
  ['mellow', 'proof'],
  ['mellow', 'addon'],
  ['mellow', 'addon_note'],
];
const POLICIES = [
  'privacyPolicy',
  'shippingPolicy',
  'termsOfService',
  'refundPolicy',
  'subscriptionPolicy',
];

const out = (line = '') => process.stdout.write(line + '\n');
const OK = '✓';
const MISSING = '✗';
const INFO = '·';

function parseDotenv(text) {
  const out = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadVariables() {
  const fromFile = existsSync(DEV_VARS)
    ? parseDotenv(readFileSync(DEV_VARS, 'utf8'))
    : {};
  const vars = {};
  const sources = {};
  for (const name of [...REQUIRED, ...OPTIONAL, 'MOCK_STOREFRONT']) {
    if (process.env[name]) {
      vars[name] = process.env[name];
      sources[name] = 'environment';
    } else if (fromFile[name]) {
      vars[name] = fromFile[name];
      sources[name] = '.dev.vars';
    }
  }
  return {vars, sources, hasFile: existsSync(DEV_VARS)};
}

function writeDevVars(vars) {
  const lines = [
    '# Written by `npm run store:check -- --write-dev-vars` from the variables in',
    '# the environment. Gitignored; never commit it. See .dev.vars.example.',
  ];
  for (const name of [...REQUIRED, ...OPTIONAL]) {
    if (vars[name]) lines.push(`${name}=${vars[name]}`);
  }
  lines.push('MOCK_STOREFRONT=false');
  writeFileSync(DEV_VARS, lines.join('\n') + '\n', {mode: 0o600});
}

async function storefrontQuery(vars, query, variables = {}) {
  const url = `https://${vars.PUBLIC_STORE_DOMAIN}/api/${API_VERSION}/graphql.json`;
  const headers = {'content-type': 'application/json'};
  if (vars.PRIVATE_STOREFRONT_API_TOKEN) {
    headers['Shopify-Storefront-Private-Token'] =
      vars.PRIVATE_STOREFRONT_API_TOKEN;
  } else {
    headers['X-Shopify-Storefront-Access-Token'] =
      vars.PUBLIC_STOREFRONT_API_TOKEN;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({query, variables}),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `${response.status} ${response.statusText} from ${url}: ${text.slice(0, 200)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText} from ${url}: ${JSON.stringify(json.errors ?? json).slice(0, 300)}`,
    );
  }
  return json;
}

const SHOP_QUERY = /* GraphQL */ `
  query StoreCheckShop {
    shop {
      name
      description
      primaryDomain {
        url
      }
      paymentSettings {
        currencyCode
      }
      shipsToCountries
      privacyPolicy {
        handle
      }
      shippingPolicy {
        handle
      }
      termsOfService {
        handle
      }
      refundPolicy {
        handle
      }
      subscriptionPolicy {
        handle
      }
    }
  }
`;

const CONTENT_QUERY = /* GraphQL */ `
  query StoreCheckContent {
    mainMenu: menu(handle: "main-menu") { items { title url items { title } } }
    footerMenu: menu(handle: "footer") { items { title url items { title } } }
    mostLoved: collection(handle: "most-loved") { title products(first: 1) { nodes { id } } }
    all: collection(handle: "all") { title }
    collections(first: 50) { nodes { handle title } }
    products(first: 50) {
      nodes {
        handle
        title
        availableForSale
        featuredImage { id }
        ${PRODUCT_METAFIELDS.map(
          ([ns, key], i) =>
            `mf${i}: metafield(namespace: "${ns}", key: "${key}") { id }`,
        ).join('\n        ')}
      }
    }
    about: page(handle: "about") { title }
    pages(first: 50) { nodes { handle title } }
    ${METAOBJECTS.map(
      ([type], i) =>
        `mo${i}: metaobjects(type: "${type}", first: 20) { nodes { handle } }`,
    ).join('\n    ')}
  }
`;

function print(mark, text) {
  out(`  ${mark} ${text}`);
}

async function main() {
  const writeRequested = process.argv.includes('--write-dev-vars');
  const {vars, sources, hasFile} = loadVariables();
  let failed = false;

  out('\nStorefront connection check');
  out('===========================\n');
  out('Variables');
  for (const name of REQUIRED) {
    if (vars[name]) print(OK, `${name} (${sources[name]})`);
    else {
      print(MISSING, `${name} is not set`);
      failed = true;
    }
  }
  for (const name of OPTIONAL) {
    if (vars[name]) print(OK, `${name} (${sources[name]})`);
    else print(INFO, `${name} not set (optional)`);
  }
  if (vars.PUBLIC_STOREFRONT_API_TOKEN?.startsWith('shpat_')) {
    print(
      MISSING,
      'PUBLIC_STOREFRONT_API_TOKEN holds a private (shpat_) token. Put it in PRIVATE_STOREFRONT_API_TOKEN and use the public token here.',
    );
    failed = true;
  }
  if (vars.MOCK_STOREFRONT === 'true') {
    print(
      MISSING,
      `MOCK_STOREFRONT=true (${sources.MOCK_STOREFRONT}): the dev server serves the demo catalog, not this store. Set it to false.`,
    );
  }
  if (!vars.PUBLIC_STOREFRONT_ID || !vars.PUBLIC_CHECKOUT_DOMAIN) {
    print(
      INFO,
      'Analytics stay off until PUBLIC_STOREFRONT_ID and PUBLIC_CHECKOUT_DOMAIN are both set (docs section 8).',
    );
  }
  if (!hasFile) {
    print(
      INFO,
      '.dev.vars does not exist; `npm run dev` needs it. Re-run with --write-dev-vars to create it from the environment.',
    );
  }
  if (failed) {
    out(
      '\nCannot connect: add the missing variables (docs/shopify-setup.md, section 1).\n' +
        'They come from Shopify admin > Sales channels > Hydrogen (or Headless) > the storefront > Storefront API settings.\n',
    );
    process.exit(1);
  }

  out('\nStore');
  let shop;
  try {
    const result = await storefrontQuery(vars, SHOP_QUERY);
    if (result.errors?.length) {
      throw new Error(result.errors.map((e) => e.message).join('; '));
    }
    shop = result.data.shop;
  } catch (error) {
    print(
      MISSING,
      `Storefront API ${API_VERSION} at ${vars.PUBLIC_STORE_DOMAIN}: ${error.message}`,
    );
    out(
      '\nCannot connect. Check PUBLIC_STORE_DOMAIN (the *.myshopify.com domain) and that the token belongs to a storefront of that store.' +
        (process.env.HTTPS_PROXY
          ? ' HTTPS goes through a proxy here, which must allow that host.'
          : '') +
        '\n',
    );
    process.exit(1);
  }
  print(
    OK,
    `Connected to "${shop.name}" (${vars.PUBLIC_STORE_DOMAIN}) with Storefront API ${API_VERSION}`,
  );
  print(
    INFO,
    `Primary domain ${shop.primaryDomain?.url ?? 'n/a'}, currency ${shop.paymentSettings?.currencyCode ?? 'n/a'}, ships to ${shop.shipsToCountries?.length ?? 0} countries`,
  );

  const content = await storefrontQuery(vars, CONTENT_QUERY);
  const data = content.data ?? {};
  const warnings = (content.errors ?? []).map((e) => e.message);

  out('\nNavigation (docs section 2)');
  for (const [key, handle] of [
    ['mainMenu', 'main-menu'],
    ['footerMenu', 'footer'],
  ]) {
    const menu = data[key];
    if (menu?.items?.length) {
      const groups = menu.items.filter((item) => item.items?.length).length;
      print(
        OK,
        `menu "${handle}": ${menu.items.length} items${groups ? `, ${groups} groups` : ''}`,
      );
    } else {
      print(
        MISSING,
        `menu "${handle}" missing or empty: the storefront shows its fallback links`,
      );
    }
  }

  out('\nCollections (docs section 3)');
  const collectionHandles = new Set(
    (data.collections?.nodes ?? []).map((c) => c.handle),
  );
  if (data.mostLoved) {
    const hasProducts = data.mostLoved.products?.nodes?.length > 0;
    print(
      hasProducts ? OK : MISSING,
      `"most-loved": ${data.mostLoved.title}${hasProducts ? '' : ' (empty; the home page falls back to best sellers)'}`,
    );
  } else {
    print(
      MISSING,
      '"most-loved" missing: the home page falls back to best sellers',
    );
  }
  print(
    data.all ? OK : INFO,
    `"all": ${data.all ? data.all.title : 'not a collection (the /collections/all route lists every product anyway)'}`,
  );
  print(
    INFO,
    `${collectionHandles.size} collections published to this storefront: ${[...collectionHandles].join(', ') || 'none'}`,
  );

  out('\nProducts (docs section 4)');
  const products = data.products?.nodes ?? [];
  if (!products.length) {
    print(
      MISSING,
      'no products are published to this sales channel (Products > product > Sales channels)',
    );
  } else {
    const available = products.filter((p) => p.availableForSale).length;
    const withImage = products.filter((p) => p.featuredImage).length;
    print(
      OK,
      `${products.length} products published, ${available} available for sale, ${withImage} with an image`,
    );
    PRODUCT_METAFIELDS.forEach(([ns, key], i) => {
      const count = products.filter((p) => p[`mf${i}`]).length;
      print(
        count ? OK : INFO,
        `${ns}.${key}: ${count ? `${count} products` : 'none (falls back or hides)'}`,
      );
    });
  }

  out('\nMetaobjects (docs section 5)');
  METAOBJECTS.forEach(([type, shape, usedBy], i) => {
    const count = data[`mo${i}`]?.nodes?.length ?? 0;
    print(
      count ? OK : INFO,
      `${type}: ${count ? `${count} ${shape === 'list' ? 'entries' : 'entry'}` : `none (${usedBy} uses the built-in copy)`}`,
    );
  });
  if (!METAOBJECTS.some((_, i) => data[`mo${i}`]?.nodes?.length)) {
    print(
      INFO,
      'No metaobjects are visible. Definitions must have "Storefront API access" switched on.',
    );
  }

  out('\nPages and policies (docs section 6)');
  print(
    data.about ? OK : INFO,
    `page "about": ${data.about ? data.about.title : 'none (the designed template renders without extra body text)'}`,
  );
  const pageHandles = (data.pages?.nodes ?? []).map((p) => p.handle);
  print(
    INFO,
    `${pageHandles.length} pages published: ${pageHandles.join(', ') || 'none'}`,
  );
  for (const field of POLICIES) {
    const policy = shop[field];
    const name = field.replace(/([A-Z])/g, '-$1').toLowerCase();
    if (policy)
      print(OK, `${name}: published in Shopify (/policies/${policy.handle})`);
    else if (field === 'subscriptionPolicy')
      print(INFO, `${name}: none (route hidden)`);
    else
      print(
        INFO,
        `${name}: not published; the storefront serves app/lib/content/policies.ts`,
      );
  }

  if (warnings.length) {
    out('\nStorefront API warnings');
    for (const message of warnings) print(INFO, message);
  }

  if (writeRequested) {
    writeDevVars(vars);
    out(`\nWrote ${DEV_VARS} (MOCK_STOREFRONT=false).`);
  }

  out(
    '\nNext: `npm run dev` serves this store on http://localhost:3000; `npm run deploy` publishes the Worker.\n',
  );
}

main().catch((error) => {
  console.error(`\n${MISSING} ${error.message}\n`);
  process.exit(1);
});
