import { useComposer } from '../ComposerContext';
import { type KeylinePart, availableParts } from '../utils/keylineConfig';
import { maskRadiusPx, safeInsetPx } from '../utils/keylineGeometry';

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
  const disponiveis = new Set(
    availableParts(Boolean(project.canvas.safeArea), state.keylineStandard)
  );
  const parts = new Set<KeylinePart>(
    [...state.keylineParts].filter((part) => disponiveis.has(part))
  );
  if (parts.size === 0) return null;

  const size = project.canvas.size;
  const display = size * state.zoom;
  const center = size / 2;
  const stroke = Math.max(1, size * 0.0035);

  /**
   * A moldura usa o raio da **plataforma da keyline**, e nao o `state.maskShape`.
   *
   * São coisas diferentes: `maskShape` é o que a pessoa escolheu para o ícone, e a
   * plataforma da keyline é contra qual ela está sendo medida. Quando coincidem, tanto faz.
   * Quando não, usar o `maskShape` fazia a guia de um ícone quadrado desenhar um
   * círculo — e a guia passava a mentir sobre a plataforma que diz representar.
   */
  const radius = maskRadiusPx(state.keylineStandard, size);

  /**
   * A zona segura da plataforma, em px — ou `null` quando ela não tem uma medida.
   *
   * Antes este componente desenhava `size / 6`, um terço, "para o iOS". Esse número não é
   * de ninguém: o iOS não define uma zona, ele define uma **máscara** (a superellipse de
   * 22,37%), e o Android define o círculo de 66/108. Um terço no meio era a caixa que
   * fazia todo preset parecer igual — e a segunda parte do `KeylinePart` `squircle` continua
   * com esse nome no schema só porque mudar o valor gravado quebraria projetos salvos.
   */
  const platformInset = safeInsetPx(state.keylineStandard, size);

  /** O raio da zona: o da plataforma, que é o que o export também usa. */
  const zoneRadius = radius * 0.7;

  /**
   * O raio do círculo inscrito.
   *
   * "Inscrito" na máscara, exceto quando a plataforma tem zona medida: aí o círculo que
   * importa é o da zona — o círculo de 66/108 do Android — porque é o maior círculo que
   * **sobrevive ao recorte**. O inscrito na máscara seria a linha mais externa, que já
   * é a moldura, e portanto não informaria nada.
   */
  const inscribedRadius = platformInset === null ? center - stroke / 2 : size / 2 - platformInset;

  /** A safe area tracejada, que vem do documento e é independente da plataforma. */
  const safe = project.canvas.safeArea ? project.canvas.safeArea.inset * size : 0;

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
            data-part="frame"
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
          <g data-part="grid" fill="none" stroke="currentColor" strokeWidth={stroke} opacity="0.45">
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
          data-part="circle"
          cx={center}
          cy={center}
          r={inscribedRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          opacity="0.45"
        />
      )}

      {parts.has('squircle') && platformInset !== null && (
        <rect
          data-part="zone"
          x={platformInset}
          y={platformInset}
          width={size - 2 * platformInset}
          height={size - 2 * platformInset}
          rx={zoneRadius}
          ry={zoneRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          opacity="0.55"
        />
      )}

      {parts.has('safe-area') && safe > 0 && (
        <rect
          data-part="safe-area"
          x={safe}
          y={safe}
          width={size - 2 * safe}
          height={size - 2 * safe}
          rx={zoneRadius}
          ry={zoneRadius}
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