import { defaultMaskRadius } from '@iconcore/shared';
import type { KeylinePart, KeylineStandard } from './keylineConfig';

/**
 * A geometria de cada plataforma — a mesma que o export usa.
 *
 * ## O problema que este arquivo resolve
 *
 * O dono viu que "apenas dois presets sao verdadeiramente diferentes. O iOS e os outros
 * (que parecem ser iguais)". Estava certo: a lista anterior de partes era quase a mesma
 * para `generic`, `android` e `square`, e so o iOS desenhava algo diferente.
 *
 * A causa nao era a lista: era que **as partes nao carregavam numero**. Um "circulo
 * inscrito" e um "circulo inscrito" sao a mesma linha, em qualquer plataforma.
 *
 * ## O erro que este arquivo ja cometeu, e corrigiu
 *
 * A primeira versao tratava `0.2237` (iOS) e `66/108` (Android) como se fossem **as duas
 * a mesma coisa** — uma "fracao de zona segura". Sao medidas diferentes:
 *
 * - **Android `66/108`** e a **zona legivel** do adaptive icon: o diametro central que
 *   sobrevive ao recorte. O recuo de cada borda e `(108 - 66) / 2 = 21`.
 * - **iOS `0.2237`** e o **raio de canto** da superellipse. Nao e zona: e o formato da
 *   mascara.
 *
 * Tratar os dois como "fracao" deu 156px para o Android e 57px para o iOS — e a comparacao
 * "Android e mais restritivo" saiu **invertida**, porque 0,61 > 0,22. Um numero usado
 * com o nome errado e pior que um numero ausente: ele nao soa errado.
 *
 * Por isso `safeFraction` e `null` para o iOS. **Nao ha zona segura do iOS medida neste
 * repositorio**, e inventar uma seria a mesma mentira em forma nova.
 */

/**
 * O recuo de **cada borda** do adaptive icon.
 *
 * A zona segura tem 66dp de lado num canvas de 108dp, entao sobram `108 - 66 = 42` —
 * e essa sobra e dividida entre as duas bordas. Logo `(108 - 66) / 2 = 21`, e a fracao e
 * `21 / 108`.
 *
 * Dividir por 108 sem o `/ 2` daria `0,389` — o dobro do recuo, e a guia entraria ate a
 * metade do canvas. Foi o que aconteceu na primeira versao, e o teste de "soma com o
 * diametro" pegou: `0,389 × 2 + 0,611 = 1,389`, e nao 1.
 */
export const ANDROID_INSET_FRACTION = (108 - 66) / 2 / 108;

/** O diametro da zona legivel do Android, como fracao do lado: `66 / 108`. */
export const ANDROID_SAFE_FRACTION = 66 / 108;

/** O raio de canto da superellipse do iOS. Formato da mascara, nao zona. */
export const IOS_SQUIRCLE_FRACTION = 0.2237;

export interface KeylineGeometry {
  /** A forma da mascara da plataforma. */
  mask: 'squircle' | 'circle' | 'rounded-rectangle' | 'square';
  /**
   * O **recuo de cada borda**, como fracao do lado. `null` = esta plataforma nao tem
   * zona segura medida neste repositorio.
   */
  insetFraction: number | null;
}

export const KEYLINE_GEOMETRY: Record<KeylineStandard, KeylineGeometry> = {
  ios: {
    mask: 'squircle',
    // `null`, e nao `0.2237`: o que o iOS define e o raio da mascara, que e desenhado
    // pelo `mask`, e nao uma zona interna.
    insetFraction: null
  },
  android: {
    mask: 'circle',
    insetFraction: ANDROID_INSET_FRACTION
  },
  generic: { mask: 'rounded-rectangle', insetFraction: null },
  circle: { mask: 'circle', insetFraction: null },
  square: { mask: 'square', insetFraction: null }
};

/**
 * O recuo em px, ou `null`.
 *
 * E **isto** que a guia desenha: uma caixa recuada da borda por `inset`, que e onde a arte
 * precisa caber. O `0` seria uma guia degenerada no canto — por isso `null` e "nao tem".
 */
export const safeInsetPx = (standard: KeylineStandard, size: number): number | null => {
  const f = KEYLINE_GEOMETRY[standard].insetFraction;
  return f === null ? null : size * f;
};

/**
 * A plataforma tem zona segura medida neste repositorio?
 *
 * E o que decide se o switch da zona existe: hoje so o Android. Um switch que liga uma
 * guia sem dado e um switch que mente.
 */
export const hasPlatformZone = (standard: KeylineStandard): boolean =>
  KEYLINE_GEOMETRY[standard].insetFraction !== null;

/** O diametro da zona legivel, ou `null`. */
export const safeDiameterPx = (standard: KeylineStandard, size: number): number | null => {
  const f = KEYLINE_GEOMETRY[standard].insetFraction;
  return f === null ? null : size - 2 * size * f;
};

/**
 * As partes de uma plataforma, e **por que**.
 *
 * Uma plataforma so recomenda uma parte que ela **realmente restringe**:
 *
 * - `squircle` (a zona) so entra no Android, o unico deste conjunto com uma zona segura
 *   medida. No iOS a superellipse ja e a **mascara**, desenhada pelo frame — uma segunda
 *   caixa seria uma duplicata.
 * - `circle` (o inscrito) entra no Android, porque a zona dele e circular.
 * - `grid` (centro e tercos) entra nos que **nao** tem mascara definida: sao a unica
 *   referencia util nesses.
 *
 * E o que responde a pergunta do dono: iOS e Android **nao** desenham as mesmas partes,
 * e a diferenca tem numero.
 */
/**
 * As partes ligadas ao escolher uma plataforma: a recomendacao **e** a safe area.
 *
 * E maior que `suggestedPartsFor` porque a `safe-area` tracejada vem de
 * `canvas.safeArea` — do documento, nao da plataforma. No iOS ela importa mais do que
 * qualquer outra guia: e o tracejado que mostra onde o sistema vai cortar, enquanto a
 * superellipse e so a borda. Trocar para iOS **liga** a safe area; a pessoa pode desligar.
 */
export const defaultPartsFor = (standard: KeylineStandard): readonly KeylinePart[] =>
  standard === 'ios' ? ['frame', 'safe-area'] : suggestedPartsFor(standard);

export const suggestedPartsFor = (standard: KeylineStandard): KeylinePart[] => {
  const g = KEYLINE_GEOMETRY[standard];

  /**
   * O iOS so tem o frame — e isso e o correto.
   *
   * A superellipse e a **mascara** do iOS, entao o frame ja a desenha com o raio certo
   * (22,37%). Uma segunda parte desenhando a mesma forma seria uma duplicata com outro
   * nome, e a versao anterior fazia exatamente isso.
   */
  if (standard === 'ios') return ['frame'];

  /**
   * Quando a mascara **e** um circulo, o frame e o inscrito sao a mesma linha: `frame` e um
   * retangulo com raio = metade do lado, e `circle` e o circulo desse mesmo raio. Os dois
   * desenham os mesmos pixels, entao recomendar os dois e oferecer duas chaves para a
   * mesma guia, e o painel mostra dois switches que parecem diferentes.
   */
  if (standard === 'circle') return ['circle'];

  const parts: KeylinePart[] = ['frame'];
  if (g.insetFraction !== null) parts.push('squircle');
  if (standard === 'android') parts.push('circle');
  if (g.insetFraction === null) parts.push('grid');
  return parts;
};

/**
 * As partes ligadas ao escolher uma plataforma — a recomendacao **e** a safe area.
 *
 * ## Por que esta lista e maior que `suggestedPartsFor`
 *
 * A `safe-area` tracejada vem de `canvas.safeArea`, que e do documento e nao da plataforma
 * — por isso `suggestedPartsFor` nao a menciona. Mas no **iOS** ela importa mais do que
 * qualquer outra guia: e o tracejado que mostra onde o sistema vai cortar o icone, e sem
 * ele a pessoa so ve a superellipse, que e a borda, e nao o limite seguro.
 *
 * Por isso trocar para iOS **liga** a safe area. Ela continua sendo do documento: o que
 * muda aqui e so o default do switch, e a pessoa pode desligar.
 */

/**
 * O raio de um canto, em px.
 *
 * Reusa `defaultMaskRadius` — a fonte unica. Um raio local aqui divergiria do frame na
 * primeira plataforma nova, e a guia descreveria um raio que o icone nao tem.
 */
export const maskRadiusPx = (standard: KeylineStandard, size: number): number =>
  defaultMaskRadius(KEYLINE_GEOMETRY[standard].mask, size);