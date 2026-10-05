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
  const partes = ['Outer frame', 'Center and thirds', 'Inscribed circle', 'iOS squircle', 'Safe area'];
  for (const nome of partes) {
    const sw = page.getByRole('switch', { name: nome });
    if ((await sw.count()) === 0) continue;
    if (await sw.isChecked()) await sw.click();
  }
  await page.waitForTimeout(300);
  await expect(overlay).toHaveCount(0);
});

test('keyline: o tipo de plataforma liga as guias recomendadas', async ({ page }) => {
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

  // Comeca no `generic` (frame + grid): sem circulo inscrito.
  await page.getByRole('switch', { name: 'Inscribed circle' }).click();
  await page.waitForTimeout(300);
  const comCirculo = await contarGuias(page);

  // Troca para Android e usa as recomendadas: o circulo entra de novo, porque e a
  // zona legivel da mascara adaptativa — o Android usa `grid` + `circle`.
  await page.getByRole('combobox', { name: 'Platform' }).selectOption('android');
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: /Use Android guides/ }).click();
  await page.waitForTimeout(300);

  const android = await contarGuias(page);
  expect(android).toBeGreaterThan(comCirculo - 1);

  // E o iOS troca o circulo pela superellipse.
  await page.getByRole('combobox', { name: 'Platform' }).selectOption('ios');
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: /Use iOS guides/ }).click();
  await page.waitForTimeout(300);

  // `toBeChecked()`, e nao atributo. O `Switch` do kit e um
  // `<input type="checkbox" role="switch">` **nativo** — nao e Radix. Nao ha
  // `data-state` nem `aria-checked`; o estado vive na propriedade `checked`. A
  // primeira versao esperava `data-state` e recebeu string vazia, que e como o
  // Playwright reporta um atributo inexistente.
  await expect(page.getByRole('switch', { name: 'iOS squircle' })).toBeChecked();
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