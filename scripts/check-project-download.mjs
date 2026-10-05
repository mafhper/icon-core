import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Porta que impede uma **quarta** copia do download do projeto.
 *
 * ## Por que isto precisa existir
 *
 * Este repositorio ja teve o mesmo download escrito em tres lugares: `Topbar`,
 * `useKeyboardShortcuts` e `CommandPalette`. Cada copia carregava os **dois** defeitos
 * que o dono reportou — `SET_DIRTY(false)` incondicional, e `revokeObjectURL` no mesmo
 * tick (que cancela o download no Firefox).
 *
 * Duas copias ja e uma decisao; tres e um sintoma. O motivo do guard e tornar a
 * proxima copia **barulhenta** na hora do commit, e nao no dia em que alguem pedir para
 * "ajustar rapidao" num deles.
 *
 * ## Por que nao e um teste
 *
 * Um teste que faz `rg` no fonte e um teste que passa. A regra aqui e sobre **forma do
 * fonte**, e a forma so se verifica no fonte. O que este script faz e o que o lint
 * faz: reclamar cedo.
 */

/**
 * `scripts/` esta **um** nivel abaixo da raiz. Com `..`, `..` a varrer passava por
 * `Github/` — e o guard passou verde sobre zero arquivo, que e a pior falha possivel
 * num guard: um "OK" que nao verificou nada.
 */
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['apps/web/src', 'packages', 'apps/promo/src'];

const ARQUIVOS = [];
const varrer = (dir) => {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === 'node_modules' || entrada.name === 'dist') continue;
      varrer(completo);
    } else if (/\.(ts|tsx)$/.test(entrada.name)) {
      ARQUIVOS.push(completo);
    }
  }
};
for (const d of DIRS) {
  const p = path.join(RAIZ, d);
  if (fs.existsSync(p)) varrer(p);
}

/** O unico lugar autorizado a montar o download. */
const PERMITIDO = path.join(RAIZ, 'apps/web/src/composer/utils/projectStorage.ts');

const PADRAO_ANCHOR = /\ba\.download\s*=/;
const PADRAO_CREATE = /createObjectURL\(/;
const PADRAO_ARQUIVO = /document\.createElement\('a'\)/;

const falhas = [];
for (const arquivo of ARQUIVOS) {
  if (path.resolve(arquivo) === PERMITIDO) continue;
  const texto = fs.readFileSync(arquivo, 'utf8');
  // Os tres juntos, no mesmo arquivo: e o padrao de "montar um download na mao".
  if (PADRAO_ANCHOR.test(texto) && PADRAO_CREATE.test(texto) && PADRAO_ARQUIVO.test(texto)) {
    const rel = path.relative(RAIZ, arquivo).split(path.sep).join('/');
    falhas.push(
      `  ${rel}\n` +
        '    Monta o download do projeto na mao. Use downloadProject() de\n' +
        '    apps/web/src/composer/utils/projectStorage.ts — ele centraliza o nome do\n' +
        '    arquivo, adia o revokeObjectURL (no mesmo tick o Firefox cancela o\n' +
        '    download) e devolve `skipped` para o dirty nao ser limpo a toa.'
    );
  }
}

if (falhas.length > 0) {
  console.error('Project download guard FALHOU:\n');
  console.error(falhas.join('\n\n'));
  console.error(`\n${falhas.length} arquivo(s) montando o download por conta propria.`);
  console.error('Ja foram tres. A proxima deve ser um bug, nao uma copia.');
  process.exit(1);
}

console.log(`Project download guard OK: ${ARQUIVOS.length} arquivo(s) verificados, montagem na mao: 0.`);