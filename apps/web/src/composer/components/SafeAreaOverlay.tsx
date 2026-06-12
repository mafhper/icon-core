import { useComposer } from '../ComposerContext';

export const SafeAreaOverlay = () => {
  const { state } = useComposer();

  if (!state.project?.canvas.safeArea) return null;

  const { inset, shape } = state.project.canvas.safeArea;
  const size = state.project.canvas.size;
  const insetPx = inset * size;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        width: size * state.zoom,
        height: size * state.zoom
      }}
    >
      <div
        className="absolute border-2 border-dashed border-core-accent/60"
        style={{
          top: insetPx * state.zoom,
          left: insetPx * state.zoom,
          right: insetPx * state.zoom,
          bottom: insetPx * state.zoom,
          borderRadius: shape === 'circle' ? '50%' : shape === 'rounded-rectangle' ? '12px' : '0'
        }}
      />
    </div>
  );
};