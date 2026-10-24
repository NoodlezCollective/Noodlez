/**
 * Moving content (WCAG 2.2.2): the announcement bar and the "As seen in"
 * press-logo strip scroll on their own, so each has a pause/resume button
 * (`aria-pressed` carries the state), pauses while hovered or focused, exposes
 * only one copy of its content to assistive technology, and stays still when
 * the visitor prefers reduced motion (the buttons are then hidden).
 *
 * The suite runs with reduced motion on, so the behaviour that needs motion
 * opts back in with `test.use({reducedMotion: 'no-preference'})`. Desktop only.
 */
import type {Page} from '@playwright/test';
import {expect, test} from './support/fixtures';
import {gotoHydrated} from './support/hydration';

const STRIPS = [
  {
    label: 'announcement bar',
    region: 'Announcements',
    toggle: 'Pause announcements',
  },
  {
    label: 'press-logo strip',
    region: 'As seen in',
    toggle: 'Pause press logos',
  },
] as const;

/** Bottom-left corner: outside both full-width strips, so hover does not pause. */
async function parkPointer(page: Page) {
  const height = page.viewportSize()?.height ?? 900;
  await page.mouse.move(5, height - 10);
}

test.describe('with motion allowed', () => {
  test.use({reducedMotion: 'no-preference'});

  for (const strip of STRIPS) {
    test(`${strip.label}: the pause button stops the scroll`, async ({
      page,
    }) => {
      await gotoHydrated(page, '/');
      const region = page.getByRole('region', {name: strip.region});
      const toggle = region.getByRole('button', {name: strip.toggle});
      const track = region.locator('.marquee__track');
      await parkPointer(page);

      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(track).toHaveCSS('animation-play-state', 'running');

      await toggle.click();
      await parkPointer(page); // the click left the pointer on the strip

      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(region.locator('.marquee')).toHaveClass(/marquee--paused/);
      await expect(track).toHaveCSS('animation-play-state', 'paused');
    });

    test(`${strip.label}: pressing the button again restarts the scroll`, async ({
      page,
    }) => {
      await gotoHydrated(page, '/');
      const region = page.getByRole('region', {name: strip.region});
      const toggle = region.getByRole('button', {name: strip.toggle});
      const track = region.locator('.marquee__track');
      await parkPointer(page);

      await toggle.click(); // pause
      await toggle.click(); // resume
      await parkPointer(page);

      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(region.locator('.marquee')).not.toHaveClass(
        /marquee--paused/,
      );
      await expect(track).toHaveCSS('animation-play-state', 'running');
    });

    test(`${strip.label}: the button works from the keyboard and keeps its name`, async ({
      page,
    }) => {
      await gotoHydrated(page, '/');
      const region = page.getByRole('region', {name: strip.region});
      const toggle = region.getByRole('button', {name: strip.toggle});

      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Space');
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      // The name stays constant; the pressed state carries the toggle.
      await expect(toggle).toHaveAccessibleName(strip.toggle);
    });

    test(`${strip.label}: pauses while hovered and runs again afterwards`, async ({
      page,
    }) => {
      await gotoHydrated(page, '/');
      const region = page.getByRole('region', {name: strip.region});
      const track = region.locator('.marquee__track');
      await parkPointer(page);
      await expect(track).toHaveCSS('animation-play-state', 'running');

      await region.hover();
      await expect(track).toHaveCSS('animation-play-state', 'paused');

      await parkPointer(page);
      await expect(track).toHaveCSS('animation-play-state', 'running');
    });
  }
});

test.describe('assistive technology', () => {
  for (const strip of STRIPS) {
    test(`${strip.label}: only the first copy is exposed, the repeats are hidden and inert`, async ({
      page,
    }) => {
      await gotoHydrated(page, '/');
      const region = page.getByRole('region', {name: strip.region});

      await expect(
        region.locator('.marquee__group:not([aria-hidden])'),
      ).toHaveCount(1);
      const repeats = region.locator('.marquee__group[aria-hidden="true"]');
      expect(await repeats.count(), 'repeated copies exist').toBeGreaterThan(0);
      await expect(
        region.locator('.marquee__group[aria-hidden="true"]:not([inert])'),
        'every repeat is inert (unreachable by keyboard)',
      ).toHaveCount(0);
    });
  }
});

test.describe('with reduced motion', () => {
  test.use({reducedMotion: 'reduce'});

  test('nothing scrolls, so there is nothing to pause', async ({page}) => {
    await gotoHydrated(page, '/');

    for (const strip of STRIPS) {
      const region = page.getByRole('region', {name: strip.region});
      await expect(
        region.getByRole('button', {name: strip.toggle, includeHidden: true}),
        `${strip.label} pause button is hidden`,
      ).toBeHidden();
      await expect(
        region.locator('.marquee__track'),
        `${strip.label} does not animate`,
      ).toHaveCSS('animation-name', 'none');
    }
  });
});
