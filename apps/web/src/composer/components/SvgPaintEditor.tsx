import { RotateCcw } from 'lucide-react';
import type { SvgPaintColor } from '@iconcore/renderer';
import { ColorField, type ColorValue } from '@iconcore/ui';
import { hexToRgb, rgbToHex } from '../utils/color';
import { effectiveSvgPaint, hasSvgPaintOverride } from '../utils/svgLayerColors';

/**
 * `IC63/1b` — as cores de um SVG importado, e o override de cada uma.
 *
 * Substitui o `Fill` que essa layer recebia. O `Fill` era um controle que **mentia**:
 * oferecia "transparent" para uma camada que estava desenhando branco, e a nota dizia
 * "No fill — the shape is transparent". Pior, mexer nele não fazia nada, porque o
 * renderer injeta o markup do SVG verbatim e nunca lê `layer.fill` para `kind: 'svg'`
 * (`renderToSvg.ts:391-419`). Um controle que não age é pior do que um controle
 * ausente — a pessoa acredita que configurou algo.
 *
 * ## Por que uma linha por cor, e não um "pintar tudo"
 *
 * Ícone importado costuma ter duas ou três cores (2,03 por arquivo, no acervo). Um
 * controle único achataria arte bicolor em uma cor só, e a pessoa que quer trocar o
 * branco do logo wouldn't quer o laranja junto. Por isso a chave é **a cor de origem**:
 * trocar uma não toca nas outras.
 *
 * ## Sem CSS novo
 *
 * O budget de `index.css` tem 5 linhas e 1 literal hex de folga, e a política é que
 * budget não sobe. Tudo aqui é utilitário Tailwind sobre tokens que já existem.
 */
export const SvgPaintEditor = ({
  label = 'Colors in this SVG',
  colors,
  overrides,
  onChange,
  onCommit
}: {
  label?: string;
  colors: SvgPaintColor[];
  overrides: Record<string, string> | undefined;
  /** Recebe o mapa **novo**, já podado — o editor não decide o que é significativo. */
  onChange: (next: Record<string, string>, transient?: boolean) => void;
  onCommit: () => void;
}) => {
  if (colors.length === 0) return null;

  /** `ColorField` devolve hex + alpha; o override é uma string CSS. */
  const paraValor = (proximo: ColorValue): string => {
    if (proximo.alpha >= 1) return proximo.color;
    const rgb = hexToRgb(proximo.color);
    if (!rgb) return proximo.color;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Number(proximo.alpha.toFixed(2))})`;
  };

  /**
   * O valor do campo, ou `null` quando o `ColorField` não sabe mostrar.
   *
   * `ColorField` exige `#rrggbb` e o `normalizeHex` do kit **também** cai para
   * `#000000` quando não entende a string. Passar um token opaco (`currentcolor`,
   * `oklch(…)`) produziria um campo preto — e preto é uma mentira: `currentColor`
   * resolve para a cor do texto, não para preto. Um default mentiroso num swatch é
   * pior do que nenhum swatch.
   *
   * então: token que o browser resolve e o `ColorField` não, fica **sem campo**, e a
   * linha mostra o literal. No acervo isso nunca acontece — 0% de `currentColor`, e
   * as 7 cores distintas todas normalizam para hex — então o picker cobre 100% dos
   * arquivos reais e o caso raro fica honesto em vez de bonito.
   */
  const paraCampo = (atual: string): ColorValue | null => {
    if (/^#[0-9a-fA-F]{6}$/.test(atual)) return { color: atual, alpha: 1 };

    const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)$/.exec(atual);
    if (rgb) {
      return {
        color: rgbToHex({ r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) }),
        alpha: rgb[4] === undefined ? 1 : Number(rgb[4])
      };
    }

    return null;
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[11px] leading-snug text-ic-text-faint">
        {label}. Change one and the artwork keeps its other colors.
      </p>

      {colors.map((cor) => {
        const atual = effectiveSvgPaint(cor.hex, overrides);
        const trocada = hasSvgPaintOverride(cor.hex, overrides);
        const campo = paraCampo(atual);

        return (
          <div key={cor.hex} className="flex items-center gap-2">
            {/* A origem, sempre visível: sem ela a pessoa perde a referência do que
                está substituindo, e o override vira um hex solto. */}
            <span
              className="h-4 w-4 shrink-0 rounded-ic-sm border border-ic-border"
              style={{ background: cor.hex }}
              title={`Original ${cor.hex} · ${cor.count}×`}
              aria-hidden="true"
            />

            {campo ? (
              <ColorField
                label={`Replace ${cor.hex}, used ${cor.count} times`}
                value={campo}
                onChange={(proximo) =>
                  onChange({ ...(overrides ?? {}), [cor.hex]: paraValor(proximo) }, true)
                }
                onCommit={onCommit}
                className="min-w-0 flex-1"
              />
            ) : (
              /* Token que o browser resolve e o picker não: o literal, sem campo. */
              <span
                className="min-w-0 flex-1 truncate font-mono text-[11px] text-ic-text-muted"
                title={`${atual} — a cor é resolvida pelo navegador`}
              >
                {atual}
              </span>
            )}

            <button
              type="button"
              className="cursor-pointer rounded-ic-sm p-1.5 text-ic-text-muted transition-colors duration-150 hover:bg-ic-elevated hover:text-ic-text disabled:cursor-default disabled:opacity-40"
              onClick={() => {
                const proximo = { ...(overrides ?? {}) };
                delete proximo[cor.hex];
                onChange(proximo);
              }}
              disabled={!trocada}
              aria-label={`Restore ${cor.hex}`}
              title={trocada ? `Back to ${cor.hex}` : 'Not changed'}
            >
              <RotateCcw size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
