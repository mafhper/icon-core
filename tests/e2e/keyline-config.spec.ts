import { expect, test } from '@playwright/test';

/**
 * A configuração da keyline: partes ligáveis e tipo de plataforma.
 *
 * O teste conta os **elementos desenhados** dentro do `<svg>`, e não verifica se os
 * switches existem. É a diferença entre "o painel tem cinco botões" e "cinco guias
 * podem ser ligadas independentemente" — e só a segunda é o que o dono pediu.
 */
const contarGuias = async (page: import('@playwright/test').Page): Promise<number> =>
  page.locator('.ic-keyline-overlay').locator('rect, circle, line').count();

test('keyline: partes ligaveis, uma a uma', async ({ page }) => {
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

  // Desligada por padrao — o padrao antigo era `false` e segue assim.
  await expect(page.locator('.ic-keyline-overlay')).toHaveCount(0);

  // Liga pela barra de acao. O dono pediu que o atalho **continue** la.
  await page.getByRole('button', { name: 'Toggle keyline grid' }).click();
  await page.waitForTimeout(300);

  const overlay = page.locator('.ic-keyline-overlay');
  await expect(overlay).toBeVisible();

  const inicial = await contarGuias(page);

  // Desliga a "Center and thirds" — saem 5 linhas (2 eixos + 3 terços/quartos).
  await page.getByRole('switch', { name: 'Center and thirds' }).click();
  await page.waitForTimeout(300);

  const semGrid = await contarGuias(page);
  expect(semGrid).toBeLessThan(inicial);

  // Desliga **cada parte ligada** até não restar nenhuma. Um `<svg>` vazio é lixo
  // no DOM e não informa nada.
  //
  // Clicar em todas seria errado: clicar em uma parte já desligada **liga**, e
  // `Inscribed circle` (desligado logo acima) voltaria. A versão anterior fazia isso
  // e o overlay nunca esvaziava — o teste falhava por um motivo que não era o que ele
  // tentava provar.
  const partes = [
    'Outer frame',
    'Center and thirds',
    'Inscribed circle',
    'Platform safe zone',
    'Safe area'
  ];
  for (const nome of partes) {
    const sw = page.getByRole('switch', { name: nome });
    if ((await sw.count()) === 0) continue;
    if (await sw.isChecked()) await sw.click();
  }
  await page.waitForTimeout(300);
  await expect(overlay).toHaveCount(0);
});

test('keyline: iOS e Android **nao** desenham as mesmas guias', async ({ page }) => {
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

  await page.getByRole('button', { name: 'Toggle keyline grid' }).click();
  await page.waitForTimeout(300);

  /**
   * Android: a zona de 66/108 e o inscrito ligado.
   *
   * O Android e o unico deste conjunto com zona segura medida — o circulo de 66/108 do
   * adaptive icon, o mesmo numero do preset `android`. Por isso ele tem o switch da zona,
   * e por isso a zona **e** o inscrito: sao o mesmo numero visto de duas formas.
   */
  await page.getByRole('combobox', { name: 'Platform' }).selectOption('android');
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: /Use Android guides/ }).click();
  await page.waitForTimeout(350);

  const zona = page.getByRole('switch', { name: 'Platform safe zone' });
  await expect(zona).toBeVisible();
  await expect(zona).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Inscribed circle' })).toBeChecked();
  const android = await contarGuias(page);
  expect(android).toBeGreaterThan(0);

  /**
   * iOS: **sem** o switch da zona, porque o iOS nao define uma.
   *
   * O que o iOS define e a **mascara** — a superellipse de 22,37% — e o frame ja a desenha
   * com esse raio. A versao anterior desenhava aqui uma caixa de 2/3, que nao e numero de
   * ninguem, e era por isso que os presets pareciam iguais.
   *
   * `toBeChecked()`, e nao atributo: o `Switch` do kit e um `<input type="checkbox"
   * role="switch">` **nativo** — nao ha `data-state` nem `aria-checked`; o estado vive
   * na propriedade `checked`.
   */
  await page.getByRole('combobox', { name: 'Platform' }).selectOption('ios');
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: /Use iOS guides/ }).click();
  await page.waitForTimeout(350);

  // O switch da zona **nao existe** no iOS: um switch que liga uma guia sem dado e um
  // switch que mente.
  await expect(page.getByRole('switch', { name: 'Platform safe zone' })).toHaveCount(0);

  // E o que o iOS **liga**: o frame (que ja e a superellipse) e a safe area
  // tracejada, que mostra onde o sistema vai cortar.
  //
  // O inscrito NAO e desligado aqui, e nao deveria: trocar de plataforma liga as
  // recomendadas mas nao desliga as outras, porque desligar algo que a pessoa ligou sem
  // querer seria mais-surpresa do que deixar a grade a mais. O que o iOS faz e nao
  // **recomendar** o inscrito — ver o teste do Android num projeto novo.
  await expect(page.getByRole('switch', { name: 'Outer frame' })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Safe area' })).toBeChecked();

  const ios = await contarGuias(page);
  expect(ios).not.toBe(android);
});

test('keyline: a zona desenhada carrega o numero da plataforma', async ({ page }) => {
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

  await page.getByRole('button', { name: 'Toggle keyline grid' }).click();
  await page.waitForTimeout(300);

  /**
   * O overlay e um SVG com `viewBox="0 0 512 512"`, entao um recuo de 99,56px na tela vale
   * 99,56 unidades no viewBox. Ler `x` e comparar com o numero da plataforma prova que a
   * guia desenha **o** numero — e nao uma caixa inventada.
   *
   * O alvo e `[data-part="zone"]`, e nao um `rect` por posicao: a ordem dos blocos no
   * JSX e um detalhe, e a primeira versao deste teste mediu a safe area do documento
   * (8%) em vez da zona (21/108) — falhou medindo a coisa errada, que e o pior jeito de
   * falhar.
   */
  await page.getByRole('combobox', { name: 'Platform' }).selectOption('android');
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: /Use Android guides/ }).click();
  await page.waitForTimeout(350);

  const esperadoAndroid = 512 * (21 / 108);
  const zona = page.locator('.ic-keyline-overlay [data-part="zone"]');
  await expect(zona).toHaveCount(1);
  expect(Number(await zona.getAttribute('x'))).toBeCloseTo(esperadoAndroid, 1);

  // O inscrito do Android e **o mesmo** numero, visto de outra forma: a zona tem
  // diametro `512 - 2×inset`, e o raio e metade disso — 256 - 99,56 = 156,44.
  //
  // Antes este teste comparava o raio com o diametro (412,44) e falhava por uma conta,
  // nao pelo codigo. Raio e diametro sendo numeros parecidos, a confusao nao appeareda
  // no diff — ela aparece em `expect`, que aceita `412.44` e `156.44` como "muito
  // proximo" e deixa passar.
  const inscrito = page.locator('.ic-keyline-overlay [data-part="circle"]');
  const r = Number(await inscrito.getAttribute('r'));
  expect(r).toBeCloseTo(256 - esperadoAndroid, 1);
  // E o diametro do inscrito e o diametro da zona: as duas guias sao o mesmo 66/108.
  expect(2 * r).toBeCloseTo(Number(await zona.getAttribute('width')), 1);

  // E a safe area do documento continua sendo outra coisa: 8% de inset, nao 21/108.
  const safeArea = page.locator('.ic-keyline-overlay [data-part="safe-area"]');
  expect(Number(await safeArea.getAttribute('x'))).toBeCloseTo(512 * 0.08, 1);

  /**
   * iOS: o switch da zona **nao existe**, e e por isso que a guia nao pode ser ligada.
   *
   * Trocar de plataforma liga as recomendadas e nao desliga as outras, entao a zona que o
   * passo anterior deixou ligada continua ligada no `state` — e por isso o overlay ainda
   * a drawa. Isso esta correto: o conjunto de partes e preferencia da pessoa.
   *
   * O que prova que o iOS nao tem zona e o switch **ausente**, verificado no outro teste.
   * Aqui o que se prova e o outro lado da moeda: **sem** o switch, e **sem** a parte
   * ligada, nao ha `[data-part="zone"]` — e o iOS mantem frame + safe area.
   */
  await page.getByRole('combobox', { name: 'Platform' }).selectOption('ios');
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: /Use iOS guides/ }).click();
  await page.waitForTimeout(350);

  // Desliga a zona que sobrou do passo do Android, pelo caminho que a pessoa teria.
  const switchZona = page.getByRole('switch', { name: 'Platform safe zone' });
  if ((await switchZona.count()) > 0 && (await switchZona.isChecked())) {
    await switchZona.click();
    await page.waitForTimeout(300);
  }

  await expect(page.locator('.ic-keyline-overlay [data-part="zone"]')).toHaveCount(0);
  await expect(page.locator('.ic-keyline-overlay [data-part="frame"]')).toHaveCount(1);
  await expect(page.locator('.ic-keyline-overlay [data-part="safe-area"]')).toHaveCount(1);
});

/**
 * O toggle da barra **não** esvazia as partes.
 *
 * Regressão de estado que o reducer documenta: se `Ctrl/Ctrl+K` limpasse o conjunto,
 * duas vezes deixaria o painel com tudo desligado e a pessoa teria de religar parte por
 * parte. O conjunto é preferência; o toggle é exibição.
 */
test('keyline: o atalho liga e desliga sem perder as partes', async ({ page }) => {
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

  const toggle = page.getByRole('button', { name: 'Toggle keyline grid' });
  const overlay = page.locator('.ic-keyline-overlay');

  await toggle.click();
  await page.waitForTimeout(200);
  const antes = await contarGuias(page);
  expect(antes).toBeGreaterThan(0);

  await toggle.click();
  await page.waitForTimeout(200);
  await expect(overlay).toHaveCount(0);

  await toggle.click();
  await page.waitForTimeout(200);
  // As mesmas guias de antes, nao um overlay vazio.
  expect(await contarGuias(page)).toBe(antes);
});
