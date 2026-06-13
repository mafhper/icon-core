import { useComposer } from '../ComposerContext';

/**
 * Apple-style icon keyline grid: concentric rounded-rect / circle / square,
 * center + thirds lines, and the safe-area inset. Pure visual guide overlay.
 */
export const KeylineOverlay = () => {
  const { state } = useComposer();
  const project = state.project;
  if (!project) return null;

  const size = project.canvas.size;
  const display = size * state.zoom;
  const center = size / 2;
  const stroke = Math.max(1, size * 0.0035);
  const radius = size * 0.2237; // iOS superellipse ≈ 22.37% of width
  const safe = project.canvas.safeArea ? project.canvas.safeArea.inset * size : 0;

  return (
    <svg
      className="ic-keyline-overlay"
      width={display}
      height={display}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <g fill="none" stroke="currentColor" strokeWidth={stroke} opacity="0.45">
        <rect x={stroke / 2} y={stroke / 2} width={size - stroke} height={size - stroke} rx={radius} ry={radius} />
        <circle cx={center} cy={center} r={center - stroke / 2} />
        <rect x={size / 6} y={size / 6} width={(size * 2) / 3} height={(size * 2) / 3} />
        <line x1={center} y1={0} x2={center} y2={size} />
        <line x1={0} y1={center} x2={size} y2={center} />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth={stroke} opacity="0.22">
        <line x1={size / 3} y1={0} x2={size / 3} y2={size} />
        <line x1={(size * 2) / 3} y1={0} x2={(size * 2) / 3} y2={size} />
        <line x1={0} y1={size / 3} x2={size} y2={size / 3} />
        <line x1={0} y1={(size * 2) / 3} x2={size} y2={(size * 2) / 3} />
      </g>
      {safe > 0 && (
        <rect
          x={safe}
          y={safe}
          width={size - 2 * safe}
          height={size - 2 * safe}
          rx={radius * 0.7}
          ry={radius * 0.7}
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
