/**
 * Gate de mutação do `escapeXml` — **versionado de propósito**.
 *
 * Antes estes scripts eram locais e gitignored, e a afirmação "0 escaparam" era inauditável:
 * ninguém podia conferir. Um gate que só roda na máquina de quem escreveu não é evidência,
 * é anedota. Este arquivo roda no CI e reprova se a cobertura sumir.
 *
 * ## O que ele prova, e o que não prova
 *
 * Cada mutação é um defeito **real** que já existiu ou que caberia neste código — não um
 * erro arbitrário. O critério é o do `IC-N34`: **assertion absoluta**. Um teste que falha
 * quando o escape some, mas passaria se o defeito fosse outro, não protege nada.
 *
 * O que ele **não** faz: substituir a auditoria humana de um diff. Um gate verde é
 * necessário, não suficiente.
 *
 * ## Uso
 *
 *   node scripts/check-escape-xml-mutation.mjs
 *
 * Sai com 1 se algum mutante sobreviver, 0 se todos morrerem. Não deixa resíduo: cada
 * mutação é desfeita em `finally`.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ALVO = path.join(RAIZ, 'packages', 'iconcore-renderer', 'src', 'escapeXml.ts');
const ALVO_RENDER = path.join(RAIZ, 'packages', 'iconcore-renderer', 'src', 'renderToSvg.ts');
const SPEC = 'tests/escapeXml.spec.ts';

/** @type {{nome:string, arquivo:string, de:string, para:string, porque:string}[]} */
const MUTANTES = [
  {
    nome: 'conteudo sem escape (o defeito original)',
    arquivo: ALVO_RENDER,
    de: '>${escapeXml(layer.text.content)}<',
    para: '>${layer.text.content}<',
    porque: 'Era exatamente isto em main: `AT&T` saia com `&` solto e o SVG nao abria.'
  },
  {
    nome: 'familia da fonte sem escape (o segundo ponto cego)',
    arquivo: ALVO_RENDER,
    de: 'font-family="${escapeXml(layer.text.fontFamily)}"',
    para: 'font-family="${layer.text.fontFamily}"',
    porque: 'Achado por grep, nao por bug relatado. Uma aspa fecha o atributo.'
  },
  {
    nome: 'escape duplo (ordem das substituicoes)',
    arquivo: ALVO,
    de: ".replace(/[&<>\"']/g, (ch: string) => ENTITIES[ch]);",
    para: ".replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&apos;')\n    .replace(/&/g, '&amp;');",
    porque: 'O `&` escapado por ultimo transforma `&amp;` em `&amp;amp;`, e a pessoa ve `&amp;` no logo.'
  },
  {
    nome: 'caracteres de controle preservados',
    arquivo: ALVO,
    de: ".replace(INVALID_XML_CHARS, '')",
    para: '',
    porque: 'XML 1.0 proibe U+0000-U+001F: nao ha representacao escapada, so remocao. Colar texto de PDF basta.'
  },
  {
    nome: 'so escapa os tres de conteudo (regressao para duas funcoes)',
    arquivo: ALVO,
    de: "  '\"': '&quot;',\n  \"'\": '&apos;'",
    para: '',
    porque: 'Prova que os cinco sao load-bearing para uso em atributo, e nao so tres.'
  }
];

const rodarSpec = () => {
  try {
    execFileSync(
      'npx',
      ['vitest', 'run', SPEC, '--root', 'packages/iconcore-renderer', '--reporter=dot'],
      { cwd: RAIZ, stdio: 'pipe', encoding: 'utf8' }
    );
    return { passou: true };
  } catch (erro) {
    return { passou: false, saida: `${erro.stdout ?? ''}${erro.stderr ?? ''}` };
  }
};

const mutar = (mutante) => {
  const original = fs.readFileSync(mutante.arquivo, 'utf8');
  if (!original.includes(mutante.de)) {
    throw new Error(`mutante "${mutante.nome}": o texto de origem nao existe mais no arquivo`);
  }
  fs.writeFileSync(mutante.arquivo, original.replace(mutante.de, mutante.para), 'utf8');
  return original;
};

const restaurar = (mutante, original) => {
  fs.writeFileSync(mutante.arquivo, original, 'utf8');
  void mutante;
};

console.log('Gate de mutacao do escapeXml');
console.log('Cada mutante e um defeito real. Se um SOBREVIVE, a cobertura nao existe.\n');

let sobreviveram = 0;

for (const mutante of MUTANTES) {
  let original = '';
  try {
    original = mutar(mutante);
    const resultado = rodarSpec();
    if (resultado.passou) {
      sobreviveram++;
      console.log(`  SOBREVIVEU  ${mutante.nome}`);
      console.log(`             ${mutante.porque}`);
    } else {
      console.log(`  morreu     ${mutante.nome}`);
    }
  } finally {
    if (original) restaurar(mutante, original);
  }
}

console.log('');
if (sobreviveram > 0) {
  console.log(`REPROVADO — ${sobreviveram} de ${MUTANTES.length} mutantes sobreviveram.`);
  process.exit(1);
}
console.log(`OK — ${MUTANTES.length}/${MUTANTES.length} mutantes morreram.`);