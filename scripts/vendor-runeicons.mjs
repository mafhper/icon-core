#!/usr/bin/env node
/**
 * Vendoriza os SVGs do Rune Icons para `assets/icons-rune/`, a partir de um checkout do pin.
 *
 * ```bash
 * node scripts/vendor-runeicons.mjs <pin-checkout>   # gera assets/icons-rune/{normal,duotone,fill}/
 * ```
 *
 * O pin (commit, licença, contagens) e as transformações aplicadas estão documentados em
 * `assets/icons-rune/SOURCE.md`. Resumo do contrato deste script:
 *
 * ## O que copia
 *
 * - `public/normal` — tudo (221 arquivos no pin);
 * - `public/duotone` — tudo (218);
 * - `public/fill` — só o que existe (129; cobertura parcial — o fallback para `normal` é
 *   responsabilidade de quem consome, não desta etapa).
 *
 * ## O que nunca toca
 *
 * `pixelated/`, `glass-icons/`, `brand-logos/` (guarda nega a leitura), sprites, e qualquer
 * código de site/editor/pacotes do upstream (o pin é lido só em `public/{normal,duotone,fill}`
 * e em `lib/icons/manifest.generated.ts`).
 *
 * ## Normalizações (byte da fonte → byte do derivado)
 *
 * - `stroke="black"` e `fill="black"` → `currentColor`;
 * - cinzas da tabela `CINZAS` → `currentColor` + `stroke-opacity`/`fill-opacity` documentados
 *   (opacidade = 1 − média(R,G,B)/255, arredondada; preserva o valor sobre fundo branco);
 * - `viewBox` exigido exatamente `0 0 24 24` — qualquer outro é falha, exceto ids em
 *   `EXCLUIDOS` (que não são vendorizados e são reportados);
 * - `width`/`height` do `<svg>` raiz removidos;
 * - declaração XML e comentários removidos (defensivo; o pin não tem nenhum);
 * - `white` não é normalizado: é mecânica de `clipPath`/`mask` (retângulo de recorte) e
 *   detalhe de recorte; convertê-lo quebraria o mascaramento;
 * - `prefixInnerIds` fica **reservado**: ids internos (clipPath/mask de 6 arquivos) não são
 *   reescritos nesta etapa — a reserva é do estágio de inlining.
 *
 * ## Determinismo
 *
 * O script confere que o checkout é o pin (blob sha1 do manifest) e que o conjunto-fonte bate
 * com `DIGEST_FONTE`. Os digests do que foi vendorizado são impressos no fim e registrados em
 * `assets/icons-rune/SOURCE.md` — re-executar sobre o mesmo pin produz os mesmos bytes.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(rootDir, 'assets', 'icons-rune');
const ESTILOS = ['normal', 'duotone', 'fill'];

/** O pin aceito: commit, blob sha1 do manifest e digest do conjunto-fonte (public/{normal,duotone,fill}). */
const PIN = '2f2a86a3a96cbf5026e4276d349c50a139bd8a88';
const PIN_MANIFEST_BLOB_SHA1 = 'aa64f8a194d9983c432b053c8318bc05dd132586';
const DIGEST_FONTE = 'c95cfdf45489f78b16b50f0fae30c61897212772546506033a72a261a82d28e8';

/**
 * Ids vendorizáveis que violam o contrato `viewBox="0 0 24 24"` e ficam de fora (reportados).
 * `nature-plant` é `0 0 26 29` no pin — não é um ícone 24×24; incluí-lo quebraria o requisito.
 */
const EXCLUIDOS = new Set(['nature-plant']);

/** Cinzas do pin → opacidade documentada (1 − média(R,G,B)/255, arredondada a 2 casas). */
const CINZAS = new Map([
  ['#1C1F21', '0.88'],
  ['#A4A5A6', '0.35'],
  ['#DDDDDD', '0.13'],
  ['#D9D9D9', '0.15'],
  ['#F3F3F3', '0.05']
]);

/** Teto de ícones sem metadado no manifest do pin (categoria `misc`). */
const TETO_MISC = 0.05;

/** Guarda: diretórios do upstream que nunca podem ser lidos. */
const PROIBIDOS = ['brand-logos', 'pixelated', 'glass-icons'];

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const sha1BlobGit = (buf) =>
  crypto.createHash('sha1').update(`blob ${buf.length}\0`, 'utf8').update(buf).digest('hex');

function falhar(mensagem) {
  console.error(`vendor-runeicons: ${mensagem}`);
  process.exit(1);
}

function guardaCaminho(abs) {
  const segmentos = abs.split(/[\\/]/);
  for (const proibido of PROIBIDOS) {
    if (segmentos.includes(proibido)) {
      falhar(`guarda negou a leitura de ${abs} (contém "${proibido}")`);
    }
  }
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validarKebab(valor, contexto) {
  if (!KEBAB.test(valor)) {
    falhar(`id fora de kebab-case minúsculo (${contexto}): "${valor}"`);
  }
}

/** Enumeradores ordenados para determinismo. */
const listar = (dir) => readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));

function main() {
  const argumentos = process.argv.slice(2);
  if (argumentos.length !== 1 || argumentos[0] === '--help' || argumentos[0] === '-h') {
    console.log('uso: node scripts/vendor-runeicons.mjs <pin-checkout>');
    console.log('  <pin-checkout>: checkout do commit do pin (ver assets/icons-rune/SOURCE.md)');
    process.exit(argumentos.length === 1 ? 0 : 1);
  }
  const fonte = resolve(argumentos[0]);

  // ---- 1. O checkout é o pin?
  for (const estilo of ESTILOS) {
    const dir = join(fonte, 'public', estilo);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      falhar(`checkout incompleto: falta ${join(fonte, 'public', estilo)} — ver assets/icons-rune/SOURCE.md`);
    }
  }
  const caminhoManifest = join(fonte, 'lib', 'icons', 'manifest.generated.ts');
  if (!existsSync(caminhoManifest)) {
    falhar(`checkout incompleto: falta ${caminhoManifest} — ver assets/icons-rune/SOURCE.md`);
  }
  const manifestBuf = readFileSync(caminhoManifest);
  const manifestBlob = sha1BlobGit(manifestBuf);
  if (manifestBlob !== PIN_MANIFEST_BLOB_SHA1) {
    falhar(
      `o checkout não é o pin ${PIN}: manifest com blob sha1 ${manifestBlob}, esperado ${PIN_MANIFEST_BLOB_SHA1}`
    );
  }

  // ---- 2. Metadados do manifest (id → entrada). O manifest do upstream não é autoridade de
  // contagem (ver SOURCE.md, divergência 221/223), mas é a fonte de metadado dos ids.
  const idsComMetadado = new Set();
  let entradas = 0;
  let flagsNormal = 0;
  let flagsDuotone = 0;
  let flagsFill = 0;
  for (const linha of manifestBuf.toString('utf8').split('\n')) {
    const trim = linha.trim();
    if (!trim.startsWith('{"id"')) continue;
    const entrada = JSON.parse(trim.replace(/,$/, ''));
    entradas += 1;
    if (!entrada.availability) continue; // entradas de glass (fora do vendor)
    idsComMetadado.add(entrada.id);
    if (entrada.availability.normal) flagsNormal += 1;
    if (entrada.availability.duotone) flagsDuotone += 1;
    if (entrada.availability.fill) flagsFill += 1;
  }
  if (idsComMetadado.size === 0) falhar('manifest sem entradas de ícones — checkout suspeito');

  // ---- 3. Enumeração + id + guarda + colisão.
  const porEstilo = new Map();
  const linhasFonte = [];
  const colisoes = [];
  for (const estilo of ESTILOS) {
    const arquivos = [];
    const dirEstilo = join(fonte, 'public', estilo);
    guardaCaminho(dirEstilo);
    for (const categoria of listar(dirEstilo)) {
      if (!categoria.isDirectory()) continue;
      validarKebab(categoria.name, `${estilo} (categoria)`);
      const dirCategoria = join(dirEstilo, categoria.name);
      guardaCaminho(dirCategoria);
      for (const arquivo of listar(dirCategoria)) {
        if (!arquivo.isFile() || !arquivo.name.endsWith('.svg')) continue;
        const base = arquivo.name.slice(0, -4);
        validarKebab(base, `${estilo}/${categoria.name}`);
        const id = `${categoria.name}-${base}`;
        const caminhoAbs = join(dirCategoria, arquivo.name);
        guardaCaminho(caminhoAbs);
        const destino = `${estilo}/${id}.svg`;
        if (arquivos.some((a) => a.destino === destino)) {
          colisoes.push(`${destino} (em ${caminhoAbs})`);
        }
        const buf = readFileSync(caminhoAbs);
        linhasFonte.push(`${estilo}/${categoria.name}/${arquivo.name} ${sha256(buf)}`);
        arquivos.push({ id, destino, caminhoAbs, buf });
      }
    }
    if (arquivos.length === 0) falhar(`nenhum SVG em public/${estilo} — checkout suspeito`);
    porEstilo.set(estilo, arquivos);
  }
  if (colisoes.length > 0) {
    falhar(`colisão de id no destino:\n  ${colisoes.join('\n  ')}`);
  }

  // ---- 4. O conjunto-fonte bate com o pin?
  linhasFonte.sort();
  const digestFonte = sha256(Buffer.from(linhasFonte.join('\n') + '\n', 'utf8'));
  if (digestFonte !== DIGEST_FONTE) {
    falhar(
      `conjunto-fonte diferente do pin ${PIN} (digest ${digestFonte}, esperado ${DIGEST_FONTE}) — ` +
        'fez checkout do commit certo?'
    );
  }

  // ---- 5. Transformação (nada é escrito antes de tudo validar).
  const excluidos = [];
  const saida = new Map();
  const idsVendorizados = new Set();
  for (const estilo of ESTILOS) {
    const escritos = [];
    for (const arquivo of porEstilo.get(estilo)) {
      let texto = arquivo.buf.toString('utf8');

      const raiz = texto.match(/<svg[^>]*>/)?.[0];
      if (!raiz) falhar(`sem <svg> raiz em ${arquivo.destino}`);
      if (!raiz.includes('viewBox="0 0 24 24"')) {
        if (EXCLUIDOS.has(arquivo.id)) {
          excluidos.push(`${estilo}/${arquivo.id}`);
          continue;
        }
        falhar(
          `${estilo}/${arquivo.id}: viewBox diferente de "0 0 24 24" (${raiz}) — contrato do vendor é 24×24`
        );
      }

      texto = texto.replace(/<\?xml[^>]*\?>\s*/g, '');
      texto = texto.replace(/<!--[\s\S]*?-->/g, '');
      texto = texto.replace(raiz, raiz.replace(/\s+(?:width|height)="[^"]*"/g, ''));
      texto = texto.replaceAll('stroke="black"', 'stroke="currentColor"');
      texto = texto.replaceAll('fill="black"', 'fill="currentColor"');
      for (const [hex, opacidade] of CINZAS) {
        texto = texto.replaceAll(
          `stroke="${hex}"`,
          `stroke="currentColor" stroke-opacity="${opacidade}"`
        );
        texto = texto.replaceAll(
          `fill="${hex}"`,
          `fill="currentColor" fill-opacity="${opacidade}"`
        );
      }

      // Pós-condições: o derivado não pode carregar o que a normalização remove.
      if (/<svg[^>]*\s(?:width|height)=/.test(texto)) falhar(`${arquivo.destino}: width/height no root`);
      if (!/<svg[^>]*viewBox="0 0 24 24"/.test(texto)) falhar(`${arquivo.destino}: viewBox perdido`);
      if (/stroke="black"|fill="black"/.test(texto) || /(?:fill|stroke)="#[0-9A-Fa-f]{6}"/.test(texto)) {
        falhar(`${arquivo.destino}: literal de cor restou no derivado`);
      }
      if (texto.includes('<!--') || texto.includes('<?xml')) {
        falhar(`${arquivo.destino}: comentário/declaração XML restou no derivado`);
      }

      idsVendorizados.add(arquivo.id);
      escritos.push({ ...arquivo, texto });
    }
    saida.set(estilo, escritos);
  }

  // ---- 6. misc: id vendorizado sem metadado no manifest do pin (teto 5%).
  const misc = [...idsVendorizados].filter((id) => !idsComMetadado.has(id));
  const percentualMisc = (misc.length / idsVendorizados.size) * 100;
  if (percentualMisc > TETO_MISC * 100) {
    falhar(
      `misc ${misc.length}/${idsVendorizados.size} (${percentualMisc.toFixed(2)}%) acima do teto de 5%: ${misc.join(', ')}`
    );
  }

  // ---- 7. Escreve: limpa só os *.svg dos diretórios gerados e grava o conjunto novo.
  const contagens = {};
  let bytes = 0;
  const linhasVendor = [];
  for (const estilo of ESTILOS) {
    const dirDestino = join(DEST, estilo);
    mkdirSync(dirDestino, { recursive: true });
    for (const nome of readdirSync(dirDestino)) {
      if (nome.endsWith('.svg')) rmSync(join(dirDestino, nome));
    }
    const escritos = saida.get(estilo);
    for (const arquivo of escritos) {
      writeFileSync(join(dirDestino, `${arquivo.id}.svg`), arquivo.texto, 'utf8');
      const buf = Buffer.from(arquivo.texto, 'utf8');
      bytes += buf.length;
      linhasVendor.push(`${estilo}/${arquivo.id}.svg ${sha256(buf)}`);
    }
    contagens[estilo] = escritos.length;
  }
  linhasVendor.sort();
  const digestVendor = sha256(Buffer.from(linhasVendor.join('\n') + '\n', 'utf8'));

  // ---- 8. Relatório.
  console.log(`Rune Icons — pin ${PIN}`);
  console.log(`  manifest do pin: ${entradas} entradas; flags normal=${flagsNormal} duotone=${flagsDuotone} fill=${flagsFill}`);
  console.log(`  fonte: ${linhasFonte.length} SVGs, digest ${digestFonte}`);
  if (excluidos.length > 0) console.log(`  excluídos (viewBox != 24×24): ${excluidos.join(', ')}`);
  console.log(
    `normal=${contagens.normal} duotone=${contagens.duotone} fill=${contagens.fill} misc=${misc.length}`
  );
  console.log(
    `  misc: ${misc.length} de ${idsVendorizados.size} ids (${percentualMisc.toFixed(2)}%, teto 5%)` +
      (misc.length > 0 ? ` — sem metadado: ${misc.join(', ')}` : '')
  );
  console.log(`  vendorizado: ${linhasVendor.length} arquivos, ${bytes} B, digest ${digestVendor}`);
  console.log(`  escrito em assets/icons-rune/{${ESTILOS.join(',')}}/`);
}

main();
