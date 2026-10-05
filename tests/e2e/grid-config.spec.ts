import { expect, test } from '@playwright/test';

/**
 * Os **dois primeiros** valores de `background-size` computado.
 *
 * A regra tem dois gradientes e o browser repete o par para cada um; o que importa
 * e o par, e ele ja rejeita `NaN` — que viria no primeiro valor.
 */
const primeiroPar = async (grade: import('@playwright/test').Locator): Promise<string> =>
  grade.evaluate((el) => {
    // O `getComputedStyle` devolve `"12.5% 12.5%, 12.5% 12.5%"`: dois pares separados
    // por virgula. Cortar por `", "` nao pegava porque o valor ja vem **sem** virgula
    // entre os componentes do par — o separador real divide o par do par.
    const computed = getComputedStyle(el).backgroundSize;
    return computed.split(',')[0].trim();
  });

/**
 * A configuração do grid: divisões por eixo, e o default desligado.
 *
 * Este teste mede o **`background-size` computado**, não a existência do controle. A
 * razão é a mesma do `mask-radius`: um controle que existe e não muda nada passa em
 * qualquer teste de presença.
 */
test('grid: default desligado, e as divisoes mudam o background-size', async ({ page }) => {
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

  const grade = page.locator('.ic-canvas-grid');

  // O dono pediu "por padrao vem desligado".
  await expect(grade).toHaveCount(0);

  // Liga pela barra de acao — o atalho que o dono pediu manter.
  await page.getByRole('button', { name: 'Toggle grid' }).click();
  await page.waitForTimeout(300);
  await expect(grade).toBeVisible();

  // 8 divisoes => 12,5%: o mesmo `background-size` que o CSS fixo fazia.
  // O browser repete o par para **cada** gradiente da regra, entao vem
  // "12.5% 12.5%, 12.5% 12.5%". Comparar os dois primeiros e o que verifica a
  // mudanca — e ainda rejeita NaN, que apareceria no primeiro par.
  const inicial = await primeiroPar(grade);
  expect(inicial).toBe('12.5% 12.5%');

  // Agora ajusta as colunas pelo Edit Space. 2 colunas => 50%.
  const colunas = page.getByRole('spinbutton', { name: 'Columns' });
  await colunas.fill('2');
  await colunas.press('Enter');
  await page.waitForTimeout(300);

  expect(await primeiroPar(grade)).toBe('50% 12.5%');

  // E as linhas, separadamente — o eixo que o dono mencionou ("horizontais e verticais").
  const linhas = page.getByRole('spinbutton', { name: 'Rows' });
  await linhas.fill('4');
  await linhas.press('Enter');
  await page.waitForTimeout(300);

  expect(await primeiroPar(grade)).toBe('50% 25%');
});

/**
 * Valor fora da faixa não chega ao CSS.
 *
 * O `NumberField` tem `min`/`max`, mas isso é *dica* para o browser, não garantia: digitar
 * `0` e apertar Enter passa. Um `NaN` ou um `0%` no `background-size` faz o browser
 * **ignorar a declaração** — e o grid desaparece sem erro, sem aviso, sem nada no console.
 */
test('grid: divisao fora da faixa e limitada, e o grid continua visivel', async ({ page }) => {
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

  await page.getByRole('button', { name: 'Toggle grid' }).click();
  await page.waitForTimeout(300);

  const colunas = page.getByRole('spinbutton', { name: 'Columns' });
  await colunas.fill('0');
  await colunas.press('Enter');
  await page.waitForTimeout(300);

  const grade = page.locator('.ic-canvas-grid');
  await expect(grade).toBeVisible();

  // 0 vira o piso (2 divisoes => 50%), e nao `0%` nem `NaN`.
  const size = await primeiroPar(grade);
  expect(size).not.toContain('NaN');
  expect(size).toBe('50% 12.5%');
});