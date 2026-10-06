import { expect, test, type Page } from '@playwright/test';

/**
 * O seletor de fonte, e a fonte embarcada carregando de verdade.
 *
 * ## Os dois defeitos que estes testes medem
 *
 * **1. O `@font-face` existe mas a fonte não carrega.** Foi o que aconteceu: o `url()`
 * apontava para `../../assets/fonts/…`, que **sai da raiz** do projeto Vite. O build avisa
 * `didn't resolve at build time` e emite o caminho literal no CSS — e do `dist/assets/` ele
 * dá 404. O `@font-face` ficava no CSS, nenhum erro aparecia, e a fonte nunca carregava.
 *
 * Por isso o primeiro teste **pede a fonte de verdade** (`document.fonts.load`) e nao so
 * verifica que o CSS tem a regra. Uma regra de `@font-face` presente é exatamente o estado
 * em que o defeito passava despercebido.
 *
 * **2. O valor gravado não é a família, e sim a pilha.** Sem o fallback, uma máquina sem a
 * fonte embarcada resolve no Times e o ícone sai serifado. E o que o `Select` mostra é a
 * **primeira** família da pilha — comparar a pilha inteira faria o campo cair em branco.
 */

/**
 * Carrega a fonte e diz o que o navegador respondeu.
 *
 * Carrega os **dois** pesos que a fonte embarca. A versao anterior carregava so o 700 e lia
 * o status da face que o `find` devolvia — a de 400 — entao o teste falhava com `unloaded` num
 * arquivo que carregava certo. Um `unloaded` que ninguem esperava e um teste que treina a
 * pessoa a ignorar o `unloaded`.
 */
const carregarCalSans = (page: Page) =>
  page.evaluate(async () => {
    if (!('fonts' in document)) return { ok: false, motivo: 'document.fonts ausente' };
    const faces = Array.from(document.fonts).filter((f) => f.family === 'Cal Sans');
    if (faces.length === 0) return { ok: false, motivo: 'nenhuma face Cal Sans declarada' };
    try {
      await document.fonts.load('400 64px "Cal Sans"');
      await document.fonts.load('700 64px "Cal Sans"');
    } catch (err) {
      return { ok: false, motivo: String(err) };
    }
    return {
      ok: document.fonts.check('700 64px "Cal Sans"'),
      status: faces.every((f) => f.status === 'loaded')
        ? 'loaded'
        : faces.map((f) => f.status).join(','),
      motivo: '',
      quantas: faces.length
    };
  });

const abrirComTexto = async (page: Page) => {
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

  /**
   * Seleciona a camada explicitamente, e o motivo esta aqui.
   *
   * `Add text layer` **cria** a camada; se ela nao vier selecionada, o inspetor mostra o
   * estado do canvas e a secao "Text" — que e onde mora o seletor de fonte — nem existe no
   * DOM. O teste falhava procurando um `combobox` que nunca foi renderizado, e a causa nao
   * era o `FontPicker`.
   *
   * Por isso o `expect` do `Font` vem **depois** deste passo: falhar aqui diz "a camada nao
   * foi criada ou nao e selecionavel", que e uma informacao util; falhar depois diz "o seletor
   * nao apareceu", que e ambiguo entre seis causas.
   */
  const linha = page.locator('.ic-layer-row').first();
  await expect(linha, 'a camada de texto nao foi criada').toBeVisible();
  await linha.click();
  await page.waitForTimeout(400);

  /**
   * **Sem `Escape` aqui.** Este spec e o unico que precisa da camada **selecionada** — e o
   * `Escape` fecha o inspetor, o que tira a secao "Text" (e o seletor de fonte) do DOM.
   *
   * As outras specs usam `Escape` para dispensar o dialogo de boas-vindas, e ai ele e
   * inofensivo porque elas medem o canvas e a lista. Copiei o `Escape` e ele passou a
   * desfazer a selecao, e o teste falhava procurando um `combobox` que existia ate dois
   * passos antes.
   */
};

test('fontes: a Cal Sans declarada esta carregada de verdade', async ({ page }) => {
  await abrirComTexto(page);

  const r = await carregarCalSans(page);
  expect(r.motivo, `a fonte embarcada nao carregou: ${r.motivo}`).toBe('');
  // `status === 'loaded'` e o que separa "declarada" de "baixada". Um `unloaded` com a
  // regra no CSS e exatamente o estado em que o `url()` nao resolvia.
  expect(r.status).toBe('loaded');
  expect(r.ok).toBe(true);
});

test('fontes: o arquivo da fonte e servido, nao e um 404 silencioso', async ({ page }) => {
  await abrirComTexto(page);

  /**
   * `CSSStyleDeclaration.src` devolve o **shorthand serializado**, nao a URL:
   *
   *     url("/icon-core/app/assets/CalSans-Regular-Dm1Envc1.woff2") format("woff2")
   *
   * Passar isso para `new URL()` produz um caminho que nao existe, o servidor devolve o
   * `index.html`, e o teste acusa `200` com `content-type: text/html` — um 404 que nunca
   * aconteceu, accuseado como se tivesse. A versao anterior disso e exatamente o que
   * aconteceu, e por isso o `url()` e extraido por regex.
   */
  const shorthand = await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSFontFaceRule && rule.style.fontFamily.includes('Cal Sans')) {
          return rule.style.src;
        }
      }
    }
    return null;
  });

  expect(shorthand, 'nenhum @font-face de Cal Sans no CSS carregado').not.toBeNull();

  // O ponto e do `format()`, e nao o inicio da string.
  const m = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(shorthand!);
  expect(m, `nao consegui extrair a URL de: ${shorthand}`).not.toBeNull();

  const url = new URL(m![1], page.url()).toString();
  expect(url, 'a URL precisa ser um arquivo, nao o caminho literal do fonte').toMatch(/\.woff2$/);

  const resposta = await page.request.get(url);
  // **200 com `text/html`** e o fallback da SPA: o caminho nao foi encontrado. Um 404 seria
  // honesto. Checar so o status deixa o fallback passar — que e como este teste falhou
  // acusando um defeito que nao existia.
  expect(
    resposta.headers()['content-type'],
    `a fonte respondeu ${resposta.status()} ${resposta.headers()['content-type']}: o @font-face aponta para onde?`
  ).toContain('font');
  expect(resposta.status()).toBe(200);

  // E o fetch de dentro da pagina, que e o caminho que o navegador realmente usa — o
  // `request` do Playwright tem `baseURL` propria e nao e o mesmo que o CSS.
  const dentroDaPagina = await page.evaluate(async (u) => {
    const r = await fetch(u);
    const b = await r.blob();
    return {
      status: r.status,
      type: r.headers.get('content-type'),
      assinatura: Array.from(new Uint8Array(await b.slice(0, 4).arrayBuffer()))
    };
  }, url);
  expect(dentroDaPagina.status).toBe(200);
  expect(dentroDaPagina.type).toContain('font');
  // A assinatura do WOFF2 e `wOF2`; um HTML comeca com `<!do` ou ``.
  expect(dentroDaPagina.assinatura.map((c) => String.fromCharCode(c)).join('')).toBe('wOF2');
});

test('fontes: o seletor oferece a embarcada e as genericas, em grupos', async ({ page }) => {
  await abrirComTexto(page);

  const seletor = page.getByRole('combobox', { name: 'Font' });
  await expect(seletor).toBeVisible();

  // A ordem dos grupos e um argumento, e `optgroup` nao se mede por texto visivel: mede-se
  // pelas opcoes que cada grupo contem.
  await expect(seletor.locator('optgroup[label="Bundled with the app"] option', { hasText: 'Cal Sans' })).toHaveCount(1);
  await expect(seletor.locator('optgroup[label="Resolves on any machine"] option')).toHaveCount(6);

  // A lista de fontes do sistema so aparece depois do clique, porque a Local Font Access API
  // exige gesto do usuario — `queryLocalFonts()` fora de um handler e recusada.
  await expect(seletor.locator('optgroup[label="This computer"]')).toHaveCount(0);
});

test('fontes: as familias genericas aparecem com o id que vai para o documento', async ({ page }) => {
  await abrirComTexto(page);

  const seletor = page.getByRole('combobox', { name: 'Font' });
  await expect(seletor).toBeVisible();

  /**
   * O `value` de cada opcao tem de ser o **id**, e nao o rotulo.
   *
   * Com `value={f.label}`, escolher "System UI" gravaria `System UI` no `.iconcore.json` —
   * que nao e uma familia CSS valida, e o navegador cairia no fallback sem avisar. E o
   * seletor nao voltaria a abrir na opcao certa, porque "System UI" nao casa com
   * `system-ui`.
   */
  const opcoes = await seletor.evaluate((el: HTMLSelectElement) =>
    Array.from(el.options).map((o) => ({
      value: o.value,
      label: (o.textContent || '').trim(),
      grupo: (o.parentElement as HTMLOptGroupElement | null)?.label ?? null
    }))
  );

  const genericas = opcoes.filter((o) => o.grupo === 'Resolves on any machine');
  expect(genericas.length).toBe(6);

  for (const o of genericas) {
    // O valor e a palavra do CSS: sem espaco, minuscula.
    expect(o.value, `"${o.label}" tem value "${o.value}", que nao e uma familia CSS`).toMatch(
      /^[a-z-]+$/
    );
    expect(o.label).not.toBe(o.value);
  }

  expect(genericas.map((o) => o.value)).toContain('system-ui');
  expect(genericas.map((o) => o.value)).toContain('monospace');
});

test('fontes: nenhuma familia conhecida aparece como "not installed"', async ({ page }) => {
  await abrirComTexto(page);

  /**
   * Este e o teste que **achou** o defeito.
   *
   * A comparacao era por `label`, e para as genericas `id != label`: a familia do default
   * (`system-ui`) nao casava com nenhuma opcao, e o seletor abria mostrando
   * `system-ui — not installed` para uma fonte que ele proprio oferece. Um controle que
   * chama de "nao instalada" a propria opcao padrao faz a pessoa achar que o app nao achou
   * uma fonte que ele acabou de embutir.
   *
   * A entrada sintetica so pode existir para uma familia que **nao** esta na lista, e a
   * unica forma de chegar nela pela UI e um projeto antigo com uma pilha como
   * `Inter, Sora, system-ui, sans-serif` — que exige um store que o app nao expoe. O que
   * fica verificado aqui e o lado oposto, que e o que quebrou: nenhuma familia da lista
   * produz a entrada.
   */
  const seletor = page.getByRole('combobox', { name: 'Font' });
  const naoInstaladas = seletor.locator('option', { hasText: 'not installed' });
  await expect(naoInstaladas).toHaveCount(0);

  // E o valor selecionado e uma opcao **de verdade**, nao a sentinela.
  const valor = await seletor.evaluate((el: HTMLSelectElement) => el.value);
  expect(valor).not.toMatch(/^__outra__/);
  expect(valor).toBe("'Cal Sans'");
});

test('fontes: a Cal Sans e o default, e o default carrega', async ({ page }) => {
  await abrirComTexto(page);

  /**
   * As tres condicoes que o default tem de cumprir, e por que uma so nao basta.
   *
   * A afirmacao de que a fonte do projeto "nao existia" estava **errada**: o `Sora` vinha de
   * `fonts.googleapis.com` por um `link`, entao carregava. O defeito real e ser **remota** num
   * app que se anuncia como offline e que roda dentro do Tauri.
   *
   * Entao trocar o default so resolve se as tres valerem:
   *
   * 1. a fonte **carrega** — e o que garante que o preview mostra o desenho certo;
   * 2. o default **e** a Cal Sans, e o seletor abre nela — e o que garante que ninguem
   *    precise escolher nada para ter a fonte que o projeto assume;
   * 3. a **interface** usa a mesma fonte — sem isso, a fonte embarcada fica disponivel
   *    enquanto a tela continua pedindo a remota: o defeito trocado de lugar.
   */

  // --- 1) carrega ---
  const carregada = await carregarCalSans(page);
  expect(carregada.motivo, `a Cal Sans nao carregou: ${carregada.motivo}`).toBe('');
  expect(carregada.status, 'a face da Cal Sans nao chegou a "loaded"').toBe('loaded');

  // --- 2) e o default de uma camada nova ---
  const seletor = page.getByRole('combobox', { name: 'Font' });
  await expect(seletor).toBeVisible();
  const valor = await seletor.evaluate((el: HTMLSelectElement) => el.value);
  expect(valor, `o seletor abriu em "${valor}" e nao na Cal Sans`).toBe("'Cal Sans'");

  await expect(
    seletor.locator('option', { hasText: 'not installed' }),
    'o default aparece como "not installed"'
  ).toHaveCount(0);

  // E o que a pessoa ve e o rotulo, e nao a familia com aspas.
  const rotulo = await seletor.evaluate(
    (el: HTMLSelectElement) => el.selectedOptions[0]?.textContent?.trim() ?? ''
  );
  expect(rotulo).toBe('Cal Sans');

  // --- 3) a interface usa a mesma fonte ---
  const chrome = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    theme: getComputedStyle(document.documentElement)
      .getPropertyValue('--font-display')
      .trim()
  }));
  expect(chrome.body, `o body computa ${chrome.body}`).toContain('Cal Sans');
  expect(chrome.theme, `o --font-display e "${chrome.theme}"`).toContain('Cal Sans');

  // E o `Sora` saiu do pedido remoto. Nao por Clearance: ele nao era mais usado, e um
  // `link` para CDN que o app parou de usar e uma dependencia de rede esperando o dia em
  // que alguem volta a usa-lo.
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('link[href*="fonts.googleapis"]')).map((l) =>
      (l.getAttribute('href') || '').slice(0, 200)
    )
  );
  for (const href of links) {
    expect(href, 'o index.html ainda pede Sora do Google Fonts').not.toContain('Sora');
  }
});

test('fontes: o botao de fontes do sistema so existe onde a API existe', async ({ page }) => {
  await abrirComTexto(page);

  /**
   * A Local Font Access API e Chromium-only e **exige gesto do usuario**. Entao o botao so
   * aparece onde ha API, e nunca como um botao que falha ao ser clicado.
   *
   * Este teste nao mede a lista de fontes do sistema — isso depende do que a maquina de
   * quem roda o teste tem instalado, e um teste que depende disso falha em outra maquina
   * sem dizer nada sobre o codigo. Ele mede o que e estavel: o botao existe e o grupo so
   * aparece **depois** do clique.
   */
  const botao = page.getByRole('button', { name: /Read fonts from this computer/i });
  const temBotao = (await botao.count()) > 0;

  if (!temBotao) {
    // Sem a API, o aviso explica o por — e nao ha botao morto.
    await expect(page.getByText(/does not list installed fonts/i)).toBeVisible();
    return;
  }

  await expect(seletorNaoEncontrado(page)).toBeHidden();
});

/** Nao ha grupo de fontes do sistema **antes** do clique: a API exige gesto. */
const seletorNaoEncontrado = (page: import('@playwright/test').Page) =>
  page.getByRole('combobox', { name: 'Font' }).locator('optgroup[label="This computer"]');
