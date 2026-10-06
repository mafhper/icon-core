import { expect, test, type Page } from '@playwright/test';

/**
 * O **arrastar** de camada, medido no navegador.
 *
 * ## O que este arquivo existe para impedir
 *
 * O bug do `REORDER_LAYER` — o arrasto nao mudava a ordem — sobreviveu a 937 testes, 85 e2e,
 * lint e typecheck. Nenhum deles arrastava uma camada: os 4 e2e de `layer-reorder` usavam
 * todos o **menu de contexto**, que e outra acao (`MOVE_LAYER`) e estava funcionando.
 *
 * Entao "os tres caminhos de reordenacao existem" era uma frase escrita sem exercitar um deles.
 * Este arquivo exercita o arrasto com o **mouse de verdade**, passo a passo, porque e assim
 * que a pessoa faz — e porque `dragTo` do Playwright e uma abstacao que pode passar por um
 * caminho que o arrasto real nao percorre.
 *
 * ## A geometria e o argumento
 *
 * O arrasto depende de dois rectangulos: a linha de origem e a linha de destino. Um teste
 * que arrasta "para algum lugar" passa mesmo quando o alvo errado e escolhido. Aqui o
 * destino e **por nome de camada**, e a posicao e o indice da linha — entao o teste diz
 * exatamente qual camada foi para onde.
 */

/** Abre o app com um projeto novo, e diz se o modal de boas-vindas apareceu. */
const abrir = async (page: Page) => {
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

  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /^Create$/i }).first().click();
    await page.waitForTimeout(700);
  }
};

/** Cria `n` camadas de texto com nomes distintos e fecha os popovers. */
const criarCamadas = async (page: Page, n: number) => {
  for (let i = 0; i < n; i++) {
    await page.getByRole('button', { name: 'Add text layer' }).click();
    await page.waitForTimeout(220);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
};

/** Os nomes das linhas, de cima para baixo — a ordem como a lista mostra. */
const ordem = async (page: Page): Promise<string[]> => {
  const linhas = page.locator('.ic-layer-row');
  const n = await linhas.count();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push((await linhas.nth(i).innerText()).replace(/\s+/g, ' ').trim());
  }
  return out;
};

/** Arrasta a linha `de` para cima da linha `para`, com o mouse passo a passo. */
const arrastar = async (page: Page, de: number, para: number) => {
  const linhas = page.locator('.ic-layer-row');
  const origem = await linhas.nth(de).boundingBox();
  const destino = await linhas.nth(para).boundingBox();
  expect(origem, `a linha ${de} nao tem caixa`).not.toBeNull();
  expect(destino, `a linha ${para} nao tem caixa`).not.toBeNull();

  await page.mouse.move(origem!.x + origem!.width / 2, origem!.y + origem!.height / 2);
  await page.mouse.down();
  // O primeiro movimento tem que passar do limiar de arraste do Chromium; sem ele a sessao
  // de arrasto nem comeca, e o `onDrop` nunca e chamado.
  await page.mouse.move(origem!.x + origem!.width / 2, origem!.y + origem!.height / 2 - 24, {
    steps: 8
  });
  await page.waitForTimeout(180);
  await page.mouse.move(destino!.x + destino!.width / 2, destino!.y + destino!.height / 2, {
    steps: 12
  });
  await page.waitForTimeout(220);
  await page.mouse.up();
  await page.waitForTimeout(600);
};

test('arrastar a camada de baixo para o topo muda a ordem na lista', async ({ page }) => {
  await abrir(page);
  await criarCamadas(page, 3);

  const antes = await ordem(page);
  expect(antes, 'a lista nao tem as tres camadas').toHaveLength(3);

  await arrastar(page, 2, 0);

  const depois = await ordem(page);

  /**
   * A camada que estava em ultimo sobe. E o caminho que o dono reportou como quebrado:
   * *"não dá certo se eu clicar e arrastar na camada"*.
   *
   * Antes da correcao esta lista voltava **igual** — `REORDER_LAYER` era um no-op, porque
   * `reorderLayers` ordenava de novo pelo `zIndex` antigo e descartava o splice.
   */
  expect(antes[2], 'a camada arrastada nao era a ultima').not.toBe(antes[0]);
  expect(depois[0], 'arrastar para o topo nao pôs a camada no topo').toBe(antes[2]);
  expect(depois, 'a lista nao mudou').not.toEqual(antes);
});

test('arrastar para baixo tambem muda a ordem, e nao volta ao comeco', async ({ page }) => {
  await abrir(page);
  await criarCamadas(page, 3);

  const antes = await ordem(page);

  await arrastar(page, 0, 2);

  const depois = await ordem(page);
  expect(depois, 'arrastar para baixo nao mudou a lista').not.toEqual(antes);

  /**
   * A camada que estava no topo desce ate o fim — e **nao** ate o lugar de onde veio.
   *
   * Este e o off-by-one que so aparecia com o handle de Background: a conta era feita na
   * lista (descendente) e refletida no fim, e os dois frames tem espacos de indices
   * diferentes quando existe a vaga 0 do Background. O sintoma e uma camada que desce dois
   * degraus em vez de um.
   */
  expect(depois.at(-1), 'a camada do topo nao desceu ate o fim').toBe(antes[0]);
});

test('arrastar uma camada vizinha troca as duas de posicao', async ({ page }) => {
  await abrir(page);
  await criarCamadas(page, 3);

  const antes = await ordem(page);

  // Linhas 1 e 2 sao vizinhas: o caso mais simples, e o que mais evidencia um degrau errado.
  await arrastar(page, 1, 2);

  const depois = await ordem(page);
  expect(depois).not.toEqual(antes);
  expect(depois, 'as duas vizinhas nao trocaram de lugar').toEqual([antes[0], antes[2], antes[1]]);
});

test('arrastar com o handle de Background presente nao o traz para cima', async ({ page }) => {
  await abrir(page);
  await criarCamadas(page, 3);

  /**
   * O handle e criado pelo botao "Add background fill layer", e um projeto novo **nao** tem
   * um. Um teste com `test.skip` aqui mediria nada; entao o handle e criado pela mesma
   * acao que a pessoa usaria.
   */
  await page.getByRole('button', { name: 'Add background fill layer' }).click();
  await page.waitForTimeout(450);

  const antes = await ordem(page);
  expect(
    antes.some((n) => /background/i.test(n)),
    `o handle de Background nao apareceu na lista: ${JSON.stringify(antes)}`
  ).toBe(true);

  // Arrasta a camada do topo para a ultima posicao, atravessando o handle.
  await arrastar(page, 0, antes.length - 1);

  const depois = await ordem(page);

  /**
   * O Background e um handle de UI: ele nunca pinta e fica em `zIndex -1`, abaixo de tudo.
   * Nenhum arrasto pode trazê-lo para a frente da composicao — e e exatamente o que acontece
   * quando o `newIndex` atravessa a vaga 0 do Background.
   */
  expect(depois.at(-1), `o Background subiu depois do arrasto: ${JSON.stringify(depois)}`).toMatch(
    /background/i
  );
  expect(depois, 'o arrasto nao mudou nada').not.toEqual(antes);
});

test('arrastar nao deixa a camada presa: um segundo arrasto funciona', async ({ page }) => {
  await abrir(page);
  await criarCamadas(page, 3);

  await arrastar(page, 2, 0);
  const depoisDoPrimeiro = await ordem(page);

  // Um bug de arraste normalmente se manifesta como "o primeiro funciona, o segundo nao":
  // o estado de `draggingId` fica sujo e o `onDrop` seguinte sai pela linha de guarda.
  await arrastar(page, 2, 0);
  const depoisDoSegundo = await ordem(page);

  expect(depoisDoSegundo, 'o segundo arrasto nao mudou nada').not.toEqual(depoisDoPrimeiro);
});
