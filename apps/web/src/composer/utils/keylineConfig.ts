/**
 * A keyline: quais partes desenhar, e de qual plataforma.
 *
 * ## O que a keyline é
 *
 * Uma **referência de composição**, nunca arte. Cada parte responde a uma pergunta que a
 * pessoa tem enquanto desenha: "onde cabe", "onde é o centro", "onde não posso encostar".
 *
 * ## Por que as partes são ligáveis
 *
 * Porque as três perguntas raramente valem ao mesmo tempo. Quem desenha um ícone pequeno
 * quer a grade; quem posiciona um logo quer o centro; quem exporta para a App Store quer
 * a safe area e nenhuma das outras. Com tudo ligado, a tela fica com cinco guias
 * competindo, e a pessoa acaba ignorando a que importa. Ligar tudo é o default porque é
 * o que ensina o que existe — mas ligar **uma** tem de ser o uso comum, e por isso cada
 * parte tem o seu switch.
 *
 * ## Por que o tipo de plataforma é dado, e não medido aqui
 *
 * As proporções vêm da plataforma e já estão em `defaultMaskRadius` e em `safeArea` do
 * documento. Este módulo **nomeia** os tipos e diz o que cada um destaca; ele não calcula
 * raio nem insets. Uma segunda tabela de proporções aqui divergiria da outra na primeira
 * plataforma nova, e a guia passaria a mentir sobre a plataforma que diz representar.
 */

/** As partes desenháveis. Cada uma é uma pergunta diferente. */
export type KeylinePart =
  /** A moldura externa: "onde é o limite". */
  | 'frame'
  /** A grade de terços/quartos com o eixo central: "onde fica o centro". */
  | 'grid'
  /** O círculo de inscribed: "qual o maior círculo que cabe". */
  | 'circle'
  /** O retângulo de cantos arredondados do iOS: "onde é a área segura". */
  | 'squircle'
  /** A safe area tracejada do documento: "onde não encostar". */
  | 'safe-area';

/**
 * Os tipos de plataforma, e o que cada um tem de próprio.
 *
 * `squircle` é o do iOS — é a superellipse de 22,37%, e é a mesma constante que o
 * `defaultMaskRadius` e que o `KeylineOverlay` já usavam. `rounded-rectangle` é o
 * genérico, que não pertence a ninguém e serve de base. `circle` e `square` são as duas
 * pontas.
 */
export type KeylineStandard = 'generic' | 'ios' | 'android' | 'circle' | 'square';

export interface KeylineStandardInfo {
  label: string;
  /**
   * As partes que **recomenda** — e o filtro inicial quando o tipo muda.
   *
   * Isto e uma recomendacao, nao um travamento: quem troca de plataforma pode querer a
   * mesma grade de antes. Por isso trocar de tipo **liga** as recomendadas mas nao
   * desliga as outras — desligar algo que a pessoa ligou sem querer seria mais-surpresa
   * do que deixar a grade a mais.
   */
  suggestedParts: readonly KeylinePart[];
}

export const KEYLINE_STANDARDS: Record<KeylineStandard, KeylineStandardInfo> = {
  generic: {
    label: 'Generic',
    suggestedParts: ['frame', 'grid']
  },
  ios: {
    label: 'iOS',
    // O iOS e o caso em que a safe area importa mais: e o que impede o icone de ser
    // cortado pela mascara do sistema.
    suggestedParts: ['frame', 'squircle', 'safe-area']
  },
  android: {
    label: 'Android',
    /**
     * O Android acrescenta o **círculo inscrito** à grade: a máscara adaptativa do
     * Android é recortada por **adaptive icon**, e a zona legível é um círculo de 66/108
     * do foreground (medido no preset `android` de `presets/registry.ts`) — o mesmo
     * número que `safeArea` carrega no documento.
     *
     * Não é a `safe-area` tracejada porque aquela vem do documento e pode não existir;
     * o círculo inscrito pode sempre ser desenhado, e é ele que neste padrão diz onde
     * a arte sobrevive ao recorte.
     */
    suggestedParts: ['frame', 'grid', 'circle']
  },
  circle: {
    label: 'Circle',
    suggestedParts: ['circle']
  },
  square: {
    label: 'Square',
    suggestedParts: ['frame', 'grid']
  }
};

/** Todas as partes, para o painel de controles. */
export const ALL_KEYLINE_PARTS: readonly KeylinePart[] = [
  'frame',
  'grid',
  'circle',
  'squircle',
  'safe-area'
];

/** Rótulos das partes, para o switch de cada uma. */
export const KEYLINE_PART_LABELS: Record<KeylinePart, string> = {
  frame: 'Outer frame',
  grid: 'Center and thirds',
  circle: 'Inscribed circle',
  squircle: 'iOS squircle',
  'safe-area': 'Safe area'
};

/**
 * Uma parte só vale se o **documento** tem dado para ela.
 *
 * A `safe-area` depende de `canvas.safeArea` existir — sem ele o tracejado seria uma
 * caixa inventada no lugar onde a plataforma recorta, e a pessoa ajustaria a arte a uma
 * margem que não existe. Um switch que liga uma guia sem dado é um switch que mente.
 */
export const availableParts = (hasSafeArea: boolean): readonly KeylinePart[] =>
  ALL_KEYLINE_PARTS.filter((part) => part !== 'safe-area' || hasSafeArea);