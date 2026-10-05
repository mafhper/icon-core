import { expect, test } from '@playwright/test';

/**
 * Por que "Frame radius" nao parece funcionar.
 *
 * O reducer grava certo (6 testes unitarios provam: grava, reseta, clamp, historico).
 * O `PreviewCanvas` aplica `borderRadius` no frame e o CSS tem `overflow: hidden`. Entao
 * o que resta e: **o valor default ja e tao grande que mexer pouco nao muda nada** — ou o
 * slider esta no lugar errado da tela.
 *
 * Este teste **mede** o raio computado no browser real, em vez de afirmar que o botao
 * existe. A diferenca entre "o reducer grava" e "a pessoa ve mudanca" e exatamente o
 * que os testes unitarios nao alcançam.
 */
test('frame radius: o raio computado muda quando o slider muda', async ({ page }) => {
  await page.goto('/icon-core/app/?theme=dark');

  // Um projeto **com uma camada**: um projeto novo mostra o `DropZone`, que nao tem
  // `.ic-canvas-frame` — o frame so existe quando ha algo para compor. A primeira versao
  // deste teste parou aqui e o dono nunca veria o slider do mesmo jeito.
  const welcome = page.getByRole('dialog');
  if (await welcome.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /^Create$/i }).first().click();
    await page.waitForTimeout(600);
  }
  await page.getByRole('button', { name: 'Add text layer' }).click();
  await page.waitForTimeout(400);

  // Desseleciona a camada: com uma layer ativa o inspetor mostra **a camada**, e as
  // secoes de work area ("Frame radius", "Import margin") somem do painel. Sem este
  // passo o locator procurava uma section que existia em outro estado da tela.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  const frame = page.locator('.ic-canvas-frame');
  await expect(frame).toBeVisible();

  const raio = () =>
    frame.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);

  const antes = await raio();

  /**
 * O slider pelo **section**, nao por indice e nem por `getByLabel`.
 *
 * Duas medidas que custaram uma volta:
 *
 * 1. `nth(2)` dependia da ordem do inspetor. Um campo novo antes do raio faz o teste
 *    mexer no slider errado e dizer "o raio nao muda".
 * 2. `getByLabel('Radius')` nao encontra, porque "Frame radius" e "Radius" sao secoes
 *    distintas do inspetor e o slider nao estava exposto por nome acessivel. O
 *    `aria-label` no `Slider` (novo) resolve o nome, mas nao a **duplicidade** — o
 *    "Radius" da section "Frame radius" convive com outros pares slider/rótulo.
 *
 * Ancorar pela section e o alvo estavel: o dono nomeou a section, e ela so muda se o
 * dono renomear.
 */
  /**
 * O slider pelo **nome acessivel**, que agora existe.
 *
 * Isto passou por tres alvos errados antes de acertar, e cada um ensinou algo:
 *
 * 1. `nth(2)` — depende da ordem do inspetor; um campo novo antes do raio faz o teste
 *    mexer no slider errado e dizer "o raio nao muda".
 * 2. `section.filter({ has: heading })` — `has:` e **descendente**, nao filho. A
 *    section que casou foi a que *contem* as duas, e o slider escolhido foi o da
 *    "Margin". Um locator que parece preciso e aponta para o vizinho.
 * 3. `section.filter({ hasText })` — idem, pelo mesmo motivo.
 *
 * O que resolve: o `aria-label` do `Slider` dá nome **próprio** ao range, e o par
 * slider/number-field é distinguível por `type`. `Radius` só existe uma vez como
 * slider — o `NumberField` ao lado é `textbox`, não `slider`.
 */
  const slider = page.getByRole('slider', { name: 'Radius' });
  await expect(slider).toBeVisible();
  await expect(slider).toHaveValue('24');

  /**
   * `Home` e nao 40x `ArrowLeft`: `ArrowLeft` num range ja em `min` nao emite `input`
   * (o valor nao muda), e o React nunca recebe o evento — os 40 passos viravam 40
   * teclas sem efeito. `Home` leva ao minimo de uma vez.
   */
  await slider.focus();
  await slider.press('Home');
  for (let i = 0; i < 3; i++) await slider.press('ArrowRight');

  await page.waitForTimeout(300);
  const depois = await raio();

  // O registro e o que interessa: um teste que so verifica "o botao existe" ja passou
  // enquanto o dono via um slider que nao mexia em nada.
  console.log(`raio antes=${antes} depois=${depois}`);
  expect(depois).not.toBe(antes);
});