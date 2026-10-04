/**
 * Gate de **tipos** do payload de `ADD_LAYER` — por que isto existe.
 *
 * A união discriminada resolve o problema. Mas o problema real **não era** o tipo frouxo:
 * era que eu rodei `vitest` direto, que descarta tipos sem checar, e acreditei no
 * resultado sem rodar `typecheck`. A forma errada compilava perfeitamente — eu é que não
 * compilei.
 *
 * Por isso este gate não usa o runner de teste. Ele grava um arquivo **dentro do
 * projeto**, roda o `tsc` de verdade, e exige que cada forma errada seja reprovada. É a
 * diferença entre "o tipo deveria pegar isso" e "o tipo pega isso, medido".
 *
 * Ele testa também o **sentido inverso**, que é onde um gate desses costuma passar a
 * tolo: se o tipo virasse `never` ou `any`, todas as formas erradas seriam reprovadas e
 * o gate ficaria verde sem proteger nada. Por isso as formas válidas têm que **passar**.
 *
 * Uso: `node scripts/check-add-layer-payload-types.mjs`
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const PROBE = path.join(RAIZ, 'apps/web/src/composer/__add-layer-probe__.ts');

/**
 * O criterio de "reprovou" e': **o erro esta no arquivo do probe**.
 *
 * Esta e' a terceira versao do criterio, e as duas anteriores falharam por adivinhar o
 * que o compilador escreve: a primeira casava `/kind|AddLayerPayload/` e perdia um caso
 * que estava sendo reprovado corretamente; a segunda acrecententou `TS2322`/`TS2345` e
 * perdeu quatro, porque excess property check e' `TS2353`. Cada vez eu troquei a
 * expectativa em vez de **ler a mensagem**.
 *
 * O probe e' a unica coisa que muda entre um caso e outro, entao "o erro cita o probe" e'
 * o criterio completo e suficiente — e nao depende da redacao do compilador, que muda
 * entre versoes do TypeScript.
 */
const ERRO_NO_PROBE = /__add-layer-probe__\.ts\(\d+,\d+\): error TS\d+/;

const DEVEM_FALHAR = [
  {
    nome: 'payload de layer pronto (o defeito original)',
    codigo: `const p: AddLayerPayload = { layer: { id: 'x' } };`
  },
  {
    nome: 'forma antiga { text: true }',
    codigo: `const p: AddLayerPayload = { text: true };`
  },
  {
    nome: 'forma antiga { background: true }',
    codigo: `const p: AddLayerPayload = { background: true };`
  },
  {
    nome: 'discriminante inexistente',
    codigo: `const p: AddLayerPayload = { kind: 'inexistente' };`
  },
  {
    nome: 'shape sem o shape',
    codigo: `const p: AddLayerPayload = { kind: 'shape' };`
  },
  {
    nome: 'kinds misturados',
    codigo: `const p: AddLayerPayload = { kind: 'text', shape: { kind: 'circle', width: 1, height: 1 } };`
  }
];

/** Formas que o compilador TEM de aceitar — o contrapeso que impede o gate de ser tolo. */
const DEVEM_PASSAR = [
  { nome: 'texto', codigo: `const p: AddLayerPayload = { kind: 'text' };` },
  { nome: 'fundo', codigo: `const p: AddLayerPayload = { kind: 'background' };` },
  {
    nome: 'shape com o shape',
    codigo: `const p: AddLayerPayload = { kind: 'shape', shape: { kind: 'circle', width: 10, height: 10 } };`
  }
];

const PREAMBULO = `/* eslint-disable */
// Arquivo temporario do gate scripts/check-add-layer-payload-types.mjs.
import type { AddLayerPayload } from './composerReducer';
export const prova = (): void => {
`;

const TSC = path.join(RAIZ, 'node_modules/typescript/bin/tsc');

const compilar = (corpo) => {
  fs.writeFileSync(PROBE, `${PREAMBULO}${corpo}\n  void p;\n};\n`, 'utf8');
  if (!fs.existsSync(TSC)) {
    return { compilou: false, saida: '', motivo: `tsc nao encontrado em ${TSC} (rode npm ci)` };
  }
  try {
    // `process.execPath` + o binario do tsc, e nao `npx`: no Windows `npx` e' `npx.cmd`,
    // que o `execFileSync` nao lanca. Sem isso o gate reprova por motivo errado — que e
    // exatamente o defeito que o gate do `escapeXml` tinha.
    const stdout = execFileSync(process.execPath, [TSC, '-p', 'apps/web/tsconfig.json', '--noEmit'], {
      cwd: RAIZ,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return { compilou: true, saida: stdout };
  } catch (e) {
    if (e.code === 'ENOENT') {
      return { compilou: false, saida: '', motivo: `nao consegui lancar node: ${e.code}` };
    }
    // exit != 0 = o compilador reprovou, que e o resultado que este gate quer medir.
    return { compilou: false, saida: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  } finally {
    fs.rmSync(PROBE, { force: true });
  }
};

console.log('Gate de tipos do payload de ADD_LAYER');
console.log('Prova que `tsc` REPROVA a forma errada e ACEITA a certa.\n');

// 1. Baseline: sem probe, o projeto compula. Sem isso, um erro preexistente faria todo
//    caso "devem falhar" passar por motivo errado — que e o modo exato de o gate mentir.
const base = compilar(`const p: AddLayerPayload = { kind: 'text' };`);
if (!base.compilou) {
  console.error('REPROVADO — o projeto nao compula antes do probe. O gate mediria lixo:');
  console.error(base.saida.split('\n').slice(0, 12).join('\n'));
  process.exit(1);
}
console.log('  baseline    projeto compila sem probe');

let falhas = 0;

for (const caso of DEVEM_FALHAR) {
  const r = compilar(caso.codigo);
  if (r.motivo) {
    console.log(`  FALHOU     ${caso.nome} — o compilador nem chegou a rodar: ${r.motivo}`);
    falhas++;
  } else if (r.compilou) {
    console.log(`  FALHOU     ${caso.nome} — COMPILOU, e devia reprovar`);
    falhas++;
  } else if (!ERRO_NO_PROBE.test(r.saida)) {
    console.log(`  FALHOU     ${caso.nome} — reprovou, mas por erro que nao e' da atribuicao:`);
    console.log(`             ${r.saida.split('\n').filter((l) => l.includes('error')).slice(0, 2).join('\n             ')}`);
    falhas++;
  } else {
    console.log(`  reprovou   ${caso.nome}`);
  }
}

for (const caso of DEVEM_PASSAR) {
  const r = compilar(caso.codigo);
  if (r.compilou) {
    console.log(`  aceitou    ${caso.nome}`);
  } else {
    console.log(`  FALHOU     ${caso.nome} — REPROVOU, e devia passar. O gate ficaria verde com o tipo inutil:`);
    console.log(`             ${(r.saida ?? '').split('\n').filter((l) => l.includes('error')).slice(0, 2).join('\n             ')}`);
    falhas++;
  }
}

const total = DEVEM_FALHAR.length + DEVEM_PASSAR.length;
console.log('');
if (fs.existsSync(PROBE)) {
  console.log('PROBE SOBROU — o arquivo temporario nao foi removido.');
  falhas++;
}

if (falhas > 0) {
  console.log(`REPROVADO — ${falhas} de ${total} casos.`);
  process.exit(1);
}
console.log(`OK — ${DEVEM_FALHAR.length} formas erradas reprovadas, ${DEVEM_PASSAR.length} certas aceitas.`);