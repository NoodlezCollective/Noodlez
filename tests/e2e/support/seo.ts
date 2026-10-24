/**
 * Readers for what search engines and link previews see in <head> and in the
 * JSON-LD block. They read the DOM of the current page; run them on a page
 * loaded with JavaScript disabled to assert on the server-rendered HTML
 * exactly as a crawler gets it (see seo.spec.ts):
 *
 *   test.use({javaScriptEnabled: false});
 *   await page.goto('/products/cloudalign-pillow');
 *   const [product] = await readJsonLd(page);
 *   expect(await canonicalHrefs(page)).toEqual([`${origin}/products/cloudalign-pillow`]);
 *   expect(await metaContent(page, 'meta[property="og:type"]')).toBe('product');
 */
import type {Page} from '@playwright/test';

/** Raw text of every `<script type="application/ld+json">`. */
export function readRawJsonLd(page: Page): Promise<string[]> {
  return page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((scripts) =>
      scripts.map((script) => script.textContent ?? ''),
    );
}

/** Parsed JSON-LD documents (throws on invalid JSON, which is itself a bug). */
export async function readJsonLd(page: Page): Promise<unknown[]> {
  const raw = await readRawJsonLd(page);
  return raw.map((text) => JSON.parse(text) as unknown);
}

/** `href` of every `<link rel="canonical">` (a page must have exactly one). */
export function canonicalHrefs(page: Page): Promise<string[]> {
  return page
    .locator('head link[rel="canonical"]')
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute('href') ?? ''),
    );
}

/** `content` of the first element matching `selector`, or null if absent. */
export async function metaContent(
  page: Page,
  selector: string,
): Promise<string | null> {
  const meta = page.locator(selector).first();
  if ((await page.locator(selector).count()) === 0) return null;
  return meta.getAttribute('content');
}

/** `<meta property="og:<name>">` content, or null. */
export function ogContent(page: Page, name: string): Promise<string | null> {
  return metaContent(page, `head meta[property="og:${name}"]`);
}

/** `<meta name="<name>">` content (description, robots ...), or null. */
export function namedMeta(page: Page, name: string): Promise<string | null> {
  return metaContent(page, `head meta[name="${name}"]`);
}

/** How many `<meta>` tags carry this selector (duplicates are SEO bugs). */
export function countMeta(page: Page, selector: string): Promise<number> {
  return page.locator(selector).count();
}
