import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';

/**
 * Studio export (Fase 5): ficheiros reais, com as assinaturas conferidas.
 *
 * O diálogo monta um `ExportPlan` mínimo (SVG/PNG/ICO) e executa o pipeline
 * de verdade; cada teste abaixo baixa um ficheiro e lê os primeiros bytes:
 * SVG abre com `<?xml`, PNG com `89 50 4E 47`, ICO com `00 00 01 00`. Um
 * diálogo simulado (o do mockup) nunca produziria estes bytes.
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

  await page.getByRole('region', { name: 'Layers panel' }).getByRole('button', { name: 'Insert layer' }).click();
  await page.getByRole('menuitem', { name: 'Ellipse' }).click();
  await expect(page.getByRole('region', { name: 'Layers panel' })).toContainText('1');
};

const abrirExport = async (page: Page) => {
  // Export lives at the end of the Inspector Export tab.
  const inspector = page.getByRole('region', { name: 'Inspector panel' });
  await inspector.getByRole('tab', { name: 'Export' }).click();
  await inspector.getByRole('button', { name: 'Export' }).click();
  await expect(page.getByRole('dialog', { name: 'Export icons' })).toBeVisible();
};

const executar = async (page: Page) => {
  const dialog = page.getByRole('dialog', { name: 'Export icons' });
  await dialog.getByRole('button', { name: /Export \d+ files?/ }).click();
  await expect(page.getByRole('button', { name: 'Download all (.zip)' })).toBeVisible({ timeout: 30000 });
};

const baixarPrimeiro = async (page: Page): Promise<{ nome: string; bytes: Buffer }> => {
  const dialog = page.getByRole('dialog', { name: 'Export icons' });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    dialog.getByRole('button', { name: 'Download' }).first().click()
  ]);
  const caminho = await download.path();
  if (!caminho) throw new Error('download sem caminho em disco');
  return { nome: download.suggestedFilename(), bytes: fs.readFileSync(caminho) };
};

test('export SVG abre com <?xml', async ({ page }) => {
  await preparar(page);
  await abrirExport(page);
  await page.getByRole('checkbox', { name: 'PNG' }).click();
  await executar(page);

  const { nome, bytes } = await baixarPrimeiro(page);
  expect(nome).toMatch(/\.svg$/);
  expect(bytes.subarray(0, 5).toString('utf8')).toBe('<?xml');
});

test('export PNG carrega a assinatura 89 50 4E 47', async ({ page }) => {
  await preparar(page);
  await abrirExport(page);
  await page.getByRole('checkbox', { name: 'SVG' }).click();
  await executar(page);

  const { nome, bytes } = await baixarPrimeiro(page);
  expect(nome).toMatch(/\.png$/);
  expect(Array.from(bytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
});

test('export ICO carrega a assinatura 00 00 01 00', async ({ page }) => {
  await preparar(page);
  await abrirExport(page);
  await page.getByRole('checkbox', { name: 'SVG' }).click();
  await page.getByRole('checkbox', { name: 'PNG' }).click();
  await page.getByRole('checkbox', { name: 'ICO' }).click();
  await executar(page);

  const { nome, bytes } = await baixarPrimeiro(page);
  expect(nome).toMatch(/\.ico$/);
  expect(Array.from(bytes.subarray(0, 4))).toEqual([0x00, 0x00, 0x01, 0x00]);
});

test('duas variantes geram dois ficheiros, sem sobrescrever', async ({ page }) => {
  await preparar(page);
  await abrirExport(page);
  await page.getByRole('checkbox', { name: 'PNG' }).click();
  await page.getByRole('checkbox', { name: 'light' }).click();
  await executar(page);

  const dialog = page.getByRole('dialog', { name: 'Export icons' });
  const ficheiros = await dialog.locator('.studio-export-files li').allInnerTexts();
  expect(ficheiros).toHaveLength(2);
  expect(ficheiros.some((f) => f.includes('default'))).toBe(true);
  expect(ficheiros.some((f) => f.includes('light'))).toBe(true);
});
