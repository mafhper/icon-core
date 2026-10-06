import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Porta que impede a versão do release de divergir entre os arquivos que a carregam.
 *
 * ## Por que isto precisa existir (`IC-N44`)
 *
 * O `release-bump.mjs` mexe em sete fontes de versão. Se **uma** delas ficar para trás,
 * nada acusa: `npm ci` passa (a versão do lockfile é metadado, não contrato), o build
 * passa, e a suíte passa. A divergência só aparece quando alguém lê o arquivo errado —
 * um relatório de auditoria, uma ferramenta que cruza `package.json` com o lockfile, o
 * diff de uma release.
 *
 * Foi o que aconteceu em 2026-10-06: depois do bump para `1.7.0`, o `package-lock.json`
 * ainda dizia `1.6.0`, e o único motivo de ter sido corrigido foi um `npm install` de
 * passagem. O `release-bump.mjs` foi corrigido no mesmo passo; **este guard é o que
 * torna a próxima divergência barulhenta no CI** em vez de silenciosa no arquivo.
 *
 * ## O que ele NÃO compara, de propósito
 *
 * `packages/iconcore-*` e `iconcore-ui` têm **versionamento próprio** (`1.0.0`, `0.1.0`)
 * e o `release-bump` nunca os tocou. Um guard que exigisse que eles seguissem a versão do
 * produto seria o defeito, não a correção — é a mesma armadilha de generalizar a regra
 * para o que não é o caso.
 */

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const lerJson = (rel) => JSON.parse(fs.readFileSync(path.join(RAIZ, rel), 'utf8'));

const fontes = [];
const registrar = (nome, valor) => fontes.push({ nome, valor });

// 1. Os `package.json` que o release-bump escreve, mais o `tauri.conf.json`.
for (const rel of [
  'package.json',
  'apps/web/package.json',
  'apps/promo/package.json',
  'apps/desktop/package.json',
  'apps/desktop/src-tauri/tauri.conf.json',
]) {
  registrar(rel, lerJson(rel).version);
}

// 2. Cargo.toml — o `version` do `[package]`, não o primeiro do arquivo (o `[workspace]`
//    e as dependências também têm `version =`).
const cargoToml = fs.readFileSync(path.join(RAIZ, 'apps/desktop/src-tauri/Cargo.toml'), 'utf8');
registrar('apps/desktop/src-tauri/Cargo.toml', (cargoToml.match(/\[package\][\s\S]*?\nversion = "([^"]+)"/) || [])[1]);

// 3. Cargo.lock — a entrada do próprio crate do app.
const cargoLock = fs.readFileSync(path.join(RAIZ, 'apps/desktop/src-tauri/Cargo.lock'), 'utf8');
registrar('apps/desktop/src-tauri/Cargo.lock', (cargoLock.match(/name = "iconcore-desktop"[\s\S]{0,120}?version = "([^"]+)"/) || [])[1]);

// 4. package-lock.json — a versão do workspace raiz e os três apps. Os pacotes internos
//    aparecem no mesmo objeto com a versão deles; não são alvo.
const lock = lerJson('package-lock.json');
for (const chave of ['', 'apps/web', 'apps/promo', 'apps/desktop']) {
  registrar(`package-lock.json [${chave || 'raiz'}]`, lock.packages?.[chave]?.version);
}

// --- verificação ---

const faltando = fontes.filter((f) => !f.valor);
const distintas = [...new Set(fontes.map((f) => f.valor).filter(Boolean))];

const problemas = [];
if (faltando.length > 0) {
  problemas.push(
    'Não achei a versão em:\n' +
      faltando.map((f) => `  ${f.nome}\n    a regex não casou — o arquivo mudou de forma?`).join('\n'),
  );
}

if (distintas.length > 1) {
  const conteudo = {};
  for (const f of fontes) (conteudo[f.valor] = conteudo[f.valor] || []).push(f.nome);
  problemas.push(
    `As fontes de versão discordam: ${distintas.join(', ')}.\n\n` +
      Object.entries(conteudo)
        .map(([v, arquivos]) => `  ${v}:\n` + arquivos.map((a) => `    ${a}`).join('\n'))
        .join('\n') +
      '\n\nO certo é uma versão só. Rode `node scripts/release-bump.mjs <versão>` —\n' +
      'ele escreve todas, inclusive o package-lock.json.',
  );
}

if (problemas.length > 0) {
  console.error('Version sync guard FALHOU:\n');
  console.error(problemas.join('\n\n'));
  process.exit(1);
}

console.log(`Version sync guard OK: ${fontes.length} fontes de versão em ${distintas[0]}.`);
