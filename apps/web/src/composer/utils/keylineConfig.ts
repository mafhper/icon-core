import { defaultPartsFor, hasPlatformZone, suggestedPartsFor } from './keylineGeometry';

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
 * quer a grade; quem posiciona um logo quer o centro; quem exporta para a App Store quer a
 * safe area e nenhuma das outras. Com tudo ligado, a tela fica com cinco guias
 * competindo, e a pessoa acaba ignorando a que importa. Ligar tudo é o default porque é
 * o que ensina o que existe - mas ligar **uma** tem de ser o uso comum, e por isso cada
 * parte tem o seu switch.
 *
 * ## Por que a recomendação vem de `keylineGeometry`
 *
 * Porque as **proporções e a recomendação sao o mesmo dado**: só se recomenda uma zona
 * para quem tem zona medida. A primeira versão tinha as duas coisas em lugares separados -
 * `KEYLINE_STANDARDS.suggestedParts` aqui, e `suggestedPartsFor` em `keylineGeometry` - e
 * as duas responderam diferente para o iOS, que era justamente a plataforma que o dono
 * achou "igual às outras". Uma segunda tabela de proporções aqui divergiria da outra na
 * primeira plataforma nova, e a guia passaria a mentir sobre a plataforma que diz
 * representar.
 */

/** As partes desenháveis. Cada uma é uma pergunta diferente. */
export type KeylinePart =
  /** A moldura externa, na máscara da plataforma: "onde é o limite". */
  | 'frame'
  /** A grade de terços/quartos com o eixo central: "onde fica o centro". */
  | 'grid'
  /** O círculo inscrito na máscara: "qual o maior círculo que cabe". */
  | 'circle'
  /**
   * A zona segura da plataforma, com o número que ela define.
   *
   * O nome no schema é `squircle` desde o começo, e mudar o valor gravado quebraria todo
   * projeto salvo sem ganho nenhum: o que mudou foi **o que ele desenha** (a zona real,
   * e não uma caixa de 2/3 inventada), não o rótulo do campo. O switch diz "Safe zone".
   */
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
    // `frame` + `grid`: o genérico não define máscara nem zona, então a grade é a
    // única referência útil.
    suggestedParts: suggestedPartsFor('generic')
  },
  ios: {
    label: 'iOS',
    // A superellipse **é** a máscara do iOS, então o frame já a desenha com o raio
    // certo (22,37%) — uma parte "squircle" seria uma duplicata com outro nome. E a
    // safe-area tracejada vem do documento, não da plataforma, mas é a guia que mais
    // importa aqui: é ela que mostra onde o sistema vai cortar.
    //
    // A versão anterior recomendava `squircle` + `safe-area`, e a primeira desenhava
    // uma caixa de 2/3 que não é número de ninguém. Era daí que vinha a sensação de "o
    // iOS é diferente mas os outros são iguais".
    suggestedParts: defaultPartsFor('ios')
  },
  android: {
    label: 'Android',
    // O Android é o único deste conjunto com zona segura medida: o círculo de 66/108 do
    // adaptive icon. E a zona dele é circular, então ele também ganha o inscrito.
    suggestedParts: suggestedPartsFor('android')
  },
  circle: {
    label: 'Circle',
    suggestedParts: suggestedPartsFor('circle')
  },
  square: {
    label: 'Square',
    suggestedParts: suggestedPartsFor('square')
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
  squircle: 'Platform safe zone',
  'safe-area': 'Safe area'
};

/**
 * Uma parte só vale se o **documento** ou a **plataforma** tem dado para ela.
 *
 * - `safe-area` depende de `canvas.safeArea` existir. Sem ele, o tracejado seria uma caixa
 *   inventada no lugar onde a plataforma recorta, e a pessoa ajustaria a arte a uma margem
 *   que não existe.
 * - `squircle` (a zona da plataforma) depende de a plataforma ter **inset medido** neste
 *   repositório. Hoje só o Android tem. Um switch que liga uma guia sem dado é um switch
 *   que mente — e foi exatamente o que aconteceu com o iOS, que recebia uma caixa de 2/3.
 *
 * Por isso isto recebe a plataforma, e não só um booleano.
 */
export const availableParts = (hasSafeArea: boolean, standard?: KeylineStandard): readonly KeylinePart[] =>
  ALL_KEYLINE_PARTS.filter((part) => {
    if (part === 'safe-area') return hasSafeArea;
    if (part === 'squircle') return standard === undefined || hasPlatformZone(standard);
    return true;
  });