import {isFeatureIconKey, type FeatureIconKey} from '~/components/ui/Icons';
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

export type MetafieldValue =
  {value?: string | null; type?: string | null} | null | undefined;

/** Ratings are expressed in stars on a 0 to 5 scale. */
const MAX_RATING = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** A finite number from a JSON number or a non-blank numeric string. */
function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'string' && value.trim()) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Accepts Shopify's `rating` JSON ({"value":"4.8","scale_min":"1.0",
 * "scale_max":"5.0"}) or a plain number and returns stars on a 0 to 5 scale:
 * a `scale_max` other than 5 is normalised (8 of 10 is 4 stars). Missing,
 * unparseable and out-of-range ratings are `null`; they are never invented.
 */
export function parseRating(field: MetafieldValue): number | null {
  const raw = field?.value?.trim();
  if (!raw) return null;

  let value: number | null;
  let scaleMax = MAX_RATING;
  if (raw.startsWith('{')) {
    const parsed = parseJson({value: raw});
    if (!isRecord(parsed)) return null;
    value = toFiniteNumber(parsed.value);
    const declaredScale = toFiniteNumber(parsed.scale_max);
    if (declaredScale !== null && declaredScale > 0) scaleMax = declaredScale;
  } else {
    value = toFiniteNumber(raw);
  }

  if (value === null || value < 0 || value > scaleMax) return null;
  return value === scaleMax ? MAX_RATING : (value * MAX_RATING) / scaleMax;
}

export function parseInteger(field: MetafieldValue): number | null {
  const raw = field?.value;
  if (!raw) return null;
  const num = Number.parseInt(raw, 10);
  return Number.isFinite(num) ? num : null;
}

/**
 * Parses a JSON metafield. The result is `unknown`: it is external data, so
 * callers must narrow it before use. Invalid JSON yields `null`.
 */
export function parseJson(field: MetafieldValue): unknown {
  const raw = field?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
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
    const parsed = parseJson(field);
    if (Array.isArray(parsed)) return parsed.filter(isNonEmptyString);
    // Not JSON after all ("[New] Cooler cover"): read it as plain lines.
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
] as const satisfies readonly FeatureIconKey[];

/**
 * Splits an "icon|text" entry. The prefix counts as an icon only when it is a
 * known icon key (case-insensitive); otherwise the whole entry is the text, so
 * "Machine washable | tumble dry low" is not cut in two and names such as
 * "constructor" never resolve to something inherited from Object.prototype.
 */
export function splitIconPrefix(entry: string): {
  icon: FeatureIconKey | null;
  text: string;
} {
  const separator = entry.indexOf('|');
  if (separator > 0) {
    const key = entry.slice(0, separator).trim().toLowerCase();
    if (isFeatureIconKey(key)) {
      return {icon: key, text: entry.slice(separator + 1).trim()};
    }
  }
  return {icon: null, text: entry.trim()};
}

/**
 * Parses feature bullets. Each entry may be prefixed with an icon key:
 * "snowflake|Cool to the touch instantly". Entries without an icon rotate
 * through a default set so the list always renders with icons. Entries that
 * have no text are dropped.
 */
export function parseFeatures(field: MetafieldValue): ProductFeature[] {
  return parseStringList(field).flatMap((entry, index) => {
    const {icon, text} = splitIconPrefix(entry);
    if (!text) return [];
    return [
      {
        icon:
          icon ?? DEFAULT_FEATURE_ICONS[index % DEFAULT_FEATURE_ICONS.length],
        text,
      },
    ];
  });
}

export type SwatchGroups = Record<string, string[]>;

export function parseSwatchGroups(field: MetafieldValue): SwatchGroups | null {
  const parsed = parseJson(field);
  if (!isRecord(parsed)) return null;
  const groups: SwatchGroups = {};
  for (const [label, values] of Object.entries(parsed)) {
    // Assigning "__proto__" would swap the prototype instead of adding a group.
    if (label === '__proto__' || !Array.isArray(values)) continue;
    const names = values.filter(isString);
    if (names.length) groups[label] = names;
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
  if (
    field?.type === 'rich_text_field' ||
    trimmed.startsWith('{"type":"root"')
  ) {
    return flattenRichText(parseJson(field));
  }
  return trimmed
    .split(/\r?\n\s*\r?\n|\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Shopify rich text nests a handful of levels; anything deeper is not content. */
const MAX_RICH_TEXT_DEPTH = 32;

function childNodes(node: Record<string, unknown>): unknown[] {
  return Array.isArray(node.children) ? node.children : [];
}

function flattenRichText(node: unknown, depth = 0): string[] {
  if (!isRecord(node) || depth > MAX_RICH_TEXT_DEPTH) return [];
  if (node.type === 'root') {
    return childNodes(node).flatMap((child) =>
      flattenRichText(child, depth + 1),
    );
  }
  if (node.type === 'list') {
    return childNodes(node)
      .map((item) => collectText(item, depth + 1))
      .filter(Boolean)
      .map((text) => `• ${text}`);
  }
  const text = collectText(node, depth);
  return text ? [text] : [];
}

function collectText(node: unknown, depth: number): string {
  if (!isRecord(node) || depth > MAX_RICH_TEXT_DEPTH) return '';
  if (node.type === 'text') return isString(node.value) ? node.value : '';
  return childNodes(node)
    .map((child) => collectText(child, depth + 1))
    .join('');
}

type ReviewMetaobjectLike = {
  id: string;
  fields: Array<{key: string; value?: string | null}>;
};

/**
 * Maps `mellow_review` metaobjects to the ProductReview contract. Nothing is
 * invented: a review without a valid rating has `rating: null`, and it is
 * `verified` only when the field is exactly "true".
 */
export function mapReviewMetaobjects(
  nodes: Array<ReviewMetaobjectLike | null | undefined> | null | undefined,
): ProductReview[] {
  if (!nodes) return [];
  return nodes.flatMap((node) => {
    if (!node) return [];
    const get = (key: string) =>
      node.fields.find((field) => field.key === key)?.value?.trim() || null;
    const body = get('body');
    if (!body) return [];
    return [
      {
        id: node.id,
        rating: parseRating({value: get('rating')}),
        title: get('title'),
        body,
        author: get('author') ?? 'Customer',
        verified:
          node.fields.find((field) => field.key === 'verified')?.value ===
          'true',
        date: get('date'),
      },
    ];
  });
}
