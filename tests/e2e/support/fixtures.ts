/**
 * The `test` every spec imports instead of `@playwright/test`:
 *
 *   import {expect, test} from './support/fixtures';
 *
 * What it adds to Playwright's `test`
 * - `context` is wrapped with hermetic third-party network stubs
 *   (./network.ts): fonts, Shopify's consent script and analytics hosts never
 *   leave the machine.
 * - `consoleGuard` (automatic, in every test) fails the test at teardown when
 *   the browser logged an unexpected console error or warning, or threw an
 *   uncaught error (./console.ts). Allow the ones a test provokes on purpose:
 *   `consoleGuard.allowHttpStatus(404, '/products/nope')`.
 *
 * Re-exported for convenience: `expect`. Everything else comes from
 * `@playwright/test` as usual (`Page`, `Locator`, ...).
 *
 * Fixtures that do not touch pages (the `request` fixture used by API-level
 * specs) are unchanged; they have no console to guard and no third-party
 * traffic.
 *
 * Other helpers, by module: ./hydration (gotoHydrated), ./layout, ./catalog,
 * ./cart (seedCart), ./dialogs, ./seo. See tests/e2e/README.md.
 */
import {expect, test as base} from '@playwright/test';
import {ConsoleGuard} from './console';
import {installNetworkStubs} from './network';

interface E2EFixtures {
  /** Records console errors/warnings and page errors; see ./console.ts. */
  consoleGuard: ConsoleGuard;
}

export const test = base.extend<E2EFixtures>({
  context: async ({context, baseURL}, use) => {
    if (!baseURL)
      throw new Error('baseURL must be configured for the e2e suite');
    await installNetworkStubs(context, new URL(baseURL).origin);
    await use(context);
  },

  consoleGuard: [
    async ({context}, use, testInfo) => {
      const guard = new ConsoleGuard(context);
      await use(guard);

      await guard.settle();
      const unexpected = guard.unexpected();
      if (unexpected.length > 0) {
        await testInfo.attach('unexpected-console.txt', {
          body: [
            ...guard.describe(unexpected),
            '',
            'Allowances in effect:',
            ...guard.allowances().map((reason) => `  - ${reason}`),
          ].join('\n'),
          contentType: 'text/plain',
        });
      }
      expect(
        guard.describe(unexpected),
        'unexpected console errors, warnings or page errors (allow them with consoleGuard.allow(..., reason) only if the test provokes them on purpose)',
      ).toEqual([]);
      guard.dispose();
    },
    {auto: true},
  ],
});

export {expect};
