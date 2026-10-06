import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const rawVersion = process.argv[2];
if (!rawVersion) {
  console.error('usage: node scripts/release-bump.mjs <version>');
  process.exit(1);
}
const version = rawVersion.replace(/^v/, '');
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`invalid version: ${rawVersion} (expected e.g. 1.3.1)`);
  process.exit(1);
}

const jsonFiles = [
  'package.json',
  'apps/web/package.json',
  'apps/promo/package.json',
  'apps/desktop/package.json',
  'apps/desktop/src-tauri/tauri.conf.json',
];

for (const rel of jsonFiles) {
  const file = join(repoRoot, rel);
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  const before = pkg.version;
  if (before === version) {
    console.log(`skip  ${rel} (already ${version})`);
    continue;
  }
  pkg.version = version;
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`set   ${rel}: ${before} -> ${version}`);
}

const cargoTomlPath = join(repoRoot, 'apps/desktop/src-tauri/Cargo.toml');
const cargoToml = readFileSync(cargoTomlPath, 'utf8');
const cargoTomlNext = cargoToml.replace(
  /^(version = ")\d+\.\d+\.\d+(")$/m,
  (_match, p1, p2) => `${p1}${version}${p2}`,
);
if (cargoTomlNext !== cargoToml) {
  writeFileSync(cargoTomlPath, cargoTomlNext);
  console.log(`set   apps/desktop/src-tauri/Cargo.toml: -> ${version}`);
} else {
  console.log(`skip  apps/desktop/src-tauri/Cargo.toml (version not found)`);
}

const cargoLockPath = join(repoRoot, 'apps/desktop/src-tauri/Cargo.lock');
const cargoLock = readFileSync(cargoLockPath, 'utf8');
const lines = cargoLock.split('\n');
let inIconcorePackage = false;
let found = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line === '[[package]]') {
    inIconcorePackage = false;
    continue;
  }
  if (line.startsWith('name = "') && line.includes('iconcore-desktop')) {
    inIconcorePackage = true;
    continue;
  }
  if (inIconcorePackage && /^version = "\d+\.\d+\.\d+"$/.test(line)) {
    lines[i] = `version = "${version}"`;
    found = true;
    inIconcorePackage = false;
  }
}
if (found) {
  writeFileSync(cargoLockPath, lines.join('\n'));
  console.log(`set   apps/desktop/src-tauri/Cargo.lock: -> ${version}`);
} else {
  console.log(`skip  apps/desktop/src-tauri/Cargo.lock (package not found)`);
}

/**
 * `package-lock.json` — a versão do workspace, que o npm guarda aqui também.
 *
 * ## Por que isto existe (`IC-N44`)
 *
 * Sem este bloco o lockfile ficava **mentindo a versão** depois de um bump: em
 * 2026-10-06 ele ainda dizia `1.6.0` depois do bump para `1.7.0`, e o único motivo
 * de ter sido corrigido foi um `npm install` de passagem. Não reprova o `npm ci` —
 * o campo é metadado, não contrato — então **nenhum portão acusava**, e quem lesse
 * o lockfile (auditoria, ferramenta que cruza com o `package.json`, diff de release)
 * via `1.7.0` num lado e `1.6.0` no outro.
 *
 * ## Edição cirúrgica, e não `npm install --package-lock-only`
 *
 * Um install re-resolveria a árvore inteira e poderia subir outras coisas junto de um
 * bump que deve mexer **só em versão**. Os alvos aqui são exatamente os mesmos
 * `package.json` acima. Os pacotes internos (`packages/iconcore-*`) têm versionamento
 * próprio e **não** entram.
 *
 * O formato bate byte a byte com o que o npm escreve (`JSON.stringify(l, null, 2)` +
 * `\n`) — verificado antes de adotar.
 */
const lockPath = join(repoRoot, 'package-lock.json');
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
const alvosDoLock = ['', 'apps/web', 'apps/promo', 'apps/desktop'];
let entradasDoLock = 0;
for (const chave of alvosDoLock) {
  const entrada = lock.packages?.[chave];
  if (!entrada) continue;
  if (entrada.version !== version) {
    entrada.version = version;
    entradasDoLock++;
  }
}
if (entradasDoLock > 0) {
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`set   package-lock.json: ${entradasDoLock} entrada(s) -> ${version}`);
} else {
  console.log(`skip  package-lock.json (already ${version})`);
}

console.log(`\nnext steps: add .github/release-notes/v${version}.md (if needed) and tag v${version}`);