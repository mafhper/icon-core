import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import zlib from 'node:zlib';

/**
 * Export de ponta a ponta com o fixture completo: **forma + texto + sombra**
 * num projeto só, e o arquivo em disco como fonte de prova.
 *
 * ## Por que mais um spec de export
 *
 * O que já existia em volta, e o que nenhum dos dois olha:
 *
 * - `bg-fidelity` cobre o caminho controle → canvas → tiles → PNG de **uma**
 *   forma, e o switch de transparência;
 * - `studio-export` cobre assinatura de PNG/ICO/SVG e o naming por variante.
 *
 * Nenhum dos dois abre o ICO ou o ZIP, nem prova que texto e sombra
 * atravessam o pipeline **junto** do fundo. Este spec é essa prova:
 *
 * 1. o fundo por variante chega ao PNG **e** ao PNG dentro do ICO — medido em
 *    (50%,2%), topo-centro interior à moldura, contra os literais das sementes
 *    do `projectFactory` (#f8fafc no default, #111827 na dark). Fundo ignorado
 *    reprova com alpha 0; variante ignorada reprova com os dois pontos iguais.
 *    O canto cru (2%,2%) fecha a moldura: alpha 0 no PNG exportado (o
 *    rounded-rectangle default recorta) e fundo puro no ICO, que não leva
 *    forma — container vence;
 * 2. a sombra default da forma (y+18, blur 34) pinta **fora** da silhueta,
 *    logo abaixo dela — o pixel que o recorte do fill amputava (a classe
 *    `sombraLonga` do `check-svg-parity`). Só no default: sobre o fundo
 *    escuro da dark o sinal seria fraco demais para um limiar honesto;
 * 3. o ZIP carrega os 8 caminhos, e o PNG lá dentro é **byte a byte** o do
 *    download individual — o transporte não reencoda nem troca blob;
 * 4. o SVG carrega `<text>` (a layer de texto) e `feDropShadow` (a sombra).
 *
 * O PNG é decodificado aqui mesmo (zlib builtin) e o ZIP é lido pelo diretório
 * central + `inflateRaw`: o arquivo que o app gera é um contrato público o
 * bastante para ser verificado sem importar o JSZip do workspace do app — a
 * suíte e2e não declara essa dependência, e não passa a declarar por causa
 * deste spec.
 *
 * ## O que este spec NÃO cobre, de propósito
 *
 * **Saída em pasta (folder).** Não existe transporte de pasta no web app: o
 * painel do Studio entrega arquivo a arquivo e o ZIP. O gravador de pasta é o
 * shell Tauri (`save_generated_files`, via `exportToDesktop` em
 * `apps/web/src/lib/desktopExport.ts`), que **não tem chamador nesta branch** —
 * e `ExportDestination = 'zip' | 'folder' | 'files'` existe só no modelo.
 * Cobrir isso é smoke do desktop, não e2e de browser; a contraparte dele aqui
 * são os downloads individuais (o mesmo `GeneratedFile[]`, um arquivo por vez).
 */

type Cor = [number, number, number, number];

/**
 * Ponto de fundo: (50%,2%) — topo-centro, **interior** à moldura e fora da arte
 * (que é centrada). O canto cru (2%,2%) não serve mais de sonda de fundo: o
 * export espelha a moldura do editor (rounded-rectangle, raio default 24) e o
 * canto é recortado — o corte é provado à parte, com `em(2, 2)`.
 */
const FRACAO_X_DO_FUNDO = 0.5;
const FRACAO_Y_DO_FUNDO = 0.02;

interface Raster {
  width: number;
  height: number;
  /** RGBA em (50%,2%): topo-centro, interior à moldura — fundo puro fora da arte. */
  fundo: Cor;
  /** RGBA num pixel absoluto. */
  em: (x: number, y: number) => Cor;
}

/**
 * Decodifica um PNG 8-bit não entrelaçado (tipos 2/6) sem dependências.
 *
 * Fora desse contrato, **lança** em vez de adivinhar: um PNG entrelaçado ou de
 * 16 bits decodificado pela metade produziria pixel errado com cara de pixel
 * medido — pior que uma falha.
 */
const decodificarPng = (bytes: Buffer): Raster => {
  if (Buffer.from([0x89, 0x50, 0x4e, 0x47]).compare(bytes.subarray(0, 4)) !== 0) {
    throw new Error('sem assinatura PNG');
  }
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  while (pos + 8 <= bytes.length) {
    const len = bytes.readUInt32BE(pos);
    const type = bytes.subarray(pos + 4, pos + 8).toString('ascii');
    const data = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
    throw new Error(`PNG fora do contrato desta sonda: depth=${bitDepth} type=${colorType} interlace=${interlace}`);
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
        const pa = Math.abs(q - a);
        const pb = Math.abs(q - b);
        const pc = Math.abs(q - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      row[i] = v;
    }
  }
  const em = (x: number, y: number): Cor => {
    const o = y * stride + x * ch;
    return [px[o], px[o + 1], px[o + 2], ch === 4 ? px[o + 3] : 255];
  };
  return { width, height, fundo: em(Math.floor(width * FRACAO_X_DO_FUNDO), Math.floor(height * FRACAO_Y_DO_FUNDO)), em };
};

const luminancia = ([r, g, b]: Cor): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

interface EntradaIco {
  largura: number;
  tamanho: number;
  offset: number;
}

/** Lê o diretório do `.ico`; cada entrada carrega um blob PNG. */
const entradasIco = (bytes: Buffer): EntradaIco[] => {
  expect(bytes.readUInt16LE(0), 'reserved do ICO').toBe(0);
  expect(bytes.readUInt16LE(2), 'type do ICO').toBe(1);
  const total = bytes.readUInt16LE(4);
  const entradas: EntradaIco[] = [];
  for (let i = 0; i < total; i++) {
    const p = 6 + i * 16;
    entradas.push({
      // No ICO, largura/altura 0 significam 256 (não cabe no byte do header).
      largura: bytes.readUInt8(p) || 256,
      tamanho: bytes.readUInt32LE(p + 8),
      offset: bytes.readUInt32LE(p + 12)
    });
  }
  return entradas;
};

const maiorEntrada = (entradas: EntradaIco[]): EntradaIco =>
  entradas.reduce((a, b) => (a.largura >= b.largura ? a : b));

/**
 * Lê um ZIP pelo **diretório central** (nomes e tamanhos vêm de lá) e infla os
 * dados com `zlib.inflateRawSync`. Só DEFLATE (método 8) e STORE (0) — que é o
 * que o `zipFiles` do app produz. Qualquer outra coisa lança.
 */
const lerZip = (bytes: Buffer): Map<string, Buffer> => {
  const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('zip: EOCD não encontrado');
  const total = bytes.readUInt16LE(eocd + 10);
  let p = bytes.readUInt32LE(eocd + 16);
  const arquivos = new Map<string, Buffer>();
  for (let i = 0; i < total; i++) {
    if (bytes.readUInt32LE(p) !== 0x02014b50) throw new Error(`zip: cabeçalho central inválido em ${p}`);
    const metodo = bytes.readUInt16LE(p + 10);
    const comprimido = bytes.readUInt32LE(p + 20);
    const nomeLen = bytes.readUInt16LE(p + 28);
    const extraLen = bytes.readUInt16LE(p + 30);
    const comentarioLen = bytes.readUInt16LE(p + 32);
    const offsetLocal = bytes.readUInt32LE(p + 42);
    const nome = bytes.subarray(p + 46, p + 46 + nomeLen).toString('utf8');
    p += 46 + nomeLen + extraLen + comentarioLen;
    if (nome.endsWith('/')) continue;
    // O local header pode declarar nome/extra de tamanhos diferentes dos do
    // diretório central; os tamanhos de dados já vieram de lá.
    if (bytes.readUInt32LE(offsetLocal) !== 0x04034b50) throw new Error(`zip: local header inválido de ${nome}`);
    const lnLen = bytes.readUInt16LE(offsetLocal + 26);
    const leLen = bytes.readUInt16LE(offsetLocal + 28);
    const inicio = offsetLocal + 30 + lnLen + leLen;
    const dados = bytes.subarray(inicio, inicio + comprimido);
    if (metodo === 0) arquivos.set(nome, Buffer.from(dados));
    else if (metodo === 8) arquivos.set(nome, zlib.inflateRawSync(dados));
    else throw new Error(`zip: método de compressão não suportado (${metodo}) em ${nome}`);
  }
  return arquivos;
};

/** Cria o projeto pelo welcome e monta o fixture: forma primeiro, texto por cima. */
const abrirComFixture = async (page: Page) => {
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

  const boasVindas = page.getByRole('dialog');
  if (await boasVindas.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /^Create$/i }).first().click();
    await page.waitForTimeout(600);
  }
  await page.getByRole('toolbar', { name: 'Studio toolbar' }).waitFor({ timeout: 15000 });

  // A forma primeiro: "Rounded rectangle" (220×220) carrega a depth-shadow
  // default habilitada — a sombra do fixture é essa, não um gesto à parte.
  await page.getByRole('button', { name: 'Insert layer' }).first().click();
  await page.getByRole('menuitem', { name: 'Rounded rectangle' }).click();
  await page.waitForTimeout(600);

  // O texto entra depois: zIndex maior, fica por cima da forma.
  await page.getByRole('button', { name: 'Insert layer' }).first().click();
  await page.getByRole('menuitem', { name: 'Text' }).click();
  await page.waitForTimeout(600);

  // Handle de Background + forma + texto: o fixture inteiro antes de exportar.
  await expect(page.locator('.ic-layer-row'), 'o fixture não montou (forma + texto + handle)').toHaveCount(3);
};

const abrirExport = async (page: Page): Promise<Locator> => {
  // Export lives in the Inspector Export tab — the panel itself is the surface.
  const inspector = page.getByRole('region', { name: 'Inspector panel' });
  await inspector.getByRole('tab', { name: 'Export' }).click();
  await expect(inspector.getByRole('button', { name: /Export \d+ files?/ })).toBeVisible();
  return inspector;
};

const executarExport = async (page: Page, painel: Locator) => {
  await painel.getByRole('button', { name: /Export \d+ files?/ }).click();
  await expect(painel.getByRole('button', { name: 'Download all (.zip)' })).toBeVisible({ timeout: 30000 });
};

/** Baixa o arquivo cuja linha da lista casa o sufixo, por role e nome — nunca por `.first()`. */
const baixarArquivo = async (page: Page, painel: Locator, sufixo: RegExp) => {
  const linha = painel.locator('.studio-export-files li').filter({ hasText: sufixo });
  await expect(linha, `um único arquivo casando ${sufixo}`).toHaveCount(1);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    linha.getByRole('button', { name: 'Download' }).click()
  ]);
  const caminho = await download.path();
  if (!caminho) throw new Error(`download sem caminho em disco: ${download.suggestedFilename()}`);
  return { nome: download.suggestedFilename(), bytes: fs.readFileSync(caminho) };
};

/** Extrai o PNG de 256 do ICO e devolve o raster — o mesmo fundo, dentro do container. */
const png256DoIco = (bytes: Buffer): Raster => {
  const entradas = entradasIco(bytes);
  expect(entradas.length, 'entradas do ICO').toBe(6);
  for (const entrada of entradas) {
    expect(
      Array.from(bytes.subarray(entrada.offset, entrada.offset + 4)),
      `entrada ${entrada.largura}px não abre com assinatura PNG`
    ).toEqual([0x89, 0x50, 0x4e, 0x47]);
  }
  const maior = maiorEntrada(entradas);
  expect(maior.largura, 'maior entrada do ICO').toBe(256);
  return decodificarPng(bytes.subarray(maior.offset, maior.offset + maior.tamanho));
};

test('forma + texto + sombra: o fundo de cada variante chega ao PNG e ao ICO, e o SVG carrega o texto e a sombra', async ({
  page
}) => {
  // Cinco downloads em série + export de 8 artefatos: o teto default de 30s
  // do runner é apertado para o teste mais longo da suíte.
  test.setTimeout(60_000);

  await abrirComFixture(page);
  const painel = await abrirExport(page);

  // ICO liga (SVG/PNG já vêm ligados); a segunda variante entra porque o fundo
  // por variante precisa de dois valores para significar alguma coisa.
  await painel.getByRole('checkbox', { name: 'ICO' }).click();
  await painel.getByRole('checkbox', { name: 'Dark' }).click();
  await executarExport(page, painel);

  // 4 artefatos (svg, png256, png512, ico) × 2 variantes.
  await expect(painel.locator('.studio-export-files li')).toHaveCount(8);

  const svg = await baixarArquivo(page, painel, /-default\.svg/);
  const pngDefault = await baixarArquivo(page, painel, /-default-512px\.png/);
  const pngDark = await baixarArquivo(page, painel, /-dark-512px\.png/);
  const icoDefault = await baixarArquivo(page, painel, /-default\.ico/);
  const icoDark = await baixarArquivo(page, painel, /-dark\.ico/);

  // ── PNG: o fundo de cada variante chega ao arquivo em (50%,2%) — topo-centro,
  // interior à moldura e fora da arte (a forma tem 220px e o texto fica no
  // centro). Os literais são as sementes do projectFactory (default #f8fafc,
  // dark #111827). Se o export ignorar o fundo, o ponto sai [0,0,0,0]; se
  // ignorar a variante, os dois fundos empatam.
  const rasterDefault = decodificarPng(pngDefault.bytes);
  const rasterDark = decodificarPng(pngDark.bytes);
  expect(rasterDefault.width, 'largura do PNG de 512').toBe(512);
  expect(rasterDefault.fundo, 'fundo do PNG default').toEqual([248, 250, 252, 255]);
  expect(rasterDark.fundo, 'fundo do PNG dark').toEqual([17, 24, 39, 255]);
  expect(rasterDefault.fundo, 'as variantes não se diferenciam no arquivo').not.toEqual(rasterDark.fundo);

  // O canto cru (2%,2%) é recortado: o export espelha a moldura do editor
  // (rounded-rectangle, raio default 24) — a máscara chegou ao arquivo.
  expect(rasterDefault.em(2, 2)[3], 'o canto não foi recortado: a moldura do canvas não chegou ao PNG').toBe(0);

  // Tinta no centro: a forma + o texto pintaram (o fundo é fundo; o centro não).
  expect(rasterDefault.em(256, 256), 'sem tinta no centro: forma/texto sumiram').not.toEqual(rasterDefault.fundo);

  // A sombra (y+18, blur 34) pinta FORA da silhueta, logo abaixo da forma —
  // o pixel que o recorte do fill amputava (sombraLonga). Só no default: sobre
  // o fundo escuro da dark o sinal seria fraco demais para um limiar honesto.
  const baseY = rasterDefault.height / 2 + 220 / 2;
  let maisEscuro = Number.POSITIVE_INFINITY;
  for (let y = Math.ceil(baseY + 2); y <= Math.min(Math.floor(baseY + 30), rasterDefault.height - 1); y++) {
    maisEscuro = Math.min(maisEscuro, luminancia(rasterDefault.em(Math.floor(rasterDefault.width / 2), y)));
  }
  expect(
    luminancia(rasterDefault.fundo) - maisEscuro,
    'a sombra não pinta abaixo da forma — o clip do fill pode ter voltado'
  ).toBeGreaterThan(20);

  // ── ICO: o mesmo fundo, no PNG de 256 que o container carrega.
  const dentroDoIco = png256DoIco(icoDefault.bytes);
  expect(dentroDoIco.fundo, 'fundo do PNG dentro do ICO default').toEqual([248, 250, 252, 255]);
  expect(png256DoIco(icoDark.bytes).fundo, 'fundo do PNG dentro do ICO dark').toEqual([17, 24, 39, 255]);
  // O container não leva a moldura: o mesmo canto que o PNG exportado recorta
  // sai aqui com o fundo puro — Windows/macOS aplicam a máscara na exibição.
  expect(dentroDoIco.em(2, 2), 'o ICO foi mascarado — container vence').toEqual([248, 250, 252, 255]);

  // ── SVG: o texto e a sombra do fixture chegaram ao vetor.
  const markup = svg.bytes.toString('utf8');
  expect(markup, 'sem <text>: a layer de texto não chegou ao SVG').toMatch(/<text\b/);
  expect(markup, 'o texto default "Icon" não está no SVG').toContain('Icon');
  expect(markup, 'sem feDropShadow: a sombra da forma não chegou ao SVG').toContain('feDropShadow');
});

test('transparência ligada: PNG e ICO saem com o fundo transparente', async ({ page }) => {
  await abrirComFixture(page);
  const painel = await abrirExport(page);

  const transparente = painel.getByRole('switch', { name: 'Transparent background' });
  await expect(transparente, 'o default do diálogo mudou: era para o fundo estar pintado').not.toBeChecked();
  await transparente.click();
  await painel.getByRole('checkbox', { name: 'ICO' }).click();
  await executarExport(page, painel);

  const png = await baixarArquivo(page, painel, /-default-512px\.png/);
  const ico = await baixarArquivo(page, painel, /-default\.ico/);

  const raster = decodificarPng(png.bytes);
  expect(raster.fundo, 'o fundo ainda aparece no arquivo — o switch não chegou').toEqual([0, 0, 0, 0]);
  // O switch tira o fundo, não a arte: o centro continua opaco.
  expect(raster.em(256, 256)[3], 'a arte perdeu o alpha junto com o fundo').toBe(255);

  expect(png256DoIco(ico.bytes).fundo, 'o ICO ignorou o switch: o fundo veio pintado').toEqual([0, 0, 0, 0]);
});

test('zip: carrega os 8 caminhos e o PNG dentro é byte a byte o do download individual', async ({ page }) => {
  await abrirComFixture(page);
  const painel = await abrirExport(page);

  await painel.getByRole('checkbox', { name: 'ICO' }).click();
  await painel.getByRole('checkbox', { name: 'Dark' }).click();
  await executarExport(page, painel);

  const pngDefault = await baixarArquivo(page, painel, /-default-512px\.png/);

  const [downloadZip] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    painel.getByRole('button', { name: 'Download all (.zip)' }).click()
  ]);
  expect(downloadZip.suggestedFilename()).toMatch(/\.zip$/);
  const caminho = await downloadZip.path();
  if (!caminho) throw new Error('zip sem caminho em disco');

  const arquivos = lerZip(fs.readFileSync(caminho));
  const nomes = [...arquivos.keys()];
  expect(nomes, 'contagem de arquivos no zip').toHaveLength(8);
  for (const sufixo of [
    '-default.svg',
    '-dark.svg',
    '-default-256px.png',
    '-dark-256px.png',
    '-default-512px.png',
    '-dark-512px.png',
    '-default.ico',
    '-dark.ico'
  ]) {
    expect(nomes.filter((nome) => nome.endsWith(sufixo)), `arquivo ${sufixo} no zip`).toHaveLength(1);
  }

  // O PNG do zip não é placeholder: é o mesmo blob do download individual...
  const dentro = arquivos.get(nomes.find((nome) => nome.endsWith('-default-512px.png'))!);
  if (!dentro) throw new Error('o zip não tem o PNG default de 512');
  expect(dentro.equals(pngDefault.bytes), 'o PNG do zip difere do download individual').toBe(true);
  // ...e carrega o fundo da variante, como o arquivo solto.
  expect(decodificarPng(dentro).fundo, 'fundo do PNG dentro do zip').toEqual([248, 250, 252, 255]);
});
