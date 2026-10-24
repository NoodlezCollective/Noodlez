/**
 * Hydration gate.
 *
 * Server-rendered HTML is interactive only after React has hydrated it. A test
 * that clicks "Cart" before that follows the native `<a href="/cart">`, typing
 * into a controlled input can be wiped by hydration, and a state update that
 * lands while a deferred `<Suspense>` boundary is still dehydrated throws
 * "This Suspense boundary received an update before it finished hydrating".
 * Use `gotoHydrated()` instead of `page.goto()` for every app document that
 * renders React (the plain-text 404 for very deep paths does not):
 *
 *   await gotoHydrated(page, '/products/cloudalign-pillow');
 *   await page.getByRole('button', {name: 'King'}).click();
 *
 * After a full-page navigation that is not a `goto` (a native link, a form
 * post, `page.reload()`) call `waitForHydration(page)` yourself. Client-side
 * navigations need nothing: assert on the result and Playwright retries.
 *
 * The gate waits for three things:
 *   1. `window.__reactRouterDataRouter`, which React Router sets while it
 *      renders the first client tree;
 *   2. React's bookkeeping on `<html>` (the `__reactProps$...` expando). The
 *      document element is the root of this app's tree (`Layout` in
 *      app/root.tsx renders `<html>`), and React completes it last, so once
 *      it carries props the shell is hydrated. Measured: 60-100 ms after (1),
 *      which is exactly the window in which early clicks and fills race
 *      hydration;
 *   3. every dehydrated Suspense boundary that holds markup has been hydrated.
 *      React hydrates `<Await>`/`<Suspense>` boundaries (header cart link,
 *      footer, cart drawer) as separate, later work: 100-150 ms after (2) on a
 *      fast machine. Boundaries appear in the DOM as `<!--$-->...<!--/$-->`;
 *      one is hydrated once its elements carry React props. Boundaries that
 *      are still streaming (`<!--$?-->`) are waited for; boundaries that hold
 *      only `<script>` tags (React Router's data stream) are ignored because
 *      React never claims those.
 *
 * Passive effects (`useEffect`) may still be pending when the gate opens;
 * assert on their results with auto-waiting expectations.
 *
 * If a React upgrade renames the expando prefix, every test will time out in
 * `waitForHydration`; fix the key check below (the helper self-test in
 * support.spec.ts fails first and says so).
 */
import type {Page, Response} from '@playwright/test';

export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    if (!('__reactRouterDataRouter' in window)) return false;

    const isOwnedByReact = (node: object) =>
      Object.keys(node).some(
        (key) =>
          key.startsWith('__reactProps$') || key.startsWith('__reactFiber$'),
      );
    if (!isOwnedByReact(document.documentElement)) return false;

    const isBoundaryStart = (data: string) => /^\$[?!]?$/.test(data);
    // (The cast works around the workers typings merged into the global scope.)
    const walker = document.createTreeWalker(
      document as unknown as Node,
      NodeFilter.SHOW_COMMENT,
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const comment = node as Comment;
      if (!isBoundaryStart(comment.data)) continue;
      if (comment.data === '$?') return false; // server still streaming it

      // Elements that belong to this boundary (not to a nested one).
      let nested = 0;
      for (
        let sibling = comment.nextSibling;
        sibling;
        sibling = sibling.nextSibling
      ) {
        if (sibling.nodeType === Node.COMMENT_NODE) {
          const data = (sibling as Comment).data;
          if (isBoundaryStart(data)) nested++;
          else if (data === '/$') {
            if (nested === 0) break;
            nested--;
          }
        } else if (
          nested === 0 &&
          sibling.nodeType === Node.ELEMENT_NODE &&
          (sibling as Element).tagName !== 'SCRIPT' &&
          !isOwnedByReact(sibling)
        ) {
          return false; // dehydrated: React has not reached it yet
        }
      }
    }
    return true;
  });
}

/**
 * `page.goto(path)` followed by `waitForHydration()`. Returns the navigation
 * response (the final one after redirects), like `page.goto()`.
 */
export async function gotoHydrated(
  page: Page,
  path: string,
  options: {waitUntil?: 'load' | 'domcontentloaded' | 'commit'} = {},
): Promise<Response | null> {
  const response = await page.goto(path, options);
  await waitForHydration(page);
  return response;
}

/** `page.reload()` followed by `waitForHydration()`. */
export async function reloadHydrated(page: Page): Promise<Response | null> {
  const response = await page.reload();
  await waitForHydration(page);
  return response;
}

export interface RedirectHop {
  /** Absolute URL that was requested. */
  url: string;
  /** Status of the response to that request, e.g. 302. */
  status: number;
}

/**
 * The redirects that led to `response`, oldest first, excluding `response`
 * itself. `/account` in mock mode yields two hops (302 to /account/orders,
 * 302 to /account/login) before the final 503.
 */
export async function redirectChain(
  response: Response,
): Promise<RedirectHop[]> {
  const hops: RedirectHop[] = [];
  let request = response.request().redirectedFrom();
  while (request) {
    const hopResponse = await request.response();
    hops.unshift({url: request.url(), status: hopResponse?.status() ?? 0});
    request = request.redirectedFrom();
  }
  return hops;
}
