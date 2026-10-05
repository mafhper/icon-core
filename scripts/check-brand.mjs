#!/usr/bin/env node
/**
 * Portão da marca: uma fonte, derivados por comando.
 *
 * ## O problema que este arquivo existe para encerrar
 *
 * A mesma arte estava em **dois lugares**, copiada à mão:
 *
 * ```
 * apps/promo/public/branding/{logo.svg, banner.svg, release.webp}
 * apps/web/public/branding/{logo.svg, banner.svg, release.webp}
 * ```
 *
 * (Havia um `banner.svg` em cada lado. O levantamento achou **zero consumidores** — nenhum
 * `index.html`, nenhum `*.tsx`, nenhum config — entao foi para
 * `assets/archive/public-unused/banner.svg`, com o sha256 registrado no README dali. Ver
 * `scripts/inventory-images.mjs`, que e o levantamento.)
 *
 * Os seis arquivos eram byte-idênticos (sha256 igual) e **nada comparava os dois lados**.
 * Duas cópias feitas à mão, sem portão entre elas, é a DD-N48: dois arquivos que existem e
 * que ninguém compara.
 *
 * E a segunda pior parte: havia um **quarto** `release.webp` em
 * `docs/images/releases/`, em duas variantes —
 *
 * | arquivo | sha256 (12) | quem consome |
 * |---|---|---|
 * | os dois `branding/release.webp` | `5f78b11f048e` | o site (web e promo) |
 * | `docs/images/releases/release-new.webp` | `5f78b11f048e` | **ninguém** |
 * | `docs/images/releases/release.webp` | `1f4ee124cf5e` | **a imagem da release** |
 *
 * O nome `-new` era a pista: a arte nova era a que o site servia, e a imagem da release
 * (`release.config.json`, `required: true`) continuava na antiga. **O site e a release
 * mostravam artes diferentes**, e nenhuma das duas era a fonte — eram as duas cópias.
 *
 * ## A regra
 *
 * ```
 * assets/brand/     FONTE, versionada, editada a mao
 *        │
 *        └─ scripts/build-brand.mjs  ──>  os derivados abaixo
 *
 * apps/promo/public/branding/*   cópia
 * apps/web/public/branding/*     cópia
 * docs/images/releases/release.webp   cópia
 * ```
 *
 * Editar um derivado é um erro que o `--check` reprova, e `build-brand.mjs` conserta.
 * É a mesma regra do `assets/brand/` do tele-code, no formato deste repositório
 * (`scripts/check-*.mjs`, como os outros cinco portões).
 *
 * ## Por que SVG e `.webp` juntos, e não só SVG
 *
 * Porque a fonte precisa servir dois consumidores com requisitos opostos: `<link
 * rel="icon">` em `index.html` aceita SVG, e o GitHub numa release mostra **raster** —
 * o Release Core não renderiza SVG. São as mesmas duas restrições que o `README` do
 * tele-code registra, e a resposta é a mesma: os dois formatos, com um derivado de cada.
 *
 * ## O `--check` é o portão, e ele compara **conteúdo**
 *
 * Não é uma lista de arquivos que "tem que existir": é um SHA-256 de cada par
 * fonte/derivado. Um derivado apagado, renomeado, ou com um byte a menos reprova.
 *
 * Run in CI: node scripts/check-brand.mjs
 * Consertar: node scripts/build-brand.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

/**
 * O caminho da fonte de um derivado: arte em `assets/brand/`, fonte em `assets/fonts/`.
 *
 * Uma funcao e nao uma constante porque sao **duas** pastas de fonte. Deixar uma constante
 * `FONTE = assets/brand` seria ler as fontes do lugar errado — e o portao acusaria "fonte
 * ausente" para um arquivo que existe.
 */
const fonteDe = (nome) =>
  path.join(rootDir, nome.endsWith('.woff2') ? 'assets/fonts' : 'assets/brand', nome);

const fonteExiste = (nome) => fs.existsSync(fonteDe(nome));

/**
 * A fonte, e onde cada arquivo vai.
 *
 * Os nomes do derivado são **fixos** e a tabela é a tradução. O motivo de a tabela existir
 * é o mesmo do tele-code: a frota tinha dois nomes para a mesma arte (`release.webp` e
 * `release-new.webp`), e nome duplicado éxxx custo até alguém usar o errado — que foi
 * o que a release fez.
 */
/**
 * As fontes: mesma regra, outra fonte. Fonte em `assets/fonts/`, derivados dentro do `src/`
 * de cada app, e o mesmo portao comparando por SHA-256.
 *
 * Por que o derivado vai para dentro de `src/`, e nao para `public/` — porque e isso que faz
 * o Vite funcionar, e as duas alternativas **falham em silencio**:
 *
 * - `url('../../assets/fonts/...')` a partir de `apps/web/src/index.css` sai da raiz do
 *   projeto Vite. O build avisa "didn't resolve at build time" e emite o caminho literal no
 *   CSS; do `dist/assets/`, esse caminho relativo da 404. O `@font-face` fica no CSS e a
 *   fonte nunca carrega.
 * - `public/` tambem nao serve: o app e servido em `/icon-core/app/`, e um `/fonts/...`
 *   absoluto nao respeita a base.
 *
 * Dentro de `src/` o Vite resolve, hasheia e respeita `base`. E o build emite
 * `dist/assets/CalSans-Regular-Dm1Envc1.woff2`, que e o que a pagina precisa.
 *
 * A letra `w` de `woff2` e o que separa as duas tabelas: a fonte mora em `assets/fonts/`, e
 * a arte em `assets/brand/`. Um mapa so, porque duas tabelas divergem na primeira fonte nova.
 */
const FONTES = {
  'CalSans-Regular.woff2': ['apps/web/src/fonts/CalSans-Regular.woff2'],
  'CalSans-Bold.woff2': ['apps/web/src/fonts/CalSans-Bold.woff2']
};

/** Todas as derivadas: arte e fonte, com o mesmo contrato de SHA-256. */
const DERIVADOS = {
  ...{
    'logo.svg': [
      'apps/promo/public/branding/logo.svg',
      'apps/web/public/branding/logo.svg'
    ],
    'release.webp': [
      'apps/promo/public/branding/release.webp',
      'apps/web/public/branding/release.webp',
      // Consumido por `.github/release.config.json` -> a imagem da release no GitHub.
      'docs/images/releases/release.webp'
    ]
  },
  ...FONTES
};

/** Arquivos que **eram** duplicatas e nao devem voltar. */
const PROIBIDOS = [
  // A arte nova virou a fonte; o nome "-new" nao significa mais nada e apontava para
  // um arquivo orfao de 53 KB.
  'docs/images/releases/release-new.webp'
];

const sha256 = (rel) =>
  crypto.createHash('sha256').update(fs.readFileSync(path.join(rootDir, rel))).digest('hex');

const failures = [];
const notes = [];

for (const [nome, destinos] of Object.entries(DERIVADOS)) {
  const fonteRel = path.relative(rootDir, fonteDe(nome)).split(path.sep).join('/');

  if (!fonteExiste(nome)) {
    failures.push(`fonte ausente: ${path.relative(rootDir, fonteDe(nome)).split(path.sep).join('/')}`);
    continue;
  }
  const hashFonte = sha256(fonteRel);

  for (const dest of destinos) {
    const destAbs = path.join(rootDir, dest);
    if (!fs.existsSync(destAbs)) {
      failures.push(`${dest}: ausente (rode "node scripts/build-brand.mjs")`);
      continue;
    }
    const hashDest = sha256(dest);
    if (hashDest !== hashFonte) {
      failures.push(
        `${dest}: DIVERGE da fonte ${fonteRel}\n` +
          `          fonte     ${hashFonte.slice(0, 12)}\n` +
          `          derivado  ${hashDest.slice(0, 12)}\n` +
          `          rode "node scripts/build-brand.mjs"`
      );
    } else {
      notes.push(`OK   ${dest} == ${fonteRel} (${hashFonte.slice(0, 12)})`);
    }
  }
}

for (const proibido of PROIBIDOS) {
  if (fs.existsSync(path.join(rootDir, proibido))) {
    failures.push(
      `${proibido}: este arquivo era uma copia manual e voltou. ` +
        `A fonte e assets/brand/ — apague este arquivo.`
    );
  }
}

// Nenhum outro derived pode existir: um `branding/` novo com um quarto nome e a mesma
// doenca do "release-new", recomeçando.
for (const app of ['apps/promo/public/branding', 'apps/web/public/branding']) {
  const dir = path.join(rootDir, app);
  if (!fs.existsSync(dir)) continue;
  const esperados = DERIVADOS[
    Object.keys(DERIVADOS).find((k) => DERIVADOS[k].includes(`${app}/${path.basename(app)}`)) ?? ''
  ];
  for (const entrada of fs.readdirSync(dir)) {
    const rel = `${app}/${entrada}`;
    const conhecido = Object.values(DERIVADOS).flat().includes(rel);
    if (!conhecido) {
      failures.push(
        `${rel}: arquivo inesperado em um diretorio de derivados.\n` +
          `          Se e arte nova, ponha a FONTE em assets/brand/ e declare aqui.`
      );
    }
  }
  void esperados;
}

if (failures.length) {
  console.error('\nBrand guard FAILED:\n');
  for (const f of failures) console.error(`  - ${f}`);
  console.error('');
  process.exit(1);
}

console.log('Brand guard OK: uma fonte, derivados conferidos por conteudo.\n');
for (const n of notes) console.log(`  ${n}`);
console.log('');
