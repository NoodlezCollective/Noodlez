/**
 * Console guard: every test fails on console errors, console warnings and
 * uncaught page errors unless they are explicitly allowed.
 *
 * The guard is an auto fixture (see ./fixtures.ts), so specs only touch it to
 * allow something they provoke on purpose:
 *
 *   test('unknown product', async ({page, consoleGuard}) => {
 *     // Chromium logs "Failed to load resource ... 404" for the document.
 *     consoleGuard.allowHttpStatus(404, '/products/does-not-exist');
 *     await gotoHydrated(page, '/products/does-not-exist');
 *   });
 *
 *   consoleGuard.allow(/Refused to execute inline script/, 'CSP probe');
 *
 * Rules
 * - Records are stored raw and filtered at teardown, so allow() may be called
 *   before or after the message arrives.
 * - Always pass a reason to allow(); it is printed in the failure report.
 * - Scope allowances to the test that needs them. Never add a blanket rule
 *   (a bare /error/, "any 4xx", "anything from localhost").
 * - Only `error`, `warning` and `assert` console messages and uncaught page
 *   errors are recorded. `log`, `info` and `debug` (Vite's "[vite] connected",
 *   the React DevTools hint) are ignored.
 *
 * Baseline allowlist (BASELINE_ALLOWLIST below) applies to every test. It is
 * empty; read its comment before adding an entry.
 */
import type {BrowserContext, ConsoleMessage, WebError} from '@playwright/test';

export interface ConsoleRecord {
  /**
   * `console` for console.error/warn/assert calls and for the network errors
   * Chromium logs itself; `pageerror` for uncaught exceptions and unhandled
   * promise rejections.
   */
  kind: 'console' | 'pageerror';
  /** `error`, `warning` or `assert` for console records, `pageerror` otherwise. */
  type: string;
  text: string;
  /**
   * For "Failed to load resource" this is the failing resource's URL; for
   * everything else the script that logged (Vite rewrites that, so do not
   * match on it for application messages).
   */
  url: string;
  /** URL of the page when the message arrived. */
  pageUrl: string;
}

/**
 * string: substring of the message text. RegExp: tested against the text
 * (do not use the `g` flag). Function: full access to the record.
 */
export type ConsoleMatcher =
  string | RegExp | ((record: ConsoleRecord) => boolean);

export interface AllowRule {
  matcher: ConsoleMatcher;
  reason: string;
}

const WATCHED_CONSOLE_TYPES = new Set(['error', 'warning', 'assert']);

/**
 * Allowed in every test: nothing. In mock mode the storefront logs nothing to
 * the console by design. Analytics, the source of the last baseline entry
 * (Hydrogen's mock-shop warning, removed in Phase 4c), is off there: it runs
 * only with PUBLIC_CHECKOUT_DOMAIN and PUBLIC_STOREFRONT_ID set and the mock
 * off. An entry here hides a message from every test, so add one only for a
 * message every page logs by design, match its exact text and type, and say
 * why in this comment.
 *
 * Deliberately NOT allowed (a failure here is a real problem):
 * - `Failed to load resource` for cdn.shopify.com / fonts.googleapis.com /
 *   fonts.gstatic.com. The hermetic network stubs (./network.ts) answer
 *   every third-party request, so these cannot happen; an allowance would
 *   only hide a broken stub.
 * - Anything from analytics or consent: both are off in mock mode, so such a
 *   message means they switched on where they must not.
 * - React hydration / key warnings and CSP "Refused to ..." reports.
 */
export const BASELINE_ALLOWLIST: readonly AllowRule[] = [];

function matches(matcher: ConsoleMatcher, record: ConsoleRecord): boolean {
  if (typeof matcher === 'string') return record.text.includes(matcher);
  if (typeof matcher === 'function') return matcher(record);
  matcher.lastIndex = 0;
  return matcher.test(record.text);
}

export class ConsoleGuard {
  readonly #context: BrowserContext;
  readonly #records: ConsoleRecord[] = [];
  readonly #allowed: AllowRule[] = [...BASELINE_ALLOWLIST];
  readonly #onConsole = (message: ConsoleMessage) => {
    const type = message.type();
    if (!WATCHED_CONSOLE_TYPES.has(type)) return;
    this.#records.push({
      kind: 'console',
      type,
      text: message.text(),
      url: message.location().url,
      pageUrl: message.page()?.url() ?? '',
    });
  };
  readonly #onWebError = (webError: WebError) => {
    const error = webError.error();
    this.#records.push({
      kind: 'pageerror',
      type: 'pageerror',
      text: error.stack ?? `${error.name}: ${error.message}`,
      url: '',
      pageUrl: webError.page()?.url() ?? '',
    });
  };

  /** Starts listening on every current and future page of `context`. */
  constructor(context: BrowserContext) {
    this.#context = context;
    context.on('console', this.#onConsole);
    context.on('weberror', this.#onWebError);
  }

  /**
   * Allows messages matching `matcher` for the rest of this test. Always give
   * a reason: it is shown in the failure report and reviewed in code review.
   */
  allow(matcher: ConsoleMatcher, reason = 'allowed by the test'): void {
    this.#allowed.push({matcher, reason});
  }

  /**
   * Allows the line Chromium logs when a resource answers with `status`:
   * "Failed to load resource: the server responded with a status of 404 ...".
   * `urlIncludes` is matched against the failing resource's URL, so
   * `allowHttpStatus(404, '/products/nope')` also covers the client-side
   * `/products/nope.data` request, but not a 404 on any other URL.
   * Document navigations to a 4xx/5xx page log this line too.
   */
  allowHttpStatus(status: number, urlIncludes: string, reason?: string): void {
    const prefix = `Failed to load resource: the server responded with a status of ${status}`;
    this.allow(
      (record) =>
        record.kind === 'console' &&
        record.text.startsWith(prefix) &&
        record.url.includes(urlIncludes),
      reason ?? `expected HTTP ${status} for ${urlIncludes}`,
    );
  }

  /** Everything recorded so far, allowed or not. */
  records(): readonly ConsoleRecord[] {
    return [...this.#records];
  }

  /** Records that no allowance (baseline or per test) covers. */
  unexpected(): ConsoleRecord[] {
    return this.#records.filter(
      (record) => !this.#allowed.some((rule) => matches(rule.matcher, record)),
    );
  }

  /**
   * Resolves once console events emitted so far have been delivered: a
   * round trip to each open page is ordered after them on the same channel.
   */
  async settle(): Promise<void> {
    await Promise.all(
      this.#context
        .pages()
        .map((page) => page.evaluate(() => undefined).catch(() => undefined)),
    );
  }

  /** One line per record, for assertion messages and attachments. */
  describe(records: readonly ConsoleRecord[] = this.unexpected()): string[] {
    return records.map((record) => {
      const where = record.url ? ` (${record.url})` : '';
      const on = record.pageUrl ? ` on ${record.pageUrl}` : '';
      return `[${record.type}] ${record.text}${where}${on}`;
    });
  }

  /** Allowances in effect, for the failure report. */
  allowances(): string[] {
    return this.#allowed.map((rule) => rule.reason);
  }

  /** Stops listening. Not needed for fixture-managed guards. */
  dispose(): void {
    this.#context.off('console', this.#onConsole);
    this.#context.off('weberror', this.#onWebError);
  }
}
