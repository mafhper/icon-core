import { expect, test, type Page } from '@playwright/test';

/**
 * O preview ao vivo tem que ser **pixel-idêntico** ao export.
 *
 * ## O que aconteceu
 *
 * Um "merge sem perda" de CSS — para caber no ratchet de linhas do `index.css` — colou duas
 * regras num seletor agrupado. O agrupado era `.ic-canvas-render,` seguido de
 * `.ic-canvas-ghost { position: absolute; … }`, sem opacidade; e o ghost tinha uma regra
 * própria, logo abaixo, com `opacity: 0.42`. O merge levou o `opacity` para dentro do grupo,
 * e o **preview ao vivo** ficou a 42%.
 *
 * O sintoma que o dono viu: um fill `#FFFFFF` aparecendo **cinza-azulado** — 42% de branco
 * sobre o palco escuro (`#0b0c0e`), que é exatamente aquela cor.
 *
 * E o sintoma mais enganoso, porque se disfarça de outra coisa: a 42% de opacidade, o que se
 * vê depende **do que há atrás de cada camada**. Então bring-to-front mudava a aparência do
 * ícone sem nada ter mudado na composição — e "reordenar reposiciona as layers" parece um
 * defeito de `MOVE_LAYER`, que estava correto o tempo todo.
 *
 * ## Por que este teste existe
 *
 * O comentário no CSS já prometia "pixel-identical to the exported asset", e a promessa
 * **não era verificada**. Um comentário não quebra quando alguém edita a regra de baixo.
 *
 * A opacidade do preview é o teste mais direto possível dessa promessa: se ela for 1, não há
 * nada entre o arquivo e a tela, e o que você vê é o que será exportado. Uma medição de cor
 * seria mais completa e mais frágil — um escudo branco sobre um palco escuro mede bem, e um
 * fill saturado não. A opacidade não tem essa dependência.
 *
 * Por que o merge passou pela guarda: o seletor agrupado tem uma **linha em branco** entre
 * as duas partes, e a guarda que procurava uma vírgula olhava **uma** linha atrás. Este
 * arquivo é a redundância que pega isso.
 */

const criarComForma = async (page: Page) => {
  await page.goto('/icon-core/app/?theme=dark');
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /^Create$/i }).first().click();
    await page.waitForTimeout(900);
  }
  await page.getByRole('button', { name: 'Add shape' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('menuitem', { name: /^Rectangle$/ }).first().click();
  await page.waitForTimeout(900);
};

test('preview: o icone ao vivo nao esta escurecido', async ({ page }) => {
  await criarComForma(page);

  const img = page.locator('.ic-canvas-render');
  await expect(img, 'o preview ao vivo nao renderizou').toBeVisible();

  const opacidade = await img.evaluate((el) => getComputedStyle(el).opacity);
  const filtro = await img.evaluate((el) => getComputedStyle(el).filter);
  const mixBlend = await img.evaluate((el) => getComputedStyle(el).mixBlendMode);

  // 1 = nada entre o arquivo e a tela. Qualquer coisa abaixo disso e uma camada a mais.
  expect(
    opacidade,
    `o preview esta a ${opacidade} de opacidade: o palco escuro aparece por tras de tudo e o preview deixa de ser o que sera exportado`
  ).toBe('1');

  // Um `filter` ou `mix-blend-mode` faz o mesmo estrago que a opacidade, e num lugar
  // diferente — por isso sao verificados aqui e nao apenas a opacidade.
  expect(filtro, `o preview tem filter: ${filtro}`).toBe('none');
  expect(mixBlend, `o preview tem mix-blend-mode: ${mixBlend}`).toBe('normal');
});

test('preview: o ghost do arraste continua translucido', async ({ page }) => {
  await criarComForma(page);

  // O outro lado do contrato: o ghost **deve** ser 0.42. Sem este teste, "tirar a opacidade
  // do preview" pode ser resolvido apagando a regra inteira — e o ghost do arraste volta a
  // opaco, o que e um defeito diferente e igualmente invisivel.
  const ghost = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'ic-canvas-ghost';
    document.body.appendChild(el);
    const op = getComputedStyle(el).opacity;
    el.remove();
    return op;
  });

  expect(Number(ghost), 'o ghost do arraste perdeu a translucidez').toBeCloseTo(0.42, 2);
});

test('preview: as duas regras sao separadas no CSS servido', async ({ page }) => {
  await criarComForma(page);

  // A forma do CSS e o que quebra: um seletor agrupado reescrito com `opacity` dentro. Ler o
  // `document.styleSheets` diz se a regra agrupada **esta** dimmed, e nao so o que o
  // navegador aplicou — que e o mesmo aqui, mas o teste fica honesto sobre o que mede.
  const agrupadaTemOpacity = await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSStyleRule)) continue;
        const sel = rule.selectorText ?? '';
        if (!sel.includes('.ic-canvas-render')) continue;
        return rule.style.opacity !== '';
      }
    }
    return null;
  });

  expect(
    agrupadaTemOpacity,
    'a regra agrupada de .ic-canvas-render declara opacity — e o que escureceu o preview'
  ).toBe(false);
});
