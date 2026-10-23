import { ChevronDown, Grid2X2, Hand, Magnet, Maximize, Minus, MousePointer2, Plus, Scan } from 'lucide-react';
import { IconButton, Menu, MenuItem, Tooltip, withIconStroke } from '@iconcore/ui';
import { useComposer } from '../../composer/ComposerContext';
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../../composer/constants';
import type { StudioTool } from './StudioStatusBar';

/** Zoom presets the mockup offers; in/out stepping keeps the full engine range. */
const ZOOM_PRESETS = [25, 50, 75, 100, 150];

interface StudioPillBarProps {
  tool: StudioTool;
  onTool: (tool: StudioTool) => void;
  onFit: () => void;
}

/**
 * Studio floating canvas toolbar (chrome slice): the mockup order, tools and
 * icon styles — Select, Hand, grid, safe area, snapping, zoom out, zoom
 * presets, zoom in, fit.
 *
 * The keyline toggle and the platform-shape cycle the pill used to carry are
 * gone on purpose, not lost: keylines toggle from View options (and the
 * Inspector Keyline section configures them), and the mask shape is chosen in
 * the Inspector Frame radius section. Everything left here dispatches; the
 * pill carries no display-only control.
 */
export const StudioPillBar = ({ tool, onTool, onFit }: StudioPillBarProps) => {
  const { state, dispatch } = useComposer();
  const zoomPercent = Math.round(state.zoom * 100);

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
          icon={<Grid2X2 size={16} />}
          aria-label="Toggle grid"
          selected={state.showGrid}
          onClick={() => dispatch({ type: 'TOGGLE_GRID' })}
        />
      </Tooltip>
      <Tooltip content="Toggle safe area">
        <IconButton
          icon={<Scan size={16} />}
          aria-label="Toggle safe area"
          selected={state.showSafeArea}
          onClick={() => dispatch({ type: 'TOGGLE_SAFE_AREA' })}
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
      <span className="studio-divider" aria-hidden="true" />
      <Tooltip content="Zoom out (Ctrl+−)">
        <IconButton
          icon={<Minus size={16} />}
          aria-label="Zoom out"
          onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.max(ZOOM_MIN, state.zoom - ZOOM_STEP) })}
        />
      </Tooltip>
      <Menu
        label="Zoom"
        trigger={
          <button type="button" className="studio-zoom-value" aria-label={`Zoom ${zoomPercent} percent`}>
            <span>{zoomPercent}%</span>
            {withIconStroke(<ChevronDown size={11} aria-hidden="true" />)}
          </button>
        }
      >
        {ZOOM_PRESETS.map((preset) => (
          <MenuItem
            key={preset}
            label={`${preset}%`}
            onSelect={() => dispatch({ type: 'SET_ZOOM', payload: preset / 100 })}
          />
        ))}
      </Menu>
      <Tooltip content="Zoom in (Ctrl++)">
        <IconButton
          icon={<Plus size={16} />}
          aria-label="Zoom in"
          onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.min(ZOOM_MAX, state.zoom + ZOOM_STEP) })}
        />
      </Tooltip>
      <Tooltip content="Fit to canvas">
        <IconButton
          icon={<Maximize size={16} />}
          aria-label="Fit to canvas"
          onClick={onFit}
        />
      </Tooltip>
    </div>
  );
};
