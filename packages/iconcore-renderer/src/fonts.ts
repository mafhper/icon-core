/**
 * As fontes que o Icon Core oferece, e de onde cada uma vem.
 *
 * ## O problema que este arquivo existe para resolver
 *
 * Uma camada de texto carregava `fontFamily: 'Inter, Sora, system-ui, sans-serif'` como uma
 * string **fixa**, sem nenhum controle na UI. E o export SVG emite essa string:
 *
 * ```
 * <text font-family="Inter, Sora, system-ui, sans-serif">...</text>
 * ```
 *
 * Duas consequencias, e a segunda e a que dói:
 *
 * 1. Nao havia como trocar a fonte. O campo era editavel so abrindo o `.iconcore.json` na mao.
 * 2. **Inter e Sora nao vêm com o projeto** — nao ha um unico `.woff2` no repositorio. O
 *    navegador e o rasterizador caem no `system-ui`, e o `favicon.svg` / `icon.svg` saem com
 *    o **nome** de uma fonte que quase ninguem tem instalada. O icone que a pessoa desenha e
 *    o icone que ela ve no preview **sao coisas diferentes**, e so no editor.
 *
 * A correcao nao e so um seletor: e fazer a fonte ser uma coisa **declarada**, com origem,
 * licenca e presenca conhecidas.
 *
 * ## As tres origens, e o que cada uma promete
 *
 * | origem | o que e | preview | export SVG |
 * |---|---|---|---|
 * | `bundled` | o projeto distribui o arquivo | exato | o nome resolve **na maquina de quem abre** |
 * | `system` | a pessoa escolhe uma fonte instalada | depende do que o canvas resolve | idem |
 * | `generic` | `sans-serif`, `monospace`, … | exato | **sempre** resolve |
 *
 * Repare na coluna da direita: **para o SVG, `bundled` e `system` sao a mesma promessa**, e
 * as duas dependem de quem abre. Isso e o que `EXPORT_FIDELITY` de `packages/iconcore-renderer`
 * mede, e e honesto dizer aqui em vez de prometer autonomia que o SVG nao tem.
 *
 * `generic` e a unica familia que resolve em qualquer maquina — e por isso o default novo e
 * `generic`, e nao uma fonte embarcada.
 *
 * ## Por que o default virou `system-ui` e nao Cal Sans
 *
 * Porque o default precisa ser o que **nao falha**. Cal Sans e a primeira choice de quem
 * quer um desenho com personalidade — e ela e a unica que o preview e o PNG mostram
 * identicos ao que a pessoa escolheu, porque o arquivo esta aqui. Mas o default e o que
 * ninguem precisa instalar.
 */
import { GENERIC_FONT_FAMILIES } from '@iconcore/shared';

/** De onde a fonte vem. Determina o que o export SVG pode prometer. */
export type FontOrigin = 'bundled' | 'system' | 'generic';

export interface IconFont {
  /** O valor gravado em `text.fontFamily`. E a chave de tudo. */
  id: string;
  /** O nome que a pessoa ve no seletor. */
  label: string;
  origin: FontOrigin;
  /**
   * O que o export SVG entrega para esta fonte.
   *
   * `self-contained` seria o ideal e **nao e verdade** para `<text>`: um SVG que carrega
   * apenas o nome da familia depende da maquina de quem abre. Isso fica escrito aqui, no
   * lugar onde a lista e mantida, em vez de em um aviso que ninguem le.
   */
  svgFidelity: 'as-designed-anywhere' | 'substitutes-without-font';
  /** Um retracted: a fonte precisa estar em `assets/fonts/` e registrada em `third-party/`. */
  bundledPath?: string;
}

/**
 * As fontes embarcadas.
 *
 * `bundledPath` e o arquivo que o `@font-face` carrega, e o gate de third-party exige que
 * ele exista e tenha licenca. Uma fonte listada aqui sem arquivo e uma promessa vazia — e o
 * comentario do `IconFont` diz por que a lista so cresce por evidencia.
 */
export const BUNDLED_FONTS: readonly IconFont[] = [
  {
    id: "'Cal Sans'",
    label: 'Cal Sans',
    origin: 'bundled',
    svgFidelity: 'substitutes-without-font',
    bundledPath: 'assets/fonts/CalSans-Regular.woff2'
  }
];

/**
 * O nome que a pessoa ve. O valor gravado e a palavra do CSS — muda-lo mudaria o schema.
 *
 * Declarado **antes** de `GENERIC_FONTS` porque um `const` nao sofre hoisting: a ordem
 * deste arquivo e parte do contrato, e o `ReferenceError` na primeira execucao e o que
 *xx a ordem.
 */
const GENERIC_LABELS: Record<string, string> = {
  'system-ui': 'System UI',
  'sans-serif': 'Sans',
  serif: 'Serif',
  monospace: 'Monospace',
  cursive: 'Cursive',
  fantasy: 'Fantasy'
};

/**
 * As familias genericas.
 *
 * Sao as unicas que resolvem em qualquer maquina: o nome e um alias do agente de usuario,
 * nao uma fonte. E sao o default, porque o default nao pode falhar.
 *
 * A lista vem de `GENERIC_FONT_FAMILIES`, no `shared` — e nao daqui, porque e o **validador**
 * que precisa dela para avisar "esse icone carrega o nome de uma fonte", e o validador nao
 * pode depender do renderer. Declarar aqui e reexportar seria a segunda fonte de verdade.
 */
export const GENERIC_FONTS: readonly IconFont[] = GENERIC_FONT_FAMILIES.map((id) => ({
  id,
  label: GENERIC_LABELS[id],
  origin: 'generic' as const,
  svgFidelity: 'as-designed-anywhere' as const
}));

/** O default. Uma familia generica: resolve no editor, no PNG e no SVG, em qualquer maquina. */
export const DEFAULT_FONT_ID = 'system-ui';

/** A pilha de fallback gravada em `text.fontFamily`. */
export const DEFAULT_FONT_STACK = 'system-ui, sans-serif';

/**
 * A lista do seletor: embarcadas primeiro, depois as genericas.
 *
 * As de sistema entram em runtime (ver `listSystemFonts`), porque so o navegador sabe o
 * que a pessoa tem instalado — e a lista muda de maquina para maquina.
 */
export const SELECTABLE_FONTS: readonly IconFont[] = [...BUNDLED_FONTS, ...GENERIC_FONTS];

/** A fonte com este id, ou `undefined` se nao for conhecida. */
export const fontById = (id: string): IconFont | undefined =>
  SELECTABLE_FONTS.find((f) => f.id === id) ||
  GENERIC_FONTS.find((f) => f.id === id);

/** O `svgFidelity` de uma fonte, para o validador. */
export const svgFidelityOf = (id: string): IconFont['svgFidelity'] =>
  fontById(id)?.svgFidelity ?? 'substitutes-without-font';

/**
 * Uma fonte e embarcada **de verdade** quando o arquivo existe.
 *
 * `BUNDLED_FONTS` declara a intencao; esta funcao mede. A diferenca importa porque uma
 * fonte listada sem arquivo falha em silencio: o preview cai no fallback, e a pessoa acha
 * que escolheu e nao escolheu.
 */
export const hasBundledFile = (font: IconFont, exists: (p: string) => boolean): boolean =>
  font.origin !== 'bundled' || (font.bundledPath !== undefined && exists(font.bundledPath));
