import { useEffect, useState, useRef } from 'react';
import { ZoomIn, ZoomOut, Grid, Circle, Square, RectangleHorizontal, Loader2 } from 'lucide-react';
import { renderProject, createCanvasBackend } from '@iconcore/renderer';
import { useComposer } from '../ComposerContext';

export const PreviewCanvas = () => {
  const { state, dispatch } = useComposer();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state.project) return;

    let cancelled = false;
    setIsRendering(true);

    const timer = setTimeout(async () => {
      try {
        const backend = createCanvasBackend();
        const blob = await renderProject(
          state.project!,
          state.activeVariant,
          state.project!.canvas.size,
          backend
        );
        if (!cancelled) {
          if (imageUrl) URL.revokeObjectURL(imageUrl);
          const url = URL.createObjectURL(blob);
          setImageUrl(url);
          setIsRendering(false);
        }
        backend.destroy();
      } catch (err) {
        console.error('Render failed:', err);
        if (!cancelled) setIsRendering(false);
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state.project, state.activeVariant, state.zoom]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  if (!state.project) return null;

  const canvasSize = state.project.canvas.size;
  const displaySize = canvasSize * state.zoom;

  return (
    <div className="flex-1 flex flex-col bg-core-bg">
      <div className="flex items-center justify-between px-4 py-2 border-b border-core-border bg-core-surface">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.max(0.25, state.zoom - 0.25) })}
            className="p-1.5 rounded hover:bg-core-elevated"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-mono">{(state.zoom * 100).toFixed(0)}%</span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.min(4, state.zoom + 0.25) })}
            className="p-1.5 rounded hover:bg-core-elevated"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: 'TOGGLE_GRID' })}
            className={`p-1.5 rounded ${state.showGrid ? 'bg-core-accent/20 text-core-accent' : 'hover:bg-core-elevated'}`}
          >
            <Grid size={16} />
          </button>
          <div className="flex gap-1 border-l border-core-border pl-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_MASK_SHAPE', payload: 'square' })}
              className={`p-1.5 rounded ${state.maskShape === 'square' ? 'bg-core-accent/20 text-core-accent' : 'hover:bg-core-elevated'}`}
            >
              <Square size={16} />
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_MASK_SHAPE', payload: 'circle' })}
              className={`p-1.5 rounded ${state.maskShape === 'circle' ? 'bg-core-accent/20 text-core-accent' : 'hover:bg-core-elevated'}`}
            >
              <Circle size={16} />
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_MASK_SHAPE', payload: 'rounded-rectangle' })}
              className={`p-1.5 rounded ${state.maskShape === 'rounded-rectangle' ? 'bg-core-accent/20 text-core-accent' : 'hover:bg-core-elevated'}`}
            >
              <RectangleHorizontal size={16} />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={canvasRef}
        className="flex-1 flex items-center justify-center overflow-auto p-8"
        style={{
          backgroundImage: state.showGrid
            ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
            : undefined,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
        }}
      >
        {isRendering ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className="composer-shimmer rounded-2xl"
              style={{ width: displaySize, height: displaySize }}
            />
            <div className="flex items-center gap-2 text-xs text-core-muted">
              <Loader2 size={14} className="animate-spin" />
              Rendering...
            </div>
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt="Preview"
            style={{
              width: displaySize,
              height: displaySize,
              borderRadius: state.maskShape === 'circle' ? '50%' : state.maskShape === 'rounded-rectangle' ? '12px' : '0'
            }}
            className="shadow-2xl composer-scale-in"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-core-muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <div className="text-sm">No preview available</div>
            <span className="text-xs">Add layers to see a preview</span>
          </div>
        )}
      </div>
    </div>
  );
};