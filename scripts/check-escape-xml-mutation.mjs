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

/**
 * Executa o spec e diz se ele **rodou**.
 *
 * A versao anterior chamava `execFileSync('npx', [...])`. No Windows, `npx` e' `npx.cmd`,
 * que o `execFileSync` nao lanca — deu `ENOENT`, o `catch` tratou como "teste reprovou",
 * e **todo mutante pareceu morto sem que um teste tivesse rodado**. O gate reportava
 * 5/5 medindo a falha do launcher.
 *
 * Duas correcoes, e a segunda e a que importa:
 *
 * 1. invocar `node` + o `vitest.mjs` do `node_modules`, que nao depende de shell;
 * 2. distinguir **"o teste rodou e reprovou"** de **"o teste nao rodou"**. Um gate que
 *    confunde as duas nao mede nada, e parece verde — que e o pior defeito possivel
 *    num portao.
 */
const VITEST = path.join(RAIZ, 'node_modules/vitest/vitest.mjs');

const rodarSpec = () => {
  if (!fs.existsSync(VITEST)) {
    return { rodou: false, passou: false, motivo: `vitest nao encontrado em ${VITEST} (rode npm ci)` };
  }
  try {
    execFileSync(
      process.execPath,
      [VITEST, 'run', SPEC, '--root', 'packages/iconcore-renderer', '--reporter=dot'],
      { cwd: RAIZ, stdio: 'pipe', encoding: 'utf8' }
    );
    return { rodou: true, passou: true };
  } catch (erro) {
    const codigo = erro.code;
    if (codigo === 'ENOENT') {
      return { rodou: false, passou: false, motivo: `nao consegui lancar node: ${codigo}` };
    }
    // exit 1 = os testes rodaram e falharam. E o resultado que o gate quer.
    return { rodou: true, passou: false, saida: `${erro.stdout ?? ''}${erro.stderr ?? ''}` };
  }
};

/**
 * O spec precisa passar **sem** mutacao. Sem este passo, um spec ja quebrado faria todo
 * mutante "morrer" — o gate approve uma suite que nao verifica nada.
 */
const sane = rodarSpec();
if (!sane.rodou) {
  console.error(`REPROVADO — o spec nao pode ser executado: ${sane.motivo}`);
  console.error('  Um portao que nao roda nao pode dizer que os mutantes morreram.');
  process.exit(1);
}
if (!sane.passou) {
  console.error('REPROVADO — o spec ja falha SEM mutacao. O gate mediria um spec quebrado:');
  console.error((sane.saida ?? '').split('\n').slice(0, 14).join('\n'));
  process.exit(1);
}

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

    if (!resultado.rodou) {
      // Um mutante que "morreu" porque o comando nao lancou nao morreu. Contar como morte
      // seria o mesmo erro que este gate tinha antes, so que agora com outra forma.
      sobreviveram++;
      console.log(`  INDETERMINADO  ${mutante.nome} — ${resultado.motivo}`);
      continue;
    }

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