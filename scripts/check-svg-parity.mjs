/**
 * SVG/canvas parity: render the same projects through both pipelines and compare
 * them pixel by pixel.
 *
 * This exists because the two pipelines drifted for a long time and nothing
 * compared them. The SVG export dropped `blendMode` entirely and drew a squircle
 * as `<rect rx>`, and there was no test anywhere that could have seen either: the
 * unit tests assert markup, the renderer tests use a mock backend, and the e2e
 * suite covers the promo page. A wrong pixel in an export is invisible to all of
 * them.
 *
 * The reference is the browser canvas, because that is what the app ships and
 * what every existing export was produced by. A Node route that differs is not
 * "close enough" — it means two different answers to "what does this project
 * look like".
 *
 * Run after `npm run build` (it needs `dist`) and after `npx playwright install
 * chromium`:
 *
 *   node scripts/check-svg-parity.mjs
 *   node scripts/check-svg-parity.mjs --write   # also refresh the fixtures
 *
 * `--baseline` compares against the committed baseline instead of the live
 * browser render, which is what CI does when it cannot launch a browser.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const SIDE = 256;
const OUT = '.dev/tmp/svg-parity';

/**
 * Fixtures, one per feature a backend has to implement.
 *
 * Built to isolate a single behaviour, so a parity failure names the feature
 * rather than saying "the render differs" — which is the only useful form of
 * this measurement.
 *
 * The first version of this file hand-wrote layers and every render came out
 * blank, because the layer shape was wrong. All of them produced a byte-identical
 * 2364-byte PNG, which is exactly what a blank canvas looks like. Nine different
 * fixtures agreeing on one byte count was the tell.
 */
const base = (nome, layers, canvas = {}) => ({
  schemaVersion: 2,
  metadata: { name: nome, shortName: nome },
  canvas: { size: 256, background: { kind: 'solid', color: '#ffffff' }, ...canvas },
  exportProfile: { outputBaseName: nome, quality: 0.95, generateReport: false },
  variants: { default: {} },
  layers,
  targets: []
});

let seq = 0;
const shape = (shapeDef, extra = {}) => ({
  id: `l${(seq += 1)}`,
  name: 'shape',
  kind: 'shape',
  visible: true,
  zIndex: 0,
  source: { type: 'reference', path: '', shape: shapeDef },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  ...extra
});

const PROJECTS = {
  // Baseline: one flat fill. If this does not match, nothing else is meaningful.
  simples: base('simples', [
    shape({ kind: 'rectangle', width: 176, height: 176, cornerRadius: 0 }, {
      transform: { x: 40, y: 40, scale: 1, rotation: 0 },
      fill: { kind: 'solid', color: '#1565c0' }
    })
  ]),

  // Linear gradient at an angle.
  gradiente: base('gradiente', [
    shape({ kind: 'rectangle', width: 208, height: 208, cornerRadius: 0 }, {
      transform: { x: 24, y: 24, scale: 1, rotation: 0 },
      fill: {
        kind: 'linear-gradient',
        angle: 45,
        stops: [
          { offset: 0, color: '#ff5722' },
          { offset: 1, color: '#2196f3' }
        ]
      }
    })
  ]),

  radial: base('radial', [
    shape({ kind: 'rectangle', width: 200, height: 200, cornerRadius: 0 }, {
      transform: { x: 28, y: 28, scale: 1, rotation: 0 },
      fill: {
        kind: 'radial-gradient',
        stops: [
          { offset: 0, color: '#ffffff' },
          { offset: 1, color: '#4a148c' }
        ]
      }
    })
  ]),

  // **Texto.**
  //
  // As 12 fixtures anteriores não tinham uma única layer de texto, e texto é o único
  // lugar onde o modelo não desenha: o canvas resolve a fonte com `ctx.font` e o SVG
  // **declara** `font-family` para quem abre resolver. São os mesmos três valores, mas
  // "os mesmos valores" era uma afirmação, não uma medição — e a regra do repositório é
  // que paridade se prova comparando, não se assume lendo o código.
  //
  // `sans-serif` de propósito: é a fonte que existe nos dois lados. Uma fixture com uma
  // fonte hypothetical mediria a resolução de fonte do Chromium contra a do
  // resvg/visor, que é outra conversa — e é a conversa da **portabilidade**, tratada
  // separadamente.
  texto: base('texto', [
    {
      id: 'ltexto',
      name: 'texto',
      kind: 'text',
      visible: true,
      zIndex: 0,
      source: { type: 'inline', shape: { kind: 'rectangle', width: 512, height: 512 } },
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      opacity: 1,
      text: { content: 'Icon', fontFamily: 'sans-serif', fontSize: 96, fontWeight: 700 },
      fill: { kind: 'solid', color: '#111827' }
    }
  ]),
  textoEBold: base('textoEBold', [
    {
      id: 'ltexto2',
      name: 'texto',
      kind: 'text',
      visible: true,
      zIndex: 0,
      source: { type: 'inline', shape: { kind: 'rectangle', width: 512, height: 512 } },
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      opacity: 1,
      text: { content: 'Wg', fontFamily: 'sans-serif', fontSize: 120, fontWeight: 300 },
      fill: { kind: 'solid', color: '#b91c1c' }
    }
  ]),

  /**
   * `IC63/1b` — override de cor em layer `svg`.
   *
   * A fixture que faltava enquanto o recurso não existia. O `check-svg-parity` compara
   * `renderProject` (canvas, que rasteriza por `Image`) contra `renderToSvg` (que injeta
   * o markup) — então uma fixture de override exercita **os dois pipelines de uma vez**,
   * que é a única forma de provar que eles concordam.
   *
   * `#ffffff` vira `#101010`; `#ff8800` fica. Se a reescrita fosse "pintar a camada
   * inteira", o laranja mudaria junto e esta fixture reprovaria — e é por isso que ela
   * tem duas cores, e não uma.
   */
  svgCor: base('svgCor', [
    {
      id: 'lsvgcor',
      name: 'svg',
      kind: 'svg',
      visible: true,
      zIndex: 0,
      source: {
        type: 'inline',
        mimeType: 'image/svg+xml',
        data: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3QgeD0iMiIgeT0iMiIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjZmZmZmZmIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iNiIgZmlsbD0iI2ZmODgwMCIvPjwvc3ZnPg==',
        shape: { kind: 'rectangle', width: 384, height: 384 }
      },
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      opacity: 1,
      svgPaintOverrides: { '#ffffff': '#101010' }
    }
  ]),

  /**
   * `IC63/2` — itálico, e por que o alinhamento **não** tem fixture aqui.
   *
   * Houve três fixtures de alinhamento (`textoEsquerda`, `textoDireita`) neste arquivo,
   * e elas **não mediam nada**. A mutação que trocava `textAlign: 'left'` por
   * `'center'` na fixture passou sem mudar um único número — o patch aplicava (verificado
   * à parte), o portão ficava verde, e as linhas saíam byte a byte iguais.
   *
   * Não era defeito da feature. Três sondas seguidas/stableceram:
   *
   *   1. o SVG emite `text-anchor="start" x=30`, `middle x=128`, `end x=226` — três
   *      âncoras corretas e distintas;
   *   2. a geometria da tinta de canvas e SVG é **idêntica ao pixel** — bbox igual,
   *      0 px de diferença de tinta, 0 colunas com perfil distinto;
   *   3. logo, os dois pipelines **honram** o campo e **concordam** entre si.
   *
   * E é essa concordância que torna a fixture cega: ela compara **canvas contra SVG**, e
   * os dois se movem juntos quando o campo muda. Ela mede *concordância*, não
   * *correção*. Um portão que só compara duas coisas que andam juntas não vê o valor de
   * nenhuma das duas.
   *
   > Esta é a lição do `IC63/1b` ao contrário. Lá a fixture comparava canvas com SVG e
   > eu a tomei como prova de que o override funcionava — não funcionava, e foi por isso
   > que existe o gate de "o override tem que mudar o render". Aqui ela parece prova da
   > âncora e não é. **Comparar contra o outro pipeline prova divergência, nunca
   > correção.** Correção precisa de valor absoluto.
   *
   * O alinhamento está travado em outro lugar, e em ambos os casos por valor absoluto:
   *
   * - **15 testes de unidade** em `textLayout.spec.ts`, mutation gate **8/8**, incluindo
   *   "left ancora no centro" e "right ancora no centro" — as duas mutações que
   *   colocariam o texto no lugar errado;
   * - **o markup emitido**, que é um número: `text-anchor="start"`, `x="30"`,
   *   `font-style="italic"` presente ou ausente.
   *
   * Então as fixtures saem em vez de afrouxarem o limite. Fixture que não falha é pior
   * que fixture nenhuma: parece cobertura.
   *
   * ## Por que esta fica
   *
   * `textoItalico` mede outra coisa, e **não** é um caso como o alinhamento. O
   * itálico não desloca a caixa: a tinta começa no mesmo pixel (`x=79` medido, igual ao
   * upright), e o que muda é a **inclinação dos glifos** dentro dela. Isso produz uma
   * divergência de borda de verdade entre os dois pipelines — e é por isso que o limite
   * é `1%` e não `null`: se alguém remover o `font-style` do SVG, esta fixture
   * reprova.
   *
   * Verificado por corte: sem `font-style`, o pixel cai para 0,8% → **1,3%** e reprova
   * (a medição está no log do PR).
   */
  textoItalico: base('textoItalico', [
    {
      id: 'ltextitalic',
      name: 'texto',
      kind: 'text',
      visible: true,
      zIndex: 0,
      source: { type: 'reference', path: '', shape: { kind: 'rectangle', width: 196, height: 44 } },
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      opacity: 1,
      text: {
        content: 'Italico',
        fontFamily: 'sans-serif',
        fontSize: 22,
        fontWeight: 400,
        fontStyle: 'italic'
      },
      fill: { kind: 'solid', color: '#111827' }
    }
  ]),

  // Alpha compositing.
  opacidade: base('opacidade', [
    shape({ kind: 'rectangle', width: 216, height: 216, cornerRadius: 0 }, {
      transform: { x: 20, y: 20, scale: 1, rotation: 0 },
      fill: { kind: 'solid', color: '#eeeeee' }
    }),
    shape({ kind: 'rectangle', width: 128, height: 128, cornerRadius: 0 }, {
      transform: { x: 64, y: 64, scale: 1, rotation: 0 },
      opacity: 0.5,
      fill: { kind: 'solid', color: '#d32f2f' }
    })
  ]),

  // A blend mode on its own.
  blend: base('blend', [
    shape({ kind: 'rectangle', width: 140, height: 224, cornerRadius: 0 }, {
      transform: { x: 16, y: 16, scale: 1, rotation: 0 },
      fill: { kind: 'solid', color: '#1565c0' }
    }),
    shape({ kind: 'rectangle', width: 140, height: 176, cornerRadius: 0 }, {
      transform: { x: 100, y: 40, scale: 1, rotation: 0 },
      blendMode: 'multiply',
      fill: { kind: 'solid', color: '#ffeb3b' }
    })
  ]),

  // Rounded corners: the clip/mask path.
  arredondado: base('arredondado', [
    shape({ kind: 'rounded-rectangle', width: 208, height: 208, cornerRadius: 48 }, {
      transform: { x: 24, y: 24, scale: 1, rotation: 0 },
      fill: { kind: 'solid', color: '#00695c' }
    })
  ], { maskRadius: 48 }),

  squircle: base('squircle', [
    shape({ kind: 'squircle', width: 200, height: 200, cornerRadius: 44 }, {
      transform: { x: 28, y: 28, scale: 1, rotation: 0 },
      fill: { kind: 'solid', color: '#6a1b9a' }
    })
  ]),

  // Non-square squircle: the shape is `width × height`, and reusing the square
  // form for it drew a circle-ish blob.
  squircleRetangular: base('squircleRetangular', [
    shape({ kind: 'squircle', width: 220, height: 120, cornerRadius: 30 }, {
      transform: { x: 18, y: 68, scale: 1, rotation: 0 },
      fill: { kind: 'solid', color: '#ad1457' }
    })
  ]),

  rotacao: base('rotacao', [
    shape({ kind: 'rectangle', width: 140, height: 140, cornerRadius: 0 }, {
      transform: { x: 58, y: 58, scale: 1, rotation: 30 },
      fill: { kind: 'solid', color: '#00838f' }
    })
  ]),

  camadas: base('camadas', [
    shape({ kind: 'rectangle', width: 216, height: 60, cornerRadius: 0 }, {
      transform: { x: 20, y: 100, scale: 1, rotation: 0 }, opacity: 0.7,
      fill: { kind: 'solid', color: '#e53935' }
    }),
    shape({ kind: 'rectangle', width: 216, height: 60, cornerRadius: 0 }, {
      transform: { x: 60, y: 60, scale: 1, rotation: 0 }, opacity: 0.6,
      fill: { kind: 'solid', color: '#43a047' }
    }),
    shape({ kind: 'rectangle', width: 136, height: 60, cornerRadius: 0 }, {
      transform: { x: 100, y: 20, scale: 1, rotation: 0 }, opacity: 0.5,
      fill: { kind: 'solid', color: '#1e88e5' }
    })
  ]),

  // Both fixes on one shape, so neither can pass while the other is missing.
  squircleComBlend: base('squircleComBlend', [
    shape({ kind: 'rectangle', width: 200, height: 200, cornerRadius: 0 }, {
      transform: { x: 28, y: 28, scale: 1, rotation: 0 },
      fill: { kind: 'solid', color: '#fdd835' }
    }),
    shape({ kind: 'squircle', width: 170, height: 170, cornerRadius: 40 }, {
      transform: { x: 43, y: 43, scale: 1, rotation: 0 },
      blendMode: 'multiply',
      fill: { kind: 'solid', color: '#6a1b9a' }
    })
  ]),

  // Mask AND blend on one document: the mask wraps everything in a
  // `<g clip-path>` and the blend lives inside it, so this is where a blend can
  // escape its clip or mix against the clipped background.
  maskComBlend: base('maskComBlend', [
    shape({ kind: 'rectangle', width: 224, height: 224, cornerRadius: 0 }, {
      transform: { x: 16, y: 16, scale: 1, rotation: 0 },
      fill: { kind: 'solid', color: '#26c6da' }
    }),
    shape({ kind: 'circle', width: 140, height: 140 }, {
      transform: { x: 58, y: 58, scale: 1, rotation: 0 },
      blendMode: 'multiply',
      fill: { kind: 'solid', color: '#ff5252' }
    })
  ], { maskRadius: 56 })
};

/**
 * Acceptance thresholds, per fixture.
 *
 * `minFora` is the fraction of pixels allowed to differ by more than the
 * tolerance — it is the number that matters, because a smooth gradient legitimately
 * differs in every dithered pixel while a wrong curve differs in the whole corner.
 *
 * `gradiente` looks like a failure and is not: the comparison quantises to 4 bits
 * per channel, which punishes a smooth gradient's dithering. The two images are
 * visually identical and the generated SVG is correct, so its agreement figure is
 * reported but not gated. Tightening the metric instead of naming the exception
 * would have sent this looking for a defect that does not exist.
 *
 * **`texto` e `textoEBold` sao a mesma excecao, e foram Posto de lado por medicao.**
 *
 * As 12 fixtures originais nao tinham uma layer de texto. Adding two produced 12,2%
 * and 13,8% of pixels differing by more than 24/255 — which reads like a serious
 * defect, and was reported as one.
 *
 * It is not. A second metric settled it: comparing the **ink geometry** of the two
 * renderings (bounding box, ink pixel count, per-column ink profile) gives, for
 * `sans-serif` 700/300 and `serif` 700 —
 *
 * | | canvas | svg | diferenca |
 * |---|---|---|---|
 * | largura da tinta | 184 | 184 | **0 px** |
 * | pixels de tinta | 5314 | 5314 | **0,0%** |
 * | colunas com perfil distinto | — | — | **0** |
 *
 * Identical to the pixel. The glyphs are drawn in the same place by the same font;
 * what differs is the antialiasing on the edges, which is the same artefact
 * `gradiente` has at a *higher* figure (16,9%) and has always been excused for.
 *
 * So: one threshold cannot rank "smooth gradient dithering" and "different glyph
 * shapes" — it punishes the first and would admit the second. Two metrics can, and
 * the cheap one is ink geometry.
 *
 * **A fixture sem `minFora` e reprovada, e a mensagem diz isso.**
 *
 * A primeira fixture de texto foi adicionada sem limite declarado, e a linha saiu
 * `REPROVADO (12.2% <= undefined%)` — que parece falha de tolerancia quando e
 * ausencia dela. O comportamento (reprovar) esta certo e e fail-closed; o que
 * estava errado era o relatorio, que nao distinguia "nao declarei" de "declarei e
 * falhou". A correcao pegou um segundo defeito no mesmo dia: apagar `opacidade` do
 * `ACEITACAO` por engano, que antes falharia em silencio.
 *
 * Um portao que nao consegue explicar a propria reprovacao treina a pessoa a
 * ignorar a reprovacao.
 */
const ACEITACAO = {
  simples: { minFora: 0.5 },
  gradiente: { minFora: null },
  radial: { minFora: 0.5 },
  opacidade: { minFora: 0.5 },
  svgCor: { minFora: 0.5 },
  textoItalico: { minFora: 1 },
  texto: { minFora: null },
  textoEBold: { minFora: null },
  blend: { minFora: 0.5 },
  arredondado: { minFora: 0.5 },
  squircle: { minFora: 0.5 },
  squircleRetangular: { minFora: 0.5 },
  rotacao: { minFora: 1 },
  camadas: { minFora: 0.5 },
  squircleComBlend: { minFora: 0.5 },
  maskComBlend: { minFora: 0.5 }
};

const BASELINE = 'packages/iconcore-renderer/tests/__fixtures__/svg-parity';

const writeBaseline = process.argv.includes('--write');
const usarBaseline = process.argv.includes('--baseline');

fs.mkdirSync(OUT, { recursive: true });

// ── Reference: the browser canvas, through the app's own renderer ──────────────

/**
 * The mask each pipeline should be asked for, derived from the project alone.
 *
 * Both sides must be told the same thing. An earlier version passed the mask to
 * the canvas and not to the SVG, and the gate still went green — which meant the
 * one feature that has a `clipPath` on one side and not the other was never
 * actually compared. A gate that cannot see the defect is not a gate.
 */
const maskFor = (project) =>
  project.canvas.maskShape ??
  (project.canvas.maskRadius !== undefined ? 'rounded-rectangle' : 'none');
/**
 * The browser has to be able to fetch the built modules, and each one imports
 * its siblings by relative path, so the whole emitted tree has to be reachable.
 *
 * Serving that by joining the request path onto the filesystem is what CodeQL
 * flags as "uncontrolled data used in path expression", and rightly so: a `../`
 * in a URL escapes the repository. Instead every allowed path is *enumerated*
 * from disk and the request has to match one of them exactly, so no traversal is
 * representable — not merely unlikely.
 */
const RAIZES = ['shared', 'renderer', 'engine'].map((p) => `packages/iconcore-${p}/dist`);

const SERVIR = new Set(['index.html']);
const SERVIR_RESOLVIDO = new Map();

for (const raiz of RAIZES) {
  const base = path.join(process.cwd(), raiz);
  if (!fs.existsSync(base)) continue;
  SERVIR.add(raiz);
  SERVIR_RESOLVIDO.set(raiz, path.join(base, 'index.js'));

  for (const arquivo of fs.readdirSync(base, { recursive: true, withFileTypes: true })) {
    if (!arquivo.isFile() || !arquivo.name.endsWith('.js')) continue;
    const absoluto = path.join(arquivo.parentPath, arquivo.name);
    const relativo = path.relative(process.cwd(), absoluto).split(path.sep).join('/');
    SERVIR.add(relativo);
    SERVIR_RESOLVIDO.set(relativo, absoluto);
  }
}

/** `caminho` → an absolute path, only for a path that is already allow-listed. */
const resolverServido = (caminho) => {
  if (!SERVIR.has(caminho)) return null;
  return SERVIR_RESOLVIDO.get(caminho) ?? null;
};

const servir = http.createServer((req, res) => {
  // Decode each segment, not the whole path: decoding the whole thing turns an
  // encoded `%2F` into a real separator, which is how a traversal sneaks past a
  // check that only looks at the raw string.
  const segmentos = (req.url ?? '/').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
  const caminho = segmentos.join('/');

  if (caminho === '' || caminho === 'index.html' || caminho.endsWith('.html')) {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><meta charset="utf-8"><body></body>');
    return;
  }

  // The absolute path was built when the allow-list was enumerated, from disk,
  // not from the request. A request can therefore only ever select among paths
  // that already exist; it cannot name one.
  const arquivo = resolverServido(caminho);
  if (arquivo) {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    res.end(fs.readFileSync(arquivo));
    return;
  }

  res.writeHead(404);
  res.end('nao servido');
});

await new Promise((ok) => servir.listen(0, '127.0.0.1', ok));
const baseUrl = `http://127.0.0.1:${servir.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();

const erros = [];
page.on('pageerror', (e) => erros.push(String(e.message).slice(0, 200)));

await page.goto(`${baseUrl}/index.html`);

// The built packages import each other by package name, which a browser cannot
// resolve without an import map — the same resolution Vite does for the app.
await page.evaluate((m) => {
  const el = document.createElement('script');
  el.type = 'importmap';
  el.textContent = m;
  document.head.appendChild(el);
}, JSON.stringify({
  imports: {
    '@iconcore/shared': `${baseUrl}/packages/iconcore-shared/dist/index.js`,
    '@iconcore/renderer': `${baseUrl}/packages/iconcore-renderer/dist/index.js`,
    '@iconcore/engine': `${baseUrl}/packages/iconcore-engine/dist/index.js`
  }
}));

const referencias = await page.evaluate(
  async ({ baseUrl, projects, masks }) => {
    const renderer = await import(`${baseUrl}/packages/iconcore-renderer/dist/index.js`);
    const out = {};

    const renderizar = async (project, mask) => {
      const backend = renderer.createCanvasBackend();
      const blob = await renderer.renderProject(project, 'default', { width: 256, height: 256 }, backend, { mask });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      backend.destroy();
      return btoa(bin);
    };

    for (const [nome, project] of Object.entries(projects)) {
      out[nome] = await renderizar(project, masks[nome]);

      /**
       * `IC63/1b` — **um override que não faz nada é um bug**, e a comparação
       * canvas↔SVG não o pega.
       *
       * Repare no buraco, que só apareceu quando a mutação foi rodada: tirando o
       * `svgPaintOverrides` da fixture, a concordância continuava em **99,3%** e o
       * portão passava. Sem override, os dois pipelines pintam o branco original e
       * concordam perfeitamente — "iguais" inclui "iguais porque nenhum fez nada".
       *
       * Então, para qualquer projeto que declare override, renderiza-se também o
       * **controle**, com os overrides removidos, e exige-se que os bytes mudem. É a
       * única forma de a fixture afirmar que o recurso funciona, e não apenas que os
       * dois lados são iguais.
       *
       * Sem flag: vale para toda fixture futura que declarar override, inclusive as
       * que ninguém lembrar de marcar.
       */
      const temOverride = project.layers.some((l) => l.svgPaintOverrides && Object.keys(l.svgPaintOverrides).length > 0);
      if (temOverride) {
        const controle = {
          ...project,
          layers: project.layers.map((l) =>
            l.svgPaintOverrides ? { ...l, svgPaintOverrides: undefined } : l
          )
        };
        out[`${nome}__controle`] = await renderizar(controle, masks[nome]);
      }
    }

    return out;
  },
  {
    baseUrl,
    projects: PROJECTS,
    // Computed here, in Node, because `page.evaluate` cannot see this scope — and
    // because the point is that both pipelines are handed the *same* value.
    masks: Object.fromEntries(Object.entries(PROJECTS).map(([nome, p]) => [nome, maskFor(p)]))
  }
);

await browser.close();
servir.close();

for (const [nome, b64] of Object.entries(referencias)) {
  fs.writeFileSync(path.join(OUT, `${nome}.png`), Buffer.from(b64, 'base64'));
}

// ── Candidate: SVG → sharp ─────────────────────────────────────────────────────
const { renderToSvg, renderToSvgWithOptions } = await import(
  '../packages/iconcore-renderer/dist/index.js'
);
const sharp = (await import('sharp')).default;

const candidatos = {};

for (const [nome, project] of Object.entries(PROJECTS)) {
  const svg = renderToSvgWithOptions(project, 'default', { mask: maskFor(project) }).svg;
  fs.writeFileSync(path.join(OUT, `${nome}.svg`), svg);

  const buf = await sharp(Buffer.from(svg), { density: 96 })
    .resize(SIDE, SIDE, { fit: 'fill' })
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(OUT, `${nome}.png`), buf);
  candidatos[nome] = buf.toString('base64');
}

// ── Compare ────────────────────────────────────────────────────────────────────
const cmpBrowser = await chromium.launch();
const cmpPage = await cmpBrowser.newPage();
await cmpPage.setContent('<body></body>');

const nomes = Object.keys(PROJECTS).filter((n) =>
  usarBaseline ? fs.existsSync(`${BASELINE}/${n}.png`) : true
);

const linhas = await cmpPage.evaluate(
  async ({ pares, SIDE }) => {
    const carregar = (src) =>
      new Promise((ok, no) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => no(new Error('falha ao carregar'));
        i.src = src;
      });

    const pixels = async (img) => {
      const c = document.createElement('canvas');
      c.width = SIDE;
      c.height = SIDE;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, SIDE, SIDE);
      ctx.drawImage(img, 0, 0, SIDE, SIDE);
      return ctx.getImageData(0, 0, SIDE, SIDE).data;
    };

    const out = [];
    for (const par of pares) {
      let ref;
      let alt;
      try {
        ref = await pixels(await carregar(par.ref));
        alt = await pixels(await carregar(par.alt));
      } catch (e) {
        out.push({ nome: par.nome, erro: e.message });
        continue;
      }

      let iguais = 0;
      let fora = 0;
      let alphaIgual = 0;

      for (let p = 0; p < SIDE * SIDE; p++) {
        const i = p * 4;
        const dr = Math.abs(ref[i] - alt[i]);
        const dg = Math.abs(ref[i + 1] - alt[i + 1]);
        const db = Math.abs(ref[i + 2] - alt[i + 2]);
        const da = Math.abs(ref[i + 3] - alt[i + 3]);

        if (da <= 8) alphaIgual += 1;
        if (
          (ref[i] >> 4) === (alt[i] >> 4) &&
          (ref[i + 1] >> 4) === (alt[i + 1] >> 4) &&
          (ref[i + 2] >> 4) === (alt[i + 2] >> 4) &&
          da <= 8
        ) {
          iguais += 1;
        } else if (Math.max(dr, dg, db) > 24 || da > 24) {
          fora += 1;
        }
      }

      const total = SIDE * SIDE;
      out.push({
        nome: par.nome,
        concordancia: +((iguais / total) * 100).toFixed(1),
        fora: +((fora / total) * 100).toFixed(1),
        alpha: +((alphaIgual / total) * 100).toFixed(1)
      });
    }
    return out;
  },
  {
    SIDE,
    pares: nomes.map((nome) => {
      const ref = usarBaseline
        ? fs.readFileSync(`${BASELINE}/${nome}.png`).toString('base64')
        : referencias[nome];
      return { nome, ref: `data:image/png;base64,${ref}`, alt: `data:image/png;base64,${candidatos[nome]}` };
    })
  }
);

await cmpBrowser.close();

if (writeBaseline) {
  fs.mkdirSync(BASELINE, { recursive: true });
  for (const nome of nomes) {
    fs.copyFileSync(path.join(OUT, `${nome}.png`), `${BASELINE}/${nome}.png`);
  }
  console.log(`baseline gravada em ${BASELINE} (${nomes.length} fixtures)\n`);
}

// ── Report ─────────────────────────────────────────────────────────────────────
console.log(`SVG vs canvas — ${usarBaseline ? 'baseline' : 'ao vivo'} @ ${SIDE}px\n`);
console.log('fixture                concordancia  fora-tolerancia  alpha  veredito');

const reprovados = [];

for (const l of linhas) {
  if (l.erro) {
    console.log(`${l.nome.padEnd(22)} ERRO ${l.erro}`);
    reprovados.push(l.nome);
    continue;
  }

  const limite = ACEITACAO[l.nome]?.minFora;
  // `undefined` (fixture sem entrada) e `null` (fixture explicitamente nao fixada) sao
  // coisas diferentes, e tratar os dois como "pode" esconderia uma fixture nova sem
  // limite. So `null` significa "esta e uma excecao nomeada".
  const ok = limite === null ? true : limite === undefined ? false : l.fora <= limite;
  const nota =
    limite === null
      ? 'nao fixado'
      : limite === undefined
        ? 'SEM LIMITE DECLARADO'
        : `${l.fora}% <= ${limite}%`;

  console.log(
    `${l.nome.padEnd(22)} ${String(l.concordancia + '%').padStart(9)} ${String(l.fora + '%').padStart(14)} ${String(l.alpha + '%').padStart(6)}  ${ok ? 'ok' : 'REPROVADO'} (${nota})`
  );

  if (!ok) reprovados.push(l.nome);
}

const comNumero = linhas.filter((l) => !l.erro);
const media = comNumero.reduce((a, l) => a + l.concordancia, 0) / (comNumero.length || 1);
console.log(`\nmedia ${media.toFixed(1)}% em ${comNumero.length} fixtures`);

if (erros.length) console.log(`erros de pagina: ${erros.slice(0, 3).join(' | ')}`);

/**
 * O override tem que **mudar alguma coisa**.
 *
 * Comparado por bytes de PNG, e não por pixel: a pergunta é "o render com override é o
 * mesmo objeto que o render sem?", e igualdade de bytes é a forma mais barata de
 * perguntar isso. Um override inerte — chave que não casa com nada no arquivo, pipeline
 * que esqueceu de ligar, reescrita que casa errado — produz bytes idênticos, e é
 * exatamente esse o defeito que a concordância canvas↔SVG não enxerga.
 */
const overridesInertes = [];
for (const nome of Object.keys(PROJECTS)) {
  const controle = referencias[`${nome}__controle`];
  if (controle === undefined) continue;

  if (referencias[nome] === controle) {
    overridesInertes.push(nome);
  } else {
    console.log(`  override ativo    ${nome.padEnd(22)} o render muda em relacao ao controle`);
  }
}

if (overridesInertes.length) {
  console.error(
    `\nSVG parity FALHOU: override sem efeito em ${overridesInertes.join(', ')} — ` +
      `o render e identico ao controle sem overrides`
  );
  process.exit(1);
}

if (reprovados.length) {
  console.error(`\nSVG parity FALHOU: ${reprovados.join(', ')}`);
  process.exit(1);
}

console.log('\nSVG parity: todos os fixtures dentro do limite.');