/**
 * Helpers for the modal drawers (cart, search, mobile menu) and any other
 * dialog that follows the same pattern (app/lib/useModalDialog.ts): the page
 * behind is `inert`, focus moves in, Tab is trapped, Escape closes, focus
 * returns to the opener.
 *
 *   await page.getByRole('link', {name: 'Cart, 0 items'}).click();
 *   const cart = drawer(page, 'Your cart');
 *   await expectModalOpen(page, cart);
 *   await expectFocusTrapped(page, cart);
 *   await page.keyboard.press('Escape');
 *   await expectModalClosed(page, cart, opener);
 *
 * Locator notes
 * - A closed drawer is `aria-hidden="true"`, so `drawer()` only resolves
 *   while it is open; `toBeHidden()` on it passes once it closes.
 * - Every drawer contains TWO buttons named "Close": `.close-outside` (the
 *   backdrop, `tabindex=-1`) and `.drawer__close`. Use `drawerClose()`; a bare
 *   `getByRole('button', {name: 'Close'})` fails strict mode.
 * - These selectors are the only structural hooks the suite relies on. If the
 *   markup grows `data-testid`s, change them here.
 */
import {expect, type Locator, type Page} from '@playwright/test';

export type DrawerName = 'Your cart' | 'Search' | 'Menu';

/** Page regions the drawers make `inert` while open (Aside.tsx PAGE_REGIONS). */
export const INERT_REGIONS = [
  '.announcement-bar',
  '.site-header',
  '#main-content',
  '.site-footer',
] as const;

/** The drawer dialog by its heading. Resolves only while the drawer is open. */
export function drawer(page: Page, name: DrawerName): Locator {
  return page.getByRole('dialog', {name, exact: true});
}

/** The drawer's real close button (not the backdrop button). */
export function drawerClose(dialog: Locator): Locator {
  return dialog.locator('.drawer__close');
}

export interface ModalOpenOptions {
  /** Element that should hold focus. Defaults to the drawer's close button. */
  initialFocus?: Locator;
  /** Selectors that must be `inert`. Defaults to INERT_REGIONS. */
  inert?: readonly string[];
}

/** The dialog is visible, focus moved into it and the page behind is inert. */
export async function expectModalOpen(
  page: Page,
  dialog: Locator,
  options: ModalOpenOptions = {},
): Promise<void> {
  await expect(dialog).toBeVisible();
  await expect(options.initialFocus ?? drawerClose(dialog)).toBeFocused();
  for (const selector of options.inert ?? INERT_REGIONS) {
    await expect(
      page.locator(selector),
      `${selector} is inert while the dialog is open`,
    ).toHaveJSProperty('inert', true);
  }
}

/**
 * The dialog is gone and the page is interactive again. Pass the element that
 * opened it to also assert that focus returned there.
 */
export async function expectModalClosed(
  page: Page,
  dialog: Locator,
  opener?: Locator,
): Promise<void> {
  await expect(dialog).toBeHidden();
  for (const selector of INERT_REGIONS) {
    await expect(
      page.locator(selector),
      `${selector} is no longer inert`,
    ).toHaveJSProperty('inert', false);
  }
  if (opener) await expect(opener).toBeFocused();
}

/** Stable identity of an element, so wrapped focus can be recognised. */
function describeActiveElement(root: Element) {
  const active = document.activeElement;
  if (!active || !root.contains(active)) {
    return {inside: false, path: '', label: active?.tagName ?? 'none'};
  }
  const path: string[] = [];
  for (let node: Element | null = active; node; node = node.parentElement) {
    const index = node.parentElement
      ? Array.prototype.indexOf.call(node.parentElement.children, node)
      : 0;
    path.unshift(`${node.tagName.toLowerCase()}[${index}]`);
  }
  const label =
    active.getAttribute('aria-label') ||
    (active.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40) ||
    active.tagName.toLowerCase();
  return {inside: true, path: path.join('>'), label};
}

/**
 * Tab and Shift+Tab never leave `dialog`, and focus wraps around: starting
 * from the currently focused element it walks the whole cycle in each
 * direction until it comes back to where it started. Returns the labels of the
 * stops in forward order (aria-label or text), so callers can assert which
 * controls are reachable:
 *
 *   expect(await expectFocusTrapped(page, cart)).toContain('Continue shopping');
 *
 * Focus must already be inside the dialog (`expectModalOpen` guarantees it).
 */
export async function expectFocusTrapped(
  page: Page,
  dialog: Locator,
  options: {maxStops?: number} = {},
): Promise<string[]> {
  const maxStops = options.maxStops ?? 60;
  const handle = await dialog.elementHandle();
  if (!handle)
    throw new Error('expectFocusTrapped: the dialog is not attached');
  const read = () => handle.evaluate(describeActiveElement);

  const start = await read();
  expect(start.inside, 'focus starts inside the dialog').toBe(true);

  const walk = async (key: 'Tab' | 'Shift+Tab') => {
    const stops: string[] = [];
    for (let step = 1; step <= maxStops; step++) {
      await page.keyboard.press(key);
      const now = await read();
      expect(
        now.inside,
        `${key} #${step} moved focus out of the dialog (to ${now.label})`,
      ).toBe(true);
      if (now.path === start.path) return stops;
      stops.push(now.label);
    }
    throw new Error(`${key} never wrapped around within ${maxStops} stops`);
  };

  // Forward cycle: the stops after the starting element, then back to it.
  const forward = await walk('Tab');
  const backward = await walk('Shift+Tab');
  expect(backward.length, 'Shift+Tab visits as many controls as Tab').toBe(
    forward.length,
  );
  return [start.label, ...forward];
}

/**
 * Clicks the dimmed area left of the drawer, which closes it. Only valid when
 * the viewport is wider than the drawer (min(440px, 100vw)): at 820px and
 * 1440px, never at 390px where the drawer covers the whole screen.
 */
export async function clickBackdrop(page: Page): Promise<void> {
  const width = page.viewportSize()?.width ?? 0;
  if (width < 600) {
    throw new Error(
      `clickBackdrop needs a viewport wider than the drawer, got ${width}px`,
    );
  }
  await page.mouse.click(40, 400);
}
