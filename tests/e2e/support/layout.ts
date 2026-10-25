/**
 * Page-level layout assertions shared by every spec.
 *
 *   await expectSingleH1(page, 'Shop All');
 *   await expectNoHorizontalOverflow(page);
 *   await expectPageChrome(page);
 *
 * All three are auto-waiting (they retry until the page settles), so they are
 * safe right after navigation and after layout-changing interactions.
 */
import {expect, type Page} from '@playwright/test';

/**
 * Exactly one `<h1>` in the DOM (visible or not), optionally with `text`.
 * Text is compared against `innerText` with whitespace collapsed, so headings
 * that contain `<br>` (the home hero, the About hero) match their one-line
 * form: "Sleep Was Broken. We Fixed It.".
 */
export async function expectSingleH1(
  page: Page,
  text?: string | RegExp,
  options: {timeout?: number} = {},
): Promise<void> {
  const h1 = page.locator('h1');
  await expect(h1, 'exactly one <h1> per page').toHaveCount(1, options);
  if (text !== undefined) {
    await expect(h1).toHaveText(text, {useInnerText: true, ...options});
  }
}

function measureOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

/** The widest offenders, for the failure message. Fixed-position boxes are skipped. */
function describeOverflowCulprits(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const insideFixed = (element: Element) => {
      for (
        let node: Element | null = element;
        node;
        node = node.parentElement
      ) {
        if (getComputedStyle(node).position === 'fixed') return true;
      }
      return false;
    };
    return Array.from(document.body.querySelectorAll('*'))
      .map((element) => ({
        element,
        right: element.getBoundingClientRect().right,
      }))
      .filter(({right}) => right > limit + 1)
      .filter(({element}) => !insideFixed(element))
      .sort((a, b) => b.right - a.right)
      .slice(0, 5)
      .map(({element, right}) => {
        const id = element.id ? `#${element.id}` : '';
        const classes =
          typeof element.className === 'string' && element.className.trim()
            ? `.${element.className.trim().split(/\s+/).join('.')}`
            : '';
        return `<${element.tagName.toLowerCase()}${id}${classes}> right edge ${Math.round(right)}px (viewport ${limit}px)`;
      });
  });
}

/**
 * The document is not wider than the viewport (1px tolerance for rounding).
 * On failure the message names the widest elements.
 */
export async function expectNoHorizontalOverflow(
  page: Page,
  options: {timeout?: number} = {},
): Promise<void> {
  try {
    await expect
      .poll(() => measureOverflow(page), {
        message: 'document overflows the viewport horizontally (px)',
        ...options,
      })
      .toBeLessThanOrEqual(1);
  } catch (error) {
    const culprits = await describeOverflowCulprits(page).catch(() => []);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${reason}\nWidest elements:\n${culprits.map((line) => `  ${line}`).join('\n')}`,
    );
  }
}

/**
 * Document furniture every page carries: `<html lang="en">`, one `main`
 * landmark (the skip link's target), one banner, one contentinfo, and the
 * "Skip to content" link pointing at `#main-content`.
 */
export async function expectPageChrome(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('main'), 'one main landmark').toHaveCount(1);
  await expect(page.getByRole('banner'), 'one banner landmark').toHaveCount(1);
  await expect(page.getByRole('contentinfo'), 'one footer').toHaveCount(1);
  await expect(
    page.getByRole('link', {name: 'Skip to content'}),
  ).toHaveAttribute('href', '#main-content');
  await expect(page.locator('main#main-content')).toBeAttached();
}
