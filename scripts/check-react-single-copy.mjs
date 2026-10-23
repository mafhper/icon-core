#!/usr/bin/env node
/**
 * Portão da cópia única do react.
 *
 * ## Por que este arquivo existe (PR #248)
 *
 * O `package.json` da raiz não declarava `react` em lugar nenhum, e o PR #248 mostrou o preço:
 * depois do bump, o npm manteve o `@radix-ui/react-id` **hoisted na raiz** e aninhou o `react`
 * **dentro de cada workspace** (`apps/web/node_modules/react`, `apps/promo/node_modules/react`,
 * `packages/iconcore-ui/node_modules/react`). O Radix da raiz sobe até `node_modules/` e não
 * encontra react — é o `ERR_MODULE_NOT_FOUND` dos quatro specs do `@iconcore/ui` e o
 * `failed to resolve import "react"` do desktop.
 *
 * Na `main` os três workspaces pedem a mesma versão e tudo hoista junto: fica verde **por sorte
 * do grafo**, não por contrato. Este guard converte a sorte em contrato, lendo **só** o
 * `package-lock.json` e os `package.json` — sem `npm install` e sem `node_modules`.
 *
 * ## O bump: os quatro pontos, nesta ordem
 *
 * 1. `package.json` (raiz) — `devDependencies`: `react` e `react-dom` **em versão exata**.
 *    É a âncora: com ela a raiz sempre tem de onde resolver, mesmo que a resolução aninhe
 *    por workspace. Sem a âncora, o hoist é acidente.
 * 2. `packages/iconcore-ui/package.json` — `peerDependencies` (`^<major>.0.0`) e
 *    `devDependencies` (exato).
 * 3. `apps/web/package.json` — `dependencies` (exato).
 * 4. `apps/promo/package.json` — `dependencies` (exato).
 *
 * `@types/react` e `@types/react-dom` acompanham os mesmos quatro arquivos. A ordem não é
 * decorativa: a âncora primeiro, porque é ela que garante o hoist dos outros três.
 *
 * Depois de escrever os quatro: `npm install` na raiz (npm 10.9.2, o `packageManager`) para o
 * `package-lock.json` ser regerado — **nunca editar o lockfile à mão** (lição já paga uma vez).
 * Verificação: este guard, mais `npm ci` local. No lockfile tem que existir `node_modules/react`
 * na raiz e **nenhum** `.../node_modules/react` aninhado.
 *
 * ## O que ele cobra
 *
 * 1. **Âncora:** a raiz declara `react` e `react-dom` no exato da versão instalada.
 * 2. **Cópia única:** `react`, `react-dom`, `@types/react` e `@types/react-dom` aparecem uma vez
 *    só, em `node_modules/<nome>`. Qualquer entrada aninhada reprova, com o caminho na mensagem.
 * 3. **Par:** `react` e `react-dom` na mesma versão — uma cópia de cada, mas desencontradas,
 *    quebra do mesmo jeito.
 * 4. **Os quatro pontos:** todo `package.json` de workspace que declara `react`/`react-dom` tem
 *    a declaração satisfeita pela versão instalada. Esquecer um ponto no bump reprova aqui.
 *
 * ## O que ele NÃO cobra, de propósito
 *
 * Não compara `@types/*` com a versão do `react` (versionamento próprio) e não reimplementa um
 * resolvedor: em lockfile v3, "não existe entrada aninhada" **é** a prova de resolução, porque
 * o Node sobe até a raiz. Também não roda `npm install` — no CI o `npm ci` já rodou.
 *
 * Uso: `node scripts/check-react-single-copy.mjs [raiz]`. O argumento existe para apontar o guard
 * para uma árvore de fixture; sem ele, vale a raiz do repositório.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(process.argv[2] ?? path.join(AQUI, '..'));

const lerJson = (rel) => {
  const arquivo = path.join(RAIZ, rel);
  if (!fs.existsSync(arquivo)) return null;
  return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
};

const falhas = [];

const lock = lerJson('package-lock.json');
if (!lock || !lock.packages) {
  console.error('React single copy guard FALHOU:\n');
  console.error(`  - ${path.join(RAIZ, 'package-lock.json')} ausente ou sem \`packages\` (precisa de lockfile v2+).`);
  process.exit(1);
}

// --- 1 e 2. Uma cópia de cada, e a cópia é a da raiz ---

const NOMES = ['react', 'react-dom', '@types/react', '@types/react-dom'];
const instaladas = {};

for (const nome of NOMES) {
  const esperado = `node_modules/${nome}`;
  const entradas = Object.keys(lock.packages).filter(
    (chave) => chave === esperado || chave.endsWith(`/${esperado}`),
  );

  if (entradas.length === 0) {
    falhas.push(
      `\`${nome}\` não está em \`${esperado}\`. O lockfile foi gerado sem essa dependência?`,
    );
    continue;
  }

  if (entradas.length > 1) {
    falhas.push(
      `\`${nome}\` tem ${entradas.length} cópias — a raiz deixou de ser o único lugar:\n` +
        entradas.map((chave) => `      ${chave} @ ${lock.packages[chave].version}`).join('\n') +
        '\n      É o defeito do PR #248: o pacote hoisted não acha o peer aninhado.' +
        '\n      Alinhe os quatro pontos (specs exatos, raiz primeiro) e rode `npm install` na raiz.',
    );
    continue;
  }

  if (entradas[0] !== esperado) {
    falhas.push(
      `\`${nome}\` só existe aninhado em \`${entradas[0]}\`, não em \`${esperado}\`.` +
        '\n      Quem estiver hoisted na raiz não resolve, e o build quebra longe da causa.',
    );
    continue;
  }

  instaladas[nome] = lock.packages[esperado].version;
}

// --- 3. react e react-dom são um par ---

if (instaladas.react && instaladas['react-dom'] && instaladas.react !== instaladas['react-dom']) {
  falhas.push(
    `\`react\` (${instaladas.react}) e \`react-dom\` (${instaladas['react-dom']}) estão em versões diferentes.` +
      '\n      São um par: subir um sem o outro troca o erro de resolução por erro em tempo de execução.',
  );
}

// --- 4. Os quatro pontos, e a âncora entre eles ---

const arquivos = ['package.json'];
for (const grupo of ['apps', 'packages']) {
  const dir = path.join(RAIZ, grupo);
  if (!fs.existsSync(dir)) continue;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!item.isDirectory()) continue;
    const rel = `${grupo}/${item.name}/package.json`;
    if (fs.existsSync(path.join(RAIZ, rel))) arquivos.push(rel);
  }
}

const CAMPOS = ['dependencies', 'devDependencies', 'peerDependencies'];

const comparar = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * Só as formas que o repositório usa. Forma desconhecida **reprova** em vez de passar em
 * silêncio: é o único jeito de o guard não virar decoração no dia em que alguém escrever
 * `19.x` ou `workspace:*`.
 */
const satisfaz = (spec, versao) => {
  const limpo = spec.trim();
  if (limpo === '*' || limpo === 'latest') return true;

  const exata = /^(\d+)\.(\d+)\.(\d+)$/.exec(limpo);
  if (exata) return limpo === versao;

  const operada = /^(\^|~|>=)(\d+)\.(\d+)\.(\d+)$/.exec(limpo);
  if (!operada) return null;

  const [, operador, ...partes] = operada;
  const alvo = partes.map(Number);
  const atual = versao.split('.').map(Number);

  if (operador === '>=') return comparar(atual, alvo) >= 0;

  // `^` e `~` nunca sobem de major.
  if (atual[0] !== alvo[0]) return false;
  // `~` trava no minor; `^` desce até o patch — exceto em major 0, onde o compatível é o minor.
  if (operador === '~' || alvo[0] === 0) return atual[1] === alvo[1] && atual[2] >= alvo[2];
  return comparar(atual, alvo) >= 0;
};

const declarantes = [];
const PONTOS = [
  'package.json',
  'packages/iconcore-ui/package.json',
  'apps/web/package.json',
  'apps/promo/package.json',
];

for (const rel of arquivos) {
  const pkg = lerJson(rel);
  if (!pkg) {
    falhas.push(`não achei \`${rel}\`, que deveria existir na árvore.`);
    continue;
  }

  let declara = false;
  for (const campo of CAMPOS) {
    for (const nome of ['react', 'react-dom']) {
      const spec = pkg[campo]?.[nome];
      if (!spec) continue;
      declara = true;

      const versao = instaladas[nome];
      if (!versao) continue; // a cópia ausente já virou falha acima; não repetir com outra mensagem

      const resultado = satisfaz(spec, versao);

      if (resultado === null) {
        falhas.push(
          `\`${rel}\` declara \`${nome}\` como \`${spec}\` em \`${campo}\`, forma que este guard não sabe ler.` +
            '\n      Use exato (`19.3.0`), `^19.0.0`, `~19.3.0`, `>=19.3.0` ou `*` — ou ensine o guard, mas não o deixe passar em silêncio.',
        );
      } else if (!resultado) {
        falhas.push(
          `\`${rel}\` declara \`${nome}\` como \`${spec}\` em \`${campo}\`, que não aceita a versão instalada \`${versao}\`.` +
            '\n      Um dos quatro pontos do bump ficou para trás — ou o lockfile foi editado à mão.',
        );
      }
    }
  }
  if (declara) declarantes.push(rel);
}

for (const rel of PONTOS) {
  if (!declarantes.includes(rel)) {
    falhas.push(
      `\`${rel}\` deixou de declarar \`react\`/\`react-dom\` — é um dos quatro pontos do bump.` +
        '\n      Se a dependência saiu de verdade, remova o ponto da lista neste guard; não deixe ele conferir menos do que anuncia.',
    );
  }
}

const raiz = lerJson('package.json');
if (raiz) {
  const raizDeps = { ...(raiz.dependencies ?? {}), ...(raiz.devDependencies ?? {}) };
  for (const nome of ['react', 'react-dom']) {
    const spec = raizDeps[nome];
    if (!spec) {
      falhas.push(
        `a raiz não declara \`${nome}\` — não existe âncora, e o hoist passa a ser acidente (PR #248).` +
          '\n      Declare em `devDependencies` com a versão exata que os workspaces usam.',
      );
    } else if (instaladas[nome] && spec !== instaladas[nome]) {
      falhas.push(
        `a raiz declara \`${nome}\` como \`${spec}\`; a âncora tem que ser exata: \`${instaladas[nome]}\`.` +
          '\n      Range na raiz permite que a próxima resolução escolha outra versão e aninhe a cópia.',
      );
    }
  }
}

if (falhas.length > 0) {
  console.error('React single copy guard FALHOU:\n');
  for (const falha of falhas) console.error(`  - ${falha}`);
  console.error('\nProcedimento: os quatro pontos do bump estão no cabeçalho deste arquivo.');
  process.exit(1);
}

console.log(
  `React single copy guard OK: react e react-dom em ${instaladas.react}, uma cópia na raiz, tipos em ${instaladas['@types/react']}.`,
);
console.log(`  ${declarantes.length} arquivos conferidos: ${declarantes.join(', ')}.`);
