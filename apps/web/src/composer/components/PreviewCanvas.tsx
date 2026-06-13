import { useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Grid, Circle, Square, RectangleHorizontal, RotateCcw, Crosshair } from 'lucide-react';
import type { IconLayer } from '@iconcore/shared';
import { imageFilterToCss } from '@iconcore/shared';
import { useComposer } from '../ComposerContext';
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../constants';
import { resolveLayerVariant } from '../utils/layerResolve';
import { scopedLayerDispatch } from '../utils/layerEdit';
import { computeSnap, type SnapGuide } from '../utils/snapping';
import { borderRadiusForLayer, clipPathForLayer, fillToCss, layerBlurPx, layerSize, shadowCssForLayer } from '../utils/layerStyle';

const SNAP_THRESHOLD_PX = 6;
import { DropZone } from './DropZone';
import { QualityWarnings } from './QualityWarnings';
import { VariantPanel } from './VariantPanel';
import { KeylineOverlay } from './KeylineOverlay';

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

const layerTransform = (layer: IconLayer, zoom: number): string =>
  `translate(-50%, -50%) translate(${layer.transform.x * zoom}px, ${layer.transform.y * zoom}px) rotate(${layer.transform.rotation}deg) scale(${layer.transform.scale})`;

const renderLayerContent = (layer: IconLayer, zoom: number) => {
  const dataUrl = layer.source.type === 'inline' && layer.source.data && layer.source.mimeType
    ? `data:${layer.source.mimeType};base64,${layer.source.data}`
    : null;
  const blur = layerBlurPx(layer) * zoom;
  const blurCss = blur > 0 ? `blur(${blur}px)` : '';

  if (layer.kind === 'text') {
    return (
      <div
        className="ic-layer-text"
        style={{
          color: layer.fill?.kind === 'solid' ? layer.fill.color : '#111827',
          fontFamily: layer.text?.fontFamily,
          fontSize: (layer.text?.fontSize ?? 64) * zoom,
          fontWeight: layer.text?.fontWeight,
          textShadow: shadowCssForLayer(layer),
          filter: blurCss || undefined
        }}
      >
        {layer.text?.content ?? 'Text'}
      </div>
    );
  }

  if (dataUrl) {
    const imageFilter = [imageFilterToCss(layer.imageFilter), blurCss].filter(Boolean).join(' ');
    return <img src={dataUrl} alt={layer.name} draggable={false} style={{ filter: imageFilter || undefined }} />;
  }

  return (
    <div
      className="ic-layer-shape"
      style={{
        background: fillToCss(layer.fill),
        borderRadius: borderRadiusForLayer(layer),
        clipPath: clipPathForLayer(layer),
        boxShadow: shadowCssForLayer(layer),
        filter: blurCss || undefined,
        border: layer.stroke ? `${Math.max(1, layer.stroke.width * zoom)}px solid ${layer.stroke.color}` : undefined
      }}
    />
  );
};

export const PreviewCanvas = () => {
  const { state, dispatch } = useComposer();
  const [menu, setMenu] = useState<{ x: number; y: number; layerId: string } | null>(null);
  const [guides, setGuides] = useState<SnapGuide[]>([]);
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
  const variantBackground = project.variants?.[state.activeVariant]?.canvas?.background ?? project.canvas.background;

  const scheduleTransform = (id: string, transform: IconLayer['transform']) => {
    pendingTransformRef.current = { id, transform };
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const pending = pendingTransformRef.current;
      if (pending) {
        scopedLayerDispatch(dispatch, state.activeVariant, pending.id, { transform: pending.transform }, { transient: true });
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
      const rawX = drag.origin.x + dx;
      const rawY = drag.origin.y + dy;
      const baseLayer = project.layers.find((item) => item.id === drag.id);
      if (baseLayer) {
        const dragged = resolveLayerVariant(baseLayer, state.activeVariant);
        const size = layerSize(dragged, canvasSize);
        const others = project.layers
          .filter((item) => item.id !== drag.id && item.visible)
          .map((item) => resolveLayerVariant(item, state.activeVariant))
          .map((item) => {
            const s = layerSize(item, canvasSize);
            return { x: item.transform.x, y: item.transform.y, width: s.width * item.transform.scale, height: s.height * item.transform.scale };
          });
        const safeInset = project.canvas.safeArea ? project.canvas.safeArea.inset * canvasSize : 0;
        const snap = computeSnap(
          { x: rawX, y: rawY, width: size.width * drag.originScale, height: size.height * drag.originScale },
          others,
          canvasSize,
          safeInset,
          SNAP_THRESHOLD_PX / state.zoom
        );
        setGuides(snap.guides);
        scheduleTransform(drag.id, { ...drag.origin, x: Math.round(snap.x), y: Math.round(snap.y) });
      } else {
        scheduleTransform(drag.id, { ...drag.origin, x: Math.round(rawX), y: Math.round(rawY) });
      }
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
      scopedLayerDispatch(dispatch, state.activeVariant, pending.id, { transform: pending.transform }, { transient: true });
      pendingTransformRef.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setGuides([]);
    dispatch({ type: 'COMMIT_HISTORY' });
  };

  const activeLayer = menu ? project.layers.find((layer) => layer.id === menu.layerId) : null;

  return (
    <div className="ic-preview-panel">
      <div className="ic-canvas-toolbar">
        <div className="ic-toolbar-group">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.max(ZOOM_MIN, state.zoom - ZOOM_STEP) })}
            className="p-1.5 rounded hover:bg-core-elevated"
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-mono tabular-nums">{(state.zoom * 100).toFixed(0)}%</span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.min(ZOOM_MAX, state.zoom + ZOOM_STEP) })}
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

        <div className="ic-toolbar-group">
          <button
            type="button"
            onClick={() => dispatch({ type: 'TOGGLE_GRID' })}
            className={`p-1.5 rounded ${state.showGrid ? 'bg-core-accent/20 text-core-accent' : 'hover:bg-core-elevated'}`}
            title="Toggle grid"
          >
            <Grid size={16} />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'TOGGLE_KEYLINES' })}
            className={`p-1.5 rounded ${state.showKeylines ? 'bg-core-accent/20 text-core-accent' : 'hover:bg-core-elevated'}`}
            title="Toggle Apple keyline grid"
          >
            <Crosshair size={16} />
          </button>
          <div className="ic-mask-controls">
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
        <QualityWarnings />
        <VariantPanel />
        {layers.length === 0 ? (
          <DropZone />
        ) : (
          <div
            className="ic-canvas-frame"
            style={{
              width: displaySize,
              height: displaySize,
              borderRadius: state.maskShape === 'circle' ? '50%' : state.maskShape === 'rounded-rectangle' ? '24px' : '4px',
              background: fillToCss(variantBackground)
            }}
          >
            {state.showGrid && <div className="ic-canvas-grid" />}
            {state.showKeylines && <KeylineOverlay />}
            {layers.map((baseLayer) => {
              const layer = resolveLayerVariant(baseLayer, state.activeVariant);
              if (!layer.visible) return null;
              const selected = state.activeLayerId === layer.id;
              const size = layerSize(layer, canvasSize);
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
                    transform: layerTransform(layer, state.zoom),
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
                  {renderLayerContent(layer, state.zoom)}
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
            {state.compareDefault && state.activeVariant !== 'default' && (
              <div className="ic-ghost-overlay" aria-hidden="true">
                {layers.map((baseLayer) => {
                  if (!baseLayer.visible) return null;
                  const size = layerSize(baseLayer, canvasSize);
                  return (
                    <div
                      key={baseLayer.id}
                      className="ic-canvas-layer"
                      style={{
                        width: size.width * state.zoom,
                        height: size.height * state.zoom,
                        opacity: baseLayer.opacity,
                        transform: layerTransform(baseLayer, state.zoom),
                        mixBlendMode: baseLayer.blendMode ?? 'normal'
                      }}
                    >
                      {renderLayerContent(baseLayer, state.zoom)}
                    </div>
                  );
                })}
              </div>
            )}
            {guides.map((guide, index) => (
              <div
                key={`${guide.axis}-${guide.pos}-${index}`}
                className={`ic-snap-guide ${guide.axis === 'x' ? 'is-vertical' : 'is-horizontal'}`}
                style={guide.axis === 'x' ? { left: guide.pos * state.zoom } : { top: guide.pos * state.zoom }}
              />
            ))}
          </div>
        )}

        {menu && activeLayer && (
          <div className="ic-context-menu" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
            <strong>{activeLayer.name}</strong>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'SET_ACTIVE_LAYER', payload: { id: activeLayer.id } });
                dispatch({ type: 'SET_RENAMING_LAYER', payload: { id: activeLayer.id } });
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
