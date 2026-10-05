import { expect, test, type Page } from '@playwright/test';

/**
 * O preview de export: coluna vertical, tamanhos distintos, e o recorte da máscara.
 *
 * ## Os dois defeitos que estes testes medem
 *
 * **1. `Math.min(size, 96)`** fazia 180 e 512 ocuparem 96px — dois quadrados do mesmo
 * tamanho, lado a lado, com o mesmo desenho. Não havia o que comparar. Este teste mede a
 * **largura renderizada** de cada thumb e exige que sejam **três números diferentes**.
 *
 * **2. Nenhum recorte.** O arquivo é renderizado no canvas quadrado inteiro, mas o ícone
 * não é um quadrado: ele é cortado pela máscara. Ver 512px num quadrado dá a impressão de
 * que um bloco quadrado é o produto final — e o canto cortado só aparece depois de
 * exportar. Este teste exige o contorno, e que ele siga a **máscara escolhida**.
 *
 * ## Por que o contorno é medido pelo `border-radius` e não por um SVG
 *
 * Porque a máscara é um raio de canto (`defaultMaskRadius`), e é o raio que o export
 * usa. Ler o `style` prova que o componente calcula com a mesma função que o
 * `PreviewCanvas` — duas constantes locais divergem na primeira plataforma nova, e o
 * contorno passa a prometer um recorte que o ícone não tem.
 */

/** Os thumbs na ordem em que aparecem na coluna (maior para o menor). */
const thumbs = (page: Page) => page.locator('.ic-export-preview-frame');

/** A largura renderizada de cada thumb, em px de tela. */
const larguras = async (page: Page): Promise<number[]> => {
  const n = await thumbs(page).count();
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const box = await thumbs(page).nth(i).boundingBox();
    if (box) out.push(Math.round(box.width));
  }
  return out;
};

const abrirExport = async (page: Page) => {
  await page.goto('/icon-core/app/?theme=dark');
  const welcome = page.getByRole('dialog');
  if (await welcome.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /^Create$/i }).first().click();
    await page.waitForTimeout(600);
  }
  await page.getByRole('button', { name: 'Add text layer' }).click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  /**
   * Entra pela view de export pelo **menu**, e nao por `goto` com hash.
   *
   * Duas tentativas anteriores falharam aqui, e nenhuma por causa do componente:
   *
   * 1. `#/export` — nome de view que nao existe (e `export-utilities`).
   * 2. `#/export-utilities` certo, mas `page.goto` so com hash **nao recarrega** a
   *    pagina: o app le o hash no mount, e a tela continuava em `edit-space`. O erro
   *    era "element not found" para um elemento que existia, na outra view.
   *
   * O menu e o caminho que a pessoa usa, entao e o caminho que o teste mede.
   */
  await page.getByRole('button', { name: 'Export menu' }).click();
  await page.getByRole('menuitem', { name: 'Export icon pack' }).click();
  await page.waitForTimeout(900);
  await expect(page.locator('.ic-export-preview')).toBeVisible();
};

test('export preview: a coluna vai do maior para o menor', async ({ page }) => {
  await abrirExport(page);

  const medidas = await larguras(page);
  expect(medidas.length).toBe(3);

  /**
   * Três tamanhos **distintos** e em ordem decrescente.
   *
   * Com `Math.min(size, 96)` esta linha recebia `[96, 96, 32]` — o `96` repetido é o
   * defeito inteiro. Comparar só "são iguais" pegaria parte; exigir ordem decrescente pega
   * o caso em que dois colidem no meio.
   */
  expect(new Set(medidas).size).toBe(3);
  expect(medidas[0]).toBeGreaterThan(medidas[1]);
  expect(medidas[1]).toBeGreaterThan(medidas[2]);

  // E o menor e 1:1: 32px na tela para um arquivo de 32px. É o que a pessoa precisa
  // julgar, e um cap de 96px o mostraria ampliado sem dizer.
  expect(medidas[2]).toBe(32);
});

test('export preview: o maior vem primeiro e e rotulado', async ({ page }) => {
  await abrirExport(page);

  // A ordem do DOM **é** a ordem visual: é o que a pessoa lê de cima para baixo. Se algum
  // dia for reordenado por CSS, esta linha mente — e a mentira é do lado que ela protege.
  const legendas = await page.locator('.ic-export-preview-cell figcaption strong').allInnerTexts();
  expect(legendas).toEqual(['512px', '180px', '32px']);
});

test('export preview: o contorno acompanha a mascara escolhida', async ({ page }) => {
  await abrirExport(page);

  const contorno = page.locator('.ic-export-preview-mask');
  await expect(contorno).toHaveCount(3);

  /** O raio do maior thumb (displaySize 160) e do menor (32). */
  const raios = async (): Promise<{ grande: number; pequeno: number }> => {
    const read = async (i: number) => {
      const bruto = await contorno.nth(i).evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
      return Math.round(Number.parseFloat(bruto));
    };
    return { grande: await read(0), pequeno: await read(2) };
  };

  // O padrao do projeto recem-criado e `rounded-rectangle`, cujo raio e **fixo**: 24px,
  // em qualquer tamanho. E por isso que ele nao serve para provar que o contorno acompanha
  // a mascara — precisa de uma mascara que dependa do tamanho.
  const padrao = await raios();
  expect(padrao.grande).toBe(24);
  expect(padrao.pequeno).toBe(24);
  await expect(page.locator('.ic-export-preview-frame').first()).toHaveAttribute(
    'data-mask',
    'rounded-rectangle'
  );

  /**
   * Circle: metade do lado. 160 → 80 e 32 → 16.
   *
   * E aqui que o "acompanha" e medido: dois raios **diferentes** para o mesmo preset, e
   * ambos a metade do lado de exibicao. Se o contorno usasse um raio fixo, ou o raio do
   * `size` (512 em vez de 160), os dois numeros estariam errados — e o `24` fixo do
   * `rounded-rectangle` e justamente o que esconde esse erro.
   */
  await page.getByRole('button', { name: 'Back to Edit Space' }).click();
  await page.waitForTimeout(500);

  // A mascara muda pelo **ciclo** do botao de plataforma (`square -> rounded-rectangle ->
  // circle`), e o proprio nome do botao e a ancora. Enquanto ele disser "Rounded", um
  // clique leva a "Circle" — assim o teste nao depende do estado inicial.
  const plataforma = page.getByRole('button', { name: /^Platform:/ });
  await expect(plataforma).toHaveAccessibleName('Platform: Rounded');
  await plataforma.click();
  await expect(plataforma).toHaveAccessibleName('Platform: Circle');
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: 'Export menu' }).click();
  await page.getByRole('menuitem', { name: 'Export icon pack' }).click();
  await page.waitForTimeout(900);

  await expect(page.locator('.ic-export-preview-frame').first()).toHaveAttribute(
    'data-mask',
    'circle'
  );
  const circular = await raios();
  expect(circular.grande).toBe(80);
  expect(circular.pequeno).toBe(16);

  // E os dois presets sao **diferentes** — a promessa do painel.
  expect(circular.grande).not.toBe(padrao.grande);
  expect(circular.pequeno).not.toBe(padrao.pequeno);
});

test('export preview: claro e escuro no mesmo quadrado, nao dois quadrados', async ({ page }) => {
  await abrirExport(page);

  /**
   * Um quadrado por tamanho, com o fundo em split.
   *
   * Eram dois quadrados empilhados (um claro, um escuro), cada um com o seu fundo — e não
   * cabia um único contorno de máscara sobre os dois. Split é o que permite um recorte, e
   * o recorte é o ponto.
   *
   * O `img` é único por quadrado: dois `img` significam que as duas metades não são
   * julgadas do **mesmo** arquivo, que é o que o painel promete.
   */
  await expect(page.locator('.ic-export-preview-frame img')).toHaveCount(3);

  const box = await thumbs(page).first().boundingBox();
  expect(box).not.toBeNull();
  // Quadrado: a altura tem de acompanhar a largura, senão o recorte nao é o do arquivo.
  expect(Math.round(box!.height)).toBe(Math.round(box!.width));

  const fundo = await thumbs(page)
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  // Um gradiente (o split), nao uma cor solida (um fundo so).
  expect(fundo).toContain('gradient');
});
