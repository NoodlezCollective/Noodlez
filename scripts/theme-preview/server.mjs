// Local renderer for the {AppName} Shopify theme, fed by the storefront's mock
// catalog (app/lib/mock/data). Implements enough of Shopify Liquid (tags,
// filters, objects, section rendering API, cart AJAX API) to render and
// screenshot every template without a store. It is a parity tool, not a
// Shopify replacement: Shopify is the reference for anything it gets wrong.
//
//   npm run theme:preview            # http://localhost:3200
//   node scripts/theme-preview/server.mjs [theme folder]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import liquidjs from 'liquidjs';
const {Liquid, Value} = liquidjs;
import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const THEME = path.resolve(process.argv[2] ?? path.join(REPO, '{AppName}'));
const PUBLIC = path.join(REPO, 'public');
const PORT = Number(process.env.PORT ?? 3200);

// Bundle the storefront's mock seeds (TypeScript) for data.mjs.
const BUILD = path.join(HERE, '.build');
buildSync({
  entryPoints: [
    path.join(REPO, 'app/lib/mock/data/catalog.ts'),
    path.join(REPO, 'app/lib/mock/data/content.ts'),
  ],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  outdir: BUILD,
  outExtension: {'.js': '.cjs'},
  logLevel: 'warning',
});
const {buildData} = await import('./data.mjs');
const data = buildData();
const warnings = new Set();
const warn = (m) => {
  if (!warnings.has(m)) {
    warnings.add(m);
    console.error('[liquid-preview]', m);
  }
};

const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);
const sectionPath = (name) => path.join(THEME, 'sections', `${name}.liquid`);
const locales = exists(path.join(THEME, 'locales/en.default.json'))
  ? JSON.parse(read(path.join(THEME, 'locales/en.default.json')))
  : {};

// ---------- settings ----------
function loadSettings() {
  const schema = JSON.parse(
    read(path.join(THEME, 'config/settings_schema.json')),
  );
  const settings = {};
  for (const group of schema) {
    for (const s of group.settings ?? [])
      if (s.id && s.default !== undefined) settings[s.id] = s.default;
  }
  const dataFile = path.join(THEME, 'config/settings_data.json');
  if (exists(dataFile))
    Object.assign(settings, JSON.parse(read(dataFile)).current ?? {});
  return settings;
}

// ---------- schema parsing ----------
const schemaCache = new Map();
function sectionSchema(name) {
  if (schemaCache.has(name)) return schemaCache.get(name);
  const file = sectionPath(name);
  let schema = {settings: [], blocks: []};
  if (exists(file)) {
    const m = /{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/.exec(
      read(file),
    );
    if (m) {
      try {
        schema = JSON.parse(m[1]);
      } catch (e) {
        warn(`sections/${name}.liquid schema JSON invalid: ${e.message}`);
      }
    }
  }
  schemaCache.set(name, schema);
  return schema;
}
/** Shopify hands sections objects for resource settings (collection, product, page…); JSON stores handles. */
function resolveResources(settingsSchema = [], settings) {
  const out = {...settings};
  for (const s of settingsSchema ?? []) {
    const v = out[s.id];
    if (typeof v !== 'string' || !v) continue;
    if (s.type === 'collection') out[s.id] = data.collections.get(v) ?? null;
    else if (s.type === 'product') out[s.id] = data.products.get(v) ?? null;
    else if (s.type === 'page') out[s.id] = data.pages[v] ?? null;
    else if (s.type === 'blog') out[s.id] = null;
    else if (s.type === 'collection_list')
      out[s.id] = v
        .split(',')
        .map((h) => data.collections.get(h.trim()))
        .filter(Boolean);
    else if (s.type === 'product_list')
      out[s.id] = v
        .split(',')
        .map((h) => data.products.get(h.trim()))
        .filter(Boolean);
    else if (s.type === 'image_picker')
      out[s.id] = v.startsWith('shopify://') ? null : v;
    else if (s.type === 'url' && v.startsWith('shopify://'))
      out[s.id] = v.replace('shopify://', '/');
  }
  return out;
}
function defaultsOf(settingsSchema = []) {
  const out = {};
  for (const s of settingsSchema)
    if (s.id && s.default !== undefined) out[s.id] = s.default;
  return out;
}

// ---------- money / images ----------
const settingsGlobal = loadSettings();
function money(cents, withCurrency = false, trailing = true) {
  if (cents == null || cents === '') return '';
  const n = Number(cents) / 100;
  let amount = n.toFixed(2);
  if (!trailing && amount.endsWith('.00')) amount = amount.slice(0, -3);
  const fmt = withCurrency
    ? data.shop.money_with_currency_format
    : data.shop.money_format;
  return fmt
    .replace(/{{\s*amount\s*}}/, amount.replace(/\B(?=(\d{3})+(?!\d))/g, ','))
    .replace(/{{\s*amount_no_decimals\s*}}/, String(Math.round(n)));
}
function namedArgs(args) {
  const opts = {};
  const positional = [];
  for (const a of args) {
    if (Array.isArray(a) && a.length === 2 && typeof a[0] === 'string')
      opts[a[0]] = a[1];
    else positional.push(a);
  }
  return {opts, positional};
}
function imageSrc(img) {
  if (!img) return '';
  if (typeof img === 'string') return img;
  return img.src ?? img.url ?? img.preview_image?.src ?? '';
}
function imageUrl(img, opts = {}) {
  const src = imageSrc(img);
  if (!src) return '';
  const q = [];
  if (opts.width) q.push(`width=${opts.width}`);
  if (opts.height) q.push(`height=${opts.height}`);
  if (opts.crop) q.push(`crop=${opts.crop}`);
  return q.length
    ? `${src}${src.includes('?') ? '&' : '?'}${q.join('&')}`
    : src;
}
function attrs(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== false && v !== '')
    .map(([k, v]) => ` ${k}="${String(v).replace(/"/g, '&quot;')}"`)
    .join('');
}

// ---------- engine ----------
const engine = new Liquid({
  root: [path.join(THEME, 'snippets')],
  partials: [path.join(THEME, 'snippets')],
  extname: '.liquid',
  cache: false,
  strictFilters: false,
  strictVariables: false,
  lenientIf: true,
  outputEscape: undefined,
  relativeReference: false,
  jsTruthy: false,
  ownPropertyOnly: false,
});

// Filters
const F = (name, fn) => engine.registerFilter(name, fn);
F('money', (v) => money(v));
F('money_with_currency', (v) => money(v, true));
F('money_without_currency', (v) =>
  v == null ? '' : (Number(v) / 100).toFixed(2),
);
F('money_without_trailing_zeros', (v) => money(v, false, false));
F('handleize', (v) => data.handleize(v ?? ''));
F('handle', (v) => data.handleize(v ?? ''));
F('t', function (key, ...args) {
  const {opts} = namedArgs(args);
  let node = locales;
  for (const part of String(key).split('.')) node = node?.[part];
  let text =
    typeof node === 'string'
      ? node
      : String(key).split('.').pop().replace(/_/g, ' ');
  for (const [k, v] of Object.entries(opts))
    text = text.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v));
  return text;
});
F('asset_url', (v) => `/cdn/assets/${v}`);
F('asset_img_url', (v) => `/cdn/assets/${v}`);
F('file_url', (v) => `/cdn/files/${v}`);
F('file_img_url', (v) => `/cdn/files/${v}`);
F('img_url', (v, size) => {
  const m = /^(\d+)?x(\d+)?$/.exec(String(size ?? ''));
  return imageUrl(v, m ? {width: m[1], height: m[2]} : {});
});
F('image_url', (v, ...args) => imageUrl(v, namedArgs(args).opts));
F('image_tag', (src, ...args) => {
  const {opts} = namedArgs(args);
  const base = String(src ?? '');
  const clean = base.split('?')[0];
  const params = new URLSearchParams(base.split('?')[1] ?? '');
  const w = Number(params.get('width')) || undefined;
  const h = Number(params.get('height')) || undefined;
  let srcset;
  if (opts.widths) {
    const crop = params.get('crop');
    srcset = String(opts.widths)
      .split(',')
      .map((x) => Number(x.trim()))
      .filter(Boolean)
      .map((ww) => {
        const q = new URLSearchParams({width: String(ww)});
        if (h && w) q.set('height', String(Math.round((ww * h) / w)));
        if (crop) q.set('crop', crop);
        return `${clean}?${q} ${ww}w`;
      })
      .join(', ');
  }
  const a = {
    alt: opts.alt ?? '',
    decoding: opts.decoding,
    height: h,
    loading: opts.loading,
    sizes: opts.sizes,
    src: base,
    srcset,
    width: w,
    class: opts.class,
    style: opts.style,
    fetchpriority: opts.fetchpriority,
  };
  return `<img${attrs(a)}>`;
});
F(
  'stylesheet_tag',
  (v) => `<link href="${v}" rel="stylesheet" type="text/css" media="all">`,
);
F('script_tag', (v) => `<script src="${v}" type="text/javascript"></script>`);
F('preload_tag', () => '');
F('font_face', () => '');
F('font_url', () => '');
F('font_modify', (v) => v);
F('inline_asset_content', (v) => {
  const p = path.join(THEME, 'assets', String(v));
  return exists(p) ? read(p) : '';
});
F(
  'link_to',
  (text, url, ...args) =>
    `<a href="${url}"${attrs(namedArgs(args).opts)}>${text}</a>`,
);
F('within', (url, collection) =>
  collection?.handle ? `/collections/${collection.handle}${url}` : url,
);
F(
  'placeholder_svg_tag',
  (name, cls) =>
    `<svg class="${cls ?? ''}" viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="#e8e6f4"/></svg>`,
);
F('default_errors', (v) =>
  v
    ? `<ul class="form-errors">${(v.messages ?? []).map((m) => `<li>${m}</li>`).join('')}</ul>`
    : '',
);
F('default_pagination', () => '');
F(
  'time_tag',
  (v) =>
    `<time datetime="${v}">${v ? new Date(v).toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'}) : ''}</time>`,
);
F('highlight', (text, term) =>
  term
    ? String(text).replace(
        new RegExp(term, 'ig'),
        (m) => `<strong class="highlight">${m}</strong>`,
      )
    : text,
);
F('weight_with_unit', (v) => `${v} kg`);
F('format_address', (a) =>
  a
    ? [
        a.name,
        a.address1,
        a.address2,
        [a.city, a.province, a.zip].filter(Boolean).join(' '),
        a.country,
      ]
        .filter(Boolean)
        .join('<br>')
    : '',
);
F('structured_data', (v) =>
  JSON.stringify({'@type': 'Product', name: v?.title}),
);
F('media_tag', (m) => `<img src="${imageSrc(m)}" alt="${m?.alt ?? ''}">`);
F(
  'video_tag',
  (m) => `<video controls poster="${imageSrc(m?.preview_image)}"></video>`,
);
F(
  'external_video_tag',
  (m) => `<iframe src="${m?.external_id ?? ''}"></iframe>`,
);
F('external_video_url', (m) => m?.external_id ?? '');
F(
  'payment_type_svg_tag',
  (t) =>
    `<svg class="payment-icon" viewBox="0 0 38 24" aria-label="${t}"><rect width="38" height="24" rx="3" fill="#e3e2ef"/></svg>`,
);
F('payment_type_img_url', () => '');
F('customer_login_link', () => '<a href="/account/login">Log in</a>');
F('customer_logout_link', () => '<a href="/account/logout">Log out</a>');
F('sort_by', (url, v) => `${url}?sort_by=${v}`);
F('url_for_type', (t) => `/collections/types?q=${encodeURIComponent(t)}`);
F('url_for_vendor', (t) => `/collections/vendors?q=${encodeURIComponent(t)}`);
F('item_count_for_variant', (cart, id) =>
  (cart?.items ?? [])
    .filter((i) => i.id === Number(id))
    .reduce((a, b) => a + b.quantity, 0),
);
F('line_items_for', (cart, obj) =>
  (cart?.items ?? []).filter(
    (i) => i.product_id === obj?.id || i.id === obj?.id,
  ),
);
F('color_to_rgb', (v) => v);
F('color_modify', (v) => v);
F('color_lighten', (v) => v);
F('color_darken', (v) => v);
F('color_brightness', () => 128);
F('color_contrast', () => 4.5);
F('color_mix', (v) => v);
F('brightness_difference', () => 100);
F('color_extract', () => 0);
F('md5', (v) => String(v));
F('sha256', (v) => String(v));
F('hmac_sha256', (v) => String(v));
F('base64_encode', (v) => Buffer.from(String(v)).toString('base64'));
F('camelize', (v) =>
  String(v).replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')),
);
F('pluralize', (n, s, p) => (Number(n) === 1 ? s : p));
F('unit_price_with_measurement', (v) => money(v));
F('strip_newlines', (v) => String(v ?? '').replace(/\r?\n/g, ''));
F('escape_once', (v) =>
  String(v ?? '')
    .replace(/&(?!(amp|lt|gt|quot|#39);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;'),
);
F('json', (v) => JSON.stringify(stripInternal(v)));
F('class_list', (v) => (Array.isArray(v) ? v.join(' ') : String(v ?? '')));
F('image_tag_safe', (v) => v);
function stripInternal(v, depth = 0) {
  if (depth > 4 || v == null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => stripInternal(x, depth + 1));
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (k.startsWith('_') || typeof val === 'function') continue;
    if (
      [
        'collections',
        'variant',
        'product',
        'metafields',
        'options_with_values',
        'media',
      ].includes(k) &&
      depth > 0
    )
      continue;
    out[k] = stripInternal(val, depth + 1);
  }
  return out;
}

// Tags
const skipBlock = (end) => ({
  parse(token, remainTokens) {
    this.tokens = [];
    const stream = this.liquid.parser.parseStream(remainTokens);
    stream
      .on(`tag:${end}`, () => stream.stop())
      .on('token', (t) => this.tokens.push(t))
      .on('end', () => {
        throw new Error(`tag ${end} not closed`);
      });
    stream.start();
  },
  render() {
    return '';
  },
});
engine.registerTag('schema', skipBlock('endschema'));
engine.registerTag('javascript', skipBlock('endjavascript'));
engine.registerTag('stylesheet', skipBlock('endstylesheet'));
engine.registerTag('doc', skipBlock('enddoc'));
engine.registerTag('style', {
  parse(token, remainTokens) {
    this.templates = [];
    const stream = this.liquid.parser.parseStream(remainTokens);
    stream
      .on('tag:endstyle', () => stream.stop())
      .on('template', (t) => this.templates.push(t))
      .on('end', () => {
        throw new Error('endstyle missing');
      });
    stream.start();
  },
  *render(ctx, emitter) {
    const html = yield this.liquid.renderer.renderTemplates(
      this.templates,
      ctx,
    );
    emitter.write(`<style>${html}</style>`);
  },
});
engine.registerTag('layout', {
  parse(token) {
    this.arg = token.args.trim();
  },
  render(ctx) {
    ctx.globals.__layout = this.arg.replace(/^['"]|['"]$/g, '');
    return '';
  },
});
engine.registerTag('form', {
  parse(token, remainTokens) {
    this.args = token.args;
    this.templates = [];
    const stream = this.liquid.parser.parseStream(remainTokens);
    stream
      .on('tag:endform', () => stream.stop())
      .on('template', (t) => this.templates.push(t))
      .on('end', () => {
        throw new Error('endform missing');
      });
    stream.start();
  },
  *render(ctx, emitter) {
    const raw = this.args;
    const parts = raw.split(/,(?![^{}]*})/).map((s) => s.trim());
    const type = parts[0].replace(/^['"]|['"]$/g, '');
    const attributes = {};
    for (const p of parts.slice(1)) {
      // The optional object argument (product, cart, address…) is not needed here.
      const kv = /^([\w-]+)\s*:\s*(.+)$/.exec(p);
      if (kv)
        attributes[kv[1]] = yield new Value(kv[2], this.liquid).value(ctx);
    }
    const actions = {
      product: '/cart/add',
      cart: '/cart',
      customer: '/contact',
      contact: '/contact',
      customer_login: '/account/login',
      create_customer: '/account',
      recover_customer_password: '/account/recover',
      customer_address: '/account/addresses',
      activate_customer_password: '/account/activate',
      reset_customer_password: '/account/reset',
      storefront_password: '/password',
      new_comment: '/blogs/journal',
      localization: '/localization',
      currency: '/cart/update',
      guest_login: '/account/login',
    };
    const action = attributes.action ?? actions[type] ?? '/';
    delete attributes.action;
    const formObj = {
      errors: null,
      posted_successfully: false,
      email: '',
      first_name: '',
      last_name: '',
      address1: '',
      city: '',
      country: '',
      password_needed: true,
    };
    ctx.push({form: formObj});
    const inner = yield this.liquid.renderer.renderTemplates(
      this.templates,
      ctx,
    );
    ctx.pop();
    const extra =
      type === 'cart' ? '' : `<input type="hidden" name="utf8" value="✓">`;
    emitter.write(
      `<form method="post" action="${action}" accept-charset="UTF-8"${attrs(attributes)}><input type="hidden" name="form_type" value="${type}">${extra}${inner}</form>`,
    );
  },
});
engine.registerTag('paginate', {
  parse(token, remainTokens) {
    const m = /^(.+?)\s+by\s+(.+)$/.exec(token.args.trim());
    this.expr = m[1].trim();
    this.sizeExpr = m[2].trim();
    this.templates = [];
    const stream = this.liquid.parser.parseStream(remainTokens);
    stream
      .on('tag:endpaginate', () => stream.stop())
      .on('template', (t) => this.templates.push(t))
      .on('end', () => {
        throw new Error('endpaginate missing');
      });
    stream.start();
  },
  *render(ctx, emitter) {
    const items = (yield new Value(this.expr, this.liquid).value(ctx)) ?? [];
    const size =
      Number(yield new Value(this.sizeExpr, this.liquid).value(ctx)) || 12;
    const current = Number(ctx.globals.request?.page ?? 1) || 1;
    const pages = Math.max(1, Math.ceil(items.length / size));
    const slice = items.slice((current - 1) * size, current * size);
    const basePath = ctx.globals.request?.path ?? '/';
    const query = new URLSearchParams(ctx.globals.request?.query ?? '');
    const urlFor = (n) => {
      const q = new URLSearchParams(query);
      q.set('page', String(n));
      return `${basePath}?${q}`;
    };
    const paginate = {
      current_page: current,
      current_offset: (current - 1) * size,
      items: items.length,
      page_size: size,
      pages,
      next:
        current < pages
          ? {title: 'Next', url: urlFor(current + 1), is_link: true}
          : null,
      previous:
        current > 1
          ? {title: 'Previous', url: urlFor(current - 1), is_link: true}
          : null,
      parts: Array.from({length: pages}, (_, i) => ({
        title: String(i + 1),
        url: urlFor(i + 1),
        is_link: i + 1 !== current,
      })),
      page_param: 'page',
    };
    // Replace the paginated path in a child scope (collection.products → slice).
    const segs = this.expr.split('.');
    const scope = {paginate};
    if (segs.length === 2) {
      const root = ctx.get([segs[0]]);
      scope[segs[0]] = Object.assign(
        Object.create(Object.getPrototypeOf(root ?? {})),
        root,
        {[segs[1]]: slice},
      );
    } else if (segs.length === 1) {
      scope[segs[0]] = slice;
    }
    ctx.push(scope);
    const html = yield this.liquid.renderer.renderTemplates(
      this.templates,
      ctx,
    );
    ctx.pop();
    emitter.write(html);
  },
});
engine.registerTag('section', {
  parse(token) {
    this.name = token.args.trim().replace(/^['"]|['"]$/g, '');
  },
  *render(ctx, emitter) {
    emitter.write(yield* renderSection(this.name, this.name, {}, ctx.globals));
  },
});
engine.registerTag('sections', {
  parse(token) {
    this.name = token.args.trim().replace(/^['"]|['"]$/g, '');
  },
  *render(ctx, emitter) {
    emitter.write(yield* renderGroup(this.name, ctx.globals));
  },
});

// ---------- sections ----------
function* renderSection(type, id, config, env) {
  const file = sectionPath(type);
  if (!exists(file)) {
    warn(`missing section ${type}`);
    return `<!-- missing section ${type} -->`;
  }
  const schema = sectionSchema(type);
  const settings = resolveResources(schema.settings, {
    ...defaultsOf(schema.settings),
    ...(config.settings ?? {}),
  });
  const blockDefaults = Object.fromEntries(
    (schema.blocks ?? []).map((b) => [b.type, defaultsOf(b.settings)]),
  );
  const blockSchemas = Object.fromEntries(
    (schema.blocks ?? []).map((b) => [b.type, b.settings ?? []]),
  );
  const order = config.block_order ?? Object.keys(config.blocks ?? {});
  const blocks = order
    .map((bid) => {
      const b = config.blocks?.[bid];
      if (!b) return null;
      return {
        id: bid,
        type: b.type,
        settings: resolveResources(blockSchemas[b.type], {
          ...(blockDefaults[b.type] ?? {}),
          ...(b.settings ?? {}),
        }),
        shopify_attributes: `data-shopify-editor-block="{&quot;id&quot;:&quot;${bid}&quot;}"`,
      };
    })
    .filter(Boolean);
  if (config.disabled) return '';
  const section = {
    id,
    settings,
    blocks,
    index: 1,
    index0: 0,
    location: 'template',
  };
  const src = read(file).replace(
    /{%-?\s*schema\s*-?%}[\s\S]*?{%-?\s*endschema\s*-?%}/,
    '',
  );
  let html;
  try {
    html = yield engine.parseAndRender(src, {}, {globals: {...env, section}});
  } catch (e) {
    warn(`render error in sections/${type}.liquid: ${e.message}`);
    html = `<!-- render error in ${type}: ${e.message.replace(/-->/g, '')} -->`;
  }
  return `<div id="shopify-section-${id}" class="shopify-section">${html}</div>`;
}
function* renderGroup(name, env) {
  const file = path.join(THEME, 'sections', `${name}.json`);
  if (!exists(file)) {
    warn(`missing section group ${name}`);
    return '';
  }
  const group = JSON.parse(read(file));
  let out = '';
  for (const id of group.order ?? Object.keys(group.sections)) {
    const cfg = group.sections[id];
    out += yield* renderSection(cfg.type, id, cfg, env);
  }
  return out;
}
function* renderTemplate(name, env) {
  const json = path.join(THEME, 'templates', `${name}.json`);
  const liquid = path.join(THEME, 'templates', `${name}.liquid`);
  if (exists(json)) {
    const tpl = JSON.parse(read(json));
    let out = '';
    for (const id of tpl.order) {
      const cfg = tpl.sections[id];
      out += yield* renderSection(cfg.type, id, cfg, env);
    }
    return out;
  }
  if (exists(liquid))
    return yield engine.parseAndRender(read(liquid), {}, {globals: env});
  warn(`missing template ${name}`);
  return `<p>Missing template ${name}</p>`;
}
async function renderPage(templateName, env, {sectionsOnly, sectionId} = {}) {
  env.template = Object.assign(templateName.split('.')[0], {
    name: templateName.split('.')[0],
    suffix: templateName.split('.')[1] ?? null,
    directory: templateName.startsWith('customers/') ? 'customers' : null,
  });
  if (sectionId) {
    // Section rendering API for a single section: look it up in the template, groups, or as a static section.
    const cfg = findSectionConfig(templateName, sectionId);
    const html = await run(
      renderSection(cfg?.type ?? sectionId, sectionId, cfg ?? {}, env),
    );
    return {status: 200, type: 'text/html', body: html};
  }
  if (sectionsOnly) {
    const out = {};
    for (const id of sectionsOnly) {
      const cfg = findSectionConfig(templateName, id);
      out[id] = await run(renderSection(cfg?.type ?? id, id, cfg ?? {}, env));
    }
    return {status: 200, type: 'application/json', body: JSON.stringify(out)};
  }
  const content = await run(renderTemplate(templateName, env));
  const layoutName = env.__layout === 'none' ? null : (env.__layout ?? 'theme');
  if (!layoutName) return {status: 200, type: 'text/html', body: content};
  const layoutSrc = read(path.join(THEME, 'layout', `${layoutName}.liquid`));
  const html = await engine.parseAndRender(
    layoutSrc,
    {},
    {
      globals: {
        ...env,
        content_for_layout: content,
        content_for_header: '<!-- content_for_header -->',
      },
    },
  );
  return {status: 200, type: 'text/html', body: html};
}
function findSectionConfig(templateName, id) {
  const json = path.join(THEME, 'templates', `${templateName}.json`);
  if (exists(json)) {
    const tpl = JSON.parse(read(json));
    if (tpl.sections?.[id]) return tpl.sections[id];
  }
  for (const g of fs
    .readdirSync(path.join(THEME, 'sections'))
    .filter((f) => f.endsWith('.json'))) {
    const group = JSON.parse(read(path.join(THEME, 'sections', g)));
    if (group.sections?.[id]) return group.sections[id];
  }
  return null;
}
function run(gen) {
  // Drive a generator that yields promises (liquidjs style) to completion.
  return new Promise((resolve, reject) => {
    const step = (val) => {
      let r;
      try {
        r = gen.next(val);
      } catch (e) {
        return reject(e);
      }
      if (r.done) return resolve(r.value);
      Promise.resolve(r.value).then(step, (e) => {
        try {
          const r2 = gen.throw(e);
          if (r2.done) resolve(r2.value);
          else Promise.resolve(r2.value).then(step, reject);
        } catch (err) {
          reject(err);
        }
      });
    };
    step();
  });
}

// ---------- cart ----------
const cartState = {items: [], note: '', attributes: {}};
function cartObject() {
  const items = cartState.items.map((it, index) => {
    const product = data.productsById.get(it.productGid);
    const variant = product.variants.find((v) => v.id === it.id);
    const line = variant.price * it.quantity;
    return {
      key: `${variant.id}:${index}`,
      id: variant.id,
      variant_id: variant.id,
      product_id: product.id,
      quantity: it.quantity,
      title: product.has_only_default_variant
        ? product.title
        : `${product.title} - ${variant.title}`,
      product_title: product.title,
      variant_title: product.has_only_default_variant ? null : variant.title,
      price: variant.price,
      original_price: variant.compare_at_price ?? variant.price,
      final_price: variant.price,
      line_price: line,
      original_line_price:
        (variant.compare_at_price ?? variant.price) * it.quantity,
      final_line_price: line,
      image: variant.featured_image ?? product.featured_image,
      url: `${product.url}?variant=${variant.id}`,
      product,
      variant,
      sku: variant.sku,
      vendor: product.vendor,
      handle: product.handle,
      options_with_values: variant.selected_options.map((o) => ({
        name: o.name,
        value: o.value,
      })),
      properties: {},
      requires_shipping: true,
      taxable: true,
      index,
      line: index + 1,
      selling_plan_allocation: null,
      discounts: [],
      line_level_discount_allocations: [],
    };
  });
  const total = items.reduce((a, b) => a + b.final_line_price, 0);
  return {
    items,
    item_count: items.reduce((a, b) => a + b.quantity, 0),
    total_price: total,
    items_subtotal_price: total,
    original_total_price: items.reduce((a, b) => a + b.original_line_price, 0),
    total_discount: 0,
    currency: 'USD',
    requires_shipping: true,
    note: cartState.note,
    attributes: cartState.attributes,
    'empty?': items.length === 0,
    empty: items.length === 0,
    cart_level_discount_applications: [],
    discount_applications: [],
    checkout_url: '/checkout',
    taxes_included: false,
  };
}
function cartJson() {
  const c = cartObject();
  return {
    token: 'preview',
    note: c.note,
    attributes: c.attributes,
    total_price: c.total_price,
    original_total_price: c.original_total_price,
    items_subtotal_price: c.items_subtotal_price,
    total_discount: 0,
    item_count: c.item_count,
    currency: 'USD',
    requires_shipping: true,
    items: c.items.map((i) => ({
      id: i.id,
      key: i.key,
      quantity: i.quantity,
      title: i.title,
      product_title: i.product_title,
      variant_title: i.variant_title,
      price: i.price,
      line_price: i.line_price,
      final_line_price: i.final_line_price,
      original_line_price: i.original_line_price,
      url: i.url,
      image: imageSrc(i.image),
      handle: i.handle,
      product_id: i.product_id,
      variant_id: i.variant_id,
      options_with_values: i.options_with_values,
      properties: {},
    })),
  };
}
function findVariant(id) {
  for (const p of data.products.values()) {
    const v = p.variants.find((v) => String(v.id) === String(id));
    if (v) return {p, v};
  }
  return null;
}
function cartAdd(items) {
  for (const it of items) {
    const found = findVariant(it.id);
    if (!found) throw new Error(`Variant ${it.id} not found`);
    const existing = cartState.items.find((x) => x.id === found.v.id);
    if (existing) existing.quantity += Number(it.quantity ?? 1);
    else
      cartState.items.push({
        id: found.v.id,
        productGid: found.p.gid,
        quantity: Number(it.quantity ?? 1),
      });
  }
}
function cartChange({id, line, quantity}) {
  let index =
    line != null
      ? Number(line) - 1
      : cartState.items.findIndex(
          (x) => String(x.id) === String(id).split(':')[0],
        );
  if (index < 0 || !cartState.items[index]) return;
  const q = Number(quantity);
  if (q <= 0) cartState.items.splice(index, 1);
  else cartState.items[index].quantity = q;
}

// ---------- environment ----------
const routes = {
  root_url: '/',
  account_url: '/account',
  account_login_url: '/account/login',
  account_logout_url: '/account/logout',
  account_register_url: '/account/register',
  account_addresses_url: '/account/addresses',
  account_recover_url: '/account/recover',
  collections_url: '/collections',
  all_products_collection_url: '/collections/all',
  search_url: '/search',
  predictive_search_url: '/search/suggest',
  cart_url: '/cart',
  cart_add_url: '/cart/add',
  cart_change_url: '/cart/change',
  cart_clear_url: '/cart/clear',
  cart_update_url: '/cart/update',
  product_recommendations_url: '/recommendations/products',
  storefront_login_url: '/account/login',
};
function baseEnv(url, pageType) {
  const collectionsArray = [...data.collections.values()];
  for (const c of collectionsArray) collectionsArray[c.handle] = c;
  const allProducts = Object.fromEntries([...data.products.entries()]);
  const blogs = {
    journal: {
      handle: 'journal',
      title: 'Journal',
      url: '/blogs/journal',
      articles: [],
      articles_count: 0,
      all_tags: [],
    },
  };
  return {
    size: '',
    shop: data.shop,
    settings: settingsGlobal,
    routes,
    request: {
      page_type: pageType,
      path: url.pathname,
      host: 'localhost:3200',
      origin: 'http://localhost:3200',
      locale: {
        iso_code: 'en',
        name: 'English',
        endonym_name: 'English',
        root_url: '/',
      },
      design_mode: false,
      visual_preview_mode: false,
      query: url.search.slice(1),
      page: url.searchParams.get('page') ?? 1,
    },
    canonical_url: `http://localhost:3200${url.pathname}`,
    linklists: data.linklists,
    collections: collectionsArray,
    all_products: allProducts,
    pages: data.pages,
    blogs,
    cart: cartObject(),
    customer: null,
    localization: {
      country: {
        iso_code: 'US',
        name: 'United States',
        currency: {iso_code: 'USD', symbol: '$'},
      },
      language: {iso_code: 'en', name: 'English'},
      available_countries: [],
      available_languages: [],
    },
    current_tags: [],
    current_page: 1,
    page_title: data.shop.name,
    page_description: data.shop.description,
    powered_by_link: '',
    content_for_additional_checkout_buttons: '',
    additional_checkout_buttons: false,
    theme: {name: '{AppName}', id: 1, role: 'main'},
    images: {},
    metaobjects: Object.fromEntries(
      [...data.metaobjectsByType.entries()].map(([t, list]) => [
        t,
        Object.fromEntries(list.map((o) => [o.handle, o])),
      ]),
    ),
    predictive_search: null,
    recommendations: null,
    search: null,
  };
}
function sortProducts(list, sortBy) {
  const arr = [...list];
  switch (sortBy) {
    case 'best-selling':
      return arr.sort((a, b) => a.best_selling_rank - b.best_selling_rank);
    case 'title-ascending':
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    case 'title-descending':
      return arr.sort((a, b) => b.title.localeCompare(a.title));
    case 'price-ascending':
      return arr.sort((a, b) => a.price_min - b.price_min);
    case 'price-descending':
      return arr.sort((a, b) => b.price_min - a.price_min);
    case 'created-ascending':
      return arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    case 'created-descending':
      return arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
    default:
      return arr;
  }
}
function buildFilters(collection, products, url) {
  // Shopify-style filters: availability, price, product type, option values.
  const base = new URLSearchParams(url.search);
  const withParam = (k, v) => {
    const q = new URLSearchParams(base);
    q.append(k, v);
    q.delete('page');
    return `${url.pathname}?${q}`;
  };
  const withoutParam = (k, v) => {
    const q = new URLSearchParams();
    for (const [key, val] of base)
      if (!(key === k && (v === undefined || val === v))) q.append(key, val);
    return `${url.pathname}${q.size ? `?${q}` : ''}`;
  };
  const activeValues = (k) => base.getAll(k);
  const listFilter = (label, param, values) => {
    const vals = values.map(([value, label2, count]) => ({
      value,
      label: label2,
      count,
      active: activeValues(param).includes(value),
      param_name: param,
      url_to_add: withParam(param, value),
      url_to_remove: withoutParam(param, value),
      display_type: 'list',
    }));
    return {
      label,
      param_name: param,
      type: 'list',
      presentation: 'text',
      values: vals,
      active_values: vals.filter((v) => v.active),
      inactive_values: vals.filter((v) => !v.active),
      url_to_remove: withoutParam(param),
      operator: 'OR',
      false_value: null,
      true_value: null,
      min_value: null,
      max_value: null,
      range_max: null,
    };
  };
  const filters = [];
  const availableCount = products.filter((p) => p.available).length;
  const availability = listFilter('Availability', 'filter.v.availability', [
    ['1', 'In stock', availableCount],
    ['0', 'Out of stock', products.length - availableCount],
  ]);
  availability.type = 'boolean';
  availability.false_value = availability.values[1];
  availability.true_value = availability.values[0];
  filters.push(availability);
  const max = Math.max(0, ...products.map((p) => p.price_max));
  const minActive = base.get('filter.v.price.gte');
  const maxActive = base.get('filter.v.price.lte');
  filters.push({
    label: 'Price',
    param_name: 'filter.v.price',
    type: 'price_range',
    presentation: 'text',
    values: [],
    active_values: [],
    inactive_values: [],
    range_max: max,
    min_value: {
      param_name: 'filter.v.price.gte',
      value: minActive != null ? Number(minActive) * 100 : null,
    },
    max_value: {
      param_name: 'filter.v.price.lte',
      value: maxActive != null ? Number(maxActive) * 100 : null,
    },
    url_to_remove:
      withoutParam('filter.v.price.gte') && withoutParam('filter.v.price.lte'),
    operator: 'AND',
  });
  const types = new Map();
  for (const p of products) types.set(p.type, (types.get(p.type) ?? 0) + 1);
  filters.push(
    listFilter(
      'Product type',
      'filter.p.product_type',
      [...types.entries()].map(([t, c]) => [t, t, c]),
    ),
  );
  const options = new Map();
  for (const p of products)
    for (const o of p.options_with_values) {
      const m = options.get(o.name) ?? new Map();
      for (const v of o.values) m.set(v.name, (m.get(v.name) ?? 0) + 1);
      options.set(o.name, m);
    }
  for (const [name, vals] of options) {
    const f = listFilter(
      name,
      `filter.v.option.${data.handleize(name)}`,
      [...vals.entries()].map(([v, c]) => [v, v, c]),
    );
    const swatches = new Map();
    for (const p of products)
      for (const o of p.options_with_values)
        if (o.name === name)
          for (const v of o.values)
            if (v.swatch?.color) swatches.set(v.name, v.swatch.color);
    if (swatches.size) {
      f.presentation = 'swatch';
      for (const v of f.values) {
        v.display_type = 'swatch';
        v.swatch = swatches.has(v.label)
          ? {color: swatches.get(v.label), image: null}
          : null;
      }
    }
    filters.push(f);
  }
  return filters;
}
function applyFilters(products, url) {
  let list = products;
  const q = url.searchParams;
  const availability = q.getAll('filter.v.availability');
  if (availability.length === 1)
    list = list.filter((p) =>
      availability[0] === '1' ? p.available : !p.available,
    );
  const types = q.getAll('filter.p.product_type');
  if (types.length) list = list.filter((p) => types.includes(p.type));
  const gte = q.get('filter.v.price.gte');
  const lte = q.get('filter.v.price.lte');
  if (gte) list = list.filter((p) => p.price_max >= Number(gte) * 100);
  if (lte) list = list.filter((p) => p.price_min <= Number(lte) * 100);
  for (const [key, val] of q) {
    if (key.startsWith('filter.v.option.')) {
      const opt = key.slice('filter.v.option.'.length);
      list = list.filter((p) =>
        p.options_with_values.some(
          (o) =>
            data.handleize(o.name) === opt &&
            o.values.some((v) => v.name === val),
        ),
      );
    }
  }
  return list;
}
function searchProducts(term) {
  const t = term.trim().toLowerCase();
  if (!t) return [];
  return [...data.products.values()].filter((p) =>
    [p.title, p.description_text, p.type, ...p.tags]
      .join(' ')
      .toLowerCase()
      .includes(t),
  );
}

// ---------- router ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const send = (status, type, body) => {
    res.writeHead(status, {
      'content-type':
        type.startsWith('text') || type.includes('json')
          ? `${type}; charset=utf-8`
          : type,
    });
    res.end(body);
  };
  const body = await new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c)).on('end', () => resolve(b));
  });
  const parseBody = () => {
    if (!body) return {};
    try {
      return req.headers['content-type']?.includes('json')
        ? JSON.parse(body)
        : Object.fromEntries(new URLSearchParams(body));
    } catch {
      return {};
    }
  };

  // Static assets.
  if (url.pathname.startsWith('/cdn/assets/')) {
    const file = path.join(THEME, 'assets', path.basename(url.pathname));
    if (!exists(file)) return send(404, 'text/plain', 'missing asset');
    const ext = path.extname(file);
    const types = {
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.woff2': 'font/woff2',
    };
    return send(
      200,
      types[ext] ?? 'application/octet-stream',
      fs.readFileSync(file),
    );
  }
  if (url.pathname.startsWith('/images/')) {
    const file = path.join(PUBLIC, url.pathname.split('?')[0]);
    if (!exists(file)) return send(404, 'text/plain', 'missing image');
    return send(200, 'image/svg+xml', fs.readFileSync(file));
  }
  if (url.pathname === '/favicon.ico') return send(204, 'text/plain', '');

  // Cart AJAX API.
  if (url.pathname === '/cart.js')
    return send(200, 'application/json', JSON.stringify(cartJson()));
  if (url.pathname === '/cart/add.js' || url.pathname === '/cart/add') {
    const b = parseBody();
    try {
      const items = b.items ?? [{id: b.id, quantity: b.quantity ?? 1}];
      cartAdd(items);
    } catch (e) {
      return send(
        422,
        'application/json',
        JSON.stringify({
          status: 422,
          message: 'Cart Error',
          description: e.message,
        }),
      );
    }
    if (url.pathname === '/cart/add') {
      res.writeHead(302, {location: '/cart'});
      return res.end();
    }
    if (b.sections) {
      const env = baseEnv(url, 'cart');
      const out = {};
      for (const id of String(b.sections).split(',')) {
        const cfg = findSectionConfig('cart', id);
        out[id] = await run(renderSection(cfg?.type ?? id, id, cfg ?? {}, env));
      }
      return send(
        200,
        'application/json',
        JSON.stringify({...cartJson(), sections: out}),
      );
    }
    return send(200, 'application/json', JSON.stringify(cartJson()));
  }
  if (
    url.pathname === '/cart/change.js' ||
    url.pathname === '/cart/update.js' ||
    url.pathname === '/cart/clear.js' ||
    url.pathname === '/cart/change' ||
    url.pathname === '/cart/update'
  ) {
    const b = parseBody();
    if (url.pathname.startsWith('/cart/clear')) cartState.items = [];
    else if (b.updates) {
      for (const [k, v] of Object.entries(b.updates))
        cartChange({id: k, quantity: v});
    } else cartChange(b);
    if (url.pathname === '/cart/change' || url.pathname === '/cart/update') {
      res.writeHead(302, {location: '/cart'});
      return res.end();
    }
    if (b.sections) {
      const env = baseEnv(url, 'cart');
      const out = {};
      for (const id of String(b.sections).split(',')) {
        const cfg = findSectionConfig('cart', id);
        out[id] = await run(renderSection(cfg?.type ?? id, id, cfg ?? {}, env));
      }
      return send(
        200,
        'application/json',
        JSON.stringify({...cartJson(), sections: out}),
      );
    }
    return send(200, 'application/json', JSON.stringify(cartJson()));
  }
  if (url.pathname === '/cart' && req.method === 'POST') {
    const b = parseBody();
    // {% form 'cart' %} posts updates[] by line.
    for (const [k, v] of Object.entries(b)) {
      const m = /^updates\[(\d+)\]$/.exec(k);
      if (m) cartChange({line: Number(m[1]) + 1, quantity: v});
    }
    res.writeHead(302, {location: '/cart'});
    return res.end();
  }

  // Pages.
  const sectionsOnly = url.searchParams.get('sections')?.split(',');
  const sectionId = url.searchParams.get('section_id');
  const opts = {sectionsOnly, sectionId};
  const p = url.pathname.replace(/\/$/, '') || '/';
  let env;
  try {
    if (p === '/') {
      env = baseEnv(url, 'index');
      env.page_title = data.shop.name;
      return respond(await renderPage('index', env, opts));
    }
    if (p === '/collections') {
      env = baseEnv(url, 'list-collections');
      env.page_title = 'Collections';
      return respond(await renderPage('list-collections', env, opts));
    }
    let m;
    if ((m = /^\/collections\/([^/]+)(?:\/(.+))?$/.exec(p))) {
      const handle = m[1];
      let collection = data.collections.get(handle);
      if (!collection && handle === 'all')
        collection = data.collections.get('all');
      if (!collection) return respond(await notFound(url));
      env = baseEnv(url, 'collection');
      const sortBy =
        url.searchParams.get('sort_by') ?? collection.default_sort_by;
      const filtered = applyFilters(collection.products, url);
      env.collection = {
        ...collection,
        products: sortProducts(filtered, sortBy),
        products_count: filtered.length,
        sort_by: sortBy,
        filters: buildFilters(collection, collection.products, url),
        toString: () => collection.title,
      };
      env.page_title = collection.title;
      return respond(await renderPage('collection', env, opts));
    }
    if ((m = /^\/products\/([^/]+)$/.exec(p))) {
      const product = data.products.get(m[1]);
      if (!product) return respond(await notFound(url));
      env = baseEnv(url, 'product');
      const variantId = url.searchParams.get('variant');
      const selected = variantId
        ? product.variants.find((v) => String(v.id) === variantId)
        : null;
      const optionsWithValues = product.options_with_values.map((o, i) => ({
        ...o,
        selected_value: (
          selected ?? product.selected_or_first_available_variant
        )?.options[i],
        values: o.values.map((v) =>
          Object.assign(Object.create(Object.getPrototypeOf(v)), v, {
            selected:
              (selected ?? product.selected_or_first_available_variant)
                ?.options[i] === v.name,
          }),
        ),
      }));
      env.product = {
        ...product,
        selected_variant: selected,
        selected_or_first_available_variant:
          selected ?? product.selected_or_first_available_variant,
        options_with_values: optionsWithValues,
        toString: () => product.title,
      };
      env.page_title = product.title;
      env.page_description = product.description_text;
      return respond(await renderPage('product', env, opts));
    }
    if (p === '/recommendations/products') {
      const pid = url.searchParams.get('product_id');
      const limit = Number(url.searchParams.get('limit') ?? 4);
      const source = [...data.products.values()].find(
        (x) => String(x.id) === String(pid),
      );
      const pool = [...data.products.values()].filter((x) => x !== source);
      const related = source
        ? [
            ...pool.filter((x) => x.type === source.type),
            ...pool.filter((x) => x.type !== source.type),
          ]
        : pool;
      env = baseEnv(url, 'product');
      env.product = source ?? null;
      env.recommendations = {
        performed: true,
        products: related.slice(0, limit),
        products_count: Math.min(limit, related.length),
        intent: url.searchParams.get('intent') ?? 'related',
      };
      return respond(
        await renderPage('product', env, {
          sectionId: sectionId ?? 'recommended-products',
        }),
      );
    }
    if (p === '/search/suggest') {
      const q = url.searchParams.get('q') ?? '';
      const limit = Number(url.searchParams.get('resources[limit]') ?? 4);
      env = baseEnv(url, 'search');
      env.predictive_search = {
        performed: true,
        terms: q,
        resources: {
          products: searchProducts(q).slice(0, limit),
          collections: [],
          pages: [],
          articles: [],
          queries: [],
        },
      };
      return respond(
        await renderPage('search', env, {
          sectionId: sectionId ?? 'predictive-search',
        }),
      );
    }
    if (p === '/search') {
      const q = url.searchParams.get('q') ?? '';
      env = baseEnv(url, 'search');
      const results = sortProducts(
        searchProducts(q),
        url.searchParams.get('sort_by') ?? 'relevance',
      );
      env.search = {
        performed: q !== '',
        terms: q,
        results,
        results_count: results.length,
        types: ['product'],
        sort_by: url.searchParams.get('sort_by') ?? 'relevance',
        default_sort_by: 'relevance',
        sort_options: [{name: 'Relevance', value: 'relevance'}],
        filters: q ? buildFilters(null, results, url) : [],
      };
      env.page_title = q
        ? `Search: ${results.length} results found for "${q}"`
        : 'Search';
      return respond(await renderPage('search', env, opts));
    }
    if (p === '/cart') {
      env = baseEnv(url, 'cart');
      env.page_title = 'Your cart';
      return respond(await renderPage('cart', env, opts));
    }
    if ((m = /^\/pages\/([^/]+)$/.exec(p))) {
      const handle = m[1];
      let page = data.pages[handle];
      let template = 'page';
      const policyHandles = [
        'privacy-policy',
        'terms-of-service',
        'refund-policy',
        'shipping-policy',
        'contact-information',
        'legal-notice',
      ];
      if (!page && policyHandles.includes(handle)) {
        const policy = data.policies[handle];
        page = {
          id: handle,
          handle,
          title: policy?.title ?? handle,
          content: '',
          url: `/pages/${handle}`,
          template_suffix: 'policy',
          metafields: {},
        };
      }
      if (!page && handle === 'policies')
        page = {
          id: 'policies',
          handle,
          title: 'Policies',
          content: '',
          url: '/pages/policies',
          template_suffix: 'policies',
          metafields: {},
        };
      if (!page) return respond(await notFound(url));
      if (handle === 'about') template = 'page.about';
      if (page.template_suffix) template = `page.${page.template_suffix}`;
      if (
        !exists(path.join(THEME, 'templates', `${template}.json`)) &&
        !exists(path.join(THEME, 'templates', `${template}.liquid`))
      )
        template = 'page';
      env = baseEnv(url, 'page');
      env.page = page;
      env.page_title = page.title;
      return respond(await renderPage(template, env, opts));
    }
    if ((m = /^\/policies\/([^/]+)$/.exec(p))) {
      // Shopify renders policies itself inside the layout with fixed markup.
      const policy = data.policies[m[1]];
      if (!policy) return respond(await notFound(url));
      env = baseEnv(url, 'policy');
      env.page_title = policy.title;
      const layoutSrc = read(path.join(THEME, 'layout/theme.liquid'));
      const html = await engine.parseAndRender(
        layoutSrc,
        {},
        {
          globals: {
            ...env,
            content_for_layout: `<div class="shopify-policy__container"><div class="shopify-policy__title"><h1>${policy.title}</h1></div><div class="shopify-policy__body">${policy.body}</div></div>`,
            content_for_header: '',
          },
        },
      );
      return respond({status: 200, type: 'text/html', body: html});
    }
    if (p === '/blogs' || /^\/blogs\/[^/]+$/.test(p)) {
      env = baseEnv(url, 'blog');
      env.blog = env.blogs.journal;
      env.page_title = 'Journal';
      return respond(await renderPage('blog', env, opts));
    }
    if (p === '/account' || p.startsWith('/account/')) {
      const map = {
        '/account': 'customers/account',
        '/account/login': 'customers/login',
        '/account/register': 'customers/register',
        '/account/addresses': 'customers/addresses',
        '/account/recover': 'customers/login',
      };
      env = baseEnv(url, 'customers/account');
      if (p === '/account') {
        // Logged-out visitors are sent to the login page, as Shopify does.
        env = baseEnv(url, 'customers/login');
        return respond(await renderPage('customers/login', env, opts));
      }
      const t = map[p] ?? 'customers/login';
      env.request.page_type = t;
      return respond(await renderPage(t, env, opts));
    }
    if (p === '/password') {
      env = baseEnv(url, 'password');
      env.__layout = 'password';
      return respond(await renderPage('password', env, opts));
    }
    if (p === '/gift_cards/preview') {
      env = baseEnv(url, 'gift_card');
      env.gift_card = {
        code: 'ABCD-EFGH-IJKL-MNOP',
        balance: 5000,
        initial_value: 5000,
        currency: 'USD',
        enabled: true,
        expired: false,
        expires_on: null,
        qr_identifier: 'preview',
        url: '/gift_cards/preview',
        product: null,
        pass_url: null,
      };
      return respond(await renderPage('gift_card', env, opts));
    }
    return respond(await notFound(url));
  } catch (e) {
    console.error(e);
    return send(500, 'text/plain', `Render error: ${e.stack}`);
  }
  function respond(r) {
    send(r.status, r.type, r.body);
  }
}
async function notFound(url) {
  const env = baseEnv(url, '404');
  env.page_title = 'Page not found';
  const r = await renderPage('404', env, {});
  return {...r, status: 404};
}

http
  .createServer((req, res) =>
    handle(req, res).catch((e) => {
      res.writeHead(500);
      res.end(String(e.stack));
    }),
  )
  .listen(PORT, () =>
    console.log(`liquid preview of ${THEME} on http://localhost:${PORT}`),
  );
