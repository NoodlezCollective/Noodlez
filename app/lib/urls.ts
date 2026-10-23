/**
 * Helpers for URLs that arrive from the request (redirect targets) or from
 * merchant-managed content (menu items, metaobject links).
 */

/**
 * Resolves a redirect target supplied by the request (`?redirect=`, a form's
 * `redirectTo`, …) to a same-origin path. Anything that resolves to another
 * origin — `https://evil.example`, `//evil.example`, `/\evil.example`,
 * `http:evil.example`, tab or newline tricks — yields `fallback`. The result
 * is rebuilt from the parsed URL, never copied from the raw input.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  origin: string,
  fallback = '/',
): string {
  if (!value) return fallback;
  try {
    const parsed = new URL(value, origin);
    if (parsed.origin !== origin) return fallback;
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    // Dot segments can leave a same-origin pathname that starts with `//`
    // (`/.//host` → `//host`), which a browser reads as protocol-relative.
    return path.startsWith('//') ? fallback : path;
  } catch {
    return fallback;
  }
}

const SAFE_HREF_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Accepts an `href` from merchant-managed content when it is a relative path
 * or uses an http(s)/mailto/tel scheme; `javascript:`, `data:` and other
 * schemes fall back to `fallback`.
 */
export function safeHref(
  value: string | null | undefined,
  fallback = '/',
): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (/^(\/(?![\/\\])|#|\?)/.test(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed, 'https://placeholder.invalid');
    return SAFE_HREF_PROTOCOLS.has(parsed.protocol) ? trimmed : fallback;
  } catch {
    return fallback;
  }
}
