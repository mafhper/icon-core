import { test, expect } from '@playwright/test';

/**
 * A4 baselines: capture the `#/ui` component gallery so visual regressions
 * are reviewable as PNGs. Capture-only (no snapshot assertions): open the
 * images before declaring a UI PR done.
 *
 * Run: `npm run ui:shots`
 */

const THEMES = ['dark', 'light'] as const;
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'narrow', width: 390, height: 844 }
] as const;

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test(`ui gallery ${viewport.name} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/icon-core/app/?theme=${theme}#/ui`);
      await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();
      // Let fonts settle so captures are stable across runs.
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `tests/e2e/__screenshots__/ui-${viewport.name}-${theme}.png`,
        fullPage: true
      });
    });
  }
}
