import { defaultMaskRadius } from '@iconcore/shared';
import { useComposer } from '../ComposerContext';
import { type KeylinePart, availableParts } from '../utils/keylineConfig';

/**
 * Apple-style icon keyline grid: concentric rounded-rect / circle / square,
 * center + thirds lines, and the safe-area inset. Pure visual guide overlay.
 *
 * ## O que mudou, e por que
 *
 * Antes as cinco guias eram desenhadas **sempre**, num único `<svg>`, e o controle
 * era um liga/desliga. Agora cada parte tem o seu switch e o tipo de plataforma decide
 * o que é recomendado.
 *
 * O motivo é de uso: as cinco competem, e quem desenha um ícone pequeno quer a grade,
 * quem posiciona um logo quer o centro, quem exporta para a App Store quer a safe area.
 * Com tudo ligado, a pessoa termina ignorando a guia que importa — e a guia que ela
 * ignora é a que teria salvado o export.
 *
 * ## Por que o raio vem de `defaultMaskRadius`
 *
 * Porque é a **fonte única**: o mesmo número que o `PreviewCanvas` usa para pintar o
 * frame. Uma constante local aqui divergiria na primeira plataforma nova, e a guia
 * descreveria um raio que o ícone não tem — a Sintoma 2 do `IC-N4` em forma de
 * geometria.
 */
export const KeylineOverlay = () => {
  const { state } = useComposer();
  const project = state.project;
  if (!project) return null;

  /**
   * As partes ligadas **que o documento sustenta**.
   *
   * O filtro importa, e nao e defensivo: o conjunto de parts pode conter `safe-area`
   * (esta no default) enquanto um projeto novo nao tem `canvas.safeArea`. Contar essa
   * parte faria o `<svg>` continuar existindo depois de a pessoa desligar todas as
   * visiveis — e um overlay vazio no DOM nao informa nada, so ocupa.
   */
  const disponiveis = new Set(availableParts(Boolean(project.canvas.safeArea)));
  const parts = new Set<KeylinePart>(
    [...state.keylineParts].filter((part) => disponiveis.has(part))
  );
  if (parts.size === 0) return null;

  const size = project.canvas.size;
  const display = size * state.zoom;
  const center = size / 2;
  const stroke = Math.max(1, size * 0.0035);
  // O `defaultMaskRadius` carrega os mesmos 22,37% do `squircle` — uma constante só,
  // para a guia e o frame que ela anota não divergirem.
  const radius = defaultMaskRadius(state.maskShape, size);
  const safe = project.canvas.safeArea ? project.canvas.safeArea.inset * size : 0;

  /**
   * O round-rect interno do bloco antigo. Vem do **tipo** de keyline, não do
   * `maskShape`: a forma do ícone e o formato da guia são coisas diferentes, e usar a
   * mesma variável fazia a guia de um ícone circular desenhar um retângulo de cantos
   * arredondados como se fosse uma superellipse.
   */
  const innerRadius =
    state.keylineStandard === 'ios' ? defaultMaskRadius('squircle', size) : radius;

  return (
    <svg
      className="ic-keyline-overlay"
      width={display}
      height={display}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      {parts.has('frame') && (
        <g fill="none" stroke="currentColor" strokeWidth={stroke} opacity="0.45">
          <rect
            x={stroke / 2}
            y={stroke / 2}
            width={size - stroke}
            height={size - stroke}
            rx={radius}
            ry={radius}
          />
        </g>
      )}

      {parts.has('grid') && (
        <>
          <g fill="none" stroke="currentColor" strokeWidth={stroke} opacity="0.45">
            <line x1={center} y1={0} x2={center} y2={size} />
            <line x1={0} y1={center} x2={size} y2={center} />
          </g>
          <g fill="none" stroke="currentColor" strokeWidth={stroke} opacity="0.22">
            <line x1={size / 3} y1={0} x2={size / 3} y2={size} />
            <line x1={(size * 2) / 3} y1={0} x2={(size * 2) / 3} y2={size} />
            <line x1={0} y1={size / 3} x2={size} y2={size / 3} />
            <line x1={0} y1={(size * 2) / 3} x2={size} y2={(size * 2) / 3} />
          </g>
        </>
      )}

      {parts.has('circle') && (
        <circle
          cx={center}
          cy={center}
          r={center - stroke / 2}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          opacity="0.45"
        />
      )}

      {parts.has('squircle') && (
        <rect
          x={size / 6}
          y={size / 6}
          width={(size * 2) / 3}
          height={(size * 2) / 3}
          rx={innerRadius}
          ry={innerRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          opacity="0.45"
        />
      )}

      {parts.has('safe-area') && safe > 0 && (
        <rect
          x={safe}
          y={safe}
          width={size - 2 * safe}
          height={size - 2 * safe}
          rx={innerRadius * 0.7}
          ry={innerRadius * 0.7}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeDasharray={`${stroke * 3} ${stroke * 2}`}
          opacity="0.7"
        />
      )}
    </svg>
  );
};