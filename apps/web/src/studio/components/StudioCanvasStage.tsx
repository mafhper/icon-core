import { useRef, useState } from 'react';
import { Box, ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import { Menu, MenuItem } from '@iconcore/ui';
import { useComposer } from '../../composer/ComposerContext';
import { PreviewCanvas } from '../../composer/components/PreviewCanvas';
import { workAreaToCss } from '../../composer/utils/workArea';
import { StudioPillBar } from './StudioPillBar';
import { StudioVariantTiles } from './StudioVariantTiles';
import { variantLabel } from '../variantLabels';
import type { StudioTool } from './StudioStatusBar';

interface StudioCanvasStageProps {
  tool: StudioTool;
  onTool: (tool: StudioTool) => void;
  onCursor: (cursor: { x: number; y: number } | null) => void;
}

const check = (on: boolean) => (on ? 'On' : 'Off');

/**
 * Studio canvas stage (Fase 3): breadcrumb + View options over the real
 * viewport, the Hand pan, the floating pill and the live variant tiles.
 *
 * The viewport itself stays the Composer's `PreviewCanvas` — real zoom,
 * gesture transactions (one undo per drag), grid/keyline/margin overlays,
 * snapping — so stage and Inspector can only disagree by a bug, never by
 * construction. What the stage adds is chrome with no dead controls: every
 * View-options row flips a real flag, tiles render the live pipeline, and
 * Reset view returns zoom and pan together.
 */
export const StudioCanvasStage = ({ tool, onTool, onCursor }: StudioCanvasStageProps) => {
  const { state, dispatch } = useComposer();
  const project = state.project;
  const activeLabel = variantLabel(state.activeVariant);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef(pan);
  panRef.current = pan;
  const dragRef = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(null);
  const movedRef = useRef(false);

  const trackCursor = (event: React.PointerEvent) => {
    const frame = event.currentTarget.getBoundingClientRect();
    onCursor({ x: Math.round(event.clientX - frame.left), y: Math.round(event.clientY - frame.top) });
  };

  const resetView = () => {
    setPan({ x: 0, y: 0 });
    dispatch({ type: 'SET_ZOOM', payload: 1 });
  };

  return (
    <section
      className={`studio-canvas ${tool === 'hand' ? 'is-hand' : ''}`}
      aria-label="Canvas"
      onPointerMove={trackCursor}
      onPointerLeave={() => onCursor(null)}
    >
      <div className="studio-crumbbar">
        <Box size={13} aria-hidden="true" />
        <strong>{project?.metadata.name ?? 'No document'}</strong>
        <ChevronRight size={12} aria-hidden="true" />
        <span>{activeLabel}</span>
        <span className="studio-crumbbar-spacer" />
        <Menu
          label="View options"
          trigger={
            <button type="button" className="studio-trigger" aria-label="View options">
              <span className="inline-flex items-center gap-1.5">
                <Settings2 size={14} aria-hidden="true" />
                <span>View options</span>
                <ChevronDown size={12} aria-hidden="true" />
              </span>
            </button>
          }
        >
          <MenuItem
            label={`Grid — ${check(state.showGrid)}`}
            onSelect={() => dispatch({ type: 'TOGGLE_GRID' })}
          />
          <MenuItem
            label={`Keylines — ${check(state.showKeylines)}`}
            onSelect={() => dispatch({ type: 'TOGGLE_KEYLINES' })}
          />
          <MenuItem
            label={`Import margin — ${check(state.showMarginOverlay)}`}
            onSelect={() => dispatch({ type: 'TOGGLE_MARGIN_OVERLAY' })}
          />
          <MenuItem
            label={`Safe area — ${check(state.showSafeArea)}`}
            onSelect={() => dispatch({ type: 'TOGGLE_SAFE_AREA' })}
          />
          <MenuItem
            label={`Icon mask — ${check(state.showMask)}`}
            onSelect={() => dispatch({ type: 'TOGGLE_MASK' })}
          />
          <MenuItem
            label={`Snapping guides — ${check(state.showSnapping)}`}
            onSelect={() => dispatch({ type: 'TOGGLE_SNAPPING' })}
          />
          <MenuItem label="Reset view" onSelect={resetView} />
        </Menu>
      </div>
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
          setPan({ x: drag.pan.x + dx, y: drag.pan.y + dy });
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
      <StudioPillBar tool={tool} onTool={onTool} />
      <StudioVariantTiles />
    </section>
  );
};
