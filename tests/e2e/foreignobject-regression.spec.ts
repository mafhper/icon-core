import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

/**
 * Regressão do `foreignObject`: um SVG do Figma **precisa** aparecer no preview.
 *
 * ## O que este arquivo substitui
 *
 * Durante a investigação, os arquivos viviam no repositório do dono
 * (`assets-hub/.dev/images/promo/`) e o teste lia de la. Um teste que depende de um caminho
 * **fora** do repositório falha em CI na primeira máquina sem aquele clone — e falha parecendo
 * que o produto quebrou.
 *
 * As fixtures agora moram em `tests/e2e/fixtures/`. Same bytes, dentro do repo.
 *
 * ## As duas fixtures, e por que as duas
 *
 * - `figma-angular-gradient.svg` — o que **quebrava**: 2 blocos `<foreignObject>` com
 *   `conic-gradient`, exportados pelo Figma.
 * - `icon-asset-hub-linear-v2.svg` — o **controle**: o mesmo icone com gradientes convertidos
 *   para `<linearGradient>` nativo, zero `foreignObject`.
 *
 * As duas juntas sao a prova de que a diferenca nao era "o Figma" nem "o tamanho" nem a
 * viewBox: e a presenca de `<foreignObject>`, e so ela, porque as duas usam `foreignObject`
 * **e** `data-figma-gradient-fill` em proporcoes iguais e so uma falha.
 *
 * ## O que o teste mede
 *
 * **Pixels**, nao a existencia do `<img>`. Um preview presente e em branco passaria numa
 * checagem de visibilidade, e e exatamente o que o arquivo sem `foreignObject` produzia: 0%
 * dos pixels, com a layer visivel na barra lateral.
 */

/** Fixture pela pasta do repo, nao por caminho absoluto para fora dele. */
const FIXTURE = (nome: string) => path.join(process.cwd(), 'tests', 'e2e', 'fixtures', nome);

interface Medida {
  preview: number;
  natural: string | null;
  tainted: boolean;
  cobertura: number;
  emBranco: boolean;
}

const medir = async (page: Page, arquivo: string): Promise<Medida> => {
  /**
   * Limpa o storage antes de o app montar. O contexto sobrevive ao `goto`, entao o
   * storage tambem: com um projeto salvo, a dialog mostra a **lista** em vez do botao
   * "Create", e o clique estoura em 30s esperando algo que nao aparece.
   *
   * Este e o primeiro spec a fazer **dois** `goto` no mesmo teste — e por isso que a limpeza
   * foi propagada para os demais, em vez de ficar so aqui.
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

  // Apos registrar o `addInitScript`: ele roda na navegacao, entao o `goto` tem que vir
  // depois — registrar depois nao limpou nada na primeira carga.
  await page.goto('/icon-core/app/?theme=dark');

  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /^Create$/i }).first().click();
    await page.waitForTimeout(700);
  }

  const erros: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') erros.push(m.text().slice(0, 140));
  });

  await page.setInputFiles('input[type="file"]', arquivo);
  await page.waitForTimeout(2400);

  const info = await page.evaluate(() => {
    const img = document.querySelector('.ic-canvas-render') as HTMLImageElement | null;
    if (!img || !img.complete || img.naturalWidth === 0) {
      return { preview: img ? 1 : 0, natural: null, cobertura: 0 };
    }
    const n = img.naturalWidth;
    const c = document.createElement('canvas');
    c.width = n;
    c.height = n;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, n, n);
    const d = ctx.getImageData(0, 0, n, n).data;
    const contagem = new Map<string, number>();
    for (let i = 0; i < d.length; i += 4) {
      const k = `${d[i]},${d[i + 1]},${d[i + 2]}`;
      contagem.set(k, (contagem.get(k) || 0) + 1);
    }
    const [, maior] = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      preview: 1,
      natural: `${img.naturalWidth}x${img.naturalHeight}`,
      cobertura: +((maior / (n * n)) * 100).toFixed(1)
    };
  });

  return {
    ...info,
    tainted: erros.some((e) => /Tainted/.test(e)),
    emBranco: info.cobertura === 0 || info.cobertura > 99.5
  };
};

/** Importa e devolve a medida, com o log que costuma ser o unico registro de uma falha. */
const importar = async (page: Page, nome: string) => {
  const m = await medir(page, FIXTURE(nome));
  console.log(
    `${nome.padEnd(34)} preview=${m.preview} natural=${m.natural} tainted=${m.tainted} ` +
      `cobertura=${m.cobertura}% emBranco=${m.emBranco}`
  );
  return m;
};

test('o svg do figma com foreignObject renderiza, com pixel', async ({ page }) => {
  const m = await importar(page, 'figma-angular-gradient.svg');

  expect(m.tainted, 'o svg com foreignObject voltou a contaminar o canvas').toBe(false);
  expect(m.preview, 'o preview nao apareceu').toBe(1);
  expect(m.natural, 'o blob do preview nao carregou').not.toBeNull();
  expect(m.emBranco, `o preview esta em branco (cobertura ${m.cobertura}%)`).toBe(false);
});

test('o svg linear nativo continua renderizando: a correcao nao quebrou o caminho feliz', async ({ page }) => {
  const m = await importar(page, 'icon-asset-hub-linear-v2.svg');

  expect(m.tainted).toBe(false);
  expect(m.preview).toBe(1);
  expect(m.emBranco, `o svg linear esta em branco (cobertura ${m.cobertura}%)`).toBe(false);
});

test('os dois svgs do mesmo icone produzem o mesmo desenho', async ({ page }) => {
  /**
   * O gradiente angular e o linear sao artes **diferentes** — voce trocou o gradiente de
   * proposito. O que tem de ser igual e a **presenca do desenho**: mesma cobertura, mesma
   * presenca de pixel.
   *
   * Se os dois dessem a mesma cobertura *e* o angular deixasse de pintar, o sinal seria de
   * que o angular virou o linear ou o vice-versa, e nao de que ambos pintam.
   */
  const angular = await importar(page, 'figma-angular-gradient.svg');
  const linear = await importar(page, 'icon-asset-hub-linear-v2.svg');

  expect(angular.cobertura, 'o angular e o linear pintaram areas muito diferentes').toBeCloseTo(
    linear.cobertura,
    0
  );
});
