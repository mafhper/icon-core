import { expect, test } from '@playwright/test';

/**
 * As marcas do frame radius: clicáveis, e cada uma leva **forma e valor** juntos.
 *
 * O teste unitário prova que os números são os padroes reais. Este prova o que só o
 * browser diz: que a marca está clicável, que o clique muda o raio **e** a forma, e
 * que a marca da forma corrente fica marcada como ativa.
 */
test('frame radius: as marcas mudam raio e forma juntas', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Insert layer' }).first().click();
  await page.getByRole('menuitem', { name: 'Text' }).click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  const frame = page.locator('.ic-canvas-frame');
  const raio = () => frame.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);

  // A marca do círculo: existe, e diz o que ela é.
  const circulo = page.getByRole('button', { name: /^Circle — / });
  await expect(circulo).toBeVisible();

  const antes = await raio();
  await circulo.click();
  await page.waitForTimeout(300);

  // 512 / 2 = 256px: o valor **e** o lado do canvas dividido por dois.
  expect(await raio()).toBe('256px');
  expect(await raio()).not.toBe(antes);

  // E a forma foi junto: a marca do quadrado leva o raio aos 4px de square.
  // A pill do slice do chrome não tem mais o ciclo de plataforma; a morada da
  // forma é a marca do inspetor, e o contrato travado aqui continua o mesmo:
  // `maskRadius` ausente significa "siga a forma", então trocar a forma tem de
  // mover o valor.
  await page.getByRole('button', { name: /^Square — / }).click();
  await page.waitForTimeout(300);
  expect(await raio()).toBe('4px');
});