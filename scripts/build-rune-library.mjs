#!/usr/bin/env node
/**
 * Gera `packages/iconcore-library/src/icons.generated.ts` a partir de `assets/icons-rune/`.
 *
 * ```bash
 * node scripts/build-rune-library.mjs <pin-checkout>   # regenera o derivado (exige o pin)
 * node scripts/build-rune-library.mjs --check          # reprova se o derivado divergir da fonte
 * ```
 *
 * ## O que este script é
 *
 * O segundo estágio da ingestão Rune (o primeiro é `scripts/vendor-runeicons.mjs`, que congela
 * os SVGs em `assets/icons-rune/`). Aqui os SVGs — a fonte versionada — viram o módulo de dados
 * que o pacote `@iconcore/library` importa: `ICONS`, um `IconEntry` por id, ordenado, com
 * `id`/`name`/`category`/`tags`/`variants`. O derivado é **versionado** (o pacote o importa
 * como código), e o que garante que ele não diverge é o `--check`, que roda no CI.
 *
 * ## Metadados: do pin, nunca inventados
 *
 * `name`, `category` e `tags` vêm de `lib/icons/manifest.generated.ts` **no pin** (blob sha1
 * conferido — o mesmo pin de `vendor-runeicons.mjs` e de `assets/icons-rune/SOURCE.md`); o
 * script recusa qualquer checkout que não seja o pin. Id sem entrada no manifest cai em
 * `category: "misc"` com nome derivado do id e `tags: []` — e o contador `misc` **reprova**
 * acima de 5% (o teto é o mesmo do vendor). Disponibilidade **não** vem do manifest: quem
 * manda é o disco (a divergência 221/223 do manifest do upstream está travada em SOURCE.md).
 *
 * ## O contrato dos SVGs (re-afirmado aqui, não herdado por confiança)
 *
 * Cada arquivo `assets/icons-rune/<estilo>/<id>.svg` precisa ter a raiz exata
 * `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">`, sem declaração
 * XML, sem comentário, sem `width`/`height`, sem literal de cor `#…` e sem bloco `<style>`
 * (o prefixo de ids abaixo quebraria seletores `#id` em silêncio). O miolo do documento vira
 * `markup`; o viewBox fica no modelo por variante (o pixelated do delta B tem viewBox
 * próprio — 40×41 — e o modelo não pode assumir 24).
 *
 * ## Ids internos prefixados (`prefixInnerIds`) — e o prefixo `glass-` reservado
 *
 * Seis arquivos do subset trazem `id="clip0_…"`/`id="mask0_…"` com referências `url(#…)`.
 * O vendor **reservou** essa reescrita para o estágio de inlining — que é este: o gerador
 * prefixa cada id interno com `<id-do-ícone>--`, a mesma convenção do pacote upstream, para
 * que vários ícones convivam na mesma página sem colisão. E o prefixo `glass-` fica
 * **reservado** ao delta de glass-icons (ainda não embarcado): nenhum id do subset pode
 * começar com ele, e o gerador reprova se começar.
 *
 * ## O que o `--check` prova — e o que ele não prova
 *
 * Prova que o derivado é exatamente o que o gerador produz de `assets/icons-rune/` **mais os
 * metadados registrados no próprio derivado**: conjunto de ids, variantes por id, bytes do
 * markup, ordem, contagens do cabeçalho. Não prova a **procedência** dos metadados (nome/
 * categoria/tags contra o pin) — isso é do modo de geração, que exige o checkout do pin e o
 * confere por blob sha1. É a troca explícita: o CI não tem o corpus local (fora de
 * versionamento), e um `--check` que precisasse dele seria um gate que nunca roda.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FONTE = join(rootDir, 'assets', 'icons-rune');
const DESTINO = join(rootDir, 'packages', 'iconcore-library', 'src', 'icons.generated.ts');

/** As três variantes redistribuídas (fase A). pixelated/glass/sprites são o delta B. */
const ESTILOS = ['normal', 'duotone', 'fill'];

/** O pin aceito — os mesmos valores de `scripts/vendor-runeicons.mjs` e `assets/icons-rune/SOURCE.md`. */
const PIN = '2f2a86a3a96cbf5026e4276d349c50a139bd8a88';
const PIN_MANIFEST_BLOB_SHA1 = 'aa64f8a194d9983c432b053c8318bc05dd132586';

/** Teto de ícones sem metadado no manifest do pin (categoria `misc`). */
const TETO_MISC = 0.05;

/** Prefixo reservado ao delta de glass-icons — nenhum id do subset pode usá-lo. */
const PREFIXO_RESERVADO = 'glass-';

/** Separador do prefixo de ids internos (`layouts-layers-2--clip0_1_3467`), como no upstream. */
const SEPARADOR = '--';

/** A raiz exata exigida dos SVGs vendorizados (medida: 567/567 idêntica). */
const RAIZ_ESPERADA = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">';
const VIEWBOX_ESPERADO = '0 0 24 24';

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const sha1BlobGit = (buf) =>
  crypto.createHash('sha1').update(`blob ${buf.length}\0`, 'utf8').update(buf).digest('hex');

function falhar(mensagem) {
  console.error(`build-rune-library: ${mensagem}`);
  process.exit(1);
}

const listar = (dir) =>
  readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

/** Prefixa os ids internos do miolo com `<id>--` e reescreve `url(#…)`/`href="#…"`. */
function prefixarIdsInternos(markup, id) {
  const prefixo = `${id}${SEPARADOR}`;
  const comPrefixo = markup
    .replace(/\bid="([^"]*)"/g, (_m, interno) => `id="${prefixo}${interno}"`)
    .replace(/url\(#([^)]+)\)/g, (_m, ref) => `url(#${prefixo}${ref})`)
    .replace(/\b(xlink:href|href)="#([^"]*)"/g, (_m, attr, ref) => `${attr}="#${prefixo}${ref}"`);

  // Pós-condições: nada de id/ref interna sem o prefixo (senão dois ícones colidem na página).
  for (const m of comPrefixo.matchAll(/\bid="([^"]*)"/g)) {
    if (!m[1].startsWith(prefixo)) falhar(`id interno sem prefixo em ${id}: "${m[1]}"`);
  }
  for (const m of comPrefixo.matchAll(/url\(#([^)]+)\)/g)) {
    if (!m[1].startsWith(prefixo)) falhar(`referência url(#…) sem prefixo em ${id}: "${m[1]}"`);
  }
  for (const m of comPrefixo.matchAll(/\b(?:xlink:href|href)="#([^"]*)"/g)) {
    if (!m[1].startsWith(prefixo)) falhar(`referência href="#…" sem prefixo em ${id}: "${m[1]}"`);
  }
  return comPrefixo;
}

/**
 * Lê os SVGs do disco e devolve `Map<id, { id, variantes }>` + contagens por estilo.
 * Todas as pós-condições do contrato são afirmadas aqui — nada é aceito por confiança.
 */
function lerIconesDoDisco() {
  const porId = new Map();
  const contagens = {};
  for (const estilo of ESTILOS) {
    const dir = join(FONTE, estilo);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      falhar(`fonte incompleta: falta ${dir} — rode scripts/vendor-runeicons.mjs`);
    }
    let arquivos = 0;
    for (const entrada of listar(dir)) {
      if (!entrada.isFile() || !entrada.name.endsWith('.svg')) continue;
      const id = entrada.name.slice(0, -4);
      if (!KEBAB.test(id)) falhar(`id fora de kebab-case minúsculo (${estilo}): "${id}"`);
      if (id.startsWith(PREFIXO_RESERVADO)) {
        falhar(`id "${id}" usa o prefixo reservado "${PREFIXO_RESERVADO}" (delta glass ainda não embarcado)`);
      }
      const texto = readFileSync(join(dir, entrada.name), 'utf8');

      const raiz = /<svg[^>]*>/.exec(texto)?.[0];
      if (raiz !== RAIZ_ESPERADA) {
        falhar(`${estilo}/${id}.svg: raiz fora do contrato — esperada ${RAIZ_ESPERADA}, lida ${raiz ?? '(sem <svg>)'}`);
      }
      if (/<\?xml|<!--/.test(texto)) falhar(`${estilo}/${id}.svg: declaração XML/comentário no derivado`);
      if (/<\s*style\b/.test(texto)) falhar(`${estilo}/${id}.svg: bloco <style> (prefixo de id quebraria seletores)`);
      if (/="#[0-9A-Fa-f]{3,8}"/.test(texto)) falhar(`${estilo}/${id}.svg: literal de cor #… restou no derivado`);

      const fim = texto.lastIndexOf('</svg>');
      if (fim < 0 || texto.slice(fim + '</svg>'.length).trim() !== '') {
        falhar(`${estilo}/${id}.svg: </svg> ausente ou conteúdo depois da raiz`);
      }
      const markup = prefixarIdsInternos(texto.slice(raiz.length, fim).trim(), id);
      if (markup === '') falhar(`${estilo}/${id}.svg: miolo vazio`);

      const atual = porId.get(id) ?? { id, variantes: {} };
      atual.variantes[estilo] = { viewBox: VIEWBOX_ESPERADO, markup };
      porId.set(id, atual);
      arquivos += 1;
    }
    if (arquivos === 0) falhar(`nenhum SVG em ${dir} — fonte suspeita`);
    contagens[estilo] = arquivos;
  }
  if (porId.size === 0) falhar('nenhum ícone lido — fonte suspeita');
  return { porId, contagens };
}

/** `name`/`category`/`tags` de `lib/icons/manifest.generated.ts` no pin (blob sha1 conferido). */
function lerMetadadosDoPin(pinDir) {
  const manifestPath = join(pinDir, 'lib', 'icons', 'manifest.generated.ts');
  if (!existsSync(manifestPath)) {
    falhar(`checkout incompleto: falta ${manifestPath} — ver assets/icons-rune/SOURCE.md`);
  }
  const buf = readFileSync(manifestPath);
  const blob = sha1BlobGit(buf);
  if (blob !== PIN_MANIFEST_BLOB_SHA1) {
    falhar(
      `o checkout não é o pin ${PIN}: manifest com blob sha1 ${blob}, esperado ${PIN_MANIFEST_BLOB_SHA1}`
    );
  }

  const metadados = new Map();
  for (const linha of buf.toString('utf8').split('\n')) {
    const trim = linha.trim();
    if (!trim.startsWith('{"id"')) continue;
    const entrada = JSON.parse(trim.replace(/,$/, ''));
    if (!entrada.availability) continue; // entradas de glass (fora do subset)
    if (typeof entrada.name !== 'string' || typeof entrada.category !== 'string' || !Array.isArray(entrada.tags)) {
      falhar(`entrada de metadado inválida no manifest do pin: ${trim.slice(0, 80)}…`);
    }
    metadados.set(entrada.id, { name: entrada.name, category: entrada.category, tags: entrada.tags });
  }
  if (metadados.size === 0) falhar('manifest sem entradas de ícones — checkout suspeito');
  return metadados;
}

/** Nome derivado do id quando não há metadado: `nature-plant` → `Nature Plant`. */
const humanizar = (id) =>
  id
    .split('-')
    .map((palavra) => palavra.charAt(0).toUpperCase() + palavra.slice(1))
    .join(' ');

/**
 * Monta as entradas ordenadas por id. `metadados` pode vir do pin (geração) ou do próprio
 * derivado (--check) — o que muda é só a procedência, nunca a forma.
 */
function construirEntradas(porId, metadados) {
  const entradas = [];
  let misc = 0;
  for (const id of [...porId.keys()].sort()) {
    const meta = metadados.get(id);
    if (!meta) misc += 1;
    entradas.push({
      id,
      name: meta?.name ?? humanizar(id),
      category: meta?.category ?? 'misc',
      tags: meta?.tags ?? [],
      variants: porId.get(id).variantes
    });
  }
  const percentualMisc = (misc / entradas.length) * 100;
  if (percentualMisc > TETO_MISC * 100) {
    falhar(
      `misc ${misc}/${entradas.length} (${percentualMisc.toFixed(2)}%) acima do teto de 5% — ` +
        'metadado faltando no manifest do pin para: ' +
        entradas
          .filter((e) => e.category === 'misc' && e.tags.length === 0)
          .map((e) => e.id)
          .join(', ')
    );
  }
  return { entradas, misc };
}

/** Serializa o derivado. Determinístico: mesma fonte + mesmos metadados ⇒ mesmos bytes. */
function serializar(entradas, contagens) {
  const linhas = [];
  linhas.push('// AUTO-GENERATED by scripts/build-rune-library.mjs — do not edit by hand.');
  linhas.push('//');
  linhas.push('// Regerar:  node scripts/build-rune-library.mjs <pin-checkout>');
  linhas.push('// Checar:   node scripts/build-rune-library.mjs --check   (roda no CI)');
  linhas.push('//');
  linhas.push('// Fonte: assets/icons-rune/{normal,duotone,fill} — Rune Icons (Apache-2.0),');
  linhas.push(`// pin ${PIN} (ver assets/icons-rune/SOURCE.md).`);
  linhas.push('// Metadados: lib/icons/manifest.generated.ts no pin (blob sha1');
  linhas.push(`// ${PIN_MANIFEST_BLOB_SHA1}) — nome, categoria e tags;`);
  linhas.push('// id sem entrada cai em categoria "misc" (teto de 5%, imposto pelo gerador).');
  linhas.push(
    `// Contagens: normal=${contagens.normal} duotone=${contagens.duotone} fill=${contagens.fill} — ` +
      `${entradas.length} ids, viewBox ${VIEWBOX_ESPERADO}.`
  );
  linhas.push('// Ids internos (clipPath/mask) prefixados com "<id>--" — seguro para inlining;');
  linhas.push(`// o prefixo "${PREFIXO_RESERVADO}" é reservado ao delta de glass-icons (não embarcado).`);
  linhas.push('');
  linhas.push('/** As três variantes redistribuídas — subconjunto de `IconVariantId` de `@iconcore/shared`. */');
  linhas.push("export type LibraryVariantId = 'normal' | 'duotone' | 'fill';");
  linhas.push('');
  linhas.push('/** Uma variante: o viewBox do documento + o miolo do SVG (sem a tag raiz). */');
  linhas.push('export interface IconVariant {');
  linhas.push('  viewBox: string;');
  linhas.push('  markup: string;');
  linhas.push('}');
  linhas.push('');
  linhas.push('/** Um ícone da biblioteca: identidade, metadados de busca e as variantes disponíveis. */');
  linhas.push('export interface IconEntry {');
  linhas.push('  id: string;');
  linhas.push('  name: string;');
  linhas.push('  category: string;');
  linhas.push('  tags: string[];');
  linhas.push('  variants: Partial<Record<LibraryVariantId, IconVariant>>;');
  linhas.push('}');
  linhas.push('');
  linhas.push('/** Todos os ícones, ordenados por id. */');
  linhas.push('export const ICONS: IconEntry[] = [');
  for (const entrada of entradas) linhas.push(`  ${JSON.stringify(entrada)},`);
  linhas.push('];');
  return linhas.join('\n') + '\n';
}

/** Lê as entradas de um derivado já commitado (uma linha JSON por ícone). */
function parsearDerivado(texto) {
  const entradas = [];
  for (const linha of texto.split('\n')) {
    const trim = linha.trim();
    if (!trim.startsWith('{')) continue;
    try {
      entradas.push(JSON.parse(trim.replace(/,$/, '')));
    } catch {
      falhar(`linha do derivado não é JSON válido: ${trim.slice(0, 80)}…`);
    }
  }
  if (entradas.length === 0) falhar('derivado sem entradas — rode o gerador');
  return entradas;
}

/** Forma das entradas do derivado: única, ordenada, com variantes do subset. */
function validarForma(entradas) {
  const vistos = new Set();
  let anterior = null;
  for (const entrada of entradas) {
    if (typeof entrada.id !== 'string' || !KEBAB.test(entrada.id)) falhar(`id inválido no derivado: ${entrada.id}`);
    if (entrada.id.startsWith(PREFIXO_RESERVADO)) {
      falhar(`id "${entrada.id}" usa o prefixo reservado "${PREFIXO_RESERVADO}" no derivado`);
    }
    if (vistos.has(entrada.id)) falhar(`id duplicado no derivado: ${entrada.id}`);
    vistos.add(entrada.id);
    if (anterior !== null && !(anterior < entrada.id)) {
      falhar(`derivado fora de ordem: "${anterior}" antes de "${entrada.id}"`);
    }
    anterior = entrada.id;
    if (typeof entrada.name !== 'string' || entrada.name === '') falhar(`nome vazio em ${entrada.id}`);
    if (typeof entrada.category !== 'string' || entrada.category === '') falhar(`categoria vazia em ${entrada.id}`);
    if (!Array.isArray(entrada.tags) || entrada.tags.some((t) => typeof t !== 'string')) {
      falhar(`tags inválidas em ${entrada.id}`);
    }
    const variantes = Object.keys(entrada.variants ?? {});
    if (variantes.length === 0) falhar(`${entrada.id} sem variante`);
    for (const estilo of variantes) {
      if (!ESTILOS.includes(estilo)) falhar(`${entrada.id} com variante fora do subset: "${estilo}"`);
    }
  }
  return vistos;
}

function modoCheck() {
  if (!existsSync(DESTINO)) {
    falhar(`derivado ausente: ${DESTINO} — rode o gerador (node scripts/build-rune-library.mjs <pin-checkout>)`);
  }
  const commitado = readFileSync(DESTINO, 'utf8');
  const entradasCommitadas = parsearDerivado(commitado);
  validarForma(entradasCommitadas);

  const { porId, contagens } = lerIconesDoDisco();
  const idsDisco = new Set(porId.keys());
  const idsArquivo = new Set(entradasCommitadas.map((e) => e.id));

  const faltandoNoArquivo = [...idsDisco].filter((id) => !idsArquivo.has(id)).sort();
  const sobrandoNoArquivo = [...idsArquivo].filter((id) => !idsDisco.has(id)).sort();
  if (faltandoNoArquivo.length > 0) {
    falhar(
      `SVGs sem entrada no derivado (rode o gerador): ${faltandoNoArquivo.slice(0, 10).join(', ')}` +
        (faltandoNoArquivo.length > 10 ? ` … +${faltandoNoArquivo.length - 10}` : '')
    );
  }
  if (sobrandoNoArquivo.length > 0) {
    falhar(
      `entradas no derivado sem SVG na fonte (rode o gerador): ${sobrandoNoArquivo.slice(0, 10).join(', ')}` +
        (sobrandoNoArquivo.length > 10 ? ` … +${sobrandoNoArquivo.length - 10}` : '')
    );
  }

  // Metadados registrados no próprio derivado — o que o --check pode usar sem o corpus.
  const metadados = new Map(
    entradasCommitadas.map((e) => [e.id, { name: e.name, category: e.category, tags: e.tags }])
  );
  const { entradas } = construirEntradas(porId, metadados);
  const esperado = serializar(entradas, contagens);

  if (esperado !== commitado) {
    const linhasEsperado = esperado.split('\n');
    const linhasCommitado = commitado.split('\n');
    let primeira = 0;
    while (
      primeira < linhasEsperado.length &&
      primeira < linhasCommitado.length &&
      linhasEsperado[primeira] === linhasCommitado[primeira]
    ) {
      primeira += 1;
    }
    console.error(`build-rune-library --check: derivado DIVERGE da fonte (primeira linha ${primeira + 1})`);
    console.error(`  esperado:  ${(linhasEsperado[primeira] ?? '(fim)').slice(0, 160)}`);
    console.error(`  commitado: ${(linhasCommitado[primeira] ?? '(fim)').slice(0, 160)}`);
    console.error('  rode: node scripts/build-rune-library.mjs <pin-checkout>');
    process.exit(1);
  }

  console.log(
    `build-rune-library --check OK: ${entradas.length} ids; normal=${contagens.normal} ` +
      `duotone=${contagens.duotone} fill=${contagens.fill}; derivado em dia com assets/icons-rune/`
  );
}

function modoGerar(pinDir) {
  if (!existsSync(pinDir) || !statSync(pinDir).isDirectory()) {
    falhar(`checkout do pin não encontrado: ${pinDir} — ver assets/icons-rune/SOURCE.md`);
  }
  const metadados = lerMetadadosDoPin(pinDir);
  const { porId, contagens } = lerIconesDoDisco();
  const { entradas, misc } = construirEntradas(porId, metadados);
  const conteudo = serializar(entradas, contagens);

  // O derivado passa pela mesma validação que o --check aplica antes de ser escrito.
  validarForma(parsearDerivado(conteudo));

  const atual = existsSync(DESTINO) ? readFileSync(DESTINO, 'utf8') : null;
  if (atual === conteudo) {
    console.log('build-rune-library: derivado já em dia (nada escrito)');
  } else {
    mkdirSync(dirname(DESTINO), { recursive: true });
    writeFileSync(DESTINO, conteudo, 'utf8');
    console.log(`build-rune-library: derivado escrito em ${DESTINO.replace(rootDir + '\\', '').replace(rootDir + '/', '')}`);
  }

  console.log(`  fonte: assets/icons-rune/ — pin ${PIN}`);
  console.log(`  normal=${contagens.normal} duotone=${contagens.duotone} fill=${contagens.fill} misc=${misc}`);
  console.log(`  ids=${entradas.length}; ids internos prefixados com "<id>--"; prefixo "${PREFIXO_RESERVADO}" reservado`);
}

const argumentos = process.argv.slice(2);
if (argumentos.includes('--help') || argumentos.includes('-h')) {
  console.log('uso: node scripts/build-rune-library.mjs <pin-checkout>   # regenera o derivado');
  console.log('     node scripts/build-rune-library.mjs --check          # verifica o derivado (CI)');
  console.log('  <pin-checkout>: checkout do commit do pin (ver assets/icons-rune/SOURCE.md)');
  process.exit(0);
}
if (argumentos.length === 1 && argumentos[0] === '--check') {
  modoCheck();
} else if (argumentos.length === 1 && !argumentos[0].startsWith('--')) {
  modoGerar(resolve(argumentos[0]));
} else {
  console.error('uso: node scripts/build-rune-library.mjs <pin-checkout> | --check');
  process.exit(1);
}
