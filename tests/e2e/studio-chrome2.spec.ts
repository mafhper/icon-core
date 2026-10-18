import { expect, test, type Page } from '@playwright/test';

/**
 * Chrome slice 2: tiles + grade follow geometry, two bars with exact
 * addresses, Export tab with grid + end action, no page-level horizontal
 * scroll at wide viewports — in dark and light.
 *
 * Every address below is a role/name the person reaches, never a selector
 * detail: if a control moves, this file moves with it instead of going green
 * on an empty query.
 */

const preparar = async (page: Page, theme: 'dark' | 'light') => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Storage bloqueado: o app cria o projeto normal.
    }
  });
  await page.goto(`/icon-core/app/?theme=${theme}`);
  await page.context().clearCookies();

  const welcome = page.getByRole('dialog');
  if (await welcome.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /^Create$/i }).first().click();
    await page.waitForTimeout(600);
  }
  await page.getByRole('toolbar', { name: 'Studio toolbar' }).waitFor({ timeout: 10000 });

  await page.getByRole('region', { name: 'Layers panel' }).getByRole('button', { name: 'Insert layer' }).click();
  await page.getByRole('menuitem', { name: 'Rounded rectangle' }).click();
  // "2": o retangulo mais o handle de Background que todo arquivo novo traz.
  await expect(page.getByRole('region', { name: 'Layers panel' })).toContainText('2');
  await expect(page.locator('.studio-tiles:not(.studio-tiles-grid) .studio-tile img')).toHaveCount(4, {
    timeout: 15000
  });
};

const shot = (page: Page, selector: string, index: number) =>
  page.locator(selector).nth(index).screenshot();

for (const theme of ['dark', 'light'] as const) {
  test(`[${theme}] raio muda → tiles e grade atualizam`, async ({ page }) => {
    await preparar(page, theme);
    const inspector = page.getByRole('region', { name: 'Inspector panel' });
    const strip = '.studio-tiles:not(.studio-tiles-grid) .studio-tile img';

    const before = await Promise.all([0, 1, 2, 3].map((i) => shot(page, strip, i)));
    await inspector.getByRole('slider', { name: 'Corner radius' }).fill('0');
    await page.waitForTimeout(1500);
    const after = await Promise.all([0, 1, 2, 3].map((i) => shot(page, strip, i)));
    for (let i = 0; i < 4; i += 1) {
      expect(Buffer.from(after[i]).equals(Buffer.from(before[i])), `tile ${i} manteve os pixels do raio anterior`).toBe(
        false
      );
    }

    // The grid shows the same radius-0 state, then follows the way back.
    await inspector.getByRole('tab', { name: 'Export' }).click();
    const grid = '.studio-tiles-grid .studio-tile img';
    await expect(page.locator(grid)).toHaveCount(4);
    const gridZero = await shot(page, grid, 0);
    await inspector.getByRole('tab', { name: 'Design' }).click();
    const radius = inspector.getByRole('slider', { name: 'Corner radius' });
    const max = await radius.evaluate((el) => (el as HTMLInputElement).max);
    await radius.fill(max);
    await page.waitForTimeout(1500);
    await inspector.getByRole('tab', { name: 'Export' }).click();
    const gridMax = await shot(page, grid, 0);
    expect(Buffer.from(gridMax).equals(Buffer.from(gridZero)), 'a grade manteve os pixels do raio anterior').toBe(
      false
    );
  });

  test(`[${theme}] titlebar: marca, documento, tema e atalhos — nada funcional a mais`, async ({ page }) => {
    await preparar(page, theme);
    const banner = page.getByRole('banner');

    await expect(banner.getByRole('button', { name: 'Go to workspaces' })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Main menu' })).toBeVisible();
    await expect(banner.getByText('Default')).toBeVisible();
    await expect(banner.getByRole('button', { name: /^Theme: / })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Keyboard shortcuts' })).toBeVisible();

    await expect(banner.getByRole('button', { name: 'Export' })).toHaveCount(0);
    await expect(banner.getByRole('button', { name: 'Insert layer' })).toHaveCount(0);
    await expect(banner.getByRole('button', { name: 'View options' })).toHaveCount(0);
    await expect(banner.getByRole('button', { name: /Layers panel|Inspector panel/ })).toHaveCount(0);
  });

  test(`[${theme}] barra do canvas: recolher, desfazer, refazer, view options, recolher`, async ({ page }) => {
    await preparar(page, theme);
    const canvas = page.getByRole('region', { name: 'Canvas' });
    const bar = canvas.getByRole('toolbar', { name: 'Studio toolbar' });
    await expect(bar).toBeVisible();

    const labels = await bar.getByRole('button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
    expect(labels).toEqual(['Hide Layers panel', 'Undo', 'Redo', 'View options', 'Hide Inspector panel']);

    // Scoped to the canvas column: inside the Canvas region, never a
    // full-width band above the sidebars.
    const scoped = await bar.evaluate((el) => {
      const section = el.closest('section');
      return section?.getAttribute('aria-label') === 'Canvas';
    });
    expect(scoped).toBe(true);

    await expect(bar.getByRole('button', { name: 'Insert layer' })).toHaveCount(0);
    await expect(bar.getByRole('button', { name: 'Export' })).toHaveCount(0);

    // The edge collapses act: first hides the left panel, and offers it back.
    await bar.getByRole('button', { name: 'Hide Layers panel' }).click();
    await expect(page.getByRole('button', { name: 'Show Layers panel' })).toBeVisible();
    await page.getByRole('button', { name: 'Show Layers panel' }).click();
    await expect(page.getByRole('region', { name: 'Layers panel' })).toBeVisible();
  });

  test(`[${theme}] aba Export: grade viva + ação no fim que abre o export`, async ({ page }) => {
    await preparar(page, theme);
    const inspector = page.getByRole('region', { name: 'Inspector panel' });

    await expect(inspector.getByRole('tab', { name: 'Preview' })).toHaveCount(0);
    await inspector.getByRole('tab', { name: 'Export' }).click();
    await expect(page.locator('.studio-tiles-grid')).toBeVisible();
    await expect(page.locator('.studio-tiles-grid .studio-tile')).toHaveCount(4);

    const action = inspector.getByRole('button', { name: 'Export' });
    await expect(action).toBeVisible();
    const atEnd = await inspector.evaluate((el) => {
      const grid = el.querySelector('.studio-tiles-grid');
      const button = el.querySelector('.studio-export-foot button');
      return Boolean(
        grid && button && (grid.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      );
    });
    expect(atEnd).toBe(true);

    await action.click();
    await expect(page.getByRole('dialog', { name: 'Export icons' })).toBeVisible();
  });

  test(`[${theme}] sem scroll horizontal em viewport larga`, async ({ page }) => {
    await preparar(page, theme);
    const sizes = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth
    }));
    expect(sizes.scroll, `scrollWidth ${sizes.scroll} passou de clientWidth ${sizes.client}`).toBeLessThanOrEqual(
      sizes.client
    );
  });
}
