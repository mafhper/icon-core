import { useRef } from 'react';
import { useComposer } from '../../composer/ComposerContext';
import { PreviewCanvas } from '../../composer/components/PreviewCanvas';
import { workAreaToCss } from '../../composer/utils/workArea';
import { StudioPillBar } from './StudioPillBar';
import { StudioVariantTiles } from './StudioVariantTiles';
import type { StudioTool } from './StudioStatusBar';

interface StudioCanvasStageProps {
  tool: StudioTool;
  onTool: (tool: StudioTool) => void;
  onCursor: (cursor: { x: number; y: number } | null) => void;
  pan: { x: number; y: number };
  onPan: (pan: { x: number; y: number }) => void;
  onResetView: () => void;
}

/**
 * Studio canvas stage (chrome slice): the real viewport, the Hand pan, the
 * floating pill and the live variant tiles — no furniture.
 *
 * The document breadcrumb and View options used to live over this viewport;
 * they moved to the titlebar and the toolbar, where the whole app can reach
 * them. The creation toolbar the Composer painted inside the canvas is gone
 * too: the Layers header Insert is the one entry point. What the stage keeps
 * is chrome with no dead controls: the pill dispatches, tiles render the live
 * pipeline, and Fit to canvas returns zoom and pan together.
 *
 * The viewport itself stays the Composer's `PreviewCanvas` — real zoom,
 * gesture transactions (one undo per drag), grid/keyline/margin overlays,
 * snapping — so stage and Inspector can only disagree by a bug, never by
 * construction.
 */
export const StudioCanvasStage = ({ tool, onTool, onCursor, pan, onPan, onResetView }: StudioCanvasStageProps) => {
  const { state } = useComposer();
  const panRef = useRef(pan);
  panRef.current = pan;
  const dragRef = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(null);
  const movedRef = useRef(false);

  const trackCursor = (event: React.PointerEvent) => {
    const frame = event.currentTarget.getBoundingClientRect();
    onCursor({ x: Math.round(event.clientX - frame.left), y: Math.round(event.clientY - frame.top) });
  };

  return (
    <section
      className={`studio-canvas ${tool === 'hand' ? 'is-hand' : ''}`}
      aria-label="Canvas"
      onPointerMove={trackCursor}
      onPointerLeave={() => onCursor(null)}
    >
      <div className="studio-stage-wrap">
        <div
          className="studio-stage"
          style={
            {
              '--pan-x': `${pan.x}px`,
              '--pan-y': `${pan.y}px`,
              backgroundColor: workAreaToCss(state.workAreaColor)
            } as React.CSSProperties
          }
          onPointerDownCapture={(event) => {
            if (tool !== 'hand') return;
            // The Hand owns the pointer from here: layers must not start drags
            // and the stage must not deselect underneath the pan.
            event.stopPropagation();
            event.preventDefault();
            movedRef.current = false;
            dragRef.current = { x: event.clientX, y: event.clientY, pan: panRef.current };
          }}
          onPointerMoveCapture={(event) => {
            const drag = dragRef.current;
            if (!drag) return;
            const dx = event.clientX - drag.x;
            const dy = event.clientY - drag.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) movedRef.current = true;
            onPan({ x: drag.pan.x + dx, y: drag.pan.y + dy });
          }}
          onPointerUpCapture={() => {
            dragRef.current = null;
          }}
          onClickCapture={(event) => {
            if (movedRef.current) {
              // A pan that travelled ends in a click the canvas must not hear.
              event.stopPropagation();
              movedRef.current = false;
            }
          }}
        >
          <PreviewCanvas interactionMode={tool} />
        </div>
        <StudioPillBar tool={tool} onTool={onTool} onFit={onResetView} />
      </div>
      <StudioVariantTiles />
    </section>
  );
};
