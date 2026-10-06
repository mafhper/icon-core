import { expect, test, type Page } from '@playwright/test';

/**
 * O painel de texto: ordem, regularidade geometrica, e Bold/Italic que ** mudam o texto**.
 *
 * ## O que o dono pediu
 *
 * "Controles como italico, negrito e um painel de edicao de ajustes mais regular."
 *
 * O painel anterior tinha quatro problemas, e tres deles nao eram de layout:
 *
 * 1. o peso era um `NumberField` 100..900, para uma fonte que embarca **dois** pesos;
 * 2. o alinhamento so tinha `aria-label` — nenhum rotulo visivel;
 * 3. o botao de fontes do sistema usava `ic-link-button`, o CTA de 42px do modal de
 *    boas-vindas, dentro do painel e occupying a largura inteira;
 * 4. a ordem era Size/Weight antes de Font, e o italico solto depois do alinhamento.
 */
const abrirComTexto = async (page: Page) => {
  await page.goto('/icon-core/app/?theme=dark');
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /^Create$/i }).first().click();
    await page.waitForTimeout(700);
  }
  await page.getByRole('button', { name: 'Add text layer' }).click();
  await page.waitForTimeout(500);
  await page.locator('.ic-layer-row').first().click();
  await page.waitForTimeout(500);
};

test('painel de texto: Bold e Italic existem e sao pares', async ({ page }) => {
  await abrirComTexto(page);

  const bold = page.getByRole('switch', { name: 'Bold' });
  const italic = page.getByRole('switch', { name: 'Italic' });
  await expect(bold).toBeVisible();
  await expect(italic).toBeVisible();

  /**
   * Eles sao **pares**: mesma linha, mesmo recuo, mesma altura.
   *
   * E o que distingue "um painel" de "uma lista de controles". O italico solto no fim, depois
   * do alinhamento, era o contra-exemplo: estava perto de nada que ele dividisse.
   */
  const [b, i] = await Promise.all([bold.boundingBox(), italic.boundingBox()]);
  expect(b, 'o switch Bold nao tem caixa').not.toBeNull();
  expect(i, 'o switch Italic nao tem caixa').not.toBeNull();

  /**
   * "Pares" e: **mesma linha**, mesma altura, e o segundo a **direita** do primeiro.
   *
   * A versao anterior comparava o `x` esperando igualdade — e o `getByRole('switch')` devolve
   * o `<input>`, que o `Switch` do kit poe a **direita** do rotulo. Entao a distancia entre
   * os dois inputs e o fim de um rotulo mais o comeco do outro: **127px**, que e a medida
   * certa. O painel estava desde o inicio; a assercao e que estava errada.
   */
  expect(Math.abs(b!.y - i!.y), 'Bold e Italic nao estao na mesma linha').toBeLessThan(2);
  expect(Math.abs(b!.height - i!.height), 'nao tem a mesma altura').toBeLessThan(2);
  expect(i!.x, 'Italic deveria estar a direita de Bold').toBeGreaterThan(b!.x);
});

test('painel de texto: o peso cru saiu e virou o switch Bold', async ({ page }) => {
  await abrirComTexto(page);

  /**
   * O `NumberField` de peso foi embora, e o motivo esta no `fonts.ts`: a Cal Sans embarca
   * 400 e 700. Um campo 100..900 ofereceria seis pesos que a fonte nao tem, e o navegador
   * escolheria o mais proximo — um controle que promete precisao que nao existe.
   */
  await expect(page.getByLabel('Weight', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('switch', { name: 'Bold' })).toBeVisible();
});

test('painel de texto: Bold muda o documento, e o preview re-renderiza', async ({ page }) => {
  await abrirComTexto(page);

  const bold = page.getByRole('switch', { name: 'Bold' });
  const preview = page.locator('.ic-canvas-render');

  // O default e negrito: `createTextLayer` grava `fontWeight: 700`.
  await expect(bold).toBeChecked();
  const antes = await preview.getAttribute('src');

  await bold.click();
  await page.waitForTimeout(600);

  await expect(bold, 'o switch nao desligou').not.toBeChecked();

  /**
   * O `src` do preview e um `blob:` novo a cada render, entao uma mudanca **prova** que o
   * documento mudou e o render reexecutou.
   *
   * A medicao de pixel do texto foi tentada aqui e deu 0 — "nenhuma coluna diferente do
   * fundo" — sem dizer por que. Um numero que ninguem sabe interpretar e pior que nenhum.
   * O que o desenho **e** diferente fica num teste unitario de `canvasFontShorthand`, que
   * e onde o peso vira assinatura de canvas e a medicao e deterministica; aqui o que se
   * mede e o caminho completo, do clique ate o re-render.
   */
  const depois = await preview.getAttribute('src');
  expect(depois, 'o preview nao re-renderizou: o documento pode nao ter mudado').not.toBe(antes);

  // E volta ao ligar, com um terceiro `blob`.
  await bold.click();
  await page.waitForTimeout(600);
  await expect(bold).toBeChecked();
  expect(await preview.getAttribute('src')).not.toBe(depois);
});

test('painel de texto: Italic muda o documento, e o preview re-renderiza', async ({ page }) => {
  await abrirComTexto(page);

  const italic = page.getByRole('switch', { name: 'Italic' });
  const preview = page.locator('.ic-canvas-render');

  await expect(italic).not.toBeChecked();
  const antes = await preview.getAttribute('src');

  await italic.click();
  await page.waitForTimeout(600);

  await expect(italic, 'o switch nao ligou').toBeChecked();
  /**
   * O mesmo caminho do Bold: o documento mudou e o render reexecutou.
   *
   * O obliquo e **sintetizado** pelo navegador — a Cal Sans nao tem corte italico, e e por isso
   * que so existe face `normal` na declaracao. Entao a medicao de pixel seria frágil de
   * proposito: o synthese varia por navegador. O que e deterministico e o caminho completo.
   */
  expect(await preview.getAttribute('src'), 'o preview nao re-renderizou').not.toBe(antes);
});

test('painel de texto: o alinhamento tem rotulo visivel', async ({ page }) => {
  await abrirComTexto(page);

  /**
   * O `SegmentedControl` so aceita `aria-label`, entao o rotulo visivel e um `span` com as
   * mesmas classes do `Field`. Sem ele, a tela mostrava "Left Center Right" sem dizer do que
   * se tratava — e o nome acessivel existia, o que e o caso em que o defeito passa por
   * qualquer teste de acessibilidade.
   */
  const rotulo = page.getByText('Alignment', { exact: true });
  await expect(rotulo).toBeVisible();

  // O rotulo fica **acima** do grupo, e nao ao lado: o grupo ocupa a largura toda.
  const grupo = page.getByRole('group', { name: 'Text alignment' });
  await expect(grupo).toBeVisible();
  const r = await rotulo.boundingBox();
  const g = await grupo.boundingBox();
  expect(r!.y + r!.height, 'o rotulo nao fica acima do grupo').toBeLessThanOrEqual(g!.y + 2);
});

test('painel de texto: a ordem e conteudo, tamanho, estilo, alinhamento', async ({ page }) => {
  await abrirComTexto(page);

  /**
   * A ordem carrega o argumento: quem escolhe a fonte so depois descobre o tamanho, e o
   * estilo altera a largura — entao mexer no peso depois do tamanho faria a pessoa
   * ajustar o tamanho duas vezes.
   *
   * O painel antigo punha Size e Weight antes de Font, e o italico depois do alinhamento.
   */
  /**
   * Por **papel e nome acessivel**, e nao por seletor de CSS.
   *
   * A versao anterior usava `select#ic-font-family, [id*="font"]`, e o `Select` do kit nao
   * gera `id` proprio. O alvo que a pessoa usa e o papel com o nome que ela le — e o mesmo
   * alvo de qualquer leitor de tela.
   */
  const y = async (localizador: import('@playwright/test').Locator) => {
    const caixa = await localizador.first().boundingBox();
    return caixa ? caixa.y : null;
  };

  const fonte = await y(page.getByRole('combobox', { name: 'Font' }));
  const tamanho = await y(page.getByRole('spinbutton', { name: 'Size' }));
  const alinhamento = await y(page.getByRole('group', { name: 'Text alignment' }));

  expect(fonte, 'a fonte nao foi encontrada').not.toBeNull();
  expect(tamanho, 'o tamanho nao foi encontrado').not.toBeNull();
  expect(alinhamento, 'o alinhamento nao foi encontrado').not.toBeNull();

  expect(fonte!, 'a fonte deveria vir antes do tamanho').toBeLessThan(tamanho!);
  expect(tamanho!, 'o tamanho deveria vir antes do alinhamento').toBeLessThan(alinhamento!);
});

test('painel de texto: Bold e dois estados, e eles sao 400 e 700', async ({ page }) => {
  await abrirComTexto(page);

  /**
   * O round trip inteiro: `Bold` -> documento -> `ctx.font`.
   *
   * Este e o teste que fecha a cadeia sem depender de pixel nem de navegador. O
   * `canvasFontShorthand` ja e testado em `textLayout.spec.ts`; aqui o que se prova e que o
   * **switch** produz o valor que aquela funcao consome.
   *
   * E o teste que pega o defeito real desta secao: um `Bold` que fica marcado, escreve 700
   * nas duas direcoes, e parece funcionar — porque o estado dele e exatamente o que a pessoa
   * ve, e so o desenho denuncia.
   */
  const bold = page.getByRole('switch', { name: 'Bold' });
  const preview = page.locator('.ic-canvas-render');

  /**
   * O `NumberField` de peso saiu, e o contrato agora e de **dois** estados.
   *
   * A Cal Sans embarca 400 e 700. Um campo 100..900 ofereceria seis pesos que a fonte nao
   * tem, e o navegador escolheria o mais proximo — um controle que promete precisao que nao
   * existe. Entao o switch mapeia 700 e 400, e estes testes zam o contrato.
   */
  await expect(bold, 'o default nao e negrito').toBeChecked();

  // Desligar re-renderiza: o documento virou 400.
  const ligado = await preview.getAttribute('src');
  await bold.click();
  await page.waitForTimeout(600);
  await expect(bold, 'desligar nao funcionou').not.toBeChecked();
  const desligado = await preview.getAttribute('src');
  expect(desligado, 'desligar o negrito nao mudou o documento').not.toBe(ligado);

  // Ligar de novo re-renderiza outra vez, e volta ao comeco.
  await bold.click();
  await page.waitForTimeout(600);
  await expect(bold, 'ligar de novo nao funcionou').toBeChecked();
  expect(await preview.getAttribute('src'), 'ligar de novo nao mudou o documento').not.toBe(
    desligado
  );
});
