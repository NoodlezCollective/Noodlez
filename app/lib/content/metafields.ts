import {isFeatureIconKey, type FeatureIconKey} from '~/components/ui/Icons';
import {isNonEmptyString, isRecord, isString} from '~/lib/guards';
import type {PackTier, ProductFeature, ProductReview} from './types';

export type MetafieldValue =
  {value?: string | null; type?: string | null} | null | undefined;

/** Ratings are expressed in stars on a 0 to 5 scale. */
const MAX_RATING = 5;

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

/**
 * `mellow.pack_tiers`: list of `quantity|Label|Note` entries, e.g.
 * `2|Pair|Most popular`. Entries without a whole-number quantity of at least 1
 * are skipped; duplicates keep the first. Returns at most 4 tiers, sorted.
 */
export function parsePackTiers(field: MetafieldValue): PackTier[] {
  const seen = new Set<number>();
  return parseStringList(field)
    .flatMap((entry) => {
      const [rawQuantity, rawLabel, ...rest] = entry.split('|');
      const quantity = Number.parseInt(rawQuantity ?? '', 10);
      if (!Number.isInteger(quantity) || quantity < 1 || seen.has(quantity)) {
        return [];
      }
      seen.add(quantity);
      const label = rawLabel?.trim() || `${quantity} pack`;
      const note = rest.join('|').trim() || null;
      return [{quantity, label, note}];
    })
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 4);
}

/** `mellow.sold_recently`: units sold in the last 7 days (a positive integer). */
export function parseSoldRecently(field: MetafieldValue): number | null {
  const value = parseInteger(field);
  return value !== null && value > 0 ? value : null;
}
