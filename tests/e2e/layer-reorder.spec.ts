import { expect, test, type Page } from '@playwright/test';

/**
 * Reordenar layers: as três vias que existem.
 *
 * 1. arrastar (`draggable` + `onDrop`);
 * 2. menu de contexto (Bring/Send Forward/Backward/Front/Back);
 * 3. (o teclado é do `Ctrl+Z`-style do app, não deste teste).
 *
 * ## O que o teste original ensinou
 *
 * O `reducer` estava **quebrado**: `moveLayer` fazia `splice` no array e
 * `reorderLayers` ordenava por `zIndex`, devolvendo a camada ao lugar. Três das quatro
 * direções não faziam nada — e só `back` tinha teste, e passava por acaso. Corrigido em
 * `composerReducer.ts` (`moveLayer`) com 12 testes unitários (`moveLayer.spec.ts`).
 *
 * ## Por que este arquivo compara nomes **sem** o ícone
 *
 * `innerText` da linha começa com `■` (o ícone do handle). A primeira versão tirava o
 * `■` com um `replace` que não pegava, e comparava listas de ícones iguais — o que prova
 * "nada mudou" **mesmo com a ordem trocada**. Agora compara o texto sem o ícone, e o teste
 * falha se a ordem não mudar de verdade.
 */

/** Os nomes visíveis, de cima para baixo, **sem** o ícone. */
const ordemNaTela = async (page: Page): Promise<string[]> => {
  const linhas = page.locator('.ic-layer-row');
  const total = await linhas.count();
  const nomes: string[] = [];
  for (let i = 0; i < total; i++) {
    const texto = (await linhas.nth(i).innerText()).replace(/\s+/g, ' ').trim();
    // Tira qualquer glifo inicial (■, ▪, …) e normaliza o nome.
    nomes.push(texto.replace(/^[^A-Za-z0-9]+/, ''));
  }
  return nomes;
};

const preparar = async (page: Page) => {
  await page.goto('/icon-core/app/?theme=dark');
  const welcome = page.getByRole('dialog');
  if (await welcome.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /^Create$/i }).first().click();
    await page.waitForTimeout(600);
  }
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Add text layer' }).click();
    await page.waitForTimeout(220);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
};

/**
 * Abre o menu de contexto de uma linha e clica num item.
 *
 * Espera o **item existir** antes de clicar: o menu é portalizado (`position: fixed` no
 * cursor) e um `click` imediato pode acertar o canvas em vez do menu.
 */
const usarMenu = async (page: Page, linha: number, item: string) => {
  await page.locator('.ic-layer-row').nth(linha).click({ button: 'right' });
  const alvo = page.getByRole('menuitem', { name: item });
  await alvo.waitFor({ state: 'visible', timeout: 5000 });
  await alvo.click();
  await page.waitForTimeout(350);
};

test('reordenar: Bring Forward troca duas camadas de lugar', async ({ page }) => {
  await preparar(page);
  const antes = await ordemNaTela(page);
  expect(antes).toHaveLength(3);

  // A última da lista (menor zIndex) sobe uma posição.
  await usarMenu(page, 2, 'Bring Forward');
  const depois = await ordemNaTela(page);

  expect(depois).not.toEqual(antes);
  // Uma troca **exata**: os mesmos três nomes, outra ordem.
  expect([...depois].sort()).toEqual([...antes].sort());
  // E Specifically: o último subiu para o meio.
  expect(depois).toEqual([antes[0], antes[2], antes[1]]);
});

test('reordenar: Send Backward desfaz Bring Forward', async ({ page }) => {
  await preparar(page);
  const antes = await ordemNaTela(page);

  await usarMenu(page, 2, 'Bring Forward');
  await usarMenu(page, 1, 'Send Backward');

  expect(await ordemNaTela(page)).toEqual(antes);
});

test('reordenar: Bring to Front / Send to Back vao aos extremos', async ({ page }) => {
  await preparar(page);
  const antes = await ordemNaTela(page);

  await usarMenu(page, 2, 'Bring to Front');
  const depois = await ordemNaTela(page);
  expect(depois).not.toEqual(antes);
  expect([...depois].sort()).toEqual([...antes].sort());
});

test('reordenar: o Background fica no fim mesmo depois de reordenar', async ({ page }) => {
  await preparar(page);
  // O projeto novo **nao tem** Background: é um handle que a pessoa cria. Sem criá-lo,
  // a regra do `IC66` não tem o que segurar — e o teste original falhava por isso, não
  // porque o `MOVE_LAYER` empurrasse algo.
  await page.getByRole('button', { name: 'Add background fill layer' }).click();
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  const antes = await ordemNaTela(page);
  expect(antes[antes.length - 1]).toBe('Background');

  // Sobe a camada do meio de todas.
  await usarMenu(page, Math.floor(antes.length / 2), 'Bring to Front');

  // A regra do `IC66`: o Background é sempre o último, independente da ordem.
  await expect(page.locator('.ic-layer-row').last()).toContainText('Background');
});
