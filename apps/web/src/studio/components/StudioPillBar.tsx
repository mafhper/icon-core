import { Circle, Crosshair, Grid3x3, Hand, Magnet, MousePointer2, RectangleHorizontal, RotateCcw, Square, ZoomIn, ZoomOut } from 'lucide-react';
import { IconButton, Tooltip } from '@iconcore/ui';
import { useComposer } from '../../composer/ComposerContext';
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../../composer/constants';
import type { StudioTool } from './StudioStatusBar';

const PLATFORM_LABELS: Record<string, string> = {
  square: 'Square',
  'rounded-rectangle': 'Rounded',
  circle: 'Circle',
  squircle: 'Squircle'
};

/** Mask-shape cycle the Composer ActionBar owns; the twin goes away at the Fase 6 cut. */
const PLATFORM_CYCLE = ['square', 'rounded-rectangle', 'circle'] as const;

interface StudioPillBarProps {
  tool: StudioTool;
  onTool: (tool: StudioTool) => void;
}

/**
 * Studio floating canvas toolbar (Fase 2 lean, Fase 3 completes it).
 *
 * The Composer's bottom ActionBar is gone with the old shell, but its canvas
 * verbs stay — tools, grid/keylines/snapping, the mask-shape cycle and real
 * viewport zoom — under the same accessible names, so the behaviour specs
 * keep driving the same words. Everything here dispatches; the pill carries
 * no display-only control.
 */
export const StudioPillBar = ({ tool, onTool }: StudioPillBarProps) => {
  const { state, dispatch } = useComposer();
  const platformLabel = `Platform: ${PLATFORM_LABELS[state.maskShape] ?? state.maskShape}`;

  return (
    <div className="studio-pillbar" role="toolbar" aria-label="Canvas tools">
      <Tooltip content="Selection tool (V)">
        <IconButton
          icon={<MousePointer2 size={16} />}
          aria-label="Selection tool"
          selected={tool === 'select'}
          onClick={() => onTool('select')}
        />
      </Tooltip>
      <Tooltip content="Hand tool (H)">
        <IconButton
          icon={<Hand size={16} />}
          aria-label="Hand tool"
          selected={tool === 'hand'}
          onClick={() => onTool('hand')}
        />
      </Tooltip>
      <span className="studio-divider" aria-hidden="true" />
      <Tooltip content="Toggle grid (G)">
        <IconButton
          icon={<Grid3x3 size={16} />}
          aria-label="Toggle grid"
          selected={state.showGrid}
          onClick={() => dispatch({ type: 'TOGGLE_GRID' })}
        />
      </Tooltip>
      <Tooltip content="Toggle keyline grid">
        <IconButton
          icon={<Crosshair size={16} />}
          aria-label="Toggle keyline grid"
          selected={state.showKeylines}
          onClick={() => dispatch({ type: 'TOGGLE_KEYLINES' })}
        />
      </Tooltip>
      <Tooltip content="Toggle snapping">
        <IconButton
          icon={<Magnet size={16} />}
          aria-label="Toggle snapping"
          selected={state.showSnapping}
          onClick={() => dispatch({ type: 'TOGGLE_SNAPPING' })}
        />
      </Tooltip>
      <Tooltip content={platformLabel}>
        <IconButton
          icon={
            state.maskShape === 'circle'
              ? <Circle size={16} />
              : state.maskShape === 'square'
                ? <Square size={16} />
                : <RectangleHorizontal size={16} />
          }
          aria-label={platformLabel}
          onClick={() => {
            const index = PLATFORM_CYCLE.indexOf(state.maskShape as (typeof PLATFORM_CYCLE)[number]);
            const next = PLATFORM_CYCLE[(index + 1) % PLATFORM_CYCLE.length];
            dispatch({ type: 'SET_MASK_SHAPE', payload: next });
          }}
        />
      </Tooltip>
      <span className="studio-divider" aria-hidden="true" />
      <Tooltip content="Zoom out (Ctrl+−)">
        <IconButton
          icon={<ZoomOut size={16} />}
          aria-label="Zoom out"
          onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.max(ZOOM_MIN, state.zoom - ZOOM_STEP) })}
        />
      </Tooltip>
      <span className="text-xs tabular-nums text-ic-text-muted px-1" aria-label={`Zoom ${Math.round(state.zoom * 100)} percent`}>
        {Math.round(state.zoom * 100)}%
      </span>
      <Tooltip content="Zoom in (Ctrl++)">
        <IconButton
          icon={<ZoomIn size={16} />}
          aria-label="Zoom in"
          onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.min(ZOOM_MAX, state.zoom + ZOOM_STEP) })}
        />
      </Tooltip>
      <Tooltip content="Reset zoom (Ctrl+0)">
        <IconButton
          icon={<RotateCcw size={16} />}
          aria-label="Reset zoom"
          onClick={() => dispatch({ type: 'SET_ZOOM', payload: 1 })}
        />
      </Tooltip>
    </div>
  );
};
