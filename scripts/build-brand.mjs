#!/usr/bin/env node
/**
 * Deriva a marca a partir de `assets/brand/`.
 *
 * ```bash
 * node scripts/build-brand.mjs           # gera os derivados
 * node scripts/build-brand.mjs --check   # reprova se a copia estiver desatualizada
 * ```
 *
 * ## Por que este script existe
 *
 * A mesma arte estava em dois lugares, copiada à mão, sem nenhum portão comparando os dois
 * lados — e uma **terceira** cópia em `docs/images/releases/`, onde o nome canônico
 * (`release.webp`) apontava para a arte **antiga** enquanto a arte nova se chamava
 * `release-new.webp` e não era consumida por nada. O site servia uma, a release do GitHub
 * mostrava outra, e nenhuma das duas era a fonte.
 *
 * Ver `scripts/check-brand.mjs` para o mapa completo e o `--check`.
 *
 * ## Por que os derivados são versionados, e não gerados no build
 *
 * Porque `apps/promo/public/` e `apps/web/public/` são servidos **estáticos** — o Vite
 * copia a pasta `public/` para `dist/` sem processar. Um `prebuild` que copiasse a arte
 * funcionaria localmente e quebraria no Pages, que assembleia os artefatos sem passar pelo
 * hook. E a release do GitHub lê `docs/images/releases/release.webp` direto do repositório,
 * num job que não roda npm.
 *
 * Então a cópia é commitada, e o que garante que ela não diverge é o portão. É a mesma
 * troca que o `--check` faz no tele-code: em vez de confiar em memória, um comando compara.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
/**
 * As fontes: mesma regra, outra fonte. `assets/fonts/` e o fonte; `apps/web/src/fonts/` e o
 * derivado, porque e dentro de `src/` que o Vite resolve e hasheia o `url()`.
 *
 * O porque de `src/` e nao `public/` esta no comentario longo de `check-brand.mjs`: as duas
 * alternativas falham em silencio — o `url()` relativo sai da raiz do Vite e da 404, e um
 * caminho absoluto em `public/` nao respeita a base `/icon-core/app/`.
 */
const FONTES = {
  'CalSans-Regular.woff2': ['apps/web/src/fonts/CalSans-Regular.woff2'],
  'CalSans-Bold.woff2': ['apps/web/src/fonts/CalSans-Bold.woff2']
};

const DERIVADOS = {
  'logo.svg': [
    'apps/promo/public/branding/logo.svg',
    'apps/web/public/branding/logo.svg'
  ],
  'release.webp': [
    'apps/promo/public/branding/release.webp',
    'apps/web/public/branding/release.webp',
    'docs/images/releases/release.webp'
  ],
  ...FONTES
};

const CHECK_ONLY = process.argv.includes('--check');
const sha256 = (abs) => crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');

/** O caminho absoluto da fonte de um derivado: arte em `assets/brand/`, fonte em `assets/fonts/`. */
const fonteDe = (nome) =>
  path.join(rootDir, nome.endsWith('.woff2') ? 'assets/fonts' : 'assets/brand', nome);

const faltando = Object.keys(DERIVADOS).filter((n) => !fs.existsSync(fonteDe(n)));
if (faltando.length) {
  console.error(
    `Brand source incomplete:\n${faltando.map((n) => `  - ${fonteDe(n).replace(rootDir + path.sep, '')}`).join('\n')}`
  );
  process.exit(1);
}

const copiados = [];
const igualados = [];

for (const [nome, destinos] of Object.entries(DERIVADOS)) {
  const abs = fonteDe(nome);
  const hash = sha256(abs);
  for (const dest of destinos) {
    const destAbs = path.join(rootDir, dest);
    const atual = fs.existsSync(destAbs) ? sha256(destAbs) : null;
    if (atual === hash) {
      igualados.push(dest);
      continue;
    }
    if (CHECK_ONLY) {
      copiados.push(`${dest} (DIVERGE — rode sem --check)`);
      continue;
    }
    fs.mkdirSync(path.dirname(destAbs), { recursive: true });
    fs.copyFileSync(abs, destAbs);
    copiados.push(dest);
  }
}

if (CHECK_ONLY) {
  if (copiados.length) {
    console.error(`\nBrand build --check FAILED:\n${copiados.map((c) => `  - ${c}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`Brand build --check OK: ${igualados.length} derived file(s) match the source.`);
  process.exit(0);
}

console.log(`Brand: ${copiados.length} written, ${igualados.length} already current.\n`);
for (const c of copiados) console.log(`  wrote ${c}`);
console.log('');
