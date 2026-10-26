// Builds Liquid-shaped objects (product, collection, linklists, pages,
// metaobjects, shop, cart) from the storefront's mock seeds so the theme can
// be rendered locally. Prices are cents, like Shopify Liquid.
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const catalog = require('./.build/catalog.cjs');
const content = require('./.build/content.cjs');

const STORE_URL = catalog.STORE_URL;
const cents = (n) => (n == null ? null : Math.round(Number(n) * 100));
const relative = (url) => (url ? url.replace(STORE_URL, '') || '/' : '/');
const handleize = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function image(seed, alt) {
  if (!seed) return null;
  return {
    id: seed.id,
    src: seed.url,
    url: seed.url,
    alt: alt ?? seed.altText ?? '',
    width: seed.width,
    height: seed.height,
    aspect_ratio: seed.width && seed.height ? seed.width / seed.height : 1,
    media_type: 'image',
    toString() {
      return seed.url;
    },
  };
}

/** Metafield value shaped like Liquid's `metafield.value` for the given type. */
function metafieldValue(mf, refs) {
  const t = mf.type;
  const raw = mf.value;
  if (t === 'rating') {
    const j = JSON.parse(raw);
    return {
      rating: Number(j.value),
      scale_min: Number(j.scale_min),
      scale_max: Number(j.scale_max),
    };
  }
  if (t === 'number_integer' || t === 'number_decimal') return Number(raw);
  if (t === 'json') return JSON.parse(raw);
  if (t === 'boolean') return raw === 'true';
  if (t.startsWith('list.')) {
    const arr = JSON.parse(raw);
    if (t.endsWith('_reference'))
      return arr.map((id) => refs(id)).filter(Boolean);
    if (t === 'list.rating')
      return arr.map((j) => ({
        rating: Number(j.value),
        scale_max: Number(j.scale_max),
      }));
    return arr;
  }
  if (t.endsWith('_reference')) return refs(raw);
  if (t === 'multi_line_text_field') return raw;
  if (t === 'rich_text_field') return raw;
  return raw;
}

function buildMetafields(list, refs) {
  const out = {};
  for (const mf of list) {
    out[mf.namespace] ??= {};
    let value;
    try {
      value = metafieldValue(mf, refs);
    } catch {
      value = mf.value;
    }
    out[mf.namespace][mf.key] = {
      value,
      type: mf.type,
      namespace: mf.namespace,
      key: mf.key,
      toString() {
        return typeof value === 'string' ? value : JSON.stringify(value);
      },
    };
  }
  return out;
}

let nextVariantId = 40000000001;
export function buildData() {
  const products = new Map();
  const productsById = new Map();
  const metaobjectsById = new Map();
  const metaobjectsByType = new Map();

  // Metaobjects first (products reference reviews; metaobjects reference products).
  const metaobjectSeeds = content.METAOBJECT_SEEDS;
  const mediaImages = new Map(
    content.MEDIA_IMAGE_SEEDS.map((m) => [m.id, image(m.image)]),
  );
  const refs = (id) =>
    productsById.get(id) ??
    metaobjectsById.get(id) ??
    mediaImages.get(id) ??
    null;

  for (const seed of metaobjectSeeds) {
    const obj = {
      id: seed.id,
      handle: seed.handle,
      type: seed.type,
      system: {id: seed.id, handle: seed.handle, type: seed.type},
    };
    metaobjectsById.set(seed.id, obj);
    metaobjectsByType.set(seed.type, [
      ...(metaobjectsByType.get(seed.type) ?? []),
      obj,
    ]);
  }

  for (const seed of catalog.PRODUCT_SEEDS) {
    const images = seed.images.map((img) => image(img));
    const media = images.map((img, i) => ({
      id: img.id,
      position: i + 1,
      media_type: 'image',
      preview_image: img,
      alt: img.alt,
      src: img.src,
      width: img.width,
      height: img.height,
    }));
    const variants = seed.variants.map((v) => {
      const img = v.imageIndex != null ? images[v.imageIndex] : images[0];
      const opts = v.selectedOptions.map((o) => o.value);
      const numericId = nextVariantId++;
      return {
        id: numericId,
        gid: v.id,
        title: opts.join(' / '),
        price: cents(v.price),
        compare_at_price: cents(v.compareAtPrice),
        available: v.availableForSale !== false,
        inventory_quantity: v.quantityAvailable ?? 0,
        sku: v.sku ?? '',
        options: opts,
        option1: opts[0] ?? null,
        option2: opts[1] ?? null,
        option3: opts[2] ?? null,
        featured_image: img,
        featured_media: media.find((m) => m.id === img?.id) ?? null,
        image: img,
        url: `/products/${seed.handle}?variant=${numericId}`,
        requires_shipping: true,
        taxable: true,
        weight: 0,
        selected_options: v.selectedOptions,
      };
    });
    const prices = variants.map((v) => v.price);
    const compares = variants
      .map((v) => v.compare_at_price)
      .filter((v) => v != null);
    const first = variants.find((v) => v.available) ?? variants[0];
    const product = {
      id: Number(String(seed.id).replace(/\D/g, '')) || seed.handle,
      gid: seed.id,
      handle: seed.handle,
      object_type: 'product',
      title: seed.title,
      url: `/products/${seed.handle}`,
      vendor: seed.vendor,
      type: seed.productType,
      tags: seed.tags,
      description: seed.descriptionHtml,
      content: seed.descriptionHtml,
      description_text: seed.description,
      available: variants.some((v) => v.available),
      price: Math.min(...prices),
      price_min: Math.min(...prices),
      price_max: Math.max(...prices),
      price_varies: Math.min(...prices) !== Math.max(...prices),
      compare_at_price: compares.length ? Math.min(...compares) : null,
      compare_at_price_min: compares.length ? Math.min(...compares) : null,
      compare_at_price_max: compares.length ? Math.max(...compares) : null,
      featured_image: images[0] ?? null,
      featured_media: media[0] ?? null,
      images,
      media,
      variants,
      first_available_variant: first,
      selected_or_first_available_variant: first,
      selected_variant: null,
      has_only_default_variant:
        seed.options.length === 0 ||
        (seed.options.length === 1 &&
          seed.options[0].values.length === 1 &&
          seed.options[0].values[0].name === 'Default Title'),
      options: seed.options.map((o) => o.name),
      options_with_values: seed.options.map((o, position) => ({
        name: o.name,
        position: position + 1,
        selected_value: first?.options[position] ?? null,
        values: o.values.map((val) => {
          const variant = variants.find(
            (v) => v.options[position] === val.name,
          );
          const anyAvailable = variants.some(
            (v) => v.options[position] === val.name && v.available,
          );
          return {
            name: val.name,
            id: handleize(`${o.name}-${val.name}`),
            available: anyAvailable,
            selected: first?.options[position] === val.name,
            swatch: val.swatchColor
              ? {color: val.swatchColor, image: null}
              : null,
            variant,
            product_url: `/products/${seed.handle}`,
            toString() {
              return val.name;
            },
            valueOf() {
              return val.name;
            },
          };
        }),
      })),
      collections: [],
      created_at: seed.createdAt,
      published_at: seed.createdAt,
      best_selling_rank: seed.bestSellingRank,
      metafields: {},
      _seed: seed,
      toString() {
        return seed.title;
      },
    };
    products.set(seed.handle, product);
    productsById.set(seed.id, product);
  }

  // Metaobject fields (may reference products and media images).
  for (const seed of metaobjectSeeds) {
    const obj = metaobjectsById.get(seed.id);
    for (const f of seed.fields) {
      let value = f.value;
      if (f.type.endsWith('_reference')) {
        if (f.type.startsWith('list.')) {
          value = (f.references ?? []).map(refs).filter(Boolean);
        } else {
          value = refs(f.reference ?? f.value) ?? null;
        }
      } else if (f.type.startsWith('list.')) {
        try {
          value = JSON.parse(f.value ?? '[]');
        } catch {
          value = [];
        }
      } else if (f.type === 'rating' && f.value) {
        const j = JSON.parse(f.value);
        value = {
          rating: Number(j.value),
          scale_min: Number(j.scale_min),
          scale_max: Number(j.scale_max),
        };
      } else if (f.type === 'number_decimal' || f.type === 'number_integer') {
        value = f.value == null ? null : Number(f.value);
      } else if (f.type === 'boolean') {
        value = f.value === 'true';
      }
      obj[f.key] = {
        value,
        type: f.type,
        toString() {
          return typeof value === 'string'
            ? value
            : value == null
              ? ''
              : JSON.stringify(value);
        },
      };
    }
  }

  // Product metafields (reference reviews and products).
  for (const product of products.values()) {
    product.metafields = buildMetafields(product._seed.metafields, refs);
  }

  // Collections.
  const collections = new Map();
  for (const seed of catalog.COLLECTION_SEEDS) {
    let items = [...products.values()].filter(
      (p) => p._seed.collections.includes(seed.handle) || seed.handle === 'all',
    );
    if (seed.productOrder) {
      items.sort(
        (a, b) =>
          seed.productOrder.indexOf(a.handle) -
          seed.productOrder.indexOf(b.handle),
      );
    } else if (seed.handle === 'all') {
      items.sort((a, b) => a.best_selling_rank - b.best_selling_rank);
    }
    const collection = {
      id: seed.id,
      handle: seed.handle,
      title: seed.title,
      url: `/collections/${seed.handle}`,
      description: seed.descriptionHtml,
      image: image(seed.image),
      featured_image: image(seed.image),
      products: items,
      all_products_count: items.length,
      products_count: items.length,
      all_tags: [...new Set(items.flatMap((p) => p.tags))],
      all_types: [...new Set(items.map((p) => p.type))],
      all_vendors: [...new Set(items.map((p) => p.vendor))],
      sort_by: '',
      default_sort_by: 'manual',
      sort_options: [
        {name: 'Featured', value: 'manual'},
        {name: 'Best selling', value: 'best-selling'},
        {name: 'Alphabetically, A-Z', value: 'title-ascending'},
        {name: 'Alphabetically, Z-A', value: 'title-descending'},
        {name: 'Price, low to high', value: 'price-ascending'},
        {name: 'Price, high to low', value: 'price-descending'},
        {name: 'Date, old to new', value: 'created-ascending'},
        {name: 'Date, new to old', value: 'created-descending'},
      ],
      filters: [],
      current_type: null,
      current_vendor: null,
      template_suffix: null,
      metafields: {},
      toString() {
        return seed.title;
      },
    };
    collections.set(seed.handle, collection);
    for (const p of items) p.collections.push(collection);
  }

  // Menus.
  const linklists = {};
  const toLink = (item) => ({
    title: item.title,
    url: relative(item.url),
    type: (item.type ?? 'http').toLowerCase() + '_link',
    active: false,
    child_active: false,
    current: false,
    child_current: false,
    handle: handleize(item.title),
    levels: item.items?.length ? 1 : 0,
    links: (item.items ?? []).map(toLink),
    object: null,
  });
  for (const menu of catalog.MENU_SEEDS) {
    linklists[menu.handle] = {
      handle: menu.handle,
      title: menu.title,
      levels: menu.items.some((i) => i.items?.length) ? 2 : 1,
      links: menu.items.map(toLink),
    };
  }

  // Pages and policies.
  const pages = {};
  for (const seed of catalog.PAGE_SEEDS) {
    pages[seed.handle] = {
      id: seed.id,
      handle: seed.handle,
      title: seed.title,
      content: seed.body,
      url: `/pages/${seed.handle}`,
      published_at: seed.createdAt,
      template_suffix: null,
      author: '',
      metafields: {},
    };
  }
  const policies = {};
  for (const seed of catalog.POLICY_SEEDS) {
    policies[seed.handle] = {
      id: seed.id,
      title: seed.title,
      body: seed.body,
      url: `/policies/${seed.handle}`,
      handle: seed.handle,
    };
  }

  const shop = {
    name: '{AppName}',
    email: 'hello@example.com',
    domain: 'ynvg9n-mw.myshopify.com',
    permanent_domain: 'ynvg9n-mw.myshopify.com',
    url: 'http://localhost:3200',
    secure_url: 'http://localhost:3200',
    description:
      'Pillows that align. Comforters that adapt. Smarter sleep essentials, designed for every night.',
    currency: 'USD',
    money_format: '${{amount}}',
    money_with_currency_format: '${{amount}} USD',
    enabled_currencies: [{iso_code: 'USD', symbol: '$'}],
    enabled_payment_types: [
      'visa',
      'master',
      'american_express',
      'paypal',
      'shopify_pay',
    ],
    privacy_policy: policies['privacy-policy'] ?? null,
    refund_policy: policies['refund-policy'] ?? null,
    shipping_policy: policies['shipping-policy'] ?? null,
    terms_of_service: policies['terms-of-service'] ?? null,
    subscription_policy: null,
    policies: Object.values(policies),
    brand: {logo: null, short_description: '', slogan: ''},
    customer_accounts_enabled: true,
    customer_accounts_optional: true,
    metafields: {},
    types: [...new Set([...products.values()].map((p) => p.type))],
    vendors: [...new Set([...products.values()].map((p) => p.vendor))],
    products_count: products.size,
    collections_count: collections.size,
  };

  return {
    products,
    productsById,
    collections,
    linklists,
    pages,
    policies,
    shop,
    metaobjectsByType,
    metaobjectsById,
    handleize,
  };
}
