#!/usr/bin/env node
/**
 * Levantamento de imagens: quem usa, o que e duplicata, e o que e publico.
 *
 * ```bash
 * node scripts/inventory-images.mjs            # o relatorio
 * node scripts/inventory-images.mjs --json     # a mesma coisa, como dados
 * ```
 *
 * ## Por que isto e uma ferramenta, e nao um script descartavel
 *
 * Porque a proxima tarefa e a mesma em todos os projetos da frota: normalizar onde a arte
 * mora, e so entao gerar a imagem de release a partir de um template. Para isso a pergunta
 * tem que ser **respondível por comando** em qualquer repositorio — e as tres respostas sao
 * exatamente estas:
 *
 * 1. **Quem consome?** Por nome, em texto.
 * 2. **E duplicata?** Por sha256 do conteudo.
 * 3. **E publica ou de dev?** Sai do repositorio para fora, ou so existe para o time e o
 *    build?
 *
 * ## O escopo: `git ls-files`, e nao o disco
 *
 * A primeira versao varreu o disco e reportou **1984 imagens** — porque o
 * `.dev/investigations/` guarda um corpus de pesquisa de ~1500 SVGs, e ele e gitignored.
 * Um inventario que inclui material de pesquisa nao e um inventario do projeto: ele responde
 * "quantas imagens existem na minha maquina", que nao e a pergunta, e o numero e grande o
 * bastante para ninguem olhar.
 *
 * `git ls-files` responde "o que um clone limpo traz", que e o que a passada de frota vai
 * encontrar. Aqui sao **61**.
 *
 * E o filtro tambem tolera o indice e a working tree fora de sincronia: um arquivo listado e
 * ja removido da arvore nao derruba o relatorio com ENOENT.
 *
 * ## As tres categorias de "sem referencia", e o que fazer com cada uma
 *
 * - **Conjunto exigido por ferramenta** (`src-tauri/icons/`): consumido **por convencao**,
 *   nao por config. Nunca arquivar sem o build que o exige.
 * - **Publica e usada** (`docs/assets/`): o `README.md` mostra. A contagem de referencias
 *   em texto pega isso.
 * - **Ate aqui**: a unica categoria que se arquiva — e **para** `assets/archive/`, com o
 *   hash registrado, nunca para o lixo.
 *
 * ## O `--json` existe por um motivo
 *
 * Porque a segunda passada — o portão que reprova imagem publica sem consumidor, e o
 * gerador de release a partir de template — vai **consumir este relatorio**, nao reescreve-lo.
 * Do mesmo jeito que `check-third-party-assets.mjs` consome um registro: um inventario
 * impresso e lido a mao nao vira gate.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(rootDir);

const ARQUIVOS = execSync('git ls-files', { encoding: 'utf8', maxBuffer: 1 << 26 })
  .split('\n')
  .filter(Boolean);

const EXT = /\.(svg|png|webp|ico|jpe?g|gif|avif)$/i;

/** Consulta que responde as tres perguntas. */
const TEXTO = ARQUIVOS.filter((f) =>
  /\.(md|html|tsx|ts|jsx|js|css|mjs|cjs|json|ya?ml|toml)$/i.test(f)
);

/** Sai do repositorio para fora: README, docs, `public/`, imagem de release. */
const isPublic = (rel) =>
  /^README\.md$/.test(rel) ||
  /^docs\//.test(rel) ||
  /^apps\/[^/]+\/public\//.test(rel) ||
  rel === '.github/release.config.json' ||
  rel.startsWith('assets/brand/');

/**
 * Conjunto que uma ferramenta exige **pelo nome**, independentemente de referencia.
 *
 * Este e o caso que impede o relatorio de sugerir o que nao pode apagar: os icones do iOS
 * do Tauri nao aparecem em nenhuma config, e mesmo assim sao obrigatorios.
 */
const REQUIRED_BY_TOOL = (rel) =>
  /^apps\/desktop\/src-tauri\/(icons|resources)[\\/]/.test(rel);

const ausentes = ARQUIVOS.filter((f) => EXT.test(f) && !fs.existsSync(f));
const imagens = ARQUIVOS.filter((f) => EXT.test(f) && fs.existsSync(f));

const sha = (rel) => crypto.createHash('sha256').update(fs.readFileSync(rel)).digest('hex');

const conteudo = TEXTO.map((f) => [f, fs.readFileSync(f, 'utf8')]);
const dados = imagens.map((rel) => {
  const b = path.basename(rel);
  return {
    path: rel,
    bytes: fs.statSync(rel).size,
    sha256: sha(rel),
    refs: conteudo
      .filter(([f, t]) => f !== rel && (t.includes(b) || t.includes(rel)))
      .map(([f]) => f),
    public: isPublic(rel),
    requiredByTool: REQUIRED_BY_TOOL(rel)
  };
});

const byHash = new Map();
for (const d of dados) {
  if (!byHash.has(d.sha256)) byHash.set(d.sha256, []);
  byHash.get(d.sha256).push(d);
}
const duplicateGroups = [...byHash.values()].filter((g) => g.length > 1);

const semRef = dados.filter((d) => d.refs.length === 0);
const arquivaveis = semRef.filter((d) => !d.requiredByTool);

const relatorio = {
  scanned: { tracked: ARQUIVOS.length, textFiles: TEXTO.length, images: dados.length },
  missingFromWorktree: ausentes,
  public: dados.filter((d) => d.public).length,
  private: dados.filter((d) => !d.public).length,
  unreferenced: semRef.length,
  unreferencedRequiredByTool: semRef.filter((d) => d.requiredByTool).length,
  archivable: arquivaveis.map((d) => ({
    path: d.path,
    sha256: d.sha256,
    bytes: d.bytes,
    public: d.public,
    duplicateOf: (byHash.get(d.sha256) || [])
      .filter((o) => o.path !== d.path)
      .map((o) => o.path)
  })),
  duplicateGroups: duplicateGroups.map((g) => ({
    sha256: g[0].sha256,
    paths: g.map((d) => d.path)
  }))
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(relatorio, null, 2));
  process.exit(0);
}

const kb = (n) => `${(n / 1024).toFixed(1).padStart(8)} KB`;

console.log(`TRACKED: ${ARQUIVOS.length} arquivos | texto: ${TEXTO.length} | imagens: ${dados.length}\n`);

if (ausentes.length) {
  console.log('NO INDICE E AUSENTE DA WORKING TREE (removido, ainda nao commitado):');
  for (const a of ausentes) console.log(`  - ${a}`);
  console.log('');
}

console.log('=== DUPLICATAS por conteudo (sha256) ===');
if (!duplicateGroups.length) console.log('  nenhuma');
for (const g of duplicateGroups) {
  console.log(`\n  ${g[0].sha256.slice(0, 12)}  ${kb(g[0].bytes)}`);
  for (const d of g) {
    const tags = [
      d.public ? 'PUBLICO' : 'privado/dev',
      d.requiredByTool ? 'conjunto de ferramenta' : '',
      d.refs.length ? `usado por ${d.refs.length}` : 'SEM REFERENCIA'
    ]
      .filter(Boolean)
      .join(' | ');
    console.log(`    ${d.path.padEnd(50)} ${tags}`);
  }
}

console.log(`\n\n=== SEM REFERENCIA (${semRef.length}) ===`);
for (const d of semRef.sort((a, b) => a.path.localeCompare(b.path))) {
  const tags = [
    d.public ? 'PUBLICO' : 'privado/dev',
    d.requiredByTool ? 'conjunto (NAO arquivar)' : 'ARQUIVAVEL',
    byHash.get(d.sha256).length > 1 ? 'duplicata' : ''
  ]
    .filter(Boolean)
    .join(' | ');
  console.log(`  ${d.path.padEnd(52)} ${kb(d.bytes)}  ${tags}`);
}

console.log('\n\n=== RESUMO ===');
console.log(`imagens versionadas:            ${dados.length}`);
console.log(`publicas:                       ${relatorio.public}`);
console.log(`privadas/dev:                   ${relatorio.private}`);
console.log(`sem referencia:                 ${relatorio.unreferenced}`);
console.log(`  ... exigidas por ferramenta:   ${relatorio.unreferencedRequiredByTool}`);
console.log(`ARQUIVAVEIS:                    ${arquivaveis.length}  (${kb(arquivaveis.reduce((a, d) => a + d.bytes, 0)).trim()})`);
console.log(`peso total:                     ${kb(dados.reduce((a, d) => a + d.bytes, 0)).trim()}`);
