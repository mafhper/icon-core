import { defaultMaskRadius } from '@iconcore/shared';
import { useComposer } from '../ComposerContext';

/**
 * The adaptive safe-area guide, drawn from the document (`canvas.safeArea`).
 *
 * The KeylineOverlay already draws this box as one of its parts, but parts
 * share the keyline master switch: asking for "just the safe area" there
 * would light up the whole platform reference. This overlay is that one box
 * on its own flag (`showSafeArea`, off by default), with the same dashed
 * language — and the corner follows the icon's own mask radius, so the guide
 * reads as "this icon's safe zone", not a generic inset.
 */
export const SafeAreaOverlay = () => {
  const { state } = useComposer();
  const project = state.project;
  if (!project) return null;
  if (!state.showSafeArea) return null;

  const safeArea = project.canvas.safeArea;
  if (!safeArea || safeArea.inset <= 0) return null;

  const size = project.canvas.size;
  const safe = safeArea.inset * size;
  if (safe * 2 >= size) return null;

  const display = size * state.zoom;
  const stroke = Math.max(1, size * 0.0035);
  const box = size - 2 * safe;
  const maskRadius = project.canvas.maskRadius ?? defaultMaskRadius(state.maskShape, size);
  const radius = safeArea.shape === 'square' ? 0 : safeArea.shape === 'circle' ? box / 2 : (maskRadius / size) * box;

  const rect = (
    <rect
      x={safe + stroke / 2}
      y={safe + stroke / 2}
      width={Math.max(0, box - stroke)}
      height={Math.max(0, box - stroke)}
      rx={Math.max(0, radius - stroke / 2)}
      ry={Math.max(0, radius - stroke / 2)}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeDasharray={`${stroke * 3} ${stroke * 2}`}
      opacity="0.7"
    />
  );

  return (
    <svg
      className="ic-safe-area-overlay"
      width={display}
      height={display}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Safe area: artwork inside ${Math.round((box / size) * 100)}% of the canvas`}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {safeArea.shape === 'circle' ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={Math.max(0, box / 2 - stroke / 2)}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeDasharray={`${stroke * 3} ${stroke * 2}`}
          opacity="0.7"
        />
      ) : (
        rect
      )}
    </svg>
  );
};
