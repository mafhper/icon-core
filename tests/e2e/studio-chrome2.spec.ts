import { expect, test, type Page } from '@playwright/test';

/**
 * Chrome slice 2: tiles + grade follow geometry, two bars with exact
 * addresses, the titlebar's PT menubar (and its measured hamburger) in four
 * zones, Export tab with grid + end action, the variant band in the
 * work-area paint, no page-level horizontal scroll at wide viewports — and
 * the narrow contract at 320px / zoom 200% — in dark and light.
 *
 * Every address below is a role/name the person reaches, never a selector
 * detail: if a control moves, this file moves with it instead of going green
 * on an empty query.
 */

const preparar = async (page: Page, theme: 'dark' | 'light') => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Storage bloqueado: o app cria o projeto normal.
    }
  });
  await page.goto(`/icon-core/app/?theme=${theme}`);
  await page.context().clearCookies();

  const welcome = page.getByRole('dialog');
  if (await welcome.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /^Create$/i }).first().click();
    await page.waitForTimeout(600);
  }
  await page.getByRole('toolbar', { name: 'Studio toolbar' }).waitFor({ timeout: 10000 });

  await page.getByRole('region', { name: 'Layers panel' }).getByRole('button', { name: 'Insert layer' }).click();
  await page.getByRole('menuitem', { name: 'Rounded rectangle' }).click();
  // "2": o retangulo mais o handle de Background que todo arquivo novo traz.
  await expect(page.getByRole('region', { name: 'Layers panel' })).toContainText('2');
  await expect(page.locator('.studio-tiles:not(.studio-tiles-grid) .studio-tile img')).toHaveCount(4, {
    timeout: 15000
  });
};

const shot = (page: Page, selector: string, index: number) =>
  page.locator(selector).nth(index).screenshot();

/**
 * The narrow contract, asserted at any effective width the shell must fit in —
 * a 320px viewport, or a 640px physical window at 200% browser zoom (the same
 * 320 CSS px of layout): the page never scrolls horizontally, the measured
 * zone hands the four slots over to the hamburger, and the breadcrumb name
 * elides instead of pushing the bar wide.
 */
const expectNarrowBar = async (page: Page) => {
  const banner = page.getByRole('banner');

  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  expect(sizes.scroll, `scrollWidth ${sizes.scroll} passou de clientWidth ${sizes.client}`).toBeLessThanOrEqual(
    sizes.client
  );

  // A própria barra cabe: o `overflow: hidden` do título é guarda, não licença
  // para vazar conteúdo por baixo dela.
  const barra = await banner.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(barra.scroll, `titlebar overflow: ${barra.scroll} > ${barra.client}`).toBeLessThanOrEqual(barra.client + 1);

  // A zona medida entrega o hambúrguer: nunca um ⋯, e nunca as duas formas juntas.
  const hamburger = banner.getByRole('button', { name: 'Main menu' });
  await expect(hamburger).toBeVisible();
  await expect(banner.getByRole('menubar')).toHaveCount(0);
  await expect(banner.locator('svg.lucide-more-horizontal')).toHaveCount(0);

  // O breadcrumb cede primeiro: nesta largura o nome está de fato truncado —
  // elipse declarada e clipping real — e o breadcrumb todo segue na janela.
  const nome = banner.locator('.studio-doc strong');
  expect(await nome.evaluate((el) => getComputedStyle(el).textOverflow)).toBe('ellipsis');
  expect(
    await nome.evaluate((el) => el.scrollWidth > el.clientWidth),
    'o nome devia estar truncado nesta largura'
  ).toBe(true);
  const docBox = (await banner.locator('.studio-doc').boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(docBox.x + docBox.width).toBeLessThanOrEqual(viewport.width + 1);
};

for (const theme of ['dark', 'light'] as const) {
  test(`[${theme}] raio muda → tiles e grade atualizam`, async ({ page }) => {
    await preparar(page, theme);
    const inspector = page.getByRole('region', { name: 'Inspector panel' });
    const strip = '.studio-tiles:not(.studio-tiles-grid) .studio-tile img';

    const before = await Promise.all([0, 1, 2, 3].map((i) => shot(page, strip, i)));
    await inspector.getByRole('slider', { name: 'Corner radius' }).fill('0');
    await page.waitForTimeout(1500);
    const after = await Promise.all([0, 1, 2, 3].map((i) => shot(page, strip, i)));
    for (let i = 0; i < 4; i += 1) {
      expect(Buffer.from(after[i]).equals(Buffer.from(before[i])), `tile ${i} manteve os pixels do raio anterior`).toBe(
        false
      );
    }

    // The grid shows the same radius-0 state, then follows the way back.
    await inspector.getByRole('tab', { name: 'Export' }).click();
    const grid = '.studio-tiles-grid .studio-tile img';
    await expect(page.locator(grid)).toHaveCount(4);
    const gridZero = await shot(page, grid, 0);
    await inspector.getByRole('tab', { name: 'Design' }).click();
    const radius = inspector.getByRole('slider', { name: 'Corner radius' });
    const max = await radius.evaluate((el) => (el as HTMLInputElement).max);
    await radius.fill(max);
    await page.waitForTimeout(1500);
    await inspector.getByRole('tab', { name: 'Export' }).click();
    const gridMax = await shot(page, grid, 0);
    expect(Buffer.from(gridMax).equals(Buffer.from(gridZero)), 'a grade manteve os pixels do raio anterior').toBe(
      false
    );
  });

  test(`[${theme}] titlebar: marca, menubar e breadcrumb em quatro zonas; painéis ficam fora`, async ({ page }) => {
    await preparar(page, theme);
    const banner = page.getByRole('banner');

    // Zona 1 — a marca (logo + título) nunca trunca.
    const brand = banner.getByRole('button', { name: 'Go to workspaces' });
    await expect(brand).toBeVisible();
    await expect(brand).toContainText('Icon-Core');
    // Zona 2 — o menubar PT: os quatro slots na ordem do plano, e nenhum ⋯.
    const menubar = banner.getByRole('menubar', { name: 'Main menu' });
    await expect(menubar).toBeVisible();
    expect(await menubar.getByRole('menuitem').evaluateAll((els) => els.map((el) => el.textContent ?? ''))).toEqual([
      'Arquivo',
      'Editar',
      'Exibir',
      'Sobre'
    ]);
    await expect(banner.locator('svg.lucide-more-horizontal')).toHaveCount(0);
    // Nesta largura os quatro slots cabem: o hambúrguer é do transbordo medido,
    // nunca de um breakpoint — então aqui ele não existe.
    await expect(banner.getByRole('button', { name: 'Main menu' })).toHaveCount(0);
    // Zona 3 — o breadcrumb relata; só o nome elipsa, o resto fica rígido.
    const doc = banner.locator('.studio-doc');
    await expect(doc).toHaveAttribute('aria-live', 'polite');
    await expect(doc.getByText('Default')).toBeVisible();
    await expect(doc.getByRole('button')).toHaveCount(0);
    expect(await doc.locator('strong').evaluate((el) => getComputedStyle(el).textOverflow)).toBe('ellipsis');
    expect(await doc.locator('span').last().evaluate((el) => getComputedStyle(el).flexShrink)).toBe('0');
    // Zona 4 — controles de janela: só Tauri; na web a zona é `display: none`.
    await expect(banner.locator('.studio-window-controls')).toHaveCSS('display', 'none');
    await expect(page.getByRole('button', { name: 'Minimize' })).toHaveCount(0);
    // E o fundo não é região de arrasto no browser (isso é do shell desktop).
    await expect(banner).not.toHaveAttribute('data-tauri-drag-region', 'deep');

    // A ordem das zonas é a da decisão: marca → menubar → breadcrumb.
    const brandBox = (await brand.boundingBox())!;
    const barBox = (await menubar.boundingBox())!;
    const docBox = (await doc.boundingBox())!;
    expect(brandBox.x).toBeLessThan(barBox.x);
    expect(barBox.x).toBeLessThan(docBox.x);

    // Nothing from the canvas column leaks up: no panel toggles, no Insert, no
    // View options.
    await expect(banner.getByRole('button', { name: 'Insert layer' })).toHaveCount(0);
    await expect(banner.getByRole('button', { name: 'View options' })).toHaveCount(0);
    await expect(banner.getByRole('button', { name: /Layers panel|Inspector panel/ })).toHaveCount(0);
  });

  test(`[${theme}] menubar PT: mesmas linhas nas duas apresentações; Esc devolve o foco`, async ({ page }) => {
    await preparar(page, theme);
    const banner = page.getByRole('banner');

    // Nenhuma largura rende um ⋯: o coletor não voltou com outro nome.
    await expect(banner.locator('svg.lucide-more-horizontal')).toHaveCount(0);

    /** As linhas acionáveis do menu aberto — itens e opções, na ordem do DOM. */
    const linhas = () =>
      page
        .locator('[role="menu"] [role="menuitem"], [role="menu"] [role="menuitemradio"]')
        .evaluateAll((els) => els.map((el) => el.textContent ?? ''));

    // Larga: os quatro slots PT, na ordem do plano.
    const menubar = banner.getByRole('menubar', { name: 'Main menu' });
    await expect(menubar).toBeVisible();
    expect(await menubar.getByRole('menuitem').evaluateAll((els) => els.map((el) => el.textContent ?? ''))).toEqual([
      'Arquivo',
      'Editar',
      'Exibir',
      'Sobre'
    ]);

    // O conjunto fechado de linhas de cada menu — o mesmo que a spec de
    // componente fixa, agora lido da build real. A paridade PT não é
    // "parecido": é a lista exata, com os atalhos que os bindings instalam
    // (Ctrl nesta plataforma de teste; o rótulo do zoom leva o sinal −, U+2212).
    const fechado: Array<[string, string[]]> = [
      [
        'Arquivo',
        [
          'Novo',
          'AbrirCtrl+O',
          'Nenhum projeto recente',
          'Renomear',
          'Fechar',
          'SalvarCtrl+S',
          'Salvar comoCtrl+Shift+S',
          'ExportarCtrl+E'
        ]
      ],
      ['Editar', ['DesfazerCtrl+Z', 'RefazerCtrl+Shift+Z', 'DuplicarCtrl+D']],
      [
        'Exibir',
        [
          'Grade — DesligadaG',
          'AproximarCtrl+=',
          'AfastarCtrl+−',
          'Zoom 100%Ctrl+0',
          'Default',
          'Light',
          'Dark',
          'Monochrome',
          'Claro',
          'Escuro',
          'Sistema'
        ]
      ],
      ['Sobre', ['Atalhos?', 'Preferências', 'Sobre o Icon-Core']]
    ];

    const largas: string[] = [];
    for (const [menu, esperado] of fechado) {
      const trigger = menubar.getByRole('menuitem', { name: menu });
      await trigger.click();
      await expect(page.getByRole('menu')).toBeVisible();
      const lidas = await linhas();
      expect(lidas, `menu ${menu} na apresentação larga`).toEqual(esperado);
      largas.push(...lidas);

      // Esc fecha e devolve o foco ao gatilho.
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu')).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }

    // Estreita de verdade: em 320px os quatro slots não cabem, e a zona medida
    // entrega o hambúrguer — o mesmo modelo, outra apresentação.
    await page.setViewportSize({ width: 320, height: 900 });
    const hamburger = banner.getByRole('button', { name: 'Main menu' });
    await expect(hamburger).toBeVisible();
    await expect(banner.getByRole('menubar')).toHaveCount(0);
    await expect(banner.locator('svg.lucide-more-horizontal')).toHaveCount(0);

    await hamburger.click();
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true');
    const painel = page.getByRole('menu', { name: 'Main menu' });
    await expect(painel).toBeVisible();

    // Paridade de verdade: as linhas do painel estreito são as MESMAS da barra
    // larga, na mesma ordem — um modelo, duas apresentações.
    expect(await linhas(), 'o painel estreito repete as linhas da barra larga').toEqual(largas);

    // Aqui as seções são cabeçalhos (rótulo, não item): "Arquivo" não é clicável.
    for (const secao of ['Arquivo', 'Editar', 'Exibir', 'Sobre']) {
      await expect(painel.getByText(secao, { exact: true })).toBeVisible();
      await expect(painel.getByRole('menuitem', { name: secao, exact: true })).toHaveCount(0);
    }

    // Esc fecha o painel e devolve o foco ao hambúrguer.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(hamburger).toBeFocused();
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false');

    // De volta à largura cheia: os quatro slots retornam e o hambúrguer sai.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(banner.getByRole('menubar', { name: 'Main menu' })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Main menu' })).toHaveCount(0);
  });

  test(`[${theme}] barra do canvas: recolher, desfazer, refazer, view options, recolher`, async ({ page }) => {
    await preparar(page, theme);
    const canvas = page.getByRole('region', { name: 'Canvas' });
    const bar = canvas.getByRole('toolbar', { name: 'Studio toolbar' });
    await expect(bar).toBeVisible();

    const labels = await bar.getByRole('button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
    expect(labels).toEqual(['Hide Layers panel', 'Undo', 'Redo', 'View options', 'Hide Inspector panel']);

    // Scoped to the canvas column: inside the Canvas region, never a
    // full-width band above the sidebars.
    const scoped = await bar.evaluate((el) => {
      const section = el.closest('section');
      return section?.getAttribute('aria-label') === 'Canvas';
    });
    expect(scoped).toBe(true);

    await expect(bar.getByRole('button', { name: 'Insert layer' })).toHaveCount(0);
    await expect(bar.getByRole('button', { name: 'Export' })).toHaveCount(0);

    // The edge collapses act: first hides the left panel, and offers it back.
    await bar.getByRole('button', { name: 'Hide Layers panel' }).click();
    await expect(page.getByRole('button', { name: 'Show Layers panel' })).toBeVisible();
    await page.getByRole('button', { name: 'Show Layers panel' }).click();
    await expect(page.getByRole('region', { name: 'Layers panel' })).toBeVisible();
  });

  test(`[${theme}] aba Export: grade viva + ação no fim que exporta de verdade`, async ({ page }) => {
    await preparar(page, theme);
    const inspector = page.getByRole('region', { name: 'Inspector panel' });

    await expect(inspector.getByRole('tab', { name: 'Preview' })).toHaveCount(0);
    await inspector.getByRole('tab', { name: 'Export' }).click();
    await expect(page.locator('.studio-tiles-grid')).toBeVisible();
    await expect(page.locator('.studio-tiles-grid .studio-tile')).toHaveCount(4);

    const action = inspector.getByRole('button', { name: /Export \d+ files?/ });
    await expect(action).toBeVisible();
    const atEnd = await inspector.evaluate((el) => {
      const grid = el.querySelector('.studio-tiles-grid');
      const button = el.querySelector('.studio-export-foot button');
      return Boolean(
        grid && button && (grid.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      );
    });
    expect(atEnd).toBe(true);

    // A ação roda o pipeline de verdade: o estágio final oferece o zip.
    await action.click();
    await expect(inspector.getByRole('button', { name: 'Download all (.zip)' })).toBeVisible({ timeout: 30000 });
  });

  test(`[${theme}] faixa das variantes segue a cor da work area: palco e faixa no mesmo pano`, async ({ page }) => {
    await preparar(page, theme);

    // Sem seleção, o Design mostra o painel da bancada (Work area). O branco é
    // o exemplo do aceite: uma cor que nenhum tema tem, para o igual entre
    // palco e faixa não poder vir de coincidência com a mesa.
    await page.keyboard.press('Escape');
    const campo = page.getByLabel('Work area color hex');
    await expect(campo).toBeVisible();
    await campo.fill('FFFFFF');
    await campo.press('Enter');

    const tinta = (selector: string) =>
      page.locator(selector).evaluate((el) => getComputedStyle(el).backgroundColor);
    const palco = () => tinta('.studio-stage');
    const faixa = () => tinta('.studio-variant-band');

    // Cor escolhida: os três sítios do mesmo binding (palco, superfície de
    // edição e faixa) computam igual.
    await expect.poll(palco).toBe('rgb(255, 255, 255)');
    expect(await faixa()).toBe('rgb(255, 255, 255)');
    expect(await tinta('.studio-stage .ic-edit-stage')).toBe('rgb(255, 255, 255)');

    // Os tiles não repintam: o tile ativo mantém o chip dele (--ic-bg + borda
    // + dot + aria-pressed) sobre a faixa branca, como manda o contrato.
    const tileAtivo = page.locator('.studio-tile[data-active="true"]');
    await expect(tileAtivo).toHaveAttribute('aria-pressed', 'true');
    const chip = await tileAtivo.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(chip).not.toBe('rgb(255, 255, 255)');
    expect(chip).toBe(await tinta('.studio-canvasbar'));

    // A faixa é a seção colada no palco e full-bleed: a costura não volta
    // por geometria (gap) nem por sobra lateral.
    const costura = await page.evaluate(() => {
      const palcoRect = document.querySelector('.studio-stage')!.getBoundingClientRect();
      const faixaRect = document.querySelector('.studio-variant-band')!.getBoundingClientRect();
      const colunaRect = document.querySelector('.studio-canvas')!.getBoundingClientRect();
      return {
        gap: faixaRect.top - palcoRect.bottom,
        fullBleed: Math.abs(faixaRect.left - colunaRect.left) < 1 && Math.abs(faixaRect.right - colunaRect.right) < 1
      };
    });
    expect(costura.gap).toBeLessThan(1);
    expect(costura.fullBleed).toBe(true);

    // Alpha: o `color-mix` do mesmo binding casa nos dois (aqui a prova é o
    // igual entre palco e faixa — o valor resolvido é do browser, não do spec).
    await page.getByLabel('Work area color alpha percent').fill('50');
    await expect.poll(palco).not.toBe('rgb(255, 255, 255)');
    expect(await faixa()).toBe(await palco());

    // Follow the theme: a escolha sai e os dois voltam à mesa juntos.
    await page.getByRole('button', { name: 'Follow the theme' }).click();
    const mesa = await tinta('.studio-canvas');
    expect(mesa).not.toBe('rgb(255, 255, 255)');
    await expect.poll(faixa).toBe(mesa);
    expect(await palco()).toBe(mesa);
    expect(await tinta('.studio-stage .ic-edit-stage')).toBe(mesa);
  });

  test(`[${theme}] tira inferior: coluna abaixo da faixa pinta a mesma mesa; pill e status são chrome`, async ({
    page
  }) => {
    await preparar(page, theme);

    const tinta = (selector: string) =>
      page.locator(selector).evaluate((el) => getComputedStyle(el).backgroundColor);
    const coluna = () => tinta('.studio-canvas');
    const palco = () => tinta('.studio-stage');
    const faixa = () => tinta('.studio-variant-band');
    const tira = () => tinta('.studio-desk-tail');
    const pill = () => tinta('.studio-pillbar');
    const status = () => tinta('.studio-statusbar');

    // Chrome dos readouts capturado antes de qualquer escolha: pintar a mesa
    // não pode lavar a toolbar flutuante nem o pé.
    const pill0 = await pill();
    const status0 = await status();

    // Sem cor, os quatro sítios de mesa são o workspace do tema.
    const mesa = await coluna();
    expect(await palco()).toBe(mesa);
    expect(await faixa()).toBe(mesa);
    expect(await tira()).toBe(mesa);

    // A cor do aceite: nenhum dos dois temas a tem, então o igual entre os
    // sítios não pode vir de coincidência com a mesa.
    await page.keyboard.press('Escape');
    const campo = page.getByLabel('Work area color hex');
    await expect(campo).toBeVisible();
    await campo.fill('B2B2B2');
    await campo.press('Enter');

    // Cor escolhida: palco, faixa e a tira inferior (em volta/atrás da pillbar
    // até a statusbar) computam igual — o mesmo binding, não três tintas. A
    // coluna segue na mesa do tema: ela é a base opaca sob o alpha, não um
    // quarto sítio de tinta.
    await expect.poll(tira).toBe('rgb(178, 178, 178)');
    expect(await palco()).toBe('rgb(178, 178, 178)');
    expect(await faixa()).toBe('rgb(178, 178, 178)');

    // Alpha: o `color-mix` do mesmo binding casa nos três sítios.
    await page.getByLabel('Work area color alpha percent').fill('50');
    await expect.poll(tira).not.toBe('rgb(178, 178, 178)');
    expect(await palco()).toBe(await tira());
    expect(await faixa()).toBe(await tira());

    // Follow the theme: os três voltam à mesa juntos.
    await page.getByRole('button', { name: 'Follow the theme' }).click();
    await expect.poll(tira).toBe(mesa);
    expect(await palco()).toBe(mesa);
    expect(await faixa()).toBe(mesa);

    // Os readouts não foram repintados em passo nenhum.
    expect(await pill()).toBe(pill0);
    expect(await status()).toBe(status0);

    // A tira é da coluna e fecha nela: começa na faixa (sem costura), é
    // full-bleed, termina na statusbar, e a pillbar assenta dentro dela.
    const geometria = await page.evaluate(() => {
      const colunaRect = document.querySelector('.studio-canvas')!.getBoundingClientRect();
      const faixaRect = document.querySelector('.studio-variant-band')!.getBoundingClientRect();
      const tiraRect = document.querySelector('.studio-desk-tail')!.getBoundingClientRect();
      const pillRect = document.querySelector('.studio-pillbar')!.getBoundingClientRect();
      const statusRect = document.querySelector('.studio-statusbar')!.getBoundingClientRect();
      return {
        costura: tiraRect.top - faixaRect.bottom,
        fullBleed:
          Math.abs(tiraRect.left - colunaRect.left) < 1 && Math.abs(tiraRect.right - colunaRect.right) < 1,
        ateStatus: Math.abs(tiraRect.bottom - statusRect.top),
        pillDentro: pillRect.top >= tiraRect.top - 0.5 && pillRect.bottom <= tiraRect.bottom + 0.5
      };
    });
    expect(geometria.costura).toBeLessThan(1);
    expect(geometria.fullBleed).toBe(true);
    expect(geometria.ateStatus).toBeLessThan(1);
    expect(geometria.pillDentro).toBe(true);
  });

  test(`[${theme}] sem scroll horizontal em viewport larga`, async ({ page }) => {
    await preparar(page, theme);
    const sizes = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth
    }));
    expect(sizes.scroll, `scrollWidth ${sizes.scroll} passou de clientWidth ${sizes.client}`).toBeLessThanOrEqual(
      sizes.client
    );
  });

  test(`[${theme}] 320px: sem scroll horizontal, hambúrguer visível e breadcrumb elipsa`, async ({ page }) => {
    await preparar(page, theme);
    // Larga → estreita de verdade: a troca de forma é medida em runtime, então
    // a resize exercita o caminho por onde a janela pequena passa.
    await page.setViewportSize({ width: 320, height: 900 });
    await expectNarrowBar(page);
  });

  test.describe(`[${theme}] zoom 200%`, () => {
    // Zoom de navegador a 200% numa janela física de 640px: o layout vê 320 CSS
    // px (a largura efetiva) e o raster sobe para 2×. É a mesma largura efetiva
    // do teste de 320px — e por isso ele repete as MESMAS asserções.
    test.use({ viewport: { width: 320, height: 900 }, deviceScaleFactor: 2 });

    test(`mesmas garantias na largura efetiva`, async ({ page }) => {
      await preparar(page, theme);
      expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);
      await page.setViewportSize({ width: 320, height: 900 });
      await expectNarrowBar(page);
    });
  });
}
