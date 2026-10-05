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
const FONTE = path.join(rootDir, 'assets', 'brand');

const DERIVADOS = {
  'logo.svg': [
    'apps/promo/public/branding/logo.svg',
    'apps/web/public/branding/logo.svg'
  ],
  'release.webp': [
    'apps/promo/public/branding/release.webp',
    'apps/web/public/branding/release.webp',
    'docs/images/releases/release.webp'
  ]
};

const CHECK_ONLY = process.argv.includes('--check');
const sha256 = (abs) => crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');

const faltando = Object.keys(DERIVADOS).filter(
  (n) => !fs.existsSync(path.join(FONTE, n))
);
if (faltando.length) {
  console.error(
    `Brand source incomplete. Missing in assets/brand/:\n${faltando.map((n) => `  - ${n}`).join('\n')}`
  );
  process.exit(1);
}

if (!fs.existsSync(FONTE)) {
  console.error(`Brand source directory not found: ${path.relative(rootDir, FONTE)}`);
  process.exit(1);
}

const copiados = [];
const igualados = [];

for (const [nome, destinos] of Object.entries(DERIVADOS)) {
  const abs = path.join(FONTE, nome);
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
