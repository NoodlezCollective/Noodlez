import type {ProductFeature, ProductReview} from './types';

/**
 * Metafield identifiers the storefront reads from Shopify.
 *
 * The GraphQL fragments hard-code the same namespace/key pairs and alias names
 * (GraphQL documents must be static for codegen); this table is the single
 * documented source of truth and is reused by the development mock.
 */
export const PRODUCT_METAFIELDS = {
  /** Shopify standard product review metafields. */
  rating: {namespace: 'reviews', key: 'rating', alias: 'rating'},
  ratingCount: {
    namespace: 'reviews',
    key: 'rating_count',
    alias: 'ratingCount',
  },
  /** "BESTSELLER", "NEW" … shown as a pill on product cards. */
  badge: {namespace: 'mellow', key: 'badge', alias: 'badge'},
  /** Short card copy. Falls back to the product description. */
  shortDescription: {
    namespace: 'mellow',
    key: 'short_description',
    alias: 'shortDescription',
  },
  /** list.single_line_text_field – "icon|Feature text" or plain text. */
  features: {namespace: 'mellow', key: 'features', alias: 'features'},
  /** multi_line_text_field or rich_text_field. */
  materials: {namespace: 'mellow', key: 'materials', alias: 'materials'},
  care: {namespace: 'mellow', key: 'care', alias: 'care'},
  /** json – {"Group label": ["Option value", ...]} groups colour swatches. */
  swatchGroups: {
    namespace: 'mellow',
    key: 'swatch_groups',
    alias: 'swatchGroups',
  },
  /** Overrides the "Savings based on comparable value." note. */
  savingsNote: {namespace: 'mellow', key: 'savings_note', alias: 'savingsNote'},
  /** list.metaobject_reference → mellow_review metaobjects. */
  featuredReviews: {
    namespace: 'mellow',
    key: 'featured_reviews',
    alias: 'featuredReviews',
  },
} as const;

export type MetafieldValue = {value?: string | null; type?: string | null} | null | undefined;

/** Accepts Shopify's `rating` JSON ({"value":"4.8", …}) or a plain number. */
export function parseRating(field: MetafieldValue): number | null {
  const raw = field?.value;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as {value?: string | number};
      const num = Number(parsed.value);
      return Number.isFinite(num) ? num : null;
    } catch {
      return null;
    }
  }
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

export function parseInteger(field: MetafieldValue): number | null {
  const raw = field?.value;
  if (!raw) return null;
  const num = Number.parseInt(raw, 10);
  return Number.isFinite(num) ? num : null;
}

export function parseJson<T>(field: MetafieldValue): T | null {
  const raw = field?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Accepts a JSON array (list metafields) or newline separated text. */
export function parseStringList(field: MetafieldValue): string[] {
  const raw = field?.value;
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    const parsed = parseJson<unknown>(field);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === 'string' && v.length > 0)
      : [];
  }
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

const DEFAULT_FEATURE_ICONS = [
  'snowflake',
  'heat',
  'couch',
  'wash',
  'feather',
  'moon',
] as const;

/**
 * Parses feature bullets. Each entry may be prefixed with an icon key:
 * "snowflake|Cool to the touch instantly". Entries without an icon rotate
 * through a default set so the list always renders with icons.
 */
export function parseFeatures(field: MetafieldValue): ProductFeature[] {
  return parseStringList(field).map((entry, index) => {
    const separator = entry.indexOf('|');
    if (separator > 0 && separator < 24) {
      return {
        icon: entry.slice(0, separator).trim().toLowerCase(),
        text: entry.slice(separator + 1).trim(),
      };
    }
    return {
      icon: DEFAULT_FEATURE_ICONS[index % DEFAULT_FEATURE_ICONS.length],
      text: entry,
    };
  });
}

export type SwatchGroups = Record<string, string[]>;

export function parseSwatchGroups(field: MetafieldValue): SwatchGroups | null {
  const parsed = parseJson<unknown>(field);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const groups: SwatchGroups = {};
  for (const [label, values] of Object.entries(parsed as Record<string, unknown>)) {
    if (Array.isArray(values)) {
      const names = values.filter((v): v is string => typeof v === 'string');
      if (names.length) groups[label] = names;
    }
  }
  return Object.keys(groups).length ? groups : null;
}

/**
 * Converts a multi_line_text_field or rich_text_field value into paragraphs.
 * Rich text is flattened to plain paragraphs (headings become bold lines).
 */
export function parseParagraphs(field: MetafieldValue): string[] {
  const raw = field?.value;
  if (!raw) return [];
  const trimmed = raw.trim();
  if (field?.type === 'rich_text_field' || trimmed.startsWith('{"type":"root"')) {
    const doc = parseJson<RichTextNode>(field);
    return doc ? flattenRichText(doc) : [];
  }
  return trimmed
    .split(/\r?\n\s*\r?\n|\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

type RichTextNode = {
  type: string;
  value?: string;
  children?: RichTextNode[];
};

function flattenRichText(node: RichTextNode): string[] {
  if (node.type === 'root') {
    return (node.children ?? []).flatMap(flattenRichText);
  }
  if (node.type === 'list') {
    return (node.children ?? []).map((item) => `• ${collectText(item)}`);
  }
  const text = collectText(node);
  return text ? [text] : [];
}

function collectText(node: RichTextNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(collectText).join('');
}

type ReviewMetaobjectLike = {
  id: string;
  fields: Array<{key: string; value?: string | null}>;
};

/** Maps `mellow_review` metaobjects to the ProductReview contract. */
export function mapReviewMetaobjects(
  nodes: Array<ReviewMetaobjectLike | null | undefined> | null | undefined,
): ProductReview[] {
  if (!nodes) return [];
  return nodes.flatMap((node) => {
    if (!node) return [];
    const get = (key: string) =>
      node.fields.find((field) => field.key === key)?.value ?? null;
    const body = get('body');
    if (!body) return [];
    return [
      {
        id: node.id,
        rating: parseRating({value: get('rating')}) ?? 5,
        title: get('title'),
        body,
        author: get('author') ?? 'Verified buyer',
        verified: get('verified') !== 'false',
        date: get('date'),
      },
    ];
  });
}
