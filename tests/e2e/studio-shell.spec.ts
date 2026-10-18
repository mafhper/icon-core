import { expect, test, type Page } from '@playwright/test';
import { clickBarAction } from './barAction';

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

  // Export lives at the end of the Inspector Export tab. The collector holds
  // its entry point (Export icons, in the menu) but no second export surface;
  // the canvas bar carries neither.
  const inspector = page.getByRole('region', { name: 'Inspector panel' });
  await inspector.getByRole('tab', { name: 'Export' }).click();
  await expect(inspector.getByRole('button', { name: /Export \d+ files?/ })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('button', { name: 'Export', exact: true })).toHaveCount(0);
  await expect(page.getByRole('banner').getByRole('button', { name: 'Export icons' })).toHaveCount(0);
  const toolbar = page.getByRole('toolbar', { name: 'Studio toolbar' });
  await expect(toolbar.getByRole('button', { name: 'Export', exact: true })).toHaveCount(0);
  await expect(toolbar.getByRole('button', { name: 'Insert layer' })).toHaveCount(0);
});

test('studio: Insert cria uma elipse e a exclusao pede confirmacao', async ({ page }) => {
  await preparar(page);

  // Insert lives only in the Layers header — the canvas bar carries none.
  await page.getByRole('region', { name: 'Layers panel' }).getByRole('button', { name: 'Insert layer' }).click();
  await page.getByRole('menuitem', { name: 'Ellipse' }).click();
  // "2": a elipse mais o handle de Background que todo arquivo novo traz.
  await expect(page.getByRole('region', { name: 'Layers panel' })).toContainText('2');

  await page.getByRole('button', { name: /^Delete / }).first().click();
  await expect(page.getByRole('dialog', { name: 'Delete layer?' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete layer' }).click();
  // "1": a elipse saiu, o Background fica.
  await expect(page.getByRole('region', { name: 'Layers panel' })).toContainText('1');
});

test('studio stage: tiles trocam a variante e View options alterna a mascara', async ({ page }) => {
  await preparar(page);

  await page.getByRole('region', { name: 'Layers panel' }).getByRole('button', { name: 'Insert layer' }).click();
  await page.getByRole('menuitem', { name: 'Rounded rectangle' }).click();
  // "2": o retangulo mais o handle de Background que todo arquivo novo traz.
  await expect(page.getByRole('region', { name: 'Layers panel' })).toContainText('2');

  // Tiles com preview vivo: trocar nao perde a camada.
  const canvas = page.getByRole('region', { name: 'Canvas' });
  await canvas.getByRole('button', { name: 'Monochrome' }).click();
  await expect(canvas).toContainText('Monochrome');
  await expect(page.getByRole('region', { name: 'Layers panel' })).toContainText('2');

  // View options: desligar a mascara quadra o frame (o export continua mascarado).
  const frame = page.locator('.ic-canvas-frame');
  const antes = await frame.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
  expect(antes).not.toBe('0px');
  const toolbar = page.getByRole('toolbar', { name: 'Studio toolbar' });
  await toolbar.getByRole('button', { name: 'View options' }).click();
  await page.getByRole('menuitem', { name: 'Icon mask — On' }).click();
  await expect(frame).toHaveCSS('border-top-left-radius', '0px');
});

test('studio inspector: o traco engrossa sem esticar a forma', async ({ page }) => {
  await preparar(page);

  await page.getByRole('region', { name: 'Layers panel' }).getByRole('button', { name: 'Insert layer' }).click();
  await page.getByRole('menuitem', { name: 'Rounded rectangle' }).click();

  const inspector = page.getByRole('region', { name: 'Inspector panel' });
  await inspector.getByRole('button', { name: 'Add stroke' }).click();
  await inspector.getByRole('spinbutton', { name: 'Stroke width' }).fill('24');

  // A tag de dimensão do canvas não mexe: o traço é outline, não escala.
  await expect(page.locator('.ic-dimension-tag')).toHaveText('220 × 220');
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

  await clickBarAction(page, 'Keyboard shortcuts');
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Duplicate selected layer');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();

  await page.keyboard.press('h');
  await expect(page.getByRole('contentinfo', { name: 'Status bar' })).toContainText('Hand');
});

test('studio: fechar o documento pede confirmacao e volta a lista', async ({ page }) => {
  await preparar(page);

  await clickBarAction(page, 'Close document');
  const confirm = page.getByRole('dialog', { name: 'Close this document?' });
  await expect(confirm).toBeVisible();
  // O botao da barra tem o mesmo nome: o confirmar e lido dentro do dialogo.
  await confirm.getByRole('button', { name: 'Close document' }).click();
  await expect(page.getByRole('dialog', { name: 'Start a new icon' })).toBeVisible();
  await expect(page.getByText('No document')).toBeVisible();
});
