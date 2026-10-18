import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';

/**
 * Studio export (Fase 5): ficheiros reais, com as assinaturas conferidas.
 *
 * O painel da aba Export monta um `ExportPlan` mínimo (SVG/PNG/ICO) e executa
 * o pipeline de verdade; cada teste abaixo baixa um ficheiro e lê os primeiros
 * bytes: SVG abre com `<?xml`, PNG com `89 50 4E 47`, ICO com `00 00 01 00`. Um
 * painel simulado (o do mockup) nunca produziria estes bytes.
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
  // "2": a elipse mais o handle de Background que todo arquivo novo traz.
  await expect(page.getByRole('region', { name: 'Layers panel' })).toContainText('2');
};

const abrirExport = async (page: Page): Promise<Locator> => {
  // Export lives in the Inspector Export tab — the panel itself is the surface.
  const inspector = page.getByRole('region', { name: 'Inspector panel' });
  await inspector.getByRole('tab', { name: 'Export' }).click();
  await expect(inspector.getByRole('button', { name: /Export \d+ files?/ })).toBeVisible();
  return inspector;
};

const executar = async (page: Page, inspector: Locator) => {
  await inspector.getByRole('button', { name: /Export \d+ files?/ }).click();
  await expect(inspector.getByRole('button', { name: 'Download all (.zip)' })).toBeVisible({ timeout: 30000 });
};

const baixarPrimeiro = async (page: Page, inspector: Locator): Promise<{ nome: string; bytes: Buffer }> => {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    inspector.getByRole('button', { name: 'Download' }).first().click()
  ]);
  const caminho = await download.path();
  if (!caminho) throw new Error('download sem caminho em disco');
  return { nome: download.suggestedFilename(), bytes: fs.readFileSync(caminho) };
};

test('export SVG abre com <?xml', async ({ page }) => {
  await preparar(page);
  const inspector = await abrirExport(page);
  await inspector.getByRole('checkbox', { name: 'PNG' }).click();
  await executar(page, inspector);

  const { nome, bytes } = await baixarPrimeiro(page, inspector);
  expect(nome).toMatch(/\.svg$/);
  expect(bytes.subarray(0, 5).toString('utf8')).toBe('<?xml');
});

test('export PNG carrega a assinatura 89 50 4E 47', async ({ page }) => {
  await preparar(page);
  const inspector = await abrirExport(page);
  await inspector.getByRole('checkbox', { name: 'SVG' }).click();
  await executar(page, inspector);

  const { nome, bytes } = await baixarPrimeiro(page, inspector);
  expect(nome).toMatch(/\.png$/);
  expect(Array.from(bytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
});

test('export ICO carrega a assinatura 00 00 01 00', async ({ page }) => {
  await preparar(page);
  const inspector = await abrirExport(page);
  await inspector.getByRole('checkbox', { name: 'SVG' }).click();
  await inspector.getByRole('checkbox', { name: 'PNG' }).click();
  await inspector.getByRole('checkbox', { name: 'ICO' }).click();
  await executar(page, inspector);

  const { nome, bytes } = await baixarPrimeiro(page, inspector);
  expect(nome).toMatch(/\.ico$/);
  expect(Array.from(bytes.subarray(0, 4))).toEqual([0x00, 0x00, 0x01, 0x00]);
});

test('duas variantes geram dois ficheiros, sem sobrescrever', async ({ page }) => {
  await preparar(page);
  const inspector = await abrirExport(page);
  await inspector.getByRole('checkbox', { name: 'PNG' }).click();
  await inspector.getByRole('checkbox', { name: 'Light' }).click();
  await executar(page, inspector);

  const ficheiros = await inspector.locator('.studio-export-files li').allInnerTexts();
  expect(ficheiros).toHaveLength(2);
  expect(ficheiros.some((f) => f.includes('default'))).toBe(true);
  expect(ficheiros.some((f) => f.includes('light'))).toBe(true);
});
