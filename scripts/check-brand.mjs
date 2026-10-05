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

const FONTE = path.join(rootDir, 'assets', 'brand');

/**
 * A fonte, e onde cada arquivo vai.
 *
 * Os nomes do derivado são **fixos** e a tabela é a tradução. O motivo de a tabela existir
 * é o mesmo do tele-code: a frota tinha dois nomes para a mesma arte (`release.webp` e
 * `release-new.webp`), e nome duplicado éxxx custo até alguém usar o errado — que foi
 * o que a release fez.
 */
const DERIVADOS = {
  'logo.svg': [
    'apps/promo/public/branding/logo.svg',
    'apps/web/public/branding/logo.svg'
  ],
  'release.webp': [
    'apps/promo/public/branding/release.webp',
    'apps/web/public/branding/release.webp',
    // Consumido por `.github/release.config.json` → a imagem da release no GitHub.
    'docs/images/releases/release.webp'
  ]
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

const fonteExiste = (nome) => fs.existsSync(path.join(FONTE, nome));

for (const [nome, destinos] of Object.entries(DERIVADOS)) {
  const fonteRel = path.join('assets', 'brand', nome).split(path.sep).join('/');

  if (!fonteExiste(nome)) {
    failures.push(`fonte ausente: assets/brand/${nome}`);
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
        `${dest}: DIVERGE da fonte assets/brand/${nome}\n` +
          `          fonte     ${hashFonte.slice(0, 12)}\n` +
          `          derivado  ${hashDest.slice(0, 12)}\n` +
          `          rode "node scripts/build-brand.mjs"`
      );
    } else {
      notes.push(`OK   ${dest} == assets/brand/${nome} (${hashFonte.slice(0, 12)})`);
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
