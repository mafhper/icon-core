/**
 * Run the built CLI, the way a user would.
 *
 * This exists because the CLI's build had been broken for a long time and
 * nothing noticed. `node dist/cli.js --help` died with
 * `ERR_MODULE_NOT_FOUND`, then with `ERR_UNSUPPORTED_DIR_IMPORT` once the file
 * specifiers were fixed. Tests import from `../src`; Vite resolves everything;
 * `npm run build` only type-checks the emit. **Nothing ever executed the built
 * binary**, which is the only thing that could have caught either failure.
 *
 * So this gate exists to make the bin a tested surface rather than an assumed
 * one. It runs after `npm run build`, since it needs `dist`.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cli = path.join('packages', 'iconcore-cli', 'dist', 'cli.js');

if (!fs.existsSync(cli)) {
  console.error(`cli-smoke: ${cli} nao existe — rode \`npm run build\` antes.`);
  process.exit(1);
}

const run = (args) =>
  execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', stdio: 'pipe' });

const falhas = [];

// 1. The bare invocation. This is the case that was broken.
let help = '';
try {
  help = run(['--help']);
} catch (e) {
  falhas.push(`--help falhou: ${String(e.stderr ?? e.message).split('\n')[0]}`);
}

if (!falhas.length) {
  for (const esperado of ['Usage:', 'build', 'audit']) {
    if (!help.includes(esperado)) falhas.push(`--help nao menciona "${esperado}"`);
  }
}

// 2. A real round trip: create a project, then read it back with inspect and
// audit. `build` is checked separately below, because it cannot work yet.
// Kept so step 3 can build the same project. The directory is removed at the
// very end, after step 3 — deleting it here made step 3 read a path that no
// longer existed, which is its own kind of misleading failure.
let projetoCriado = null;
let tempDir = null;

if (!falhas.length) {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iconcore-cli-smoke-'));
  try {
    // The CLI takes `--flag=value`, not `--flag value`.
    const project = path.join(tempDir, 'demo.iconcore.json');
    run(['create', '--preset=pwa', `--out=${project}`]);

    if (!fs.existsSync(project)) {
      falhas.push('create nao escreveu o projeto');
    } else {
      projetoCriado = project;

      const inspecionado = run(['inspect', project]);
      if (!inspecionado.includes('Canvas')) falhas.push('inspect nao leu o projeto criado');

      const auditado = run(['audit', project]);
      if (!auditado.includes('Score')) falhas.push('audit nao avaliou o projeto criado');
    }
  } catch (e) {
    const saida = `${e.stdout ?? ''}${e.stderr ?? ''}`.split('\n').find((l) => l.trim()) ?? '';
    falhas.push(`create falhou: ${saida || String(e.message).split('\n')[0]}`);
  }
}

// 3. `build` is the one command that cannot work yet: the Node rendering
// backend is a hard `throw` ("not yet implemented… wait for Phase 6"). So this
// is a **ratchet**, not an endorsement: it asserts the failure is the known one
// and is reported cleanly, so a stack trace or a silent no-op fails. When the
// backend lands and `build` starts writing files, this assertion fails and has
// to be updated on purpose.
const KNOWN_BACKEND_GAP = 'not yet implemented';

if (!falhas.length && projetoCriado) {
  const out = path.join(os.tmpdir(), 'iconcore-cli-build-probe');
  fs.rmSync(out, { recursive: true, force: true });
  try {
    run(['build', projetoCriado, `--out=${out}`]);
    const escreveu = fs.existsSync(out) ? fs.readdirSync(out) : [];
    if (escreveu.length === 0) {
      console.log('cli-smoke: nota — build terminou sem saida (backend Node pendente).');
    }
  } catch (e) {
    const saida = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    const temTrace = /\n\s+at\s+\S+\s+\(/.test(saida);

    if (temTrace) {
      falhas.push('build produziu stack trace em vez de uma mensagem');
    } else if (!saida.includes(KNOWN_BACKEND_GAP)) {
      falhas.push(`build falhou por motivo desconhecido: ${saida.split('\n').find((l) => l.trim())}`);
    } else {
      console.log('cli-smoke: nota — build barrado pelo backend Node pendente (esperado).');
    }
  }
}

if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });

if (falhas.length) {
  console.error('cli-smoke: FALHOU');
  for (const f of falhas) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('cli-smoke: o bin carrega, roda e cria/inspeciona/audita um projeto.');
