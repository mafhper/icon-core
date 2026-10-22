import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import zlib from 'node:zlib';

/**
 * Fidelidade do background: o ajuste flui controle → modelo → canvas →
 * tiles → Preview/Export → arquivo, com paridade de pixels.
 *
 * A quebra que este spec trava: `SET_CANVAS_BACKGROUND` escrevia sempre na
 * base enquanto canvas, tiles e export leem o override da variante ativa —
 * ajustar com light/dark/mono ativo commitava e nao mudava um pixel. E o
 * Preview/Export mostrava o fundo mesmo com a transparencia ligada, mentindo
 * sobre o arquivo. Medido antes do fix com uma sonda de browser descartável:
 * canvas `#f8fafc → #ff0000` ok no default, tiles light/dark/mono parados
 * nas sementes, PNG exportado `[0,0,0,0]` (transparente) com o switch ligado.
 */

const preparar = async (page: Page) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Storage bloqueado: o app cria o projeto normal.
    }
  });
  await page.goto('/icon-core/app/?theme=dark');
  await page.context().clearCookies();

  const welcome = page.getByRole('dialog');
  if (await welcome.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /^Create$/i }).first().click();
    await page.waitForTimeout(600);
  }
  await page.getByRole('toolbar', { name: 'Studio toolbar' }).waitFor({ timeout: 10000 });
};

/** Canto (2%,2%) de um <img> renderizado: a forma fica no centro, o canto e fundo puro. */
const cantoDoImg = (page: Page, selector: string): Promise<[number, number, number, number]> =>
  page.evaluate((sel) => {
    const img = document.querySelector(sel) as HTMLImageElement | null;
    if (!img || !img.naturalWidth) throw new Error(`sem pixels em ${sel}`);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(Math.floor(c.width * 0.02), Math.floor(c.height * 0.02), 1, 1).data;
    return [d[0], d[1], d[2], d[3]] as [number, number, number, number];
  }, selector);

const cantoDoTile = (page: Page, name: string): Promise<[number, number, number, number]> =>
  page.evaluate((label) => {
    const btn = [...document.querySelectorAll('.studio-tile')].find((b) =>
      b.textContent?.includes(label));
    const img = btn?.querySelector('img');
    if (!img || !img.naturalWidth) throw new Error(`tile ${label} sem pixels`);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(Math.floor(c.width * 0.02), Math.floor(c.height * 0.02), 1, 1).data;
    return [d[0], d[1], d[2], d[3]] as [number, number, number, number];
  }, name);

/** Canto de um PNG em disco (8-bit nao entrelacado, tipos 2/6), sem deps. */
const cantoDoPng = (caminho: string): [number, number, number, number] => {
  const buf = fs.readFileSync(caminho);
  expect(Array.from(buf.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  let pos = 8, width = 0, height = 0, colorType = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString('ascii');
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const ch = colorType === 6 ? 4 : 3;
  const stride = width * ch;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(height * stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const row = px.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? row[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      let v = raw[p++];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const q = a + b - c;
        const pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      row[i] = v;
    }
  }
  const o = Math.floor(height * 0.02) * stride + Math.floor(width * 0.02) * ch;
  return [px[o], px[o + 1], px[o + 2], ch === 4 ? px[o + 3] : 255];
};

const pintarFundo = async (page: Page, hex: string) => {
  const linha = page.locator('.ic-layer-row', { hasText: /background/i }).first();
  // O NOME, nao a linha: a fileira tem stagger de entrada (`composer-layer-enter`)
  // e um clique no centro durante a animacao cai no botao do olho — foi assim
  // que um clique "na linha" desligou a visibilidade em vez de selecionar.
  // O botao do nome borbulha para o `onSelect` da linha e nao tem vizinho clicavel.
  const nome = linha.getByRole('button', { name: 'Background', exact: true });
  // Re-clica ate a selecao assentar. O que prova a selecao e o cabecalho do
  // inspetor (`Image/Background`) mais a linha ativa — nunca um texto, porque
  // "Background" tambem nomeia o grupo da lista e um `toContainText` passaria
  // com a forma ainda selecionada (foi assim que a tinta caiu no stop do
  // gradiente da elipse).
  let selecionado = false;
  for (let i = 0; i < 6 && !selecionado; i++) {
    await nome.click();
    selecionado = await page.locator('.ic-inspector-head h2', { hasText: 'Background' })
      .waitFor({ state: 'visible', timeout: 1500 })
      .then(() => true)
      .catch(() => false);
  }
  expect(selecionado, 'a linha Background nao selecionou').toBe(true);
  await expect(linha).toHaveClass(/bg-ic-accent/);
  // `exact`: sem ele, "Stop 1 color hex" (gradiente da forma) casa primeiro.
  const campo = page.locator('.ic-inspector').getByLabel('Color hex', { exact: true });
  await campo.click();
  await campo.fill(hex);
  await campo.press('Enter');
  await expect(campo).toHaveValue(hex.replace('#', '').toUpperCase());
};

/** Espera o canto (2%,2%) de um <img> chegar ao rgba, em vez de dormir fixo. */
const esperarCanto = (
  page: Page,
  selector: string,
  rgba: [number, number, number, number]
): Promise<void> =>
  page.waitForFunction(
    ([sel, alvo]) => {
      const img = document.querySelector(sel as string) as HTMLImageElement | null;
      if (!img || !img.naturalWidth) return false;
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(Math.floor(c.width * 0.02), Math.floor(c.height * 0.02), 1, 1).data;
      const t = alvo as [number, number, number, number];
      return d[0] === t[0] && d[1] === t[1] && d[2] === t[2] && d[3] === t[3];
    },
    [selector, rgba] as unknown as void,
    { timeout: 15000 }
  ).then(() => undefined);

const esperarCantoDoTile = (
  page: Page,
  name: string,
  rgba: [number, number, number, number]
): Promise<void> =>
  page.waitForFunction(
    ([label, alvo]) => {
      const btn = [...document.querySelectorAll('.studio-tile')].find((b) =>
        b.textContent?.includes(label as string));
      const img = btn?.querySelector('img');
      if (!img || !img.naturalWidth) return false;
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(Math.floor(c.width * 0.02), Math.floor(c.height * 0.02), 1, 1).data;
      const t = alvo as [number, number, number, number];
      return d[0] === t[0] && d[1] === t[1] && d[2] === t[2] && d[3] === t[3];
    },
    [name, rgba] as unknown as void,
    { timeout: 15000 }
  ).then(() => undefined);

test('fundo novo nasce com o handle e o ajuste chega ao canvas e ao tile', async ({ page }) => {
  await preparar(page);

  // O contorno vigente: arquivo novo nasce COM a layer de background padrao.
  await expect(page.locator('.ic-layer-row', { hasText: /background/i })).toHaveCount(1);

  await page.getByRole('button', { name: 'Insert layer' }).first().click();
  await page.getByRole('menuitem', { name: 'Ellipse' }).click();
  await page.waitForTimeout(800);

  await pintarFundo(page, '#FF0000');
  await esperarCanto(page, 'img.ic-canvas-render', [255, 0, 0, 255]);
  await esperarCantoDoTile(page, 'Default', [255, 0, 0, 255]);
  expect(await cantoDoImg(page, 'img.ic-canvas-render')).toEqual([255, 0, 0, 255]);
  expect(await cantoDoTile(page, 'Default')).toEqual([255, 0, 0, 255]);
});

test('ajuste na variante dark fica na dark: canvas, tile dark e default intacto', async ({ page }) => {
  await preparar(page);
  await page.getByRole('button', { name: 'Insert layer' }).first().click();
  await page.getByRole('menuitem', { name: 'Ellipse' }).click();
  await page.waitForTimeout(800);

  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  // `exact`: sem ele, "Dark theme" (o toggle de tema) casa por substring e o
  // clique troca o TEMA em vez da variante — o ajuste cairia na base e o teste
  // mediria verde no tile errado, parecendo que o escopo quebrou.
  await expect(page.getByRole('region', { name: 'Canvas' })).toContainText('Dark appearance');
  await page.waitForTimeout(800);
  await pintarFundo(page, '#00FF00');

  // Canvas segue a variante ativa; o tile da variante acompanha.
  await esperarCanto(page, 'img.ic-canvas-render', [0, 255, 0, 255]);
  await esperarCantoDoTile(page, 'Dark', [0, 255, 0, 255]);
  expect(await cantoDoImg(page, 'img.ic-canvas-render')).toEqual([0, 255, 0, 255]);
  expect(await cantoDoTile(page, 'Dark')).toEqual([0, 255, 0, 255]);
  // As demais variantes guardam o desenho delas — escopo, nao vazamento. A espera vem
  // antes da leitura: trocar de variante re-renderiza os thumbs, e o `<img>` do tile
  // inativo fica sem `naturalWidth` enquanto decodifica — foi o "tile Default sem pixels"
  // do CI, que passava local. As leituras vizinhas (linhas acima) ja esperavam; esta nao.
  await esperarCantoDoTile(page, 'Default', [248, 250, 252, 255]);
  expect(await cantoDoTile(page, 'Default')).toEqual([248, 250, 252, 255]);
});

test('arquivo exportado carrega o fundo ajustado (switch desligado = WYSIWYG)', async ({ page }) => {
  await preparar(page);
  await page.getByRole('button', { name: 'Insert layer' }).first().click();
  await page.getByRole('menuitem', { name: 'Ellipse' }).click();
  await page.waitForTimeout(800);
  await pintarFundo(page, '#FF0000');

  const inspector = page.getByRole('region', { name: 'Inspector panel' });
  await inspector.getByRole('tab', { name: 'Export' }).click();
  await expect(inspector.getByRole('switch', { name: 'Transparent background' })).not.toBeChecked();
  await inspector.getByRole('checkbox', { name: 'SVG' }).click();
  await inspector.getByRole('button', { name: /Export \d+ files?/ }).click();
  await expect(inspector.getByRole('button', { name: 'Download all (.zip)' })).toBeVisible({ timeout: 30000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    inspector.getByRole('button', { name: 'Download' }).first().click()
  ]);
  const caminho = await download.path();
  if (!caminho) throw new Error('download sem caminho em disco');
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  expect(cantoDoPng(caminho)).toEqual([255, 0, 0, 255]);
});

test('switch ligado: Preview/Export mostra alpha e o arquivo sai transparente', async ({ page }) => {
  await preparar(page);
  await page.getByRole('button', { name: 'Insert layer' }).first().click();
  await page.getByRole('menuitem', { name: 'Ellipse' }).click();
  await page.waitForTimeout(800);
  await pintarFundo(page, '#FF0000');

  const inspector = page.getByRole('region', { name: 'Inspector panel' });
  await inspector.getByRole('tab', { name: 'Export' }).click();
  await inspector.getByRole('switch', { name: 'Transparent background' }).click();
  // O preview do painel é o arquivo, não o editor: espera o canto alpha.
  await page.waitForFunction(
    () => {
      const panel = document.querySelector('[aria-label="Inspector panel"]')!;
      const img = panel.querySelector('.studio-tile img') as HTMLImageElement | null;
      if (!img || !img.naturalWidth) return false;
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(Math.floor(c.width * 0.02), Math.floor(c.height * 0.02), 1, 1).data;
      return d[3] === 0;
    },
    undefined,
    { timeout: 15000 }
  );

  await inspector.getByRole('checkbox', { name: 'SVG' }).click();
  await inspector.getByRole('button', { name: /Export \d+ files?/ }).click();
  await expect(inspector.getByRole('button', { name: 'Download all (.zip)' })).toBeVisible({ timeout: 30000 });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    inspector.getByRole('button', { name: 'Download' }).first().click()
  ]);
  const caminho = await download.path();
  if (!caminho) throw new Error('download sem caminho em disco');
  expect(cantoDoPng(caminho)[3]).toBe(0);
});
