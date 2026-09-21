import { test, expect, type Page } from '@playwright/test';

/**
 * Layout contract for the inspector.
 *
 * Regression guard for the min-content overflow that clipped the whole panel:
 * a single-column CSS grid sizes its column by the widest child's min-content,
 * and a row of inputs asks for ~223px each, so the content grew past the
 * 240–380px panel while `overflow-x: hidden` cut the excess. Users read that as
 * "the inspector misplaces its elements". Asserting
 * `scrollWidth <= clientWidth` catches the class of bug that pixel baselines
 * only catch by eye.
 */

const WIDTHS = [240, 288, 320, 380] as const;

type InspectorMetrics = {
  clientWidth: number;
  scrollWidth: number;
  widestChild: number;
  widestChildLabel: string;
};

const measure = (page: Page): Promise<InspectorMetrics> =>
  page.locator('.ic-inspector').evaluate((element) => {
    const children = [...element.querySelectorAll('*')];
    const widest = children.reduce(
      (worst, child) => (child.getBoundingClientRect().width > worst.getBoundingClientRect().width ? child : worst),
      children[0] ?? element
    );
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      widestChild: Math.round(widest.getBoundingClientRect().width),
      widestChildLabel: `${widest.tagName.toLowerCase()}.${String(widest.className ?? '').split(' ')[0]}`
    };
  });

const expectFits = async (page: Page) => {
  const metrics = await measure(page);
  // Allow 1px of sub-pixel rounding.
  expect(
    metrics.scrollWidth,
    `inspector overflows: ${JSON.stringify(metrics)}`
  ).toBeLessThanOrEqual(metrics.clientWidth + 1);
};

/** Seeds the inspector width before the app boots, then opens a project with a shape. */
const openEditor = async (page: Page, panelWidth: number, withShape: boolean) => {
  await page.addInitScript(
    (width) => window.localStorage.setItem('iconcore:panel-right', String(width)),
    panelWidth
  );
  await page.goto('/icon-core/app/?theme=dark');
  await page.getByRole('button', { name: /^Create$/i }).first().click();
  await expect(page.locator('.ic-inspector')).toBeVisible();
  if (!withShape) return;
  await page.getByRole('button', { name: /add shape/i }).first().click();
  await page.getByRole('menuitem').first().click();
  await page.waitForTimeout(400);
};

for (const width of WIDTHS) {
  test(`inspector fits at ${width}px with a gradient shape selected`, async ({ page }) => {
    await openEditor(page, width, true);
    await expectFits(page);
  });
}

test('inspector fits with the Background layer selected', async ({ page }) => {
  await openEditor(page, 288, true);
  // The Background layer is a handle created on demand, not part of a blank project.
  await page.getByRole('button', { name: /add background fill layer/i }).first().click();
  await page.locator('.ic-layer-row', { hasText: /background/i }).first().click();
  await page.waitForTimeout(300);
  await expectFits(page);
});

test('inspector fits with nothing selected', async ({ page }) => {
  await openEditor(page, 288, false);
  await page.locator('.ic-edit-stage').click({ position: { x: 5, y: 5 } });
  await page.waitForTimeout(300);
  await expectFits(page);
});
