import { useMemo, useRef, useState } from 'react';
import type { IconLayer } from '@iconcore/shared';
import { resolveMaskRadius, resolveSize } from '@iconcore/shared';
import { layerBaseRect } from '@iconcore/renderer';
import { useComposer } from '../ComposerContext';
import { useRenderedProject } from '../hooks/useRenderedProject';
import { resolveLayerVariant } from '../utils/layerResolve';
import { scopedLayerDispatch } from '../utils/layerEdit';
import { workAreaToCss } from '../utils/workArea';
import { gridBackgroundSize } from '../utils/gridConfig';
import { computeSnap, type SnapGuide } from '../utils/snapping';
import { layerSize } from '../utils/layerStyle';

const SNAP_THRESHOLD_PX = 6;
import { DropZone } from './DropZone';
import { SafeAreaOverlay } from './SafeAreaOverlay';
import { VariantPanel } from './VariantPanel';
import { KeylineOverlay } from './KeylineOverlay';
import { MarginOverlay } from './MarginOverlay';
import { LayerContextMenu } from './LayerContextMenu';

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

export const PreviewCanvas = (
  { interactionMode = 'select', workAreaFallback = 'var(--ic-bg)' }: {
    interactionMode?: 'select' | 'hand';
    /**
     * Para onde a mesa cai quando nada foi escolhido. O Composer usa o fundo
     * do tema; a concha passa a mesa do mockup para que palco e faixa leiam
     * um pano só. Só o padrão muda — cor escolhida pinta igual nos dois.
     */
    workAreaFallback?: string;
  } = {}) => {
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

  const previewUrl = useRenderedProject(project, state.activeVariant);
  const ghostUrl = useRenderedProject(
    project,
    'default',
    state.compareDefault && state.activeVariant !== 'default'
  );

  if (!project) return null;

  const canvasSize = project.canvas.size;
  // The renderer takes the resolved pair; the editor's own display/snapping math
  // below stays square-first (that is a UI surface, not the export model).
  const canvas = resolveSize(project.canvas);
  const displaySize = canvasSize * state.zoom;
  // One resolver in `@iconcore/shared` owns the shape → radius rule — the same
  // one the export mask reads, so frame and file cannot drift apart. The
  // document's shape wins; the toolbar's choice covers a project that never
  // declared one. The old inline ternary handled three of the four shapes, so
  // `squircle` silently got the square's 4px instead of the superellipse the
  // keylines draw at.
  // The mask preview flag rounds the frame; off shows the square frame.
  // The export always masks — this is the preview comparison, not the output.
  const frameShape = project.canvas.maskShape ?? state.maskShape;
  const frameRadiusPx = state.showMask
    ? resolveMaskRadius({ ...project.canvas, maskShape: frameShape })
    : 0;
  const frameRadius = `${frameRadiusPx}px`;

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
    // The Hand tool owns the pointer: pans happen at the stage, never here.
    if (interactionMode === 'hand') return;
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
        const size = layerSize(dragged, canvas);
        const others = project.layers
          .filter((item) => item.id !== drag.id && item.visible && item.role !== 'background')
          .map((item) => resolveLayerVariant(item, state.activeVariant))
          .map((item) => {
            const s = layerSize(item, canvas);
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
      // Project the pointer onto the layer's own diagonal (in its local frame, so
      // rotation is respected): the corner follows the cursor at any layer size.
      // The previous fixed sensitivity (`* 2.2`) only matched ~468px layers.
      const baseLayer = project.layers.find((item) => item.id === drag.id);
      const dragged = baseLayer ? resolveLayerVariant(baseLayer, state.activeVariant) : null;
      if (!dragged) return;
      const size = layerSize(dragged, canvas);
      const radians = (drag.origin.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(radians) + dy * Math.sin(radians);
      const localY = -dx * Math.sin(radians) + dy * Math.cos(radians);
      const diagonal = size.width ** 2 + size.height ** 2;
      // The layer scales about its centre, so the corner travels half the size
      // change: double the projection for the corner to follow the cursor.
      const projected = diagonal === 0 ? 0 : (2 * (localX * size.width + localY * size.height)) / diagonal;
      scheduleTransform(drag.id, {
        ...drag.origin,
        scale: Math.max(0.08, Number((drag.originScale + projected).toFixed(3)))
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

  return (
    <div className="ic-preview-panel">
      <div
        className="ic-edit-stage"
        /**
         * A cor vai **inline**, e nao por atributo de dados.
         *
         * O `data-editor-backdrop` com tres regras CSS era o que impedia isto de ser uma
         * cor: o valor tinha de estar na folha, e por isso o `plain` — que ja era uma cor
         * — carregava um literal `#e6ecf5` dentro do `color-mix`. Inline, o fallback
         * continua sendo o `workAreaFallback` (o fundo do tema no Composer) e nenhum
         * literal existe.
         */
        style={{ backgroundColor: workAreaToCss(state.workAreaColor, workAreaFallback) }}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={(event) => {
          setMenu(null);
          // Canvas adjustments (work area) belong to the stage *around* the icon;
          // a click inside the icon frame is the frame's own business.
          if ((event.target as HTMLElement).closest('.ic-canvas-frame')) return;
          if (interactionMode === 'hand') return;
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
            onClick={(event) => {
              // The Background layer produces no pixels, so it has no hit area of
              // its own: clicking the icon's background selects its handle, which
              // brings it up in the sidebar and in the inspector.
              event.stopPropagation();
              if (interactionMode === 'hand') return;
              const background = layers.find((layer) => layer.role === 'background');
              if (background) dispatch({ type: 'SET_ACTIVE_LAYER', payload: { id: background.id } });
            }}
          >
            {previewUrl && (
              <img className="ic-canvas-render" src={previewUrl} alt="" draggable={false} style={{ width: displaySize, height: displaySize }} />
            )}
            {ghostUrl && (
              <img className="ic-canvas-ghost" src={ghostUrl} alt="" draggable={false} style={{ width: displaySize, height: displaySize }} />
            )}
            {/*
                O `background-size` vem inline das divisões: em CSS fixo era
                `12.5%` (8 divisões) e não havia como mudar. `100/n` em porcentagem é
                o que faz a mesma conta servir a 512 e a 1024 — um `gap` em px não
                sobrevive a outro tamanho de canvas.
            */}
            {state.showGrid && (
              <div className="ic-canvas-grid" style={{ backgroundSize: gridBackgroundSize(state.gridColumns, state.gridRows) }} />
            )}
            {state.showKeylines && <KeylineOverlay />}
            {/*
                A máscara da margem fica **sobre** a keyline e não sob ela: as duas
                falariam da mesma caixa (a área da arte e a safe area), e a de cima é a
                que responde ao controle que a pessoa acabou de mexer.
            */}
            <MarginOverlay />
            <SafeAreaOverlay />
            {layers.filter((baseLayer) => baseLayer.role !== 'background').map((baseLayer) => {
              const layer = resolveLayerVariant(baseLayer, state.activeVariant);
              if (!layer.visible) return null;
              const selected = state.activeLayerId === layer.id;
              const rect = layerBaseRect(layer, canvas);
              const width = rect.w * state.zoom;
              const height = rect.h * state.zoom;

              return (
                <div
                  key={layer.id}
                  className={`ic-canvas-layer ${selected ? 'is-selected' : ''} ${layer.locked ? 'is-locked' : ''}`}
                  style={{
                    width,
                    height,
                    transform: layerTransform(layer, state.zoom),
                    // Handles counter-scale against this so they keep a constant
                    // size on screen (see `.ic-transform-handle` in index.css).
                    '--layer-scale': Math.max(0.01, layer.transform.scale * state.zoom)
                  } as React.CSSProperties}
                  onPointerDown={(event) => startDrag(event, layer, 'move')}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (interactionMode === 'hand') return;
                    dispatch({ type: 'SET_ACTIVE_LAYER', payload: { id: layer.id } });
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (interactionMode === 'hand') return;
                    dispatch({ type: 'SET_ACTIVE_LAYER', payload: { id: layer.id } });
                    setMenu({ x: event.clientX, y: event.clientY, layerId: layer.id });
                  }}
                >
                  {selected && !layer.locked && (
                    <>
                      <span className="ic-dimension-tag" aria-hidden="true">
                        {Math.round(rect.w)} × {Math.round(rect.h)}
                      </span>
                      {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
                        <button
                          key={corner}
                          type="button"
                          className={`ic-transform-handle ic-scale-handle is-${corner}`}
                          onPointerDown={(event) => startDrag(event, layer, 'scale')}
                          title="Scale layer"
                          aria-label={`Scale ${layer.name}`}
                        />
                      ))}
                      <button
                        type="button"
                        className="ic-transform-handle ic-rotate-handle"
                        onPointerDown={(event) => startDrag(event, layer, 'rotate')}
                        title="Rotate layer"
                        aria-label={`Rotate ${layer.name}`}
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
