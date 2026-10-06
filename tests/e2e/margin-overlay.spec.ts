import { expect, test } from '@playwright/test';

/**
 * A máscara da `import margin`: ela **aparece** quando a margem sobe, e some quando a
 * pessoa desliga o controle.
 *
 * O teste mede o retângulo renderizado, e não a existência do componente. Um teste que
 * verifica "o componente montou" passa com uma geometria errada no `d` — e a geometria
 * errada aqui é a que faria a guia discordar da arte na importação seguinte.
 */
test('import margin: a guia acompanha o slider e respeita o toggle', async ({ page }) => {
  await page.goto('/icon-core/app/?theme=dark');

  /**
   * Limpa o storage antes de o app montar. O contexto sobrevive ao `goto`, entao o
   * storage tambem: com um projeto salvo, a dialog mostra a **lista** em vez do botao
   * "Create", e o clique estoura em 30s esperando algo que nao aparece. Ver
   * `foreignobject-regression`, o primeiro spec a fazer **dois** `goto` no mesmo teste.
   */
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
  await page.getByRole('button', { name: 'Add text layer' }).click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  const overlay = page.locator('.ic-margin-overlay');
  const rect = overlay.locator('rect');

  // Margem 0% nao tem o que mostrar: a guia seria o canvas inteiro, e poluiria.
  await expect(overlay).toHaveCount(0);

  const slider = page.getByRole('slider', { name: 'Margin' });
  await expect(slider).toHaveValue('0');

  await slider.press('ArrowRight');
  await slider.press('ArrowRight');
  await page.waitForTimeout(300);

  // A guia apareceu, e a area e MENOR que o canvas — 2% de margem em 512.
  await expect(overlay).toBeVisible();
  const box = await rect.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.width).toBeLessThan(512 * 0.99);
    expect(box.width).toBeGreaterThan(400);
  }

  // E ela e **centralizada**: as duas bordas iguais. Uma guia deslocada seria pior que
  // nenhuma, porque a arte entra centralizada.
  if (box) {
    const stage = await page.locator('.ic-canvas-frame').boundingBox();
    if (stage) {
      const esquerda = box.x - stage.x;
      const direita = stage.x + stage.width - (box.x + box.width);
      expect(Math.abs(esquerda - direita)).toBeLessThan(3);
    }
  }

  // O toggle desliga.
  await page.getByRole('switch', { name: 'Show margin on canvas' }).click();
  await page.waitForTimeout(200);
  await expect(overlay).toHaveCount(0);

  // E religar traz de volta — o controle nao e decorativo.
  await page.getByRole('switch', { name: 'Show margin on canvas' }).click();
  await page.waitForTimeout(200);
  await expect(overlay).toBeVisible();
});

/**
 * A máscara não rouba clique.
 *
 * `pointer-events: none` é o que garante isto, e a consequência de perdê-lo é sutil:
 * clicar numa camada embaixo da guia deixaria de selecionar a camada. Testar o efeito,
 * e não a propriedade CSS, porque a propriedade pode estar lá e o browser stacking
 * context pode thwartar.
 */
test('import margin: a guia nao impede selecionar a camada de baixo', async ({ page }) => {
  await page.goto('/icon-core/app/?theme=dark');

  const welcome = page.getByRole('dialog');
  if (await welcome.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /^Create$/i }).first().click();
    await page.waitForTimeout(600);
  }
  await page.getByRole('button', { name: 'Add text layer' }).click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  await page.getByRole('slider', { name: 'Margin' }).press('ArrowRight');
  await page.waitForTimeout(300);

  /*
    O alvo do clique e o **canvas**, e nao a linha da camada.

    A versao anterior clicava numa linha do painel esquerdo. Isso nao testava a
    propriedade: o overlay esta sobre o canvas, e um painel lateral nao tem como
    sofrer com ele. Um teste que passa sem tocar no alvo e um teste que nao prova
    nada.

    Aqui o clique e no frame, onde a mascara esta, e o efeito observavel e o
    inspetor passar a mostrar `Background` — que e o que a `PreviewCanvas` faz num
    clique dentro do frame.

    E o clique e no **centro**, nao no canto (5, 5): com raio de 24px o ponto (5, 5)
    cai fora do retangulo arredondado, entao o alvo real seria o `ic-edit-stage` de
    tras e o Playwright recusaria. A primeira versao falhou por isso — o canto do
    frame nao e parte do frame.
  */
  const frame = page.locator('.ic-canvas-frame');
  await frame.click();
  await page.waitForTimeout(300);

  // O inspetor saiu de "Canvas" e passou a mostrar uma camada — o clique atravessou a
  // mascara. Nao afirmo **qual** camada: o centro do frame tem a camada de texto por
  // cima, entao quem recebe o clique depende da pilha de camadas. O que este teste
  // precisa provar e que *alguma* camada foi selecionada, e nao que foi uma especifica.
  await expect(page.getByRole('heading', { name: 'Layer Properties' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Canvas' })).toHaveCount(0);
});

/**
 * A máscara é **anunciada**, não é só desenhada.
 *
 * Um SVG inline sem nome é uma imagem muda para um leitor de tela: a pessoa que não
 * enxerga a linha tracejada fica sem nenhuma pista de onde a arte vai entrar. O `title`
 * diz quanto do canvas a arte ocupará.
 */
test('import margin: a guia tem nome acessivel com a porcentagem', async ({ page }) => {
  await page.goto('/icon-core/app/?theme=dark');

  const welcome = page.getByRole('dialog');
  if (await welcome.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /^Create$/i }).first().click();
    await page.waitForTimeout(600);
  }
  await page.getByRole('button', { name: 'Add text layer' }).click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  const slider = page.getByRole('slider', { name: 'Margin' });
  for (let i = 0; i < 10; i++) await slider.press('ArrowRight');
  await page.waitForTimeout(300);

  const guide = page.getByRole('img', { name: /Import margin/ });
  await expect(guide).toBeVisible();

  // 10% de margem => 90% de area. O texto tem de dizer o numero, nao so "guia".
  const name = await guide.getAttribute('aria-label');
  expect(name).toContain('90%');
});