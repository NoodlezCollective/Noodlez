/**
 * Builds the in-memory object graph the development mock executes GraphQL
 * queries against. Objects follow the Storefront API shapes; fields that take
 * arguments are functions (graphql-js calls them with the field arguments).
 */
import {
  COLLECTION_SEEDS,
  MENU_SEEDS,
  PAGE_SEEDS,
  POLICY_SEEDS,
  PRODUCT_SEEDS,
  STORE_URL,
} from './data/catalog';
import {MEDIA_IMAGE_SEEDS, METAOBJECT_SEEDS} from './data/content';
import type {
  CollectionSeed,
  ImageSeed,
  MenuItemSeed,
  MetafieldSeed,
  MetaobjectSeed,
  ProductSeed,
} from './data/types';

export type GqlObject = Record<string, any>;

export type PaginationArgs = {
  first?: number | null;
  last?: number | null;
  after?: string | null;
  before?: string | null;
};

const NOW = '2026-10-01T12:00:00Z';

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

export function money(amount: number) {
  return {
    __typename: 'MoneyV2',
    amount: (Math.round(amount * 100) / 100).toFixed(2),
    currencyCode: 'USD',
  };
}

const encodeCursor = (index: number) => btoa(`cursor:${index}`);
const decodeCursor = (cursor: string) =>
  Number.parseInt(atob(cursor).replace('cursor:', ''), 10);

/** Relay-style connection with cursor pagination. */
export function connection<T>(
  items: T[],
  args: PaginationArgs = {},
  extra: GqlObject = {},
) {
  let start = 0;
  let end = items.length;
  if (args.after) start = Math.min(items.length, decodeCursor(args.after) + 1);
  if (args.before) end = Math.max(0, decodeCursor(args.before));
  let slice = items.slice(start, end);
  let sliceStart = start;
  if (typeof args.first === 'number') {
    slice = slice.slice(0, args.first);
  } else if (typeof args.last === 'number') {
    const drop = Math.max(0, slice.length - args.last);
    slice = slice.slice(drop);
    sliceStart = start + drop;
  }
  const sliceEnd = sliceStart + slice.length - 1;
  return {
    edges: slice.map((node, index) => ({
      cursor: encodeCursor(sliceStart + index),
      node,
    })),
    nodes: slice,
    pageInfo: {
      __typename: 'PageInfo',
      hasNextPage: slice.length > 0 && sliceEnd < items.length - 1,
      hasPreviousPage: slice.length > 0 && sliceStart > 0,
      startCursor: slice.length ? encodeCursor(sliceStart) : null,
      endCursor: slice.length ? encodeCursor(sliceEnd) : null,
    },
    totalCount: items.length,
    ...extra,
  };
}

/**
 * Encodes option value index combinations into Shopify's v1 trie format,
 * the inverse of `decodeEncodedVariant` in @shopify/hydrogen-react.
 * Example: [[0,0],[0,1],[1,0]] → "v1_0:0 1,1:0,,"
 */
export function encodeVariantCombos(combos: number[][]): string {
  const build = (nodes: number[][], depth: number): string => {
    if (!nodes.length) return '';
    const isLeaf = nodes[0].length === depth + 1;
    if (isLeaf) {
      return [...new Set(nodes.map((n) => n[depth]))]
        .sort((a, b) => a - b)
        .join(' ');
    }
    const groups = new Map<number, number[][]>();
    for (const node of nodes) {
      const key = node[depth];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(node);
    }
    return (
      [...groups.keys()]
        .sort((a, b) => a - b)
        .map((key) => `${key}:${build(groups.get(key)!, depth + 1)}`)
        .join(',') + ','
    );
  };
  const encoded = build(combos, 0);
  return `v1_${encoded.endsWith(',') ? encoded : `${encoded},`}`;
}

export function toImage(seed: ImageSeed) {
  return {
    __typename: 'Image',
    id: seed.id,
    url: seed.url,
    altText: seed.altText,
    width: seed.width,
    height: seed.height,
    originalSrc: seed.url,
    src: seed.url,
    transformedSrc: seed.url,
    thumbhash: null,
  };
}

function toMediaImage(id: string, image: ReturnType<typeof toImage>) {
  return {
    __typename: 'MediaImage',
    id,
    alt: image.altText,
    mediaContentType: 'IMAGE',
    presentation: null,
    previewImage: image,
    image,
  };
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* Catalog                                                                     */
/* -------------------------------------------------------------------------- */

export type MockCatalog = ReturnType<typeof buildCatalog>;

type Registry = {
  nodesById: Map<string, GqlObject>;
  resolveNode: (id: string | null | undefined) => GqlObject | null;
};

export function buildCatalog() {
  const nodesById = new Map<string, GqlObject>();
  const productsByHandle = new Map<string, GqlObject>();
  const registry: Registry = {
    nodesById,
    resolveNode: (id) => {
      if (!id) return null;
      if (id.startsWith('gid://shopify/Product/handle:')) {
        return productsByHandle.get(id.split('handle:')[1]) ?? null;
      }
      return nodesById.get(id) ?? null;
    },
  };

  // Media images referenced by metaobjects
  for (const media of MEDIA_IMAGE_SEEDS) {
    nodesById.set(media.id, toMediaImage(media.id, toImage(media.image)));
  }

  // Collections (products attached after products are built)
  const collections = COLLECTION_SEEDS.map((seed) =>
    buildCollection(seed, registry),
  );
  const collectionsByHandle = new Map(
    collections.map((collection) => [collection.handle as string, collection]),
  );

  // Products
  const products = PRODUCT_SEEDS.map((seed) =>
    buildProduct(seed, collectionsByHandle, registry),
  );
  for (const product of products) {
    productsByHandle.set(product.handle as string, product);
    nodesById.set(product.id as string, product);
    for (const variant of product.__variants as GqlObject[]) {
      nodesById.set(variant.id as string, variant);
    }
  }
  for (const collection of collections) {
    const seed = COLLECTION_SEEDS.find((c) => c.id === collection.id)!;
    const members = products.filter((product) =>
      (product.__collections as string[]).includes(seed.handle),
    );
    const ordered = seed.productOrder
      ? [...members].sort(
          (a, b) =>
            seed.productOrder!.indexOf(a.handle as string) -
            seed.productOrder!.indexOf(b.handle as string),
        )
      : members;
    collection.__products = ordered;
    nodesById.set(collection.id as string, collection);
  }

  // Metaobjects
  const metaobjects = METAOBJECT_SEEDS.map((seed) =>
    buildMetaobject(seed, registry),
  );
  for (const metaobject of metaobjects) {
    nodesById.set(metaobject.id as string, metaobject);
  }

  // Menus, pages, policies, shop
  const menus = MENU_SEEDS.map((seed) => ({
    __typename: 'Menu',
    id: seed.id,
    handle: seed.handle,
    title: seed.title,
    itemsCount: seed.items.length,
    items: seed.items.map(buildMenuItem),
  }));
  const pages = PAGE_SEEDS.map((seed) => ({
    __typename: 'Page',
    ...seed,
    seo: {__typename: 'SEO', ...seed.seo},
    onlineStoreUrl: `${STORE_URL}/pages/${seed.handle}`,
    trackingParameters: null,
    metafield: () => null,
    metafields: () => [],
  }));
  for (const page of pages) nodesById.set(page.id, page);
  const policies = Object.fromEntries(
    POLICY_SEEDS.map((seed) => [
      seed.handle.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
      {
        __typename: 'ShopPolicy',
        ...seed,
        url: `${STORE_URL}/policies/${seed.handle}`,
      },
    ]),
  );

  const shop = {
    __typename: 'Shop',
    id: 'gid://shopify/Shop/68817551382',
    name: '{AppName}',
    description: 'Premium cooling comforters and pillows for better sleep.',
    primaryDomain: {
      __typename: 'Domain',
      url: STORE_URL,
      host: 'mellow.mock',
      sslEnabled: true,
    },
    brand: {
      __typename: 'Brand',
      logo: null,
      squareLogo: null,
      coverImage: null,
      slogan: 'Sleep Better. Sleep {AppName}.',
      shortDescription: 'Premium cooling comforters and pillows.',
      colors: {
        __typename: 'BrandColors',
        primary: [
          {
            __typename: 'BrandColorGroup',
            background: '#4c4184',
            foreground: '#ffffff',
          },
        ],
        secondary: [
          {
            __typename: 'BrandColorGroup',
            background: '#e1e1fe',
            foreground: '#4c4184',
          },
        ],
      },
    },
    moneyFormat: '${{amount}}',
    paymentSettings: {
      __typename: 'PaymentSettings',
      currencyCode: 'USD',
      countryCode: 'US',
      acceptedCardBrands: ['VISA', 'MASTERCARD', 'AMERICAN_EXPRESS'],
      enabledPresentmentCurrencies: ['USD'],
      shopifyPaymentsAccountId: null,
      supportedDigitalWallets: ['SHOPIFY_PAY', 'APPLE_PAY'],
      cardVaultUrl: `${STORE_URL}/card-vault`,
    },
    shipsToCountries: ['US', 'CA'],
    privacyPolicy: policies.privacyPolicy ?? null,
    refundPolicy: policies.refundPolicy ?? null,
    shippingPolicy: policies.shippingPolicy ?? null,
    termsOfService: policies.termsOfService ?? null,
    subscriptionPolicy: null,
    termsOfSale: null,
    legalNotice: null,
    customerAccountUrl: null,
    metafield: () => null,
    metafields: () => [],
  };

  const localization = {
    __typename: 'Localization',
    language: {
      __typename: 'Language',
      isoCode: 'EN',
      name: 'English',
      endonymName: 'English',
    },
    country: {
      __typename: 'Country',
      isoCode: 'US',
      name: 'United States',
      unitSystem: 'IMPERIAL_SYSTEM',
      currency: {
        __typename: 'Currency',
        isoCode: 'USD',
        name: 'United States Dollar',
        symbol: '$',
      },
      availableLanguages: [
        {
          __typename: 'Language',
          isoCode: 'EN',
          name: 'English',
          endonymName: 'English',
        },
      ],
      market: {
        __typename: 'Market',
        id: 'gid://shopify/Market/1',
        handle: 'us',
      },
    },
    market: {__typename: 'Market', id: 'gid://shopify/Market/1', handle: 'us'},
    availableCountries: [],
    availableLanguages: [],
  };

  return {
    shop,
    localization,
    menus,
    menusByHandle: new Map(menus.map((menu) => [menu.handle, menu])),
    products,
    productsByHandle,
    collections,
    collectionsByHandle,
    pages,
    policies,
    metaobjects,
    registry,
  };
}

let cachedCatalog: MockCatalog | undefined;
export function getCatalog(): MockCatalog {
  if (!cachedCatalog) cachedCatalog = buildCatalog();
  return cachedCatalog;
}

/* -------------------------------------------------------------------------- */
/* Builders                                                                    */
/* -------------------------------------------------------------------------- */

function buildMenuItem(seed: MenuItemSeed): GqlObject {
  return {
    __typename: 'MenuItem',
    id: seed.id,
    title: seed.title,
    url: seed.url,
    type: seed.type,
    resourceId: seed.resourceId ?? null,
    resource: null,
    tags: [],
    items: (seed.items ?? []).map(buildMenuItem),
  };
}

function buildMetafield(
  seed: MetafieldSeed,
  ownerId: string,
  owner: GqlObject,
  registry: Registry,
): GqlObject {
  return {
    __typename: 'Metafield',
    id: `gid://shopify/Metafield/${ownerId.split('/').pop()}-${seed.namespace}-${seed.key}`,
    namespace: seed.namespace,
    key: seed.key,
    type: seed.type,
    value: seed.value,
    createdAt: NOW,
    updatedAt: NOW,
    description: null,
    parentResource: () => owner,
    reference: () => registry.resolveNode(seed.references?.[0]),
    references: (args: PaginationArgs) =>
      seed.references
        ? connection(
            seed.references
              .map((id) => registry.resolveNode(id))
              .filter(Boolean) as GqlObject[],
            args,
          )
        : null,
  };
}

function buildMetaobject(seed: MetaobjectSeed, registry: Registry): GqlObject {
  const fields = seed.fields.map((field) => ({
    __typename: 'MetaobjectField',
    key: field.key,
    type: field.type,
    value: field.value,
    reference: () => registry.resolveNode(field.reference),
    references: (args: PaginationArgs) =>
      field.references
        ? connection(
            field.references
              .map((id) => registry.resolveNode(id))
              .filter(Boolean) as GqlObject[],
            args,
          )
        : null,
  }));
  return {
    __typename: 'Metaobject',
    id: seed.id,
    handle: seed.handle,
    type: seed.type,
    updatedAt: NOW,
    onlineStoreUrl: null,
    seo: null,
    fields,
    field: ({key}: {key: string}) => fields.find((f) => f.key === key) ?? null,
  };
}

function buildCollection(seed: CollectionSeed, registry: Registry): GqlObject {
  const collection: GqlObject = {
    __typename: 'Collection',
    id: seed.id,
    handle: seed.handle,
    title: seed.title,
    description: seed.description,
    descriptionHtml: seed.descriptionHtml,
    image: seed.image ? toImage(seed.image) : null,
    updatedAt: seed.updatedAt,
    onlineStoreUrl: `${STORE_URL}/collections/${seed.handle}`,
    trackingParameters: null,
    seo: {__typename: 'SEO', title: seed.title, description: seed.description},
    metafield: () => null,
    metafields: () => [],
    __products: [] as GqlObject[],
    products: (
      args: PaginationArgs & {
        sortKey?: string;
        reverse?: boolean;
        filters?: GqlObject[];
      },
    ) => {
      const all = collection.__products as GqlObject[];
      const filtered = applyProductFilters(all, args.filters);
      const sorted = sortProducts(
        filtered,
        args.sortKey ?? 'COLLECTION_DEFAULT',
        args.reverse ?? false,
      );
      return connection(sorted, args, {filters: buildFilters(all)});
    },
  };
  void registry;
  return collection;
}

function buildProduct(
  seed: ProductSeed,
  collectionsByHandle: Map<string, GqlObject>,
  registry: Registry,
): GqlObject {
  const images = seed.images.map(toImage);
  const mediaImages = images.map((img, index) =>
    toMediaImage(`gid://shopify/MediaImage/${seed.handle}-${index + 1}`, img),
  );
  const product: GqlObject = {
    __typename: 'Product',
    id: seed.id,
    handle: seed.handle,
    title: seed.title,
    vendor: seed.vendor,
    productType: seed.productType,
    tags: seed.tags,
    descriptionHtml: seed.descriptionHtml,
    description: ({truncateAt}: {truncateAt?: number | null}) =>
      truncateAt ? seed.description.slice(0, truncateAt) : seed.description,
    createdAt: seed.createdAt,
    updatedAt: seed.updatedAt,
    publishedAt: seed.createdAt,
    onlineStoreUrl: `${STORE_URL}/products/${seed.handle}`,
    isGiftCard: false,
    requiresSellingPlan: false,
    trackingParameters: null,
    category: null,
    seo: {
      __typename: 'SEO',
      title: `${seed.title} | {AppName}`,
      description: seed.description,
    },
    featuredImage: images[0] ?? null,
    images: (args: PaginationArgs) => connection(images, args),
    media: (args: PaginationArgs) => connection(mediaImages, args),
    sellingPlanGroups: (args: PaginationArgs) => connection([], args),
    __collections: seed.collections,
    __bestSellingRank: seed.bestSellingRank,
    collections: (args: PaginationArgs) =>
      connection(
        seed.collections
          .map((handle) => collectionsByHandle.get(handle))
          .filter(Boolean) as GqlObject[],
        args,
      ),
  };

  const variants: GqlObject[] = seed.variants.map((variantSeed) => {
    const title =
      variantSeed.selectedOptions.map((o) => o.value).join(' / ') ||
      'Default Title';
    const variant: GqlObject = {
      __typename: 'ProductVariant',
      id: variantSeed.id,
      title,
      sku: variantSeed.sku ?? null,
      barcode: null,
      availableForSale: variantSeed.availableForSale ?? true,
      currentlyNotInStock: false,
      quantityAvailable: variantSeed.quantityAvailable ?? 50,
      requiresShipping: true,
      requiresComponents: false,
      taxable: true,
      weight: 1.5,
      weightUnit: 'KILOGRAMS',
      price: money(variantSeed.price),
      compareAtPrice:
        variantSeed.compareAtPrice != null
          ? money(variantSeed.compareAtPrice)
          : null,
      unitPrice: null,
      unitPriceMeasurement: null,
      selectedOptions: variantSeed.selectedOptions.map((option) => ({
        __typename: 'SelectedOption',
        ...option,
      })),
      image: images[variantSeed.imageIndex ?? 0] ?? images[0] ?? null,
      product: () => product,
      metafield: () => null,
      metafields: () => [],
      components: (args: PaginationArgs) => connection([], args),
      groupedBy: (args: PaginationArgs) => connection([], args),
      sellingPlanAllocations: (args: PaginationArgs) => connection([], args),
      storeAvailability: (args: PaginationArgs) => connection([], args),
      quantityPriceBreaks: (args: PaginationArgs) => connection([], args),
      quantityRule: {
        __typename: 'QuantityRule',
        minimum: 1,
        maximum: null,
        increment: 1,
      },
      shopPayInstallmentsPricing: null,
      trackingParameters: null,
      __price: variantSeed.price,
      __compareAtPrice: variantSeed.compareAtPrice ?? null,
    };
    return variant;
  });

  const optionNames = new Set(seed.options.map((option) => option.name));
  const findVariantFor = (name: string, value: string) =>
    variants.find(
      (variant) =>
        variant.availableForSale &&
        variant.selectedOptions.some(
          (o: GqlObject) => o.name === name && o.value === value,
        ),
    ) ??
    variants.find((variant) =>
      variant.selectedOptions.some(
        (o: GqlObject) => o.name === name && o.value === value,
      ),
    ) ??
    null;

  const options = seed.options.map((option, optionIndex) => ({
    __typename: 'ProductOption',
    id: `gid://shopify/ProductOption/${seed.handle}-${optionIndex + 1}`,
    name: option.name,
    optionValues: option.values.map((value, valueIndex) => ({
      __typename: 'ProductOptionValue',
      id: `gid://shopify/ProductOptionValue/${seed.handle}-${optionIndex + 1}-${valueIndex + 1}`,
      name: value.name,
      swatch: value.swatchColor
        ? {
            __typename: 'ProductOptionValueSwatch',
            color: value.swatchColor,
            image: null,
          }
        : null,
      firstSelectableVariant: () => findVariantFor(option.name, value.name),
    })),
  }));

  const combos = variants.map((variant) =>
    seed.options.map((option) => {
      const selected = variant.selectedOptions.find(
        (o: GqlObject) => o.name === option.name,
      );
      return option.values.findIndex((value) => value.name === selected?.value);
    }),
  );
  const availableCombos = combos.filter(
    (_, index) => variants[index].availableForSale,
  );

  const prices = variants.map((variant) => variant.__price as number);
  const comparePrices = variants
    .map((variant) => variant.__compareAtPrice as number | null)
    .filter((price): price is number => typeof price === 'number');

  const matchVariant = (
    args: {
      selectedOptions?: Array<{name: string; value: string}> | null;
      ignoreUnknownOptions?: boolean | null;
      caseInsensitiveMatch?: boolean | null;
    },
    fallbackToAvailable: boolean,
  ) => {
    const equals = (a: string, b: string) =>
      args.caseInsensitiveMatch ? normalize(a) === normalize(b) : a === b;
    const selected = (args.selectedOptions ?? []).filter(
      (option) => !args.ignoreUnknownOptions || optionNames.has(option.name),
    );
    const exact = selected.length
      ? variants.find((variant) =>
          selected.every((option) =>
            variant.selectedOptions.some(
              (o: GqlObject) =>
                equals(o.name, option.name) && equals(o.value, option.value),
            ),
          ),
        )
      : undefined;
    if (exact) return exact;
    if (!fallbackToAvailable) return null;
    return (
      variants.find((variant) => variant.availableForSale) ??
      variants[0] ??
      null
    );
  };

  Object.assign(product, {
    __variants: variants,
    availableForSale: variants.some((variant) => variant.availableForSale),
    totalInventory: variants.reduce(
      (sum, variant) => sum + (variant.quantityAvailable as number),
      0,
    ),
    variantsCount: {
      __typename: 'Count',
      count: variants.length,
      precision: 'EXACT',
    },
    options: () => options,
    variants: (args: PaginationArgs) => connection(variants, args),
    priceRange: {
      __typename: 'ProductPriceRange',
      minVariantPrice: money(Math.min(...prices)),
      maxVariantPrice: money(Math.max(...prices)),
    },
    compareAtPriceRange: {
      __typename: 'ProductPriceRange',
      minVariantPrice: money(
        comparePrices.length ? Math.min(...comparePrices) : 0,
      ),
      maxVariantPrice: money(
        comparePrices.length ? Math.max(...comparePrices) : 0,
      ),
    },
    encodedVariantExistence: encodeVariantCombos(combos),
    encodedVariantAvailability: encodeVariantCombos(availableCombos),
    selectedOrFirstAvailableVariant: (args: GqlObject) =>
      matchVariant(args, true),
    variantBySelectedOptions: (args: GqlObject) => matchVariant(args, false),
    adjacentVariants: (args: GqlObject) => {
      const selected = matchVariant(args, true);
      return variants.filter((variant) => variant !== selected);
    },
    metafield: ({namespace, key}: {namespace?: string | null; key: string}) => {
      const metafieldSeed = seed.metafields.find(
        (m) => m.key === key && (!namespace || m.namespace === namespace),
      );
      return metafieldSeed
        ? buildMetafield(metafieldSeed, seed.id, product, registry)
        : null;
    },
    metafields: ({
      identifiers,
    }: {
      identifiers: Array<{namespace?: string | null; key: string}>;
    }) =>
      identifiers.map((identifier) => {
        const metafieldSeed = seed.metafields.find(
          (m) =>
            m.key === identifier.key &&
            (!identifier.namespace || m.namespace === identifier.namespace),
        );
        return metafieldSeed
          ? buildMetafield(metafieldSeed, seed.id, product, registry)
          : null;
      }),
  });

  return product;
}

/* -------------------------------------------------------------------------- */
/* Sorting, filtering, search                                                  */
/* -------------------------------------------------------------------------- */

export function sortProducts(
  products: GqlObject[],
  sortKey: string,
  reverse: boolean,
) {
  const sorted = [...products];
  const by = (fn: (p: GqlObject) => number | string) =>
    sorted.sort((a, b) => {
      const av = fn(a);
      const bv = fn(b);
      return av < bv ? -1 : av > bv ? 1 : 0;
    });
  switch (sortKey) {
    case 'TITLE':
      by((p) => p.title as string);
      break;
    case 'PRICE':
      by((p) => Number(p.priceRange.minVariantPrice.amount));
      break;
    case 'BEST_SELLING':
      by((p) => p.__bestSellingRank as number);
      break;
    case 'CREATED':
    case 'CREATED_AT':
      by((p) => p.createdAt as string);
      break;
    case 'UPDATED_AT':
      by((p) => p.updatedAt as string);
      break;
    case 'VENDOR':
      by((p) => p.vendor as string);
      break;
    case 'PRODUCT_TYPE':
      by((p) => p.productType as string);
      break;
    case 'ID':
      by((p) => p.id as string);
      break;
    default:
      break; // COLLECTION_DEFAULT, MANUAL, RELEVANCE keep the given order
  }
  return reverse ? sorted.reverse() : sorted;
}

export function applyProductFilters(
  products: GqlObject[],
  filters?: GqlObject[] | null,
) {
  if (!filters?.length) return products;
  const groups = new Map<string, GqlObject[]>();
  for (const filter of filters) {
    for (const [key, value] of Object.entries(filter)) {
      if (value === undefined || value === null) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(value as GqlObject);
    }
  }
  return products.filter((product) =>
    [...groups.entries()].every(([key, values]) =>
      values.some((value) => matchesFilter(product, key, value)),
    ),
  );
}

function matchesFilter(product: GqlObject, key: string, value: any): boolean {
  const variants = product.__variants as GqlObject[];
  switch (key) {
    case 'available':
      return value
        ? product.availableForSale === true
        : product.availableForSale === false;
    case 'price': {
      const min = Number(product.priceRange.minVariantPrice.amount);
      const max = Number(product.priceRange.maxVariantPrice.amount);
      const lower = value.min ?? 0;
      const upper = value.max ?? Number.POSITIVE_INFINITY;
      return max >= lower && min <= upper;
    }
    case 'productType':
      return normalize(product.productType) === normalize(String(value));
    case 'productVendor':
      return normalize(product.vendor) === normalize(String(value));
    case 'tag':
      return (product.tags as string[]).some(
        (tag) => normalize(tag) === normalize(String(value)),
      );
    case 'variantOption':
      return variants.some((variant) =>
        variant.selectedOptions.some(
          (o: GqlObject) =>
            normalize(o.name) === normalize(value.name) &&
            normalize(o.value) === normalize(value.value),
        ),
      );
    default:
      return true;
  }
}

export function buildFilters(products: GqlObject[]) {
  const count = (predicate: (p: GqlObject) => boolean) =>
    products.filter(predicate).length;
  const prices = products.map((p) =>
    Number(p.priceRange.maxVariantPrice.amount),
  );
  const types = [
    ...new Set(products.map((p) => p.productType as string)),
  ].sort();
  const optionValues = new Map<string, Map<string, string | null>>();
  for (const product of products) {
    for (const variant of product.__variants as GqlObject[]) {
      for (const option of variant.selectedOptions as GqlObject[]) {
        if (!optionValues.has(option.name))
          optionValues.set(option.name, new Map());
        const swatch =
          (product.options() as GqlObject[])
            .find((o) => o.name === option.name)
            ?.optionValues.find((v: GqlObject) => v.name === option.value)
            ?.swatch?.color ?? null;
        optionValues.get(option.name)!.set(option.value, swatch);
      }
    }
  }
  const filterValue = (
    id: string,
    label: string,
    n: number,
    input: GqlObject,
    swatchColor?: string | null,
  ) => ({
    __typename: 'FilterValue',
    id,
    label,
    count: n,
    input: JSON.stringify(input),
    image: null,
    swatch: swatchColor
      ? {__typename: 'Swatch', color: swatchColor, image: null}
      : null,
  });
  return [
    {
      __typename: 'Filter',
      id: 'filter.v.availability',
      label: 'Availability',
      type: 'LIST',
      presentation: null,
      values: [
        filterValue(
          'filter.v.availability.1',
          'In stock',
          count((p) => p.availableForSale),
          {available: true},
        ),
        filterValue(
          'filter.v.availability.0',
          'Out of stock',
          count((p) => !p.availableForSale),
          {available: false},
        ),
      ],
    },
    {
      __typename: 'Filter',
      id: 'filter.v.price',
      label: 'Price',
      type: 'PRICE_RANGE',
      presentation: null,
      values: [
        filterValue('filter.v.price', 'Price', products.length, {
          price: {min: 0, max: Math.ceil(Math.max(0, ...prices))},
        }),
      ],
    },
    {
      __typename: 'Filter',
      id: 'filter.p.product_type',
      label: 'Product type',
      type: 'LIST',
      presentation: null,
      values: types.map((type) =>
        filterValue(
          `filter.p.product_type.${normalize(type)}`,
          type,
          count((p) => p.productType === type),
          {productType: type},
        ),
      ),
    },
    ...[...optionValues.entries()].map(([name, values]) => ({
      __typename: 'Filter',
      id: `filter.v.option.${normalize(name)}`,
      label: name,
      type: 'LIST',
      presentation: name === 'Color' ? 'SWATCH' : null,
      values: [...values.entries()].map(([value, swatchColor]) =>
        filterValue(
          `filter.v.option.${normalize(name)}.${normalize(value)}`,
          value,
          count((p) =>
            (p.__variants as GqlObject[]).some((v) =>
              v.selectedOptions.some(
                (o: GqlObject) => o.name === name && o.value === value,
              ),
            ),
          ),
          {variantOption: {name, value}},
          swatchColor,
        ),
      ),
    })),
  ];
}

export function searchProducts(products: GqlObject[], term: string) {
  const query = normalize(term);
  if (!query) return [];
  const words = query.split(/\s+/).filter(Boolean);
  return products
    .map((product) => {
      const haystack = normalize(
        `${product.title} ${product.productType} ${(product.tags as string[]).join(' ')} ${product.description({})}`,
      );
      const score = words.reduce((sum, word) => {
        if (normalize(product.title).includes(word)) return sum + 3;
        if (haystack.includes(word)) return sum + 1;
        return sum;
      }, 0);
      return {product, score};
    })
    .filter(({score}) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({product}) => product);
}
