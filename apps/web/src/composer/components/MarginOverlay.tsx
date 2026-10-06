import { useComposer } from '../ComposerContext';
import { isMarginGuideVisible, marginDash, marginGeometry } from '../utils/marginOverlay';

/**
 * A máscara da `import margin`, sobre o ícone.
 *
 * ## Por que um overlay e não um fundo
 *
 * Porque a margem é uma **restrição sobre a arte que entra**, e a arte ainda não existe.
 * Um fundo colorindo a área seria lido como "isto é o fundo do ícone" — que é
 * exatamente o que a margem **não** é. A leitura correta é "limite", e por isso a
 * máscara é uma linha tracejada **sobre** o que já está no canvas.
 *
 * ## Por que `t = 0` e um retângulo
 *
 * Porque é o que `marginGeometry` espelha (`usable = size × (1 − margin)`, centrada) e
 * nada mais. Se a máscara desenhasse uma arte de exemplo, ela mentiria sobre proporção,
 * alinhamento e conteúdo — três coisas que a pessoa não pode prever e que vai corrigir
 * depois de importar.
 *
 * ## Quando some
 *
 * Abaixo de 8px de lado a linha deixa de se ler como retângulo. E o `prefers-reduced-
 * motion` não entra aqui porque **não há movimento**: é uma linha parada. A animação que
 * exigiria isto é a do `IC61J`, fora do fluxo por decisão do dono.
 */
export const MarginOverlay = () => {
  const { state } = useComposer();
  const project = state.project;
  if (!project) return null;

  // `importMargin` ausente = 0 = guia do canvas inteiro, que só poluiria. Por isso a
  // Early return: com 0% **não** ha nada a mostrar.
  const margin = project.canvas.importMargin ?? 0;
  if (margin <= 0) return null;
  if (!state.showMarginOverlay) return null;

  const size = project.canvas.size;
  const geo = marginGeometry(size, margin);
  if (!isMarginGuideVisible(geo.width)) return null;

  const display = size * state.zoom;
  const stroke = Math.max(1, size * 0.0035);

  return (
    <svg
      className="ic-margin-overlay"
      width={display}
      height={display}
      viewBox={`0 0 ${size} ${size}`}
      // O rótulo vai no `title`, e nao em `aria-label`: um SVG inline é uma imagem,
      // e e o `title` que um leitor de tela consegue ler.
      role="img"
      aria-label={`Import margin — artwork will occupy ${Math.round((geo.width / size) * 100)}% of the canvas`}
    >
      <rect
        x={geo.x + stroke / 2}
        y={geo.y + stroke / 2}
        width={Math.max(0, geo.width - stroke)}
        height={Math.max(0, geo.height - stroke)}
        rx={stroke * 2}
        ry={stroke * 2}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeDasharray={marginDash(geo.width, stroke)}
        opacity="0.75"
      />
    </svg>
  );
};