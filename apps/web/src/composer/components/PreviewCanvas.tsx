import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Circle, Crosshair, ImagePlus, Shapes, Slash, Square, Squircle, Star, Triangle, Type } from 'lucide-react';
import type { IconLayer, IconVariant, IconCoreProject, ShapeDefinition } from '@iconcore/shared';
import { renderProject, createCanvasBackend, layerBaseRect } from '@iconcore/renderer';
import { ButtonGroup, IconButton, Menu, MenuItem, ToolbarDivider, Tooltip } from '@iconcore/ui';
import { useComposer } from '../ComposerContext';
import { useLayerImport } from '../hooks/useLayerImport';
import { resolveLayerVariant } from '../utils/layerResolve';
import { scopedLayerDispatch } from '../utils/layerEdit';
import { computeSnap, type SnapGuide } from '../utils/snapping';
import { layerSize } from '../utils/layerStyle';

const SNAP_THRESHOLD_PX = 6;
import { DropZone } from './DropZone';
import { VariantPanel } from './VariantPanel';
import { KeylineOverlay } from './KeylineOverlay';
import { LayerContextMenu } from './LayerContextMenu';

type DragMode = 'move' | 'scale' | 'rotate';

/** Tiny rounded-rectangle glyph (lucide has no rounded-rect primitive). */
const RoundedRectGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <rect x="2" y="3.5" width="12" height="9" rx="2.5" />
  </svg>
);

interface ShapeOption {
  kind: ShapeDefinition['kind'];
  label: string;
  icon: ReactNode;
  defaults: ShapeDefinition;
}

/** Primitive shapes offered by the canvas "Add" menu, with creation defaults. */
const SHAPE_OPTIONS: ShapeOption[] = [
  { kind: 'rectangle', label: 'Rectangle', icon: <Square size={15} />, defaults: { kind: 'rectangle', width: 220, height: 220 } },
  { kind: 'rounded-rectangle', label: 'Rounded rectangle', icon: <RoundedRectGlyph />, defaults: { kind: 'rounded-rectangle', width: 220, height: 220, cornerRadius: 48 } },
  { kind: 'squircle', label: 'Squircle', icon: <Squircle size={15} />, defaults: { kind: 'squircle', width: 220, height: 220, cornerRadius: 48 } },
  { kind: 'circle', label: 'Circle', icon: <Circle size={15} />, defaults: { kind: 'circle', width: 220, height: 220 } },
  { kind: 'triangle', label: 'Triangle', icon: <Triangle size={15} />, defaults: { kind: 'triangle', width: 220, height: 220 } },
  { kind: 'line', label: 'Line', icon: <Slash size={15} />, defaults: { kind: 'line', width: 280, height: 40 } },
  { kind: 'star', label: 'Star', icon: <Star size={15} />, defaults: { kind: 'star', width: 220, height: 220 } }
];

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

/**
 * Render the project through the SAME Canvas2D pipeline used for export, so the
 * live preview is pixel-identical to the exported asset. Returns an object URL
 * for the rendered PNG, re-rendered (RAF-coalesced) whenever the project or
 * variant changes. `enabled` lets callers skip the (compare) ghost render.
 */
const useRenderedIcon = (
  project: IconCoreProject | null,
  variant: IconVariant,
  enabled = true
): string | null => {
  const [url, setUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!project || !enabled || project.layers.length === 0) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    const backend = createCanvasBackend();
    const raf = requestAnimationFrame(async () => {
      try {
        const blob = await renderProject(project, variant, project.canvas.size, backend);
        if (cancelled) return;
        const next = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = next;
        setUrl(next);
      } catch (err) {
        console.error('Live preview render failed:', err);
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      backend.destroy();
    };
  }, [project, variant, enabled]);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  return url;
};

export const PreviewCanvas = () => {
  const { state, dispatch } = useComposer();
  const importFiles = useLayerImport();
  const fileRef = useRef<HTMLInputElement>(null);
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

  const previewUrl = useRenderedIcon(project, state.activeVariant);
  const ghostUrl = useRenderedIcon(
    project,
    'default',
    state.compareDefault && state.activeVariant !== 'default'
  );

  if (!project) return null;

  const canvasSize = project.canvas.size;
  const displaySize = canvasSize * state.zoom;
  const frameRadius = state.maskShape === 'circle' ? '50%' : state.maskShape === 'rounded-rectangle' ? '24px' : '4px';

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
          .filter((item) => item.id !== drag.id && item.visible && item.role !== 'background')
          .map((item) => resolveLayerVariant(item, state.activeVariant))
          .map((item) => {
            const s = layerSize(item, canvasSize);
            return { x: item.transform.x, y: item.transform.y, width: s.width * item.transform.scale, height: s.height * item.transform.scale };
          });
        const safeInset = project.canvas.safeArea ? project.canvas.safeArea.inset * canvasSize : 0;
        const snap = state.showSnapping
          ? computeSnap(
              { x: rawX, y: rawY, width: size.width * drag.originScale, height: size.height * drag.originScale },
              others,
              canvasSize,
              safeInset,
              SNAP_THRESHOLD_PX / state.zoom
            )
          : { x: rawX, y: rawY, guides: [] as SnapGuide[] };
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await importFiles(e.target.files);
    e.target.value = '';
  };

  return (
    <div className="ic-preview-panel">
      <div className="ic-canvas-toolbar">
        <div className="flex min-w-0 items-center gap-1">
          <span className="ic-toolbar-label" aria-hidden="true">
            Add
          </span>
          <ButtonGroup label="Add layer" className="ic-toolbar-group">
            <Menu
              label="Add shape"
              trigger={<IconButton icon={<Shapes size={16} />} aria-label="Add shape" />}
            >
              {SHAPE_OPTIONS.map((shape) => (
                <MenuItem
                  key={shape.kind}
                  icon={shape.icon}
                  label={shape.label}
                  onSelect={() => dispatch({ type: 'ADD_LAYER', payload: { shape: shape.defaults } })}
                />
              ))}
            </Menu>
            <Tooltip content="Add text layer">
              <IconButton
                icon={<Type size={16} />}
                aria-label="Add text layer"
                onClick={() => dispatch({ type: 'ADD_LAYER', payload: { text: true } })}
              />
            </Tooltip>
            <Tooltip content="Add background fill layer">
              <IconButton
                icon={<Square size={16} fill="currentColor" strokeWidth={1} />}
                aria-label="Add background fill layer"
                onClick={() => dispatch({ type: 'ADD_LAYER', payload: { background: true } })}
              />
            </Tooltip>
            <Tooltip content="Upload image">
              <IconButton
                icon={<ImagePlus size={16} />}
                aria-label="Upload image"
                onClick={() => fileRef.current?.click()}
              />
            </Tooltip>
          </ButtonGroup>
          <input
            ref={fileRef}
            type="file"
            accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp"
            className="hidden"
            multiple
            onChange={handleFileUpload}
          />
        </div>
        <ToolbarDivider />
        <div className="flex min-w-0 items-center gap-1">
          <span className="ic-toolbar-label" aria-hidden="true">
            View
          </span>
          <ButtonGroup label="Canvas view" className="ic-toolbar-group">
            <Tooltip content="Toggle keyline grid">
              <IconButton
                selected={state.showKeylines}
                onClick={() => dispatch({ type: 'TOGGLE_KEYLINES' })}
                icon={<Crosshair size={16} />}
                aria-label="Toggle keyline grid"
              />
            </Tooltip>
          </ButtonGroup>
        </div>
      </div>
      <div
        className="ic-edit-stage"
        data-editor-backdrop={state.editorBackdrop}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={() => {
          setMenu(null);
          dispatch({ type: 'SET_ACTIVE_LAYER', payload: { id: null } });
        }}
      >
        <VariantPanel />
        {layers.length === 0 ? (
          <DropZone />
        ) : (
          <div
            className="ic-canvas-frame"
            style={{
              width: displaySize,
              height: displaySize,
              borderRadius: frameRadius
            }}
          >
            {previewUrl && (
              <img className="ic-canvas-render" src={previewUrl} alt="" draggable={false} style={{ width: displaySize, height: displaySize }} />
            )}
            {ghostUrl && (
              <img className="ic-canvas-ghost" src={ghostUrl} alt="" draggable={false} style={{ width: displaySize, height: displaySize }} />
            )}
            {state.showGrid && <div className="ic-canvas-grid" />}
            {state.showKeylines && <KeylineOverlay />}
            {layers.filter((baseLayer) => baseLayer.role !== 'background').map((baseLayer) => {
              const layer = resolveLayerVariant(baseLayer, state.activeVariant);
              if (!layer.visible) return null;
              const selected = state.activeLayerId === layer.id;
              const rect = layerBaseRect(layer, canvasSize);
              const width = rect.w * state.zoom;
              const height = rect.h * state.zoom;

              return (
                <div
                  key={layer.id}
                  className={`ic-canvas-layer ${selected ? 'is-selected' : ''} ${layer.locked ? 'is-locked' : ''}`}
                  style={{
                    width,
                    height,
                    transform: layerTransform(layer, state.zoom)
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
            {guides.map((guide, index) => (
              <div
                key={`${guide.axis}-${guide.pos}-${index}`}
                className={`ic-snap-guide ${guide.axis === 'x' ? 'is-vertical' : 'is-horizontal'}`}
                style={guide.axis === 'x' ? { left: guide.pos * state.zoom } : { top: guide.pos * state.zoom }}
              />
            ))}
          </div>
        )}

        {menu && (
          <LayerContextMenu x={menu.x} y={menu.y} layerId={menu.layerId} onClose={() => setMenu(null)} />
        )}
      </div>
    </div>
  );
};
