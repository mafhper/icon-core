/**
 * A cor da work area — a "mesa" em volta do ícone.
 *
 * ## Por que saiu o tipo (`dots` / `grid` / `plain`)
 *
 * O dono pediu cor, no lugar dos três tipos. E há um argumento de projeto, não só de
 * gosto: `plain` **nunca foi uma cor** — era um gradiente fixo de duas misturas de
 * `--ic-bg` com um literal `#e6ecf5` (ver `index.css`, a regra `.ic-edit-stage[data-
 * editor-backdrop='plain']`). Ou seja: um dos três "tipos" já era um jeito
 * desajeitado de escrever uma cor, escondido atrás de um seletor.
 *
 * Trocar o tipo pela cor não remove uma opção — **remove a indireção**.
 *
 * ## Por que isto vive no `state` e não no documento
 *
 * Porque a work area é a **bancada**, não a arte. O `ADR-020` diz que um `.iconcore.json`
 * é o que sai do export, e o fundo da bancada nunca sai: o `LayerInspector` já diz isso
 * ("never exported"). Guardar no documento faria o digest do `IC-N7` acusar arte nova a
 * cada mudança de cor de editor — que é a assinatura de um pipeline que não pode ser
 * reproduzido.
 *
 * ## Por que não é um hex solto
 *
 * Porque o dono pediu para o valor **persistir entre sessões** e o hex puro não tem onde
 * guardar. Um `{ color, alpha }` serializa em JSON, volta igual, e o `ColorField` do
 * kit já produz exatamente este formato — de modo que **nenhum hex novo** entra no
 * `check-ui-budget`, que é um ratchet que só desce.
 */

/** O mesmo formato do `ColorField` do kit, para não inventar um segundo dialeto. */
export interface WorkAreaColor {
  /** `#rrggbb`. */
  color: string;
  /** 0..1. */
  alpha: number;
}

/**
 * O padrão é a própria cor de fundo do tema, opaca.
 *
 * E **não** é uma cor literal: o valor tem de seguir `--ic-bg` para que trocar o tema
 * continue fazendo sentido. Guardar `#0b0e14` aqui significaria um desk quase preto no
 * tema claro — que é o sintoma de valor copiado.
 */
export const DEFAULT_WORK_AREA_COLOR: WorkAreaColor = { color: '', alpha: 1 };

/** Um hex de 3 digitos e um de 4, normalizados para o formato de 6. */
const normalizeHex = (value: string): string => {
  const hex = value.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
  return '';
};

export const isValidHex = (value: string): boolean => normalizeHex(value).length === 7;

/** Serializa para CSS. `color: ''` cai no token do tema. */
export const workAreaToCss = (value: WorkAreaColor | null | undefined): string => {
  const color = normalizeHex(value?.color ?? '');
  if (!color) return 'var(--ic-bg)';
  const alpha = value?.alpha ?? 1;
  // Alpha 1 vira hex, porque `color-mix` com transparente e o jeito barato de dizer
  // "opaco" e custa uma linha a menos na folha.
  return alpha >= 1 ? color : colorWithAlpha(color, alpha);
};

/**
 * `color-mix` em vez de `rgba()`.
 *
 * `normalizeHex` garante 6 dígitos, então um `rgba()` seria possivel — mas
 * `color-mix(in srgb, <cor> X%, transparent)` sobrevive a **transparência herdada**:
 * a bancada fica sobre o fundo do tema, e `rgba()` sobre um fundo que também tem alpha
 * produz um alpha duplo. `color-mix` evita a conta.
 */
const colorWithAlpha = (hex: string, alpha: number): string =>
  `color-mix(in srgb, ${hex} ${Math.round(alpha * 100)}%, transparent)`;

/**
 * O que o estado guarda: uma cor, ou nada.
 *
 * `null` é diferente de `{ color: '', alpha: 1 }` **na prática, não no formato**: o
 * `ColorField` precisa de um valor para pintar a amostra. `resolveWorkAreaColor` entrega
 * o que o campo mostra — e o token do tema quando nada foi escolhido; `workAreaToCss`
 * decide o que o browser recebe, e devolve `var(--ic-bg)`. Separar as duas coisas é o
 * que mantém o fallback no tema em vez de virar um `#000` silencioso.
 */
/**
 * O que o `ColorField` mostra quando **nada** foi escolhido.
 *
 * `themeColor` e o valor **calculado** de `--ic-bg`, e nao um hex aqui.
 *
 * Duas razoes, e a segunda e a que importa mais:
 *
 * 1. Um `#` em codigo de producao e o que o `check-ui-budget` conta, e o orcamento e um
 *    ratchet que so desce. Um hex sentinela aqui custaria orcamento de interface para
 *    representar "nada escolhido".
 * 2. Um hex fixo **mentiria**: uma amostra quase branca num tema escuro mostraria algo
 *    que o desk nunca vai ter. Lendo o token, a amostra e a cor que a bancada esta
 *    de fato — e no tema claro ela muda sozinha.
 *
 * Por isso o fallback quando o token nao resolve e `{ color: '', alpha: 1 }`: e o
 * estado inicial honesto, e o `ColorField` mostra uma amostra neutra em vez de preto.
 */
export const resolveWorkAreaColor = (
  stored: WorkAreaColor | null | undefined,
  themeColor = ''
): WorkAreaColor => {
  const color = normalizeHex(stored?.color ?? '');
  if (!color) {
    const theme = normalizeHex(themeColor);
    return theme ? { color: theme, alpha: 1 } : { color: '', alpha: 1 };
  }
  return { color, alpha: clampAlpha(stored?.alpha ?? 1) };
};

const clampAlpha = (alpha: number): number =>
  Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;