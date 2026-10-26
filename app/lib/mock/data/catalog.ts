/**
 * {AppName} demo catalog for the development Storefront API mock.
 *
 * Products, prices, badges and review counts mirror the design references.
 * Imagery is local placeholder artwork (public/images/placeholders).
 */
import {getStorefrontPolicy} from '~/lib/content/policies';
import type {
  CollectionSeed,
  ImageSeed,
  MenuSeed,
  PageSeed,
  PolicySeed,
  ProductSeed,
  VariantSeed,
} from './types';

const NOW = '2026-10-01T12:00:00Z';
const CREATED = '2025-01-15T12:00:00Z';

function image(
  handle: string,
  suffix: string | number,
  alt: string,
): ImageSeed {
  return {
    id: `gid://shopify/ProductImage/${handle}-${suffix}`,
    url: `/images/placeholders/product-${handle}-${suffix}.svg`,
    altText: alt,
    width: 1200,
    height: 1200,
  };
}

function rating(value: number) {
  return JSON.stringify({
    scale_min: '1.0',
    scale_max: '5.0',
    value: value.toFixed(1),
  });
}

function list(values: string[]) {
  return JSON.stringify(values);
}

function sizeVariants(
  handle: string,
  sizes: Array<{
    name: string;
    price: number;
    compareAt: number;
    available?: boolean;
  }>,
): VariantSeed[] {
  return sizes.map((size, index) => ({
    id: `gid://shopify/ProductVariant/${handle}-${index + 1}`,
    sku: `${handle.toUpperCase().slice(0, 8)}-${index + 1}`,
    price: size.price,
    compareAtPrice: size.compareAt,
    availableForSale: size.available ?? true,
    quantityAvailable: size.available === false ? 0 : 120,
    selectedOptions: [{name: 'Size', value: size.name}],
    imageIndex: 0,
  }));
}

const COMFORTER_MATERIALS =
  'Shell: 100% brushed microfiber (300 thread count).\nFill: 100% recycled down-alternative microfiber clusters.\nCertified OEKO-TEX® Standard 100.';
const COMFORTER_CARE =
  'Machine wash cold on a gentle cycle with like colours.\nTumble dry low with dryer balls to restore loft.\nDo not bleach. Do not iron.';
const PILLOW_MATERIALS =
  'Cover: 65% polyester, 35% viscose cooling knit, removable.\nCore: CertiPUR-US® certified adaptive memory foam.';
const PILLOW_CARE =
  'Remove the cover and machine wash cold.\nTumble dry low. Spot clean the core only.\nAllow 24 hours for the core to fully expand on arrival.';

export const PRODUCT_SEEDS: ProductSeed[] = [
  {
    id: 'gid://shopify/Product/1001',
    handle: 'cloudalign-pillow',
    title: 'CloudAlign Pillow',
    vendor: '{AppName}',
    productType: 'Pillow',
    tags: ['pillow', 'bestseller', 'cooling', 'ergonomic'],
    description:
      'The #1 best-selling ergonomic pillow of 2025, engineered to support proper alignment, relieve neck and shoulder pressure, and help you sleep deeper.',
    descriptionHtml:
      '<p>The #1 best-selling ergonomic pillow of 2025, engineered to support proper alignment, relieve neck and shoulder pressure, and help you sleep deeper.</p><p>Its contoured cloud-soft core cradles your head while the breathable cooling cover keeps you comfortable all night, whether you sleep on your back or your side.</p>',
    images: [
      image(
        'cloudalign-pillow',
        1,
        'CloudAlign Pillow – #1 best-selling pillow of 2025',
      ),
      image('cloudalign-pillow', 2, 'CloudAlign Pillow side profile'),
      image('cloudalign-pillow', 3, 'CloudAlign Pillow on a bed'),
    ],
    options: [{name: 'Size', values: [{name: 'Standard'}, {name: 'King'}]}],
    variants: sizeVariants('cloudalign-pillow', [
      {name: 'Standard', price: 49.99, compareAt: 100},
      {name: 'King', price: 59.99, compareAt: 120},
    ]),
    collections: ['all', 'most-loved', 'pillows'],
    metafields: [
      {namespace: 'reviews', key: 'rating', type: 'rating', value: rating(4.9)},
      {
        namespace: 'reviews',
        key: 'rating_count',
        type: 'number_integer',
        value: '51644',
      },
      {
        namespace: 'mellow',
        key: 'badge',
        type: 'single_line_text_field',
        value: 'Bestseller',
      },
      {
        namespace: 'mellow',
        key: 'features',
        type: 'list.single_line_text_field',
        value: list([
          'moon|Supports proper spinal alignment all night',
          'feather|Cloud-soft adaptive foam core',
          'snowflake|Breathable cooling knit cover',
          'wash|Removable cover, machine washable',
          'check|Innovation of Sleep Award 2025 winner',
        ]),
      },
      {
        namespace: 'mellow',
        key: 'materials',
        type: 'multi_line_text_field',
        value: PILLOW_MATERIALS,
      },
      {
        namespace: 'mellow',
        key: 'care',
        type: 'multi_line_text_field',
        value: PILLOW_CARE,
      },
      {
        namespace: 'mellow',
        key: 'featured_reviews',
        type: 'list.metaobject_reference',
        value: list([
          'gid://shopify/Metaobject/review-1',
          'gid://shopify/Metaobject/review-2',
        ]),
        references: [
          'gid://shopify/Metaobject/review-1',
          'gid://shopify/Metaobject/review-2',
        ],
      },
      {
        namespace: 'mellow',
        key: 'sold_recently',
        type: 'number_integer',
        value: '2184',
      },
      {
        namespace: 'mellow',
        key: 'size_guide',
        type: 'single_line_text_field',
        value:
          'Back & side sleepers: Standard · Broad shoulders or a king bed: King',
      },
      {
        namespace: 'mellow',
        key: 'pack_tiers',
        type: 'list.single_line_text_field',
        value: list([
          '1|Single',
          '2|Pair|Most popular – one each',
          '4|Family pack|Every bed in the house',
        ]),
      },
      {
        namespace: 'mellow',
        key: 'proof',
        type: 'list.single_line_text_field',
        value: list([
          'shield|Recommended by our chiropractic partners',
          'leaf|OEKO-TEX® certified, hypoallergenic cover',
          'sparkle|Voted softest pillow of 2025',
        ]),
      },
      {
        namespace: 'mellow',
        key: 'addon',
        type: 'product_reference',
        value: 'gid://shopify/Product/1011',
        references: ['gid://shopify/Product/1011'],
      },
      {
        namespace: 'mellow',
        key: 'addon_note',
        type: 'single_line_text_field',
        value: 'Blocks light for deeper sleep. Ships in the same box.',
      },
    ],
    createdAt: CREATED,
    updatedAt: NOW,
    bestSellingRank: 1,
  },
  {
    id: 'gid://shopify/Product/1002',
    handle: 'marshmellow-comforter',
    title: 'MarshMellow Comforter',
    vendor: '{AppName}',
    productType: 'Comforter',
    tags: ['comforter', 'bestseller', 'ultra-fluffy'],
    description:
      "A double-stuffed comforter for more volume and bounce. Made with our premium baby-soft feel fabric to be the softest comforter you'll ever own.",
    descriptionHtml:
      "<p>A double-stuffed comforter for more volume and bounce. Made with our premium baby-soft feel fabric to be the softest comforter you'll ever own.</p><p>Two times fuller than ordinary comforters, the MarshMellow stays lofty wash after wash and never clumps.</p>",
    images: [
      image(
        'marshmellow-comforter',
        1,
        'MarshMellow Comforter – ultra fluffy, 2X stuffed',
      ),
      image('marshmellow-comforter', 2, 'MarshMellow Comforter folded'),
      image('marshmellow-comforter', 3, 'MarshMellow Comforter on a bed'),
    ],
    options: [
      {
        name: 'Size',
        values: [{name: 'Twin'}, {name: 'Full/Queen'}, {name: 'King'}],
      },
    ],
    variants: sizeVariants('marshmellow-comforter', [
      {name: 'Twin', price: 87.99, compareAt: 200},
      {name: 'Full/Queen', price: 97.99, compareAt: 220},
      {name: 'King', price: 107.99, compareAt: 240},
    ]),
    collections: ['all', 'most-loved', 'comforters'],
    metafields: [
      {namespace: 'reviews', key: 'rating', type: 'rating', value: rating(4.9)},
      {
        namespace: 'reviews',
        key: 'rating_count',
        type: 'number_integer',
        value: '15744',
      },
      {
        namespace: 'mellow',
        key: 'sold_recently',
        type: 'number_integer',
        value: '940',
      },
      {
        namespace: 'mellow',
        key: 'proof',
        type: 'list.single_line_text_field',
        value: list([
          'leaf|OEKO-TEX® certified fabric',
          'sparkle|Voted softest comforter of 2025',
          'wash|Stays lofty wash after wash',
        ]),
      },
      {
        namespace: 'mellow',
        key: 'badge',
        type: 'single_line_text_field',
        value: 'Bestseller',
      },
      {
        namespace: 'mellow',
        key: 'features',
        type: 'list.single_line_text_field',
        value: list([
          'feather|2X fuller than other comforters',
          'sparkle|Ultra-soft baby-soft feel fabric',
          'wash|Machine washable and dryer safe',
          'moon|Hotel-bed loft every single night',
        ]),
      },
      {
        namespace: 'mellow',
        key: 'materials',
        type: 'multi_line_text_field',
        value: COMFORTER_MATERIALS,
      },
      {
        namespace: 'mellow',
        key: 'care',
        type: 'multi_line_text_field',
        value: COMFORTER_CARE,
      },
      {
        namespace: 'mellow',
        key: 'featured_reviews',
        type: 'list.metaobject_reference',
        value: list(['gid://shopify/Metaobject/review-3']),
        references: ['gid://shopify/Metaobject/review-3'],
      },
    ],
    createdAt: CREATED,
    updatedAt: NOW,
    bestSellingRank: 2,
  },
  {
    id: 'gid://shopify/Product/1003',
    handle: 'cloudcool-cooling-comforter',
    title: 'CloudCool Cooling Comforter',
    vendor: '{AppName}',
    productType: 'Comforter',
    tags: ['comforter', 'cooling', 'dual-sided'],
    description:
      'Award winning cooling comforter with silk-smooth chill on one side and soft, breathable knit on the other.',
    descriptionHtml:
      '<p>Award winning cooling comforter with silk-smooth chill on one side and soft, breathable knit on the other.</p><p>The coolest comforter you will ever own: flip to the cool-touch side on hot nights and the knit side when the temperature drops.</p>',
    images: [
      image(
        'cloudcool-cooling-comforter',
        1,
        'CloudCool Cooling Comforter – the coolest comforter',
      ),
      image(
        'cloudcool-cooling-comforter',
        2,
        'CloudCool cool-touch fabric detail',
      ),
      image(
        'cloudcool-cooling-comforter',
        3,
        'CloudCool Cooling Comforter on a bed',
      ),
    ],
    options: [
      {
        name: 'Size',
        values: [{name: 'Twin'}, {name: 'Full/Queen'}, {name: 'King'}],
      },
    ],
    variants: sizeVariants('cloudcool-cooling-comforter', [
      {name: 'Twin', price: 79.99, compareAt: 119.99},
      {name: 'Full/Queen', price: 89.99, compareAt: 139.99},
      {name: 'King', price: 99.99, compareAt: 159.99},
    ]),
    collections: ['all', 'most-loved', 'comforters'],
    metafields: [
      {namespace: 'reviews', key: 'rating', type: 'rating', value: rating(4.8)},
      {
        namespace: 'reviews',
        key: 'rating_count',
        type: 'number_integer',
        value: '4030',
      },
      {
        namespace: 'mellow',
        key: 'sold_recently',
        type: 'number_integer',
        value: '612',
      },
      {
        namespace: 'mellow',
        key: 'proof',
        type: 'list.single_line_text_field',
        value: list([
          'snowflake|Dual-sided: cool side and plush side',
          'leaf|OEKO-TEX® certified fabric',
        ]),
      },
      {
        namespace: 'mellow',
        key: 'features',
        type: 'list.single_line_text_field',
        value: list([
          'snowflake|Cool-touch fabric chills on contact',
          'heat|Soft breathable knit on the reverse',
          'wash|Machine washable',
          'sparkle|Ultra-breathable all-season fill',
        ]),
      },
      {
        namespace: 'mellow',
        key: 'materials',
        type: 'multi_line_text_field',
        value: COMFORTER_MATERIALS,
      },
      {
        namespace: 'mellow',
        key: 'care',
        type: 'multi_line_text_field',
        value: COMFORTER_CARE,
      },
    ],
    createdAt: CREATED,
    updatedAt: NOW,
    bestSellingRank: 3,
  },
  {
    id: 'gid://shopify/Product/1004',
    handle: 'pebble-pillow',
    title: 'Pebble Pillow',
    vendor: '{AppName}',
    productType: 'Pillow',
    tags: ['pillow', 'new', 'travel'],
    description:
      'The pillow you will use everywhere. A pebble-shaped squish pillow with a cool-touch or plush cover for the couch, bed, desk and car.',
    descriptionHtml:
      '<p>The pillow you will use everywhere. A pebble-shaped squish pillow with a cool-touch or plush cover for the couch, bed, desk and car.</p><p>Choose the CloudCool™ Cooling Collection for instant chill or the Lush Collection for cosy warmth.</p>',
    images: [
      {
        id: 'gid://shopify/ProductImage/pebble-1',
        url: '/images/placeholders/product-pebble-pillow-baby-blue.svg',
        altText: 'Pebble Pillow in Baby Blue',
        width: 1200,
        height: 1200,
      },
      {
        id: 'gid://shopify/ProductImage/pebble-2',
        url: '/images/placeholders/product-pebble-pillow-blush.svg',
        altText: 'Pebble Pillow in Blush',
        width: 1200,
        height: 1200,
      },
      {
        id: 'gid://shopify/ProductImage/pebble-3',
        url: '/images/placeholders/product-pebble-pillow-sage.svg',
        altText: 'Pebble Pillow in Sage',
        width: 1200,
        height: 1200,
      },
      {
        id: 'gid://shopify/ProductImage/pebble-4',
        url: '/images/placeholders/product-pebble-pillow-stone.svg',
        altText: 'Pebble Pillow in Stone',
        width: 1200,
        height: 1200,
      },
      {
        id: 'gid://shopify/ProductImage/pebble-5',
        url: '/images/placeholders/product-pebble-pillow-cream.svg',
        altText: 'Pebble Pillow in Cream',
        width: 1200,
        height: 1200,
      },
      {
        id: 'gid://shopify/ProductImage/pebble-6',
        url: '/images/placeholders/product-pebble-pillow-charcoal.svg',
        altText: 'Pebble Pillow in Charcoal',
        width: 1200,
        height: 1200,
      },
      image('pebble-pillow', 1, 'Pebble Pillow lifestyle'),
      image(
        'pebble-pillow',
        2,
        'Pebble Pillow – made for wherever you get comfy',
      ),
    ],
    options: [
      {
        name: 'Color',
        values: [
          {name: 'Baby Blue', swatchColor: '#aac9ea'},
          {name: 'Blush', swatchColor: '#fee6fe'},
          {name: 'Sage', swatchColor: '#aebca0'},
          {name: 'Stone', swatchColor: '#bcc0c1'},
          {name: 'Cream', swatchColor: '#d6cfc1'},
          {name: 'Charcoal', swatchColor: '#65625a'},
        ],
      },
    ],
    variants: ['Baby Blue', 'Blush', 'Sage', 'Stone', 'Cream', 'Charcoal'].map(
      (color, index) => ({
        id: `gid://shopify/ProductVariant/pebble-pillow-${index + 1}`,
        sku: `PEBBLE-${index + 1}`,
        price: 44.99,
        compareAtPrice: 69.99,
        availableForSale: color !== 'Charcoal',
        quantityAvailable: color === 'Charcoal' ? 0 : 80,
        selectedOptions: [{name: 'Color', value: color}],
        imageIndex: index,
      }),
    ),
    collections: ['all', 'most-loved', 'pillows'],
    metafields: [
      {namespace: 'reviews', key: 'rating', type: 'rating', value: rating(4.8)},
      {
        namespace: 'reviews',
        key: 'rating_count',
        type: 'number_integer',
        value: '365',
      },
      {
        namespace: 'mellow',
        key: 'sold_recently',
        type: 'number_integer',
        value: '318',
      },
      {
        namespace: 'mellow',
        key: 'pack_tiers',
        type: 'list.single_line_text_field',
        value: list([
          '1|Single',
          '2|Pair|Most popular',
          '3|Trio|Couch, bed and car',
        ]),
      },
      {
        namespace: 'mellow',
        key: 'badge',
        type: 'single_line_text_field',
        value: 'New',
      },
      {
        namespace: 'mellow',
        key: 'short_description',
        type: 'multi_line_text_field',
        value:
          "The pillow you'll use everywhere: couch, bed, desk or car, in a cool-touch or plush cover.",
      },
      {
        namespace: 'mellow',
        key: 'features',
        type: 'list.single_line_text_field',
        value: list([
          'snowflake|Cool to the touch instantly (CloudCool™ Collection)',
          'heat|Plush & cozy for cold nights (Lush Collection)',
          'couch|Couch, bed, desk, car: works everywhere',
          'wash|Removable cover, machine washable',
          'feather|Lightweight enough to take anywhere',
        ]),
      },
      {
        namespace: 'mellow',
        key: 'swatch_groups',
        type: 'json',
        value: JSON.stringify({
          'CloudCool™ Cooling Collection': [
            'Baby Blue',
            'Blush',
            'Sage',
            'Stone',
          ],
          'Lush Collection': ['Cream', 'Charcoal'],
        }),
      },
      {
        namespace: 'mellow',
        key: 'materials',
        type: 'multi_line_text_field',
        value: PILLOW_MATERIALS,
      },
      {
        namespace: 'mellow',
        key: 'care',
        type: 'multi_line_text_field',
        value: PILLOW_CARE,
      },
      {
        namespace: 'mellow',
        key: 'featured_reviews',
        type: 'list.metaobject_reference',
        value: list([
          'gid://shopify/Metaobject/review-4',
          'gid://shopify/Metaobject/review-5',
          'gid://shopify/Metaobject/review-6',
        ]),
        references: [
          'gid://shopify/Metaobject/review-4',
          'gid://shopify/Metaobject/review-5',
          'gid://shopify/Metaobject/review-6',
        ],
      },
    ],
    createdAt: '2026-06-01T12:00:00Z',
    updatedAt: NOW,
    bestSellingRank: 6,
  },
  {
    id: 'gid://shopify/Product/1005',
    handle: 'cloudcontrol-comforter',
    title: 'CloudControl Comforter',
    vendor: '{AppName}',
    productType: 'Comforter',
    tags: ['comforter', 'new'],
    description:
      'Melt into cloud-fluff softness with built-in duvet control: no cover, no corner ties, no hassle.',
    descriptionHtml:
      '<p>Melt into cloud-fluff softness with built-in duvet control: no cover, no corner ties, no hassle.</p><p>An integrated washable shell means you never wrestle a duvet cover again.</p>',
    images: [
      image(
        'cloudcontrol-comforter',
        1,
        'CloudControl Comforter – melt into cloud-fluff softness',
      ),
      image('cloudcontrol-comforter', 2, 'CloudControl Comforter detail'),
      image('cloudcontrol-comforter', 3, 'CloudControl Comforter on a bed'),
    ],
    options: [
      {
        name: 'Size',
        values: [{name: 'Twin'}, {name: 'Full/Queen'}, {name: 'King'}],
      },
    ],
    variants: sizeVariants('cloudcontrol-comforter', [
      {name: 'Twin', price: 109.99, compareAt: 220},
      {name: 'Full/Queen', price: 119.99, compareAt: 240},
      {name: 'King', price: 129.99, compareAt: 260},
    ]),
    collections: ['all', 'most-loved', 'comforters'],
    metafields: [
      {namespace: 'reviews', key: 'rating', type: 'rating', value: rating(4.9)},
      {
        namespace: 'reviews',
        key: 'rating_count',
        type: 'number_integer',
        value: '1208',
      },
      {
        namespace: 'mellow',
        key: 'badge',
        type: 'single_line_text_field',
        value: 'New!',
      },
      {
        namespace: 'mellow',
        key: 'features',
        type: 'list.single_line_text_field',
        value: list([
          'sparkle|Built-in duvet control, no cover needed',
          'feather|Cloud-fluff softness',
          'wash|Whole comforter is machine washable',
        ]),
      },
      {
        namespace: 'mellow',
        key: 'materials',
        type: 'multi_line_text_field',
        value: COMFORTER_MATERIALS,
      },
      {
        namespace: 'mellow',
        key: 'care',
        type: 'multi_line_text_field',
        value: COMFORTER_CARE,
      },
    ],
    createdAt: '2026-08-01T12:00:00Z',
    updatedAt: NOW,
    bestSellingRank: 5,
  },
  {
    id: 'gid://shopify/Product/1006',
    handle: 'cloud-body-pillow',
    title: 'Cloud Body Pillow',
    vendor: '{AppName}',
    productType: 'Pillow',
    tags: ['pillow', 'new', 'body-pillow'],
    description:
      'The pillow you will use everywhere: full-length support for side sleepers, pregnancy and lounging.',
    descriptionHtml:
      '<p>The pillow you will use everywhere: full-length support for side sleepers, pregnancy and lounging.</p>',
    images: [
      image('cloud-body-pillow', 1, 'Cloud Body Pillow'),
      image('cloud-body-pillow', 2, 'Cloud Body Pillow detail'),
    ],
    options: [
      {
        name: 'Color',
        values: [
          {name: 'Cloud White', swatchColor: '#f7f5ff'},
          {name: 'Lavender', swatchColor: '#c9c4f2'},
        ],
      },
    ],
    variants: ['Cloud White', 'Lavender'].map((color, index) => ({
      id: `gid://shopify/ProductVariant/cloud-body-pillow-${index + 1}`,
      sku: `BODY-${index + 1}`,
      price: 69.99,
      compareAtPrice: 110,
      availableForSale: true,
      quantityAvailable: 60,
      selectedOptions: [{name: 'Color', value: color}],
      imageIndex: index % 2,
    })),
    collections: ['all', 'most-loved', 'pillows'],
    metafields: [
      {namespace: 'reviews', key: 'rating', type: 'rating', value: rating(4.8)},
      {
        namespace: 'reviews',
        key: 'rating_count',
        type: 'number_integer',
        value: '892',
      },
      {
        namespace: 'mellow',
        key: 'badge',
        type: 'single_line_text_field',
        value: 'New',
      },
      {
        namespace: 'mellow',
        key: 'features',
        type: 'list.single_line_text_field',
        value: list([
          'moon|Full-length support for side sleepers',
          'feather|Weightless cloud fill',
          'wash|Removable cover, machine washable',
        ]),
      },
      {
        namespace: 'mellow',
        key: 'materials',
        type: 'multi_line_text_field',
        value: PILLOW_MATERIALS,
      },
      {
        namespace: 'mellow',
        key: 'care',
        type: 'multi_line_text_field',
        value: PILLOW_CARE,
      },
    ],
    createdAt: '2026-09-01T12:00:00Z',
    updatedAt: NOW,
    bestSellingRank: 8,
  },
  {
    id: 'gid://shopify/Product/1007',
    handle: 'cloud-bath-towel',
    title: 'Cloud Bath Towel',
    vendor: '{AppName}',
    productType: 'Bath',
    tags: ['bath', 'towel'],
    description:
      'Oversized, quick-drying and impossibly plush. The bath towel that feels like your comforter.',
    descriptionHtml:
      '<p>Oversized, quick-drying and impossibly plush. The bath towel that feels like your comforter.</p>',
    images: [
      image('cloud-bath-towel', 1, 'Cloud Bath Towel'),
      image('cloud-bath-towel', 2, 'Cloud Bath Towel folded'),
    ],
    options: [
      {
        name: 'Color',
        values: [
          {name: 'White', swatchColor: '#ffffff'},
          {name: 'Lavender', swatchColor: '#c9c4f2'},
          {name: 'Sand', swatchColor: '#d6cfc1'},
        ],
      },
    ],
    variants: ['White', 'Lavender', 'Sand'].map((color, index) => ({
      id: `gid://shopify/ProductVariant/cloud-bath-towel-${index + 1}`,
      sku: `TOWEL-${index + 1}`,
      price: 34.99,
      compareAtPrice: 55,
      availableForSale: true,
      quantityAvailable: 200,
      selectedOptions: [{name: 'Color', value: color}],
      imageIndex: index % 2,
    })),
    collections: ['all', 'bath'],
    metafields: [
      {namespace: 'reviews', key: 'rating', type: 'rating', value: rating(4.7)},
      {
        namespace: 'reviews',
        key: 'rating_count',
        type: 'number_integer',
        value: '640',
      },
      {
        namespace: 'mellow',
        key: 'features',
        type: 'list.single_line_text_field',
        value: list([
          'sparkle|Quick-drying plush cotton',
          'wash|Softer with every wash',
        ]),
      },
      {
        namespace: 'mellow',
        key: 'materials',
        type: 'multi_line_text_field',
        value: '100% long-staple cotton, 650 GSM.',
      },
      {
        namespace: 'mellow',
        key: 'care',
        type: 'multi_line_text_field',
        value:
          'Machine wash warm. Tumble dry low. Skip fabric softener to keep it absorbent.',
      },
    ],
    createdAt: CREATED,
    updatedAt: NOW,
    bestSellingRank: 9,
  },
  {
    id: 'gid://shopify/Product/1008',
    handle: 'cloud-bath-robe',
    title: 'Cloud Bath Robe',
    vendor: '{AppName}',
    productType: 'Bath',
    tags: ['bath', 'robe'],
    description:
      'A spa-weight robe in our baby-soft comforter fabric. Lounge-ready in seconds.',
    descriptionHtml:
      '<p>A spa-weight robe in our baby-soft comforter fabric. Lounge-ready in seconds.</p>',
    images: [
      image('cloud-bath-robe', 1, 'Cloud Bath Robe'),
      image('cloud-bath-robe', 2, 'Cloud Bath Robe detail'),
    ],
    options: [{name: 'Size', values: [{name: 'S/M'}, {name: 'L/XL'}]}],
    variants: sizeVariants('cloud-bath-robe', [
      {name: 'S/M', price: 79.99, compareAt: 130},
      {name: 'L/XL', price: 79.99, compareAt: 130},
    ]),
    collections: ['all', 'bath'],
    metafields: [
      {namespace: 'reviews', key: 'rating', type: 'rating', value: rating(4.8)},
      {
        namespace: 'reviews',
        key: 'rating_count',
        type: 'number_integer',
        value: '312',
      },
      {
        namespace: 'mellow',
        key: 'features',
        type: 'list.single_line_text_field',
        value: list([
          'feather|Baby-soft comforter fabric',
          'wash|Machine washable',
        ]),
      },
      {
        namespace: 'mellow',
        key: 'materials',
        type: 'multi_line_text_field',
        value: 'Shell: 100% brushed microfiber. Lining: cotton terry.',
      },
      {
        namespace: 'mellow',
        key: 'care',
        type: 'multi_line_text_field',
        value: 'Machine wash cold. Tumble dry low.',
      },
    ],
    createdAt: CREATED,
    updatedAt: NOW,
    bestSellingRank: 10,
  },
  {
    id: 'gid://shopify/Product/1009',
    handle: 'better-sleep-bundle',
    title: 'Better Sleep Bundle',
    vendor: '{AppName}',
    productType: 'Bundle',
    tags: ['bundle', 'bestseller'],
    description:
      'The CloudAlign Pillow and MarshMellow Comforter together. Everything you need for your best night.',
    descriptionHtml:
      '<p>The CloudAlign Pillow and MarshMellow Comforter together. Everything you need for your best night, at our best price.</p>',
    images: [
      image('better-sleep-bundle', 1, 'Better Sleep Bundle'),
      image('better-sleep-bundle', 2, 'Better Sleep Bundle contents'),
    ],
    options: [
      {
        name: 'Size',
        values: [{name: 'Twin'}, {name: 'Full/Queen'}, {name: 'King'}],
      },
    ],
    variants: sizeVariants('better-sleep-bundle', [
      {name: 'Twin', price: 139.99, compareAt: 300},
      {name: 'Full/Queen', price: 149.99, compareAt: 320},
      {name: 'King', price: 169.99, compareAt: 360},
    ]),
    collections: ['all', 'bundles'],
    metafields: [
      {namespace: 'reviews', key: 'rating', type: 'rating', value: rating(4.9)},
      {
        namespace: 'reviews',
        key: 'rating_count',
        type: 'number_integer',
        value: '2311',
      },
      {
        namespace: 'mellow',
        key: 'badge',
        type: 'single_line_text_field',
        value: 'Bestseller',
      },
      {
        namespace: 'mellow',
        key: 'features',
        type: 'list.single_line_text_field',
        value: list([
          'check|Includes CloudAlign Pillow (Standard)',
          'check|Includes MarshMellow Comforter',
          'sparkle|Save more when you bundle',
        ]),
      },
      {
        namespace: 'mellow',
        key: 'materials',
        type: 'multi_line_text_field',
        value: `${PILLOW_MATERIALS}\n\n${COMFORTER_MATERIALS}`,
      },
      {
        namespace: 'mellow',
        key: 'care',
        type: 'multi_line_text_field',
        value: COMFORTER_CARE,
      },
    ],
    createdAt: CREATED,
    updatedAt: NOW,
    bestSellingRank: 4,
  },
  {
    id: 'gid://shopify/Product/1010',
    handle: 'cool-sleeper-bundle',
    title: 'Cool Sleeper Bundle',
    vendor: '{AppName}',
    productType: 'Bundle',
    tags: ['bundle', 'cooling'],
    description:
      'The CloudCool Cooling Comforter paired with two CloudAlign Pillows for hot sleepers.',
    descriptionHtml:
      '<p>The CloudCool Cooling Comforter paired with two CloudAlign Pillows for hot sleepers.</p>',
    images: [
      image('cool-sleeper-bundle', 1, 'Cool Sleeper Bundle'),
      image('cool-sleeper-bundle', 2, 'Cool Sleeper Bundle contents'),
    ],
    options: [{name: 'Size', values: [{name: 'Full/Queen'}, {name: 'King'}]}],
    variants: sizeVariants('cool-sleeper-bundle', [
      {name: 'Full/Queen', price: 119.99, compareAt: 220},
      {name: 'King', price: 139.99, compareAt: 260},
    ]),
    collections: ['all', 'bundles'],
    metafields: [
      {namespace: 'reviews', key: 'rating', type: 'rating', value: rating(4.8)},
      {
        namespace: 'reviews',
        key: 'rating_count',
        type: 'number_integer',
        value: '980',
      },
      {
        namespace: 'mellow',
        key: 'features',
        type: 'list.single_line_text_field',
        value: list([
          'snowflake|Cool-touch comforter for hot sleepers',
          'check|Includes two CloudAlign Pillows',
        ]),
      },
      {
        namespace: 'mellow',
        key: 'materials',
        type: 'multi_line_text_field',
        value: COMFORTER_MATERIALS,
      },
      {
        namespace: 'mellow',
        key: 'care',
        type: 'multi_line_text_field',
        value: COMFORTER_CARE,
      },
    ],
    createdAt: CREATED,
    updatedAt: NOW,
    bestSellingRank: 7,
  },
  // --- Extra products that belong only to the Shop All collection -------------
  // They push /collections/all past one page (12 per page) so pagination
  // ("Load more") can be exercised against the mock. Ranks 11-13 and an older
  // createdAt keep every other listing, search result and recommendation
  // unchanged.
  {
    id: 'gid://shopify/Product/1011',
    handle: 'silk-sleep-mask',
    title: 'Silk Sleep Mask',
    vendor: '{AppName}',
    productType: 'Accessories',
    tags: ['accessories', 'sleep mask'],
    description:
      'Mulberry silk on both sides, a contoured fit that blocks light without pressing on your eyes.',
    descriptionHtml:
      '<p>Mulberry silk on both sides, a contoured fit that blocks light without pressing on your eyes.</p>',
    images: [
      image('silk-sleep-mask', 1, 'Silk Sleep Mask'),
      image('silk-sleep-mask', 2, 'Silk Sleep Mask detail'),
    ],
    options: [{name: 'Size', values: [{name: 'One Size'}]}],
    variants: sizeVariants('silk-sleep-mask', [
      {name: 'One Size', price: 29.99, compareAt: 45},
    ]),
    collections: ['all'],
    metafields: [
      {namespace: 'reviews', key: 'rating', type: 'rating', value: rating(4.6)},
      {
        namespace: 'reviews',
        key: 'rating_count',
        type: 'number_integer',
        value: '412',
      },
      {
        namespace: 'mellow',
        key: 'features',
        type: 'list.single_line_text_field',
        value: list([
          'moon|Total blackout, zero pressure',
          'feather|22-momme mulberry silk',
        ]),
      },
      {
        namespace: 'mellow',
        key: 'materials',
        type: 'multi_line_text_field',
        value: '100% 22-momme mulberry silk shell. Hypoallergenic fibre fill.',
      },
      {
        namespace: 'mellow',
        key: 'care',
        type: 'multi_line_text_field',
        value: 'Hand wash cold with a mild detergent. Lay flat to dry.',
      },
    ],
    createdAt: '2024-06-01T12:00:00Z',
    updatedAt: NOW,
    bestSellingRank: 11,
  },
  {
    id: 'gid://shopify/Product/1012',
    handle: 'linen-sheet-set',
    title: 'Linen Sheet Set',
    vendor: '{AppName}',
    productType: 'Sheets',
    tags: ['sheets', 'linen'],
    description:
      'Stonewashed European flax that gets softer with every wash. Breathable in summer, cosy in winter.',
    descriptionHtml:
      '<p>Stonewashed European flax that gets softer with every wash. Breathable in summer, cosy in winter.</p>',
    images: [
      image('linen-sheet-set', 1, 'Linen Sheet Set'),
      image('linen-sheet-set', 2, 'Linen Sheet Set folded'),
    ],
    options: [
      {name: 'Size', values: [{name: 'Twin'}, {name: 'Queen'}, {name: 'King'}]},
    ],
    variants: sizeVariants('linen-sheet-set', [
      {name: 'Twin', price: 129, compareAt: 199},
      {name: 'Queen', price: 159, compareAt: 249},
      {name: 'King', price: 179, compareAt: 279},
    ]),
    collections: ['all'],
    metafields: [
      {namespace: 'reviews', key: 'rating', type: 'rating', value: rating(4.8)},
      {
        namespace: 'reviews',
        key: 'rating_count',
        type: 'number_integer',
        value: '1203',
      },
      {
        namespace: 'mellow',
        key: 'features',
        type: 'list.single_line_text_field',
        value: list([
          'leaf|100% European flax linen',
          'wash|Softer with every wash',
        ]),
      },
      {
        namespace: 'mellow',
        key: 'materials',
        type: 'multi_line_text_field',
        value: '100% stonewashed European flax linen, OEKO-TEX® Standard 100.',
      },
      {
        namespace: 'mellow',
        key: 'care',
        type: 'multi_line_text_field',
        value: 'Machine wash warm. Tumble dry low and remove promptly.',
      },
    ],
    createdAt: '2024-06-01T12:00:00Z',
    updatedAt: NOW,
    bestSellingRank: 12,
  },
  {
    id: 'gid://shopify/Product/1013',
    handle: 'weighted-blanket',
    title: 'Weighted Blanket',
    vendor: '{AppName}',
    productType: 'Blankets',
    tags: ['blankets', 'weighted'],
    description:
      'Evenly distributed glass beads in a quilted knit cover for deep, calming pressure all night.',
    descriptionHtml:
      '<p>Evenly distributed glass beads in a quilted knit cover for deep, calming pressure all night.</p>',
    images: [
      image('weighted-blanket', 1, 'Weighted Blanket'),
      image('weighted-blanket', 2, 'Weighted Blanket draped'),
    ],
    options: [
      {
        name: 'Size',
        values: [{name: '12 lb'}, {name: '15 lb'}, {name: '20 lb'}],
      },
    ],
    variants: sizeVariants('weighted-blanket', [
      {name: '12 lb', price: 119, compareAt: 169},
      {name: '15 lb', price: 129, compareAt: 179},
      {name: '20 lb', price: 139, compareAt: 189},
    ]),
    collections: ['all'],
    metafields: [
      {namespace: 'reviews', key: 'rating', type: 'rating', value: rating(4.7)},
      {
        namespace: 'reviews',
        key: 'rating_count',
        type: 'number_integer',
        value: '876',
      },
      {
        namespace: 'mellow',
        key: 'features',
        type: 'list.single_line_text_field',
        value: list([
          'moon|Deep, even pressure',
          'wash|Removable washable cover',
        ]),
      },
      {
        namespace: 'mellow',
        key: 'materials',
        type: 'multi_line_text_field',
        value:
          'Cover: 100% cotton knit. Inner: micro glass beads in quilted polyester pockets.',
      },
      {
        namespace: 'mellow',
        key: 'care',
        type: 'multi_line_text_field',
        value: 'Machine wash the cover cold. Spot clean the weighted inner.',
      },
    ],
    createdAt: '2024-06-01T12:00:00Z',
    updatedAt: NOW,
    bestSellingRank: 13,
  },
];

function collectionImage(handle: string, alt: string): ImageSeed {
  return {
    id: `gid://shopify/CollectionImage/${handle}`,
    url: `/images/placeholders/lifestyle-${handle === 'bath' ? 2 : 1}.svg`,
    altText: alt,
    width: 1376,
    height: 760,
  };
}

export const COLLECTION_SEEDS: CollectionSeed[] = [
  {
    id: 'gid://shopify/Collection/2001',
    handle: 'all',
    title: 'Shop All',
    description:
      'Every {AppName} pillow, comforter, bath essential and bundle in one place.',
    descriptionHtml:
      '<p>Every {AppName} pillow, comforter, bath essential and bundle in one place.</p>',
    image: collectionImage('all', '{AppName} bedding collection'),
    updatedAt: NOW,
  },
  {
    id: 'gid://shopify/Collection/2002',
    handle: 'most-loved',
    title: 'Most Loved',
    description:
      'From adaptive comforters to cloud-like pillows, every {AppName} product is designed to make sleep effortless.',
    descriptionHtml:
      '<p>From adaptive comforters to cloud-like pillows, every {AppName} product is designed to make sleep effortless.</p>',
    image: collectionImage('most-loved', 'Our most loved sleep products'),
    updatedAt: NOW,
    productOrder: [
      'cloudalign-pillow',
      'marshmellow-comforter',
      'cloudcool-cooling-comforter',
      'pebble-pillow',
      'cloudcontrol-comforter',
      'cloud-body-pillow',
    ],
  },
  {
    id: 'gid://shopify/Collection/2003',
    handle: 'pillows',
    title: 'Pillows',
    description: 'Ergonomic, cloud-soft and cooling. Pillows that align.',
    descriptionHtml:
      '<p>Ergonomic, cloud-soft and cooling. Pillows that align.</p>',
    image: collectionImage('pillows', '{AppName} pillows'),
    updatedAt: NOW,
  },
  {
    id: 'gid://shopify/Collection/2004',
    handle: 'comforters',
    title: 'Comforters',
    description:
      'Dual-sided cooling, ultra-fluffy and washable. Comforters that adapt.',
    descriptionHtml:
      '<p>Dual-sided cooling, ultra-fluffy and washable. Comforters that adapt.</p>',
    image: collectionImage('comforters', '{AppName} comforters'),
    updatedAt: NOW,
  },
  {
    id: 'gid://shopify/Collection/2005',
    handle: 'bath',
    title: 'Bath',
    description: 'Plush towels and robes in our signature baby-soft fabrics.',
    descriptionHtml:
      '<p>Plush towels and robes in our signature baby-soft fabrics.</p>',
    image: collectionImage('bath', '{AppName} bath essentials'),
    updatedAt: NOW,
  },
  {
    id: 'gid://shopify/Collection/2006',
    handle: 'bundles',
    title: 'Bundles',
    description:
      'Save more when you bundle. Curated sets for every kind of sleeper.',
    descriptionHtml:
      '<p>Save more when you bundle. Curated sets for every kind of sleeper.</p>',
    image: collectionImage('bundles', '{AppName} bundles'),
    updatedAt: NOW,
  },
];

export const STORE_URL = 'https://mellow.mock';

export const MENU_SEEDS: MenuSeed[] = [
  {
    id: 'gid://shopify/Menu/main-menu',
    handle: 'main-menu',
    title: 'Main menu',
    items: [
      {
        id: 'gid://shopify/MenuItem/main-1',
        title: 'Shop',
        url: `${STORE_URL}/collections/all`,
        type: 'COLLECTION',
        resourceId: 'gid://shopify/Collection/2001',
      },
      {
        id: 'gid://shopify/MenuItem/main-2',
        title: 'Bath',
        url: `${STORE_URL}/collections/bath`,
        type: 'COLLECTION',
        resourceId: 'gid://shopify/Collection/2005',
      },
      {
        id: 'gid://shopify/MenuItem/main-3',
        title: 'Bundles',
        url: `${STORE_URL}/collections/bundles`,
        type: 'COLLECTION',
        resourceId: 'gid://shopify/Collection/2006',
      },
      {
        id: 'gid://shopify/MenuItem/main-4',
        title: 'About',
        url: `${STORE_URL}/pages/about`,
        type: 'PAGE',
        resourceId: 'gid://shopify/Page/about',
      },
    ],
  },
  {
    id: 'gid://shopify/Menu/footer',
    handle: 'footer',
    title: 'Footer menu',
    items: [
      {
        id: 'gid://shopify/MenuItem/footer-shop',
        title: 'Shop',
        url: `${STORE_URL}/collections/all`,
        type: 'COLLECTION',
        items: [
          {
            id: 'gid://shopify/MenuItem/footer-shop-1',
            title: 'Pillows',
            url: `${STORE_URL}/collections/pillows`,
            type: 'COLLECTION',
          },
          {
            id: 'gid://shopify/MenuItem/footer-shop-2',
            title: 'Comforters',
            url: `${STORE_URL}/collections/comforters`,
            type: 'COLLECTION',
          },
          {
            id: 'gid://shopify/MenuItem/footer-shop-3',
            title: 'Bath',
            url: `${STORE_URL}/collections/bath`,
            type: 'COLLECTION',
          },
          {
            id: 'gid://shopify/MenuItem/footer-shop-4',
            title: 'Bundles',
            url: `${STORE_URL}/collections/bundles`,
            type: 'COLLECTION',
          },
        ],
      },
      {
        id: 'gid://shopify/MenuItem/footer-learn',
        title: 'Learn',
        url: `${STORE_URL}/pages/about`,
        type: 'PAGE',
        items: [
          {
            id: 'gid://shopify/MenuItem/footer-learn-1',
            title: 'About Us',
            url: `${STORE_URL}/pages/about`,
            type: 'PAGE',
          },
          {
            id: 'gid://shopify/MenuItem/footer-learn-2',
            title: 'Blog',
            url: `${STORE_URL}/blogs`,
            type: 'HTTP',
          },
          {
            id: 'gid://shopify/MenuItem/footer-learn-3',
            title: 'Reviews',
            url: `${STORE_URL}/#reviews`,
            type: 'HTTP',
          },
          {
            id: 'gid://shopify/MenuItem/footer-learn-4',
            title: 'FAQ',
            url: `${STORE_URL}/#faq`,
            type: 'HTTP',
          },
        ],
      },
      {
        id: 'gid://shopify/MenuItem/footer-support',
        title: 'Support',
        url: `${STORE_URL}/policies`,
        type: 'HTTP',
        items: [
          {
            id: 'gid://shopify/MenuItem/footer-support-1',
            title: 'Contact Us',
            url: `${STORE_URL}/policies/contact-information`,
            type: 'SHOP_POLICY',
          },
          {
            id: 'gid://shopify/MenuItem/footer-support-2',
            title: 'Account',
            url: `${STORE_URL}/account`,
            type: 'HTTP',
          },
          {
            id: 'gid://shopify/MenuItem/footer-support-3',
            title: 'Privacy Policy',
            url: `${STORE_URL}/policies/privacy-policy`,
            type: 'SHOP_POLICY',
          },
          {
            id: 'gid://shopify/MenuItem/footer-support-4',
            title: 'Terms of Service',
            url: `${STORE_URL}/policies/terms-of-service`,
            type: 'SHOP_POLICY',
          },
          {
            id: 'gid://shopify/MenuItem/footer-support-5',
            title: 'Returns',
            url: `${STORE_URL}/policies/refund-policy`,
            type: 'SHOP_POLICY',
          },
          {
            id: 'gid://shopify/MenuItem/footer-support-6',
            title: 'Shipping Policy',
            url: `${STORE_URL}/policies/shipping-policy`,
            type: 'SHOP_POLICY',
          },
          {
            id: 'gid://shopify/MenuItem/footer-support-7',
            title: 'Legal Notice',
            url: `${STORE_URL}/policies/legal-notice`,
            type: 'SHOP_POLICY',
          },
        ],
      },
      {
        id: 'gid://shopify/MenuItem/footer-social',
        title: 'Social',
        url: 'https://www.instagram.com/',
        type: 'HTTP',
        items: [
          {
            id: 'gid://shopify/MenuItem/footer-social-1',
            title: 'Instagram',
            url: 'https://www.instagram.com/',
            type: 'HTTP',
          },
          {
            id: 'gid://shopify/MenuItem/footer-social-2',
            title: 'Facebook',
            url: 'https://www.facebook.com/',
            type: 'HTTP',
          },
          {
            id: 'gid://shopify/MenuItem/footer-social-3',
            title: 'TikTok',
            url: 'https://www.tiktok.com/',
            type: 'HTTP',
          },
        ],
      },
    ],
  },
];

export const PAGE_SEEDS: PageSeed[] = [
  {
    id: 'gid://shopify/Page/about',
    handle: 'about',
    title: 'About {AppName}',
    body: '<p>{AppName} started with a comforter that changed everything. Today we design pillows, comforters and bath essentials for people who are done compromising on sleep.</p>',
    bodySummary: '{AppName} started with a comforter that changed everything.',
    seo: {
      title: 'About {AppName} | Sleep Was Broken. We Fixed It.',
      description:
        'Bedding and sleepwear, done right. Engineered for better sleep.',
    },
    createdAt: CREATED,
    updatedAt: NOW,
  },
];

/** The four Shopify shop policies, seeded from the storefront's own documents. */
export const POLICY_SEEDS: PolicySeed[] = (
  [
    'privacy-policy',
    'refund-policy',
    'shipping-policy',
    'terms-of-service',
  ] as const
).map((handle) => {
  const policy = getStorefrontPolicy(handle);
  if (!policy) throw new Error(`No storefront policy for ${handle}`);
  return {
    id: `gid://shopify/ShopPolicy/${handle}`,
    handle,
    title: policy.title,
    body: policy.body,
  };
});
