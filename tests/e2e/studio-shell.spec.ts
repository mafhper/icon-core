import { expect, test, type Page } from '@playwright/test';

/**
 * Studio shell (Fase 2): the five regions mount over the real engine, the
 * primary Insert creates a layer, panel collapse always offers a way back,
 * and menu-driven deletes ask first.
 *
 * First studio spec in the app suite: it drives the new chrome, never the
 * Composer tree directly, so the Fase 6 cut (which removes that tree) keeps
 * this file green by construction.
 */

const preparar = async (page: Page) => {
  await page.goto('/icon-core/app/?theme=dark');
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Storage bloqueado: o app cria o projeto normal.
    }
  });
  await page.context().clearCookies();

  const welcome = page.getByRole('dialog');
  if (await welcome.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /^Create$/i }).first().click();
    await page.waitForTimeout(600);
  }
  await page.getByRole('toolbar', { name: 'Studio toolbar' }).waitFor({ timeout: 10000 });
};

test('studio monta as cinco regioes com o chrome do documento', async ({ page }) => {
  await preparar(page);

  await expect(page.getByRole('toolbar', { name: 'Studio toolbar' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Layers panel' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Canvas' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Inspector panel' })).toBeVisible();
  await expect(page.getByRole('contentinfo', { name: 'Status bar' })).toBeVisible();

  await expect(page.getByText('Icon-Core').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
});

test('studio: Insert cria uma elipse e a exclusao pede confirmacao', async ({ page }) => {
  await preparar(page);

  const toolbar = page.getByRole('toolbar', { name: 'Studio toolbar' });
  await toolbar.getByRole('button', { name: 'Insert layer' }).click();
  await page.getByRole('menuitem', { name: 'Ellipse' }).click();
  await expect(page.getByRole('region', { name: 'Layers panel' })).toContainText('1');

  await page.getByRole('button', { name: /^Delete / }).first().click();
  await expect(page.getByRole('dialog', { name: 'Delete layer?' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete layer' }).click();
  await expect(page.getByRole('region', { name: 'Layers panel' })).toContainText('0');
});

test('studio stage: tiles trocam a variante e View options alterna a mascara', async ({ page }) => {
  await preparar(page);

  const toolbar = page.getByRole('toolbar', { name: 'Studio toolbar' });
  await toolbar.getByRole('button', { name: 'Insert layer' }).click();
  await page.getByRole('menuitem', { name: 'Rounded rectangle' }).click();
  await expect(page.getByRole('region', { name: 'Layers panel' })).toContainText('1');

  // Tiles com preview vivo: trocar nao perde a camada.
  await page.getByRole('group', { name: 'Appearance variants' }).getByRole('button', { name: 'Monochrome' }).click();
  await expect(page.getByRole('region', { name: 'Canvas' })).toContainText('Monochrome');
  await expect(page.getByRole('region', { name: 'Layers panel' })).toContainText('1');

  // View options: desligar a mascara quadra o frame (o export continua mascarado).
  const frame = page.locator('.ic-canvas-frame');
  const antes = await frame.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
  expect(antes).not.toBe('0px');
  await page.getByRole('button', { name: 'View options' }).click();
  await page.getByRole('menuitem', { name: 'Icon mask — On' }).click();
  await expect(frame).toHaveCSS('border-top-left-radius', '0px');
});

test('studio: paineis recolhem e reabrem; atalhos listam os vinculos reais', async ({ page }) => {
  await preparar(page);

  // A collapsed panel leaves the accessibility tree (visibility:hidden):
  // the proof is the reopen control, not the hidden region.
  await page.getByRole('button', { name: 'Hide Layers panel' }).click();
  await expect(page.getByRole('button', { name: 'Show Layers panel' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Canvas' })).toBeVisible();
  await page.getByRole('button', { name: 'Show Layers panel' }).click();
  await expect(page.getByRole('region', { name: 'Layers panel' })).toBeVisible();

  await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Duplicate selected layer');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();

  await page.keyboard.press('h');
  await expect(page.getByRole('contentinfo', { name: 'Status bar' })).toContainText('Hand');
});
