/**
 * Pure helpers for GraphQL documents and responses, ported from Hydrogen
 * 2026.4.7 (`minifyQuery`, the query/mutation checks and `parseJSON` in
 * node_modules/@shopify/hydrogen/dist/development/index.js).
 */

/** Hydrogen parity: everything from `#` to the end of a line is a comment. */
const COMMENT_RE = /\s*#.*$/gm;
const WHITESPACE_RE = /\s+/gm;
/** Hydrogen parity: the keyword opens the document or follows a fragment. */
const QUERY_RE = /(^|}\s)query[\s({]/im;
const MUTATION_RE = /(^|}\s)mutation[\s({]/im;
const OPERATION_NAME_RE =
  /(?:^|}\s)(?:query|mutation)\s+([_A-Za-z][_0-9A-Za-z]*)/;
const ANONYMOUS_OPERATION = 'anonymous';
const PROTO_KEY = '__proto__';

/**
 * Strips comments (including the `#graphql` marker) and collapses whitespace,
 * exactly like Hydrogen. A `#` inside a string literal also starts a comment,
 * so values containing `#` must be passed as variables.
 */
export function minifyQuery(document: string): string {
  return document.replace(COMMENT_RE, '').replace(WHITESPACE_RE, ' ').trim();
}

/** True for a `query` operation. The `{ shop }` shorthand is not one. */
export function isQueryDocument(document: string): boolean {
  return QUERY_RE.test(minifyQuery(document));
}

/** True for a `mutation` operation. */
export function isMutationDocument(document: string): boolean {
  return MUTATION_RE.test(minifyQuery(document));
}

/** The operation's name for logs, or `'anonymous'` when it has none. */
export function getOperationName(document: string): string {
  return (
    OPERATION_NAME_RE.exec(minifyQuery(document))?.[1] ?? ANONYMOUS_OPERATION
  );
}

/**
 * `JSON.parse` that drops every `__proto__` key, so copying the result with
 * `Object.assign` or a deep merge cannot swap in an attacker's prototype.
 * The reviver always runs: a key written with Unicode escapes
 * (`"\u005f_proto__"`) only becomes `__proto__` while parsing, so screening
 * the raw text for it is not enough. Throws a `SyntaxError` on invalid JSON.
 */
export function parseJson<T = unknown>(text: string): T {
  return JSON.parse(text, dropProtoKey) as T;
}

function dropProtoKey(key: string, value: unknown): unknown {
  return key === PROTO_KEY ? undefined : value;
}
