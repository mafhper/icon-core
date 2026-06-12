import { useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Grid, Circle, Square, RectangleHorizontal, RotateCcw } from 'lucide-react';
import type { Fill, IconLayer, IconVariant } from '@iconcore/shared';
import { useComposer } from '../ComposerContext';
import { DropZone } from './DropZone';

type DragMode = 'move' | 'scale' | 'rotate';

interface DragState {
  id: string;
  mode: DragMode;
  startX: number;
  startY: number;
  origin: IconLayer['transform'];
  originScale: number;
  originRotation: number;
}

const resolveLayer = (layer: IconLayer, variant: IconVariant): IconLayer => {
  const override = layer.variantOverrides?.[variant];
  if (!override) return layer;
  return {
    ...layer,
    ...override,
    source: override.source ? { ...layer.source, ...override.source } : layer.source,
    transform: override.transform ? { ...layer.transform, ...override.transform } : layer.transform,
    text: override.text ? { ...layer.text, ...override.text } as IconLayer['text'] : layer.text,
    effects: override.effects ?? layer.effects
  };
};

const fillToCss = (fill?: Fill): string => {
  if (!fill) return 'transparent';
  if (fill.kind === 'solid') return fill.color ?? '#111827';
  if (fill.kind === 'linear-gradient') {
    const stops = (fill.stops ?? []).map((stop) => `${stop.color} ${Math.round(stop.offset * 100)}%`).join(', ');
    return `linear-gradient(${fill.angle ?? 135}deg, ${stops || '#f3d18a, #6bb7d8'})`;
  }
  const stops = (fill.stops ?? []).map((stop) => `${stop.color} ${Math.round(stop.offset * 100)}%`).join(', ');
  return `radial-gradient(circle, ${stops || '#f3d18a, #6bb7d8'})`;
};

const layerSize = (layer: IconLayer, canvasSize: number) => {
  const shape = layer.source.shape;
  if (shape) return { width: shape.width, height: shape.height };
  return { width: Math.round(canvasSize * 0.7), height: Math.round(canvasSize * 0.7) };
};

const borderRadiusForLayer = (layer: IconLayer) => {
  const shape = layer.source.shape;
  if (!shape) return '0px';
  if (shape.kind === 'circle') return '999px';
  if (shape.kind === 'squircle') return '28%';
  if (shape.kind === 'rounded-rectangle') return `${shape.cornerRadius ?? 32}px`;
  return '0px';
};

const shadowForLayer = (layer: IconLayer) => {
  const effect = layer.effects?.find((item) => item.kind === 'depth-shadow' && item.enabled);
  if (!effect) return undefined;
  const x = Number(effect.params.x ?? 0);
  const y = Number(effect.params.y ?? 14);
  const blur = Number(effect.params.blur ?? 28);
  const color = String(effect.params.color ?? 'rgba(15, 23, 42, 0.28)');
  return `${x}px ${y}px ${blur}px ${color}`;
};

export const PreviewCanvas = () => {
  const { state, dispatch } = useComposer();
  const [menu, setMenu] = useState<{ x: number; y: number; layerId: string } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingTransformRef = useRef<{ id: string; transform: IconLayer['transform'] } | null>(null);

  const project = state.project;
  const layers = useMemo(
    () => project ? [...project.layers].sort((a, b) => a.zIndex - b.zIndex) : [],
    [project]
  );

  if (!project) return null;

  const canvasSize = project.canvas.size;
  const displaySize = canvasSize * state.zoom;

  const scheduleTransform = (id: string, transform: IconLayer['transform']) => {
    pendingTransformRef.current = { id, transform };
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const pending = pendingTransformRef.current;
      if (pending) {
        dispatch({ type: 'UPDATE_LAYER', payload: { id: pending.id, changes: { transform: pending.transform }, transient: true } });
        pendingTransformRef.current = null;
      }
      frameRef.current = null;
    });
  };

  const startDrag = (
    event: React.PointerEvent,
    layer: IconLayer,
    mode: DragMode
  ) => {
    if (layer.locked) return;
    event.preventDefault();
    event.stopPropagation();
    setMenu(null);
    dispatch({ type: 'SET_ACTIVE_LAYER', payload: { id: layer.id } });
    dragRef.current = {
      id: layer.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: layer.transform,
      originScale: layer.transform.scale,
      originRotation: layer.transform.rotation
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (event.clientX - drag.startX) / state.zoom;
    const dy = (event.clientY - drag.startY) / state.zoom;

    if (drag.mode === 'move') {
      scheduleTransform(drag.id, {
        ...drag.origin,
        x: Math.round(drag.origin.x + dx),
        y: Math.round(drag.origin.y + dy)
      });
      return;
    }

    if (drag.mode === 'scale') {
      const delta = Math.max(dx, dy) / canvasSize;
      scheduleTransform(drag.id, {
        ...drag.origin,
        scale: Math.max(0.08, Number((drag.originScale + delta * 2.2).toFixed(3)))
      });
      return;
    }

    const rotation = drag.originRotation + (dx + dy) * 0.5;
    scheduleTransform(drag.id, {
      ...drag.origin,
      rotation: Math.round(rotation)
    });
  };

  const endDrag = (event: React.PointerEvent) => {
    if (!dragRef.current) return;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    const pending = pendingTransformRef.current;
    if (pending) {
      dispatch({ type: 'UPDATE_LAYER', payload: { id: pending.id, changes: { transform: pending.transform }, transient: true } });
      pendingTransformRef.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    dispatch({ type: 'COMMIT_HISTORY' });
  };

  const activeLayer = menu ? project.layers.find((layer) => layer.id === menu.layerId) : null;

  return (
    <div className="flex-1 flex flex-col bg-core-bg">
      <div className="flex items-center justify-between px-4 py-2 border-b border-core-border bg-core-surface">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.max(0.25, state.zoom - 0.25) })}
            className="p-1.5 rounded hover:bg-core-elevated"
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-mono tabular-nums">{(state.zoom * 100).toFixed(0)}%</span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.min(4, state.zoom + 0.25) })}
            className="p-1.5 rounded hover:bg-core-elevated"
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_ZOOM', payload: 1 })}
            className="p-1.5 rounded hover:bg-core-elevated"
            title="Reset zoom"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: 'TOGGLE_GRID' })}
            className={`p-1.5 rounded ${state.showGrid ? 'bg-core-accent/20 text-core-accent' : 'hover:bg-core-elevated'}`}
            title="Toggle grid"
          >
            <Grid size={16} />
          </button>
          <div className="flex gap-1 border-l border-core-border pl-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_MASK_SHAPE', payload: 'square' })}
              className={`p-1.5 rounded ${state.maskShape === 'square' ? 'bg-core-accent/20 text-core-accent' : 'hover:bg-core-elevated'}`}
              title="Square preview mask"
            >
              <Square size={16} />
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_MASK_SHAPE', payload: 'circle' })}
              className={`p-1.5 rounded ${state.maskShape === 'circle' ? 'bg-core-accent/20 text-core-accent' : 'hover:bg-core-elevated'}`}
              title="Circle preview mask"
            >
              <Circle size={16} />
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_MASK_SHAPE', payload: 'rounded-rectangle' })}
              className={`p-1.5 rounded ${state.maskShape === 'rounded-rectangle' ? 'bg-core-accent/20 text-core-accent' : 'hover:bg-core-elevated'}`}
              title="Rounded preview mask"
            >
              <RectangleHorizontal size={16} />
            </button>
          </div>
        </div>
      </div>

      <div
        className="ic-edit-stage"
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={() => {
          setMenu(null);
          dispatch({ type: 'SET_ACTIVE_LAYER', payload: { id: null } });
        }}
      >
        {layers.length === 0 ? (
          <DropZone />
        ) : (
          <div
            className="ic-canvas-frame"
            style={{
              width: displaySize,
              height: displaySize,
              borderRadius: state.maskShape === 'circle' ? '50%' : state.maskShape === 'rounded-rectangle' ? '24px' : '4px',
              background: fillToCss(project.canvas.background)
            }}
          >
            {state.showGrid && <div className="ic-canvas-grid" />}
            {layers.map((baseLayer) => {
              const layer = resolveLayer(baseLayer, state.activeVariant);
              if (!layer.visible) return null;
              const selected = state.activeLayerId === layer.id;
              const size = layerSize(layer, canvasSize);
              const dataUrl = layer.source.type === 'inline' && layer.source.data && layer.source.mimeType
                ? `data:${layer.source.mimeType};base64,${layer.source.data}`
                : null;
              const width = size.width * state.zoom;
              const height = size.height * state.zoom;

              return (
                <div
                  key={layer.id}
                  className={`ic-canvas-layer ${selected ? 'is-selected' : ''} ${layer.locked ? 'is-locked' : ''}`}
                  style={{
                    width,
                    height,
                    opacity: layer.opacity,
                    transform: `translate(-50%, -50%) translate(${layer.transform.x * state.zoom}px, ${layer.transform.y * state.zoom}px) rotate(${layer.transform.rotation}deg) scale(${layer.transform.scale})`,
                    mixBlendMode: layer.blendMode ?? 'normal'
                  }}
                  onPointerDown={(event) => startDrag(event, layer, 'move')}
                  onClick={(event) => {
                    event.stopPropagation();
                    dispatch({ type: 'SET_ACTIVE_LAYER', payload: { id: layer.id } });
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    dispatch({ type: 'SET_ACTIVE_LAYER', payload: { id: layer.id } });
                    setMenu({ x: event.clientX, y: event.clientY, layerId: layer.id });
                  }}
                >
                  {layer.kind === 'text' ? (
                    <div
                      className="ic-layer-text"
                      style={{
                        color: layer.fill?.kind === 'solid' ? layer.fill.color : '#111827',
                        fontFamily: layer.text?.fontFamily,
                        fontSize: (layer.text?.fontSize ?? 64) * state.zoom,
                        fontWeight: layer.text?.fontWeight,
                        textShadow: shadowForLayer(layer)
                      }}
                    >
                      {layer.text?.content ?? 'Text'}
                    </div>
                  ) : dataUrl ? (
                    <img src={dataUrl} alt={layer.name} draggable={false} />
                  ) : (
                    <div
                      className="ic-layer-shape"
                      style={{
                        background: fillToCss(layer.fill),
                        borderRadius: borderRadiusForLayer(layer),
                        boxShadow: shadowForLayer(layer),
                        border: layer.stroke ? `${Math.max(1, layer.stroke.width * state.zoom)}px solid ${layer.stroke.color}` : undefined
                      }}
                    />
                  )}
                  {selected && !layer.locked && (
                    <>
                      <button
                        type="button"
                        className="ic-transform-handle ic-scale-handle"
                        onPointerDown={(event) => startDrag(event, layer, 'scale')}
                        title="Scale layer"
                      />
                      <button
                        type="button"
                        className="ic-transform-handle ic-rotate-handle"
                        onPointerDown={(event) => startDrag(event, layer, 'rotate')}
                        title="Rotate layer"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {menu && activeLayer && (
          <div className="ic-context-menu" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
            <strong>{activeLayer.name}</strong>
            <button
              type="button"
              onClick={() => {
                const name = window.prompt('Rename layer', activeLayer.name);
                if (name?.trim()) dispatch({ type: 'UPDATE_LAYER', payload: { id: activeLayer.id, changes: { name: name.trim() } } });
                setMenu(null);
              }}
            >
              Rename
            </button>
            <button type="button" onClick={() => { dispatch({ type: 'DUPLICATE_LAYER', payload: { id: activeLayer.id } }); setMenu(null); }}>Duplicate</button>
            <button type="button" onClick={() => { dispatch({ type: 'MOVE_LAYER', payload: { id: activeLayer.id, direction: 'front' } }); setMenu(null); }}>Bring to Front</button>
            <button type="button" onClick={() => { dispatch({ type: 'MOVE_LAYER', payload: { id: activeLayer.id, direction: 'forward' } }); setMenu(null); }}>Bring Forward</button>
            <button type="button" onClick={() => { dispatch({ type: 'MOVE_LAYER', payload: { id: activeLayer.id, direction: 'backward' } }); setMenu(null); }}>Send Backward</button>
            <button type="button" onClick={() => { dispatch({ type: 'MOVE_LAYER', payload: { id: activeLayer.id, direction: 'back' } }); setMenu(null); }}>Send to Back</button>
            <button type="button" onClick={() => { dispatch({ type: 'TOGGLE_LAYER_LOCK', payload: { id: activeLayer.id } }); setMenu(null); }}>{activeLayer.locked ? 'Unlock' : 'Lock'}</button>
            <button type="button" onClick={() => { dispatch({ type: 'TOGGLE_LAYER_VISIBILITY', payload: { id: activeLayer.id } }); setMenu(null); }}>{activeLayer.visible ? 'Hide' : 'Show'}</button>
            <button type="button" onClick={() => { dispatch({ type: 'RESET_LAYER_TRANSFORM', payload: { id: activeLayer.id } }); setMenu(null); }}>Reset Transform</button>
            <button type="button" className="is-danger" onClick={() => { dispatch({ type: 'REMOVE_LAYER', payload: { id: activeLayer.id } }); setMenu(null); }}>Delete</button>
          </div>
        )}
      </div>
    </div>
  );
};
