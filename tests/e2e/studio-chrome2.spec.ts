import { expect, test, type Page } from '@playwright/test';

/**
 * Chrome slice 2: tiles + grade follow geometry, two bars with exact
 * addresses, Export tab with grid + end action, the variant band in the
 * work-area paint, no page-level horizontal scroll at wide viewports — in
 * dark and light.
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

  test(`[${theme}] titlebar: documento, saída e sistema distribuídos; painéis ficam fora`, async ({ page }) => {
    await preparar(page, theme);
    const banner = page.getByRole('banner');

    await expect(banner.getByRole('button', { name: 'Go to workspaces' })).toBeVisible();
    await expect(banner.getByRole('group', { name: 'Document' })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'New document' })).toBeVisible();
    await expect(banner.getByText('Default')).toBeVisible();
    await expect(banner.getByRole('group', { name: 'Output' }).getByRole('button', { name: 'Export icons' })).toBeVisible();
    // The theme control is a toggle: it names the state in force, per run.
    await expect(banner.getByRole('button', { name: /^(Dark|Light) theme$/ })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Keyboard shortcuts' })).toBeVisible();

    // Nothing from the canvas column leaks up: no panel toggles, no Insert, no
    // View options.
    await expect(banner.getByRole('button', { name: 'Insert layer' })).toHaveCount(0);
    await expect(banner.getByRole('button', { name: 'View options' })).toHaveCount(0);
    await expect(banner.getByRole('button', { name: /Layers panel|Inspector panel/ })).toHaveCount(0);
  });

  test(`[${theme}] titlebar mede a própria largura: ação dobra em More actions e volta`, async ({ page }) => {
    await preparar(page, theme);
    const banner = page.getByRole('banner');

    // Larga: o conjunto inteiro cabe e o gatilho de excedentes não existe.
    await expect(banner.getByRole('button', { name: 'About Icon-Core' })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'More actions' })).toHaveCount(0);

    // Estreita: o rabo da prioridade dobra — About sai primeiro — e o gatilho
    // aparece dizendo o que faz e se está aberto.
    await page.setViewportSize({ width: 760, height: 900 });
    await expect(banner.getByRole('button', { name: 'About Icon-Core' })).toHaveCount(0);
    const trigger = banner.getByRole('button', { name: 'More actions' });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // A saída continua na barra: é o topo da prioridade, o último a dobrar.
    await expect(banner.getByRole('button', { name: 'Save session' })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Export icons' })).toBeVisible();

    // O item que saiu está no menu com o mesmo nome, e Esc devolve o foco.
    await trigger.click();
    await expect(page.getByRole('menuitem', { name: 'About Icon-Core' })).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();

    // De volta à largura: a ação volta para a barra e o gatilho some.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(banner.getByRole('button', { name: 'About Icon-Core' })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'More actions' })).toHaveCount(0);
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
}
