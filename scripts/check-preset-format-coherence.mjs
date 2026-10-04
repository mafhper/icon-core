/**
 * Coerência formato ↔ plataforma: um preset não pode emitir um arquivo que a plataforma
 * não lê.
 *
 * ## A pergunta que deu origem a este portão
 *
 * O dono perguntou sobre assets de app Android e, ao ver que o `IC72` faria sentido emitir
 * SVG, respondeu: *"Se o Android não lê o SVG, não faz sentido exportar o formato para esse
 * preset."*
 *
 * A regra que saiu disso é mais geral do que Android, e é o que este arquivo verifica:
 *
 * > Um artefato só existe porque **alguma** plataforma do preset sabe ler o formato.
 *
 * ## Por que um portão e não uma conferida
 *
 * A auditoria manual de hoje diz que está tudo coerente — só `electron` e `web` emitem SVG,
 * e ambos leem. Mas conferência manual vale até a próxima vez que alguém acrescenta um
 * preset, e ninguém vai reler a tabela de formatos ao criar artefato. Um artefato sem
 * plataforma que o leia é **silenciosamente inútil**: o export roda, o zip sai, o arquivo
 * abre, e o build da pessoa falha depois.
 *
 * ## A regra de "ao menos uma"
 *
 * Um preset pode cobrir várias plataformas, e `tauri` emite `icon.icns`, que só o macOS lê.
 * Isso está certo: o preset cobre `windows, macos, linux`. Então o critério não é "todas as
 * plataformas leem", e sim **"ao menos uma do preset lê"** — que é o que justifica o
 * artefato existir.
 *
 * ## A tabela de leitura é afirmação de domínio, não dedução
 *
 * `LEITOS_POR_PLATAFORMA` é o que a plataforma consome de fato. Ela é **declarada aqui**,
 * e não inferida do preset: inferir seria circular — o gate passaria porque o preset
 * emite o que ele mesmo afirma ler. Se uma plataforma passar a ler um formato, o lugar de
 * mudar é esta tabela, e a mudança fica visível no diff.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const RAIZ = path.resolve(import.meta.dirname, '..');
const REGISTRY = path.join(RAIZ, 'packages/iconcore-exporters/src/presets/registry.ts');

/**
 * O que cada plataforma sabe ler, entre os formatos que o app emite.
 *
 * - **svg** — web (navegador) e linux (freedesktop). **Não** windows, **não** macos, **não**
 *   android: nenhum dos três tem leitor de SVG para ícone de app.
 * - **ico** — windows. O macOS e o linux aceitam abrir um `.ico`, mas não é o formato
 *   nativo deles e nenhum dos dois o usa por hábito; o export emite `icns` para o macOS.
 * - **icns** — macos.
 * - **png / webp / jpeg** — todas: é imagem raster, e todo sistema de janelas ou
 *   navegador sabe decodificar.
 * - **android** — só raster. O Android lê `VectorDrawable`, que é XML com `<path>` e não
 *   SVG: é um formato diferente com outro nome, e o `ExportFormat` deste repo não tem.
 */
const LEITOS_POR_PLATAFORMA = {
  windows: ['png', 'webp', 'jpeg', 'ico'],
  macos: ['png', 'webp', 'jpeg', 'icns'],
  linux: ['png', 'webp', 'jpeg', 'svg'],
  web: ['png', 'webp', 'jpeg', 'ico', 'svg'],
  android: ['png', 'webp', 'jpeg']
};

/** `ExportPlatform` declara estes quatro; `android` entra com o `IC72`. */
const PLATAFORMAS_DECLARADAS = ['windows', 'macos', 'linux', 'web'];

/**
 * Lê o registry por texto, e não importa.
 *
 * O registry é TypeScript e o repositório compila os pacotes antes de qualquer teste; o
 * portão roda em `validate`, **antes** de `build:packages`. Importar exigiria o `dist`,
 * que ainda não existe nesse momento — e um portão que depende de build anterior é um
 * portão que falha por motivo errado. O formato do arquivo é estável e commentado.
 */
const fonte = readFileSync(REGISTRY, 'utf8');

const blocos = fonte
  .split(/\n  \{\n/)
  .slice(1)
  .map((b) => {
    const id = /id: '([^']+)'/.exec(b)?.[1];
    if (!id) return null;
    const plataformas = (/platforms: \[([^\]]*)\]/.exec(b)?.[1] ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .filter(Boolean);
    // `raster(...)`, `vector(...)` e `container(...)` declaram o formato daartefato.
    const formatos = new Set(
      [...b.matchAll(/\b(raster|vector|container)\(/g)].map((m) => m[1])
    );
    const formats = new Set(
      [...b.matchAll(/format: '([a-z0-9]+)'/g)].map((m) => m[1])
    );
    const porConstrutor = { raster: 'png', vector: 'svg', container: 'ico/icns' };
    return { id, plataformas, formatos: [...formatos].map((k) => porConstrutor[k] ?? k), declared: [...formats] };
  })
  .filter(Boolean);

const violacoes = [];
const avisos = [];

console.log('Coerência formato ↔ plataforma\n');

if (blocos.length === 0) {
  console.error('REPROVADO — o registry não produziu nenhum preset. O parsing quebrou:');
  console.error('  o portão mediu zero e approves zero.');
  process.exit(1);
}

for (const preset of blocos) {
  const linhas = [`  ${preset.id.padEnd(17)}[${preset.plataformas.join(', ') || '—'}]`];
  console.log(linhas[0]);

  if (preset.plataformas.length === 0) {
    // `custom` é o preset "comece em branco": não tem plataformas nem artefatos, por desenho.
    if (preset.formatos.length > 0) {
      violacoes.push(
        `${preset.id}: declara ${preset.formatos.join(', ')} sem nenhuma plataforma — nada pode ler.`
      );
    }
    continue;
  }

  for (const plataforma of preset.plataformas) {
    if (!PLATAFORMAS_DECLARADAS.includes(plataforma) && !LEITOS_POR_PLATAFORMA[plataforma]) {
      violacoes.push(`${preset.id}: plataforma '${plataforma}' não está na tabela de leitura`);
    }
  }

  const leemAlguma = (formato) =>
    formato === 'ico/icns'
      ? preset.plataformas.some((p) => (LEITOS_POR_PLATAFORMA[p] ?? []).includes('ico') || (LEITOS_POR_PLATAFORMA[p] ?? []).includes('icns'))
      : preset.plataformas.some((p) => (LEITOS_POR_PLATAFORMA[p] ?? []).includes(formato));

  for (const formato of preset.formatos) {
    const marca = leemAlguma(formato) ? 'ok  ' : 'RUIM';
    console.log(`      ${marca} ${formato}`);
    if (!leemAlguma(formato)) {
      violacoes.push(
        `${preset.id}: emite ${formato}, e nenhuma das plataformas [${preset.plataformas.join(', ')}] lê ${formato}. ` +
          `Um arquivo que ninguém lê é inútil — o export passa, o build da pessoa falha depois.`
      );
    }
  }

  if (preset.declared.length > 0) {
    avisos.push(`${preset.id}: mistura construtor e formato literal (${preset.declared.join(', ')}) — confira a leitura`);
  }
}

console.log('');
if (avisos.length > 0) {
  console.log('avisos:');
  for (const a of avisos) console.log(`  ${a}`);
  console.log('');
}

if (violacoes.length > 0) {
  console.error(`REPROVADO — ${violacoes.length} incoerência(s):`);
  for (const v of violacoes) console.error(`  ${v}`);
  console.error('\n  Se a plataforma passou a ler o formato, o lugar de mudar é');
  console.error('  LEITOS_POR_PLATAFORMA — e a mudança fica visível no diff.');
  process.exit(1);
}

console.log(`OK — ${blocos.length} presets: todo formato emitido é lido por ao menos uma plataforma do preset.`);