/**
 * Gera `assets/brand/release.webp` a partir do template do projeto
 * (`assets/brand/release-art.iconcore.json`), com o motor Canvas do app
 * hospedado num Chromium headless — `ADR-017`.
 *
 * ## Por que assim, e não desenhando à mão
 *
 * A imagem da release era um PNG composto à mão e commitado. Isso tem dois
 * defeitos: ninguém consegue reproduzi-lo, e nada compara o que ele mostra com
 * a identidade que o site serve. Aqui a arte é **derivada de um template**: o
 * documento `release-art.iconcore.json` é o desenho (abre no próprio studio, é
 * diffável), e este script o rasteriza pelo caminho do `ADR-017`:
 *
 * 1. o `dist/` dos pacotes é servido por HTTP local (o mesmo allow-list de
 *    `check-svg-parity.mjs`);
 * 2. a página importa o `renderer` compilado e roda `renderProject` com
 *    `createCanvasBackend` — **exatamente o código do app**, sem segundo motor;
 * 3. o WebP sai de `canvas.toBlob('image/webp')` **dentro da página**; não há
 *    `sharp` nem conversão PNG→WebP.
 *
 * O que o script NÃO faz: copiar para os derivados. Isso é `build-brand.mjs`
 * (a ordem é: `--from-template` gera a fonte, `build-brand` copia, `check-brand`
 * confere).
 *
 * ## A convenção do template, e por quê
 *
 * Uma layer `inline` com `mimeType: "image/svg+xml"` e `path` (sem `data`) é
 * resolvida **na hora do render** contra `assets/brand/`. O template referencia
 * `logo-light.svg` pelo nome e nunca carrega uma cópia embutida: era assim que a
 * fonte e a arte podiam divergir em silêncio, a doença que o `check-brand.mjs`
 * existe para encerrar.
 *
 * ## Pré-requisito
 *
 * `npm run build:packages` antes de rodar — o harness serve `dist/`.
 *
 * Uso (via build-brand, que é a interface documentada):
 *   node scripts/build-brand.mjs --from-template
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const TEMPLATE = 'assets/brand/release-art.iconcore.json';
const OUT = 'assets/brand/release.webp';

/**
 * Onde o template mora e de onde ele resolve `path` das layers inline.
 *
 * Fonte única: `assets/brand/` — o mesmo diretório que `build-brand.mjs` trata
 * como a fonte versionada. Um template que apontasse para fora daqui
 * recriaria a pergunta "qual das duas é a fonte?".
 */
const BRAND_DIR = 'assets/brand';

/** O renderizador precisa do pacote compilado; o erro aponta o conserto. */
const exigirDist = (rel) => {
  const abs = path.join(rootDir, rel);
  if (!fs.existsSync(abs)) {
    throw new Error(
      `Falta ${rel} — rode "npm run build:packages" antes (o harness hospeda o renderer compilado, por ADR-017).`
    );
  }
  return abs;
};

/**
 * As raízes servidas por HTTP, enumeradas do disco.
 *
 * O mesmo desenho do `check-svg-parity.mjs`, e pelo mesmo motivo: servir por
 * junção de caminho cru com a URL é traversal; a allow-list enumerada torna
 * traversal inexpressável. Fontes entram aqui porque o render de texto precisa
 * da fonte **embarcada** (fonte do sistema é proibida — determinismo).
 */
const RAIZES = [
  'packages/iconcore-shared/dist',
  'packages/iconcore-renderer/dist',
  'packages/iconcore-engine/dist',
  'assets/fonts'
].map((rel) => exigirDist(rel));

const MIME = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.woff2': 'font/woff2'
};

/** As famílias que o template pode usar — embarcadas, nunca do sistema. */
const FONTES = [
  ['Cal Sans', 400, 'CalSans-Regular.woff2'],
  ['Cal Sans', 700, 'CalSans-Bold.woff2'],
  ['Manrope', 400, 'Manrope-Regular.woff2'],
  ['Manrope', 500, 'Manrope-Medium.woff2'],
  ['Manrope', 600, 'Manrope-SemiBold.woff2'],
  ['Manrope', 700, 'Manrope-Bold.woff2']
];

/**
 * Resolve as layers `inline` de SVG contra `assets/brand/`.
 *
 * O contrato: `type: 'inline'`, `mimeType: 'image/svg+xml'`, `path` preenchido
 * e `data` ausente. Qualquer outra combinação é usada como está — o renderer
 * aceita `data` embutido, e o dia em que o studio re-exportar o template é ele
 * que vai gravar `data` (aí a resolução deixa de acontecer e o README avisa).
 */
const resolverLayers = (project) => {
  const resolvidas = [];
  const layers = project.layers.map((layer) => {
    const src = layer.source;
    if (src && src.type === 'inline' && src.mimeType === 'image/svg+xml' && src.path && !src.data) {
      const abs = path.join(rootDir, BRAND_DIR, src.path);
      if (!fs.existsSync(abs)) {
        throw new Error(`layer "${layer.name}" aponta para ${BRAND_DIR}/${src.path}, que não existe.`);
      }
      resolvidas.push(`${layer.name} <- ${BRAND_DIR}/${src.path}`);
      return { ...layer, source: { ...src, data: fs.readFileSync(abs).toString('base64') } };
    }
    return layer;
  });
  return { project: { ...project, layers }, resolvidas };
};

const servir = (permitidos, html) => {
  const server = http.createServer((req, res) => {
    if ((req.url ?? '/').split('?')[0] === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html());
      return;
    }
    const caminho = (req.url ?? '/')
      .split('?')[0]
      .split('/')
      .filter(Boolean)
      .map(decodeURIComponent)
      .join('/');
    const abs = permitidos.get(caminho);
    if (!abs) {
      res.writeHead(404);
      res.end('nao servido');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(abs)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(abs));
  });
  return server;
};

export const renderReleaseArt = async () => {
  const templatePath = path.join(rootDir, TEMPLATE);
  const bruto = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  const { project, resolvidas } = resolverLayers(bruto);

  const largura = project.canvas.size;
  const altura = project.canvas.height ?? project.canvas.size;
  const qualidade = project.exportProfile?.quality ?? 0.92;

  // Allow-list: cada arquivo é enumerado do disco e a URL só escolhe entre os
  // que já existem; nada na requisição vira caminho.
  const permitidos = new Map();
  for (const raiz of RAIZES) {
    for (const arquivo of fs.readdirSync(raiz, { recursive: true, withFileTypes: true })) {
      if (!arquivo.isFile()) continue;
      const absoluto = path.join(arquivo.parentPath, arquivo.name);
      const relativo = path.relative(rootDir, absoluto).split(path.sep).join('/');
      permitidos.set(relativo, absoluto);
    }
  }

  const server = servir(permitidos, () => paginaHtml);
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  /**
   * A página é **servida** pelo próprio servidor, e não montada com
   * `page.setContent`: um `setContent` deixa a página em `about:blank`, e de uma
   * origem opaca o `import()` do módulo é cross-origin — o fetch morre com
   * `NetworkError`. Servindo `index.html` na mesma origem das fontes e do
   * renderer, tudo é same-origin como no harness do `check-svg-parity`.
   */
  const paginaHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${FONTES.map(
    ([familia, peso, arquivo]) =>
      `@font-face{font-family:'${familia}';font-style:normal;font-weight:${peso};font-display:block;src:url('/assets/fonts/${arquivo}') format('woff2');}`
  ).join('\n')}</style><script type="importmap">${JSON.stringify({
    imports: {
      '@iconcore/shared': '/packages/iconcore-shared/dist/index.js',
      '@iconcore/renderer': '/packages/iconcore-renderer/dist/index.js',
      '@iconcore/engine': '/packages/iconcore-engine/dist/index.js'
    }
  })}</script></head><body></body></html>`;

  const { chromium } = await import('playwright');
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e.message).slice(0, 300)));
    page.on('console', (m) => {
      if (m.type() === 'error') erros.push(m.text().slice(0, 300));
    });

    await page.goto(`${baseUrl}/index.html`);

    const resultado = await page.evaluate(
      async ({ baseUrl, project, largura, altura, qualidade, familias }) => {
        // A fonte precisa estar carregada ANTES do fillText — um fallback
        // silencioso produziria a arte errada sem erro nenhum.
        for (const [familia, peso, tamanho] of familias) {
          await document.fonts.load(`${peso} ${tamanho}px "${familia}"`);
        }
        await document.fonts.ready;

        const renderer = await import(`${baseUrl}/packages/iconcore-renderer/dist/index.js`);
        const backend = renderer.createCanvasBackend();
        try {
          const blob = await renderer.renderProject(
            project,
            'default',
            { width: largura, height: altura },
            backend,
            { format: 'webp', quality: qualidade }
          );
          const bytes = new Uint8Array(await blob.arrayBuffer());
          let bin = '';
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
          return { type: blob.type, png: btoa(bin), fontes: [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`) };
        } finally {
          backend.destroy();
        }
      },
      {
        baseUrl,
        project,
        largura,
        altura,
        qualidade,
        familias: [...new Set(project.layers.filter((l) => l.text).map((l) => [l.text.fontFamily.replace(/^["']|["']$/g, ''), l.text.fontWeight, l.text.fontSize]))]
      }
    );

    if (resultado.type !== 'image/webp') {
      throw new Error(`o encode saiu como ${resultado.type}, não image/webp`);
    }
    const bytes = Buffer.from(resultado.png, 'base64');
    const outAbs = path.join(rootDir, OUT);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, bytes);

    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    console.log(`release-art: ${OUT} escrito (${bytes.length} bytes, sha256 ${hash.slice(0, 12)})`);
    console.log(`  template ${TEMPLATE} @ ${largura}x${altura}, webp q=${qualidade}`);
    for (const r of resolvidas) console.log(`  resolvido ${r}`);
    const fontesUsadas = resultado.fontes.filter((f) => f.includes('loaded')).slice(0, 6);
    if (fontesUsadas.length) console.log(`  fontes carregadas: ${fontesUsadas.join(', ')}`);
    if (erros.length) console.warn(`  avisos de página: ${erros.slice(0, 3).join(' | ')}`);

    return { bytes: bytes.length, hash };
  } finally {
    await browser.close();
    server.close();
  }
};

export { TEMPLATE, OUT };
