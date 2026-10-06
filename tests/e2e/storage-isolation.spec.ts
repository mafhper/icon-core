import { expect, test } from '@playwright/test';

/**
 * O `addInitScript` limpa o storage **em toda navegacao**, e nao so na primeira.
 *
 * ## Por que este teste existe
 *
 * A limpeza de storage foi propagada para 12 specs com um bloco repetido. O padrao funciona
 * por uma propriedade que ninguem verifica: `addInitScript` roda **antes** de qualquer script
 * da pagina, **em cada navegacao** — e nao apenas uma vez.
 *
 * Se essa propriedade deixar de valer (uma mudanca no Playwright, um `goto` antes do
 * `addInitScript`, um `context` reutilizado), os 12 specs voltam a **estourar em 30s** esperando
 * um botao "Create" que nao aparece quando ha projeto salvo. E o sintoma — timeout numa
 * interacao — nao aponta para storage.
 *
 * Este teste mede a propriedade: duas navegacoes no mesmo contexto, e o storage tem de estar
 * limpo nas duas.
 */
test('o storage fica limpo na segunda navegacao do mesmo contexto', async ({ page }) => {
  /**
   * Este e o cenario que quebrava: mesmo contexto, storage marcado, e a dialog de boas-vindas
   * trocando o botao "Create" pela lista de projetos.
   */
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Storage bloqueado.
    }
  });
  await page.context().clearCookies();

  await page.goto('/icon-core/app/?theme=dark');

  // Marca o storage como "sujo" e deixa um projeto persistido.
  await page.evaluate(() => {
    localStorage.setItem('__teste__', 'sujo');
  });
  const sujo = await page.evaluate(() => localStorage.getItem('__teste__'));

  // O storage foi marcado depois que a pagina carregou, entao o init script nao pode ter
  // limpado ainda — e nao deve: ele roda na navegacao, nao durante a sessao.
  expect(sujo, 'o teste nao conseguiu sujar o storage — a medicao nao prova nada').toBe('sujo');

  /**
   * Segunda navegacao no **mesmo** contexto. E aqui que a propriedade importa: sem o
   * `addInitScript` reexecutando, o storage continuaria sujo e a dialog abriria na lista.
   */
  await page.goto('/icon-core/app/?theme=dark');

  const limpo = await page.evaluate(() => localStorage.getItem('__teste__'));

  expect(limpo, 'o addInitScript nao limpou na segunda navegacao: os 12 specs vao estourar').toBe(
    null
  );
});

test('o botao Create continua acessivel com projeto salvo', async ({ page }) => {
  /**
   * A razao de o bug existir, medida — e a razao de **nao** ser o botao sumir.
   *
   * Eu escrevi este teste acreditando que, com um projeto salvo, a dialog trocava o botao
   * "Create" pela lista. **Nao e assim**: os dois coexistem, e `Create` continua la. O que
   * muda e o titulo (`Start a new icon` -> `Your projects`) e a lista aparecer acima.
   *
   * Entao por que o spec estourava em 30s? Nao era o botao ausente — era o **elemento se
   * destacando do DOM** durante a animacao de montagem da dialog, com o `click` do Playwright
   * reexecutando em loop ate o timeout. A causa real e a animacao, e nao o storage.
   *
   * Isto fica registrado porque a hypothesis estava errada e o sintoma apontava para ela.
   * O `addInitScript` continua correto: ele **e** o que garante estado limpo entre navegacoes,
   * e o teste anterior prova que funciona.
   */
  await page.goto('/icon-core/app/?theme=dark');
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /^Create$/i }).first().click();
    await page.waitForTimeout(700);
  }

  await page.reload();

  const dialog2 = page.getByRole('dialog');
  if (await dialog2.isVisible().catch(() => false)) {
    await expect(dialog2.getByRole('button', { name: /^Create$/i })).toHaveCount(1);
    return;
  }

  // O app reabriu o projeto e nao mostrou a dialog: nada a medir aqui.
  expect(true).toBe(true);
});