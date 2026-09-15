import { Download, Grid3x3, Magnet, MousePointer2, Redo2, RotateCcw, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { useComposer } from '../ComposerContext';
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../constants';

/**
 * Contextual action bar at the bottom of the Composer AppShell.
 *
 * Owns the global document actions (undo/redo), the active-tool readout and
 * the view controls (zoom, grid, snapping) plus the Export entry point, so the
 * header stays focused on project identity/file actions.
 */
export const ActionBar = () => {
  const { state, dispatch, navigate } = useComposer();

  return (
    <footer className="ic-action-bar">
      <div className="ic-action-bar-inner">
        <div className="ic-toolbar-group">
          <button
            type="button"
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={state.historyIndex <= 0}
            className="p-1.5 rounded hover:bg-core-elevated disabled:opacity-40 disabled:pointer-events-none"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'REDO' })}
            disabled={state.historyIndex >= state.history.length - 1}
            className="p-1.5 rounded hover:bg-core-elevated disabled:opacity-40 disabled:pointer-events-none"
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <Redo2 size={15} />
          </button>
        </div>

        <div className="ic-action-bar-context">
          <MousePointer2 size={14} aria-hidden />
          <span className="ic-action-bar-tool-label">Select</span>
        </div>

        <div className="ic-toolbar-group">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.max(ZOOM_MIN, state.zoom - ZOOM_STEP) })}
            className="p-1.5 rounded hover:bg-core-elevated"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut size={15} />
          </button>
          <span className="text-xs font-mono tabular-nums">{(state.zoom * 100).toFixed(0)}%</span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.min(ZOOM_MAX, state.zoom + ZOOM_STEP) })}
            className="p-1.5 rounded hover:bg-core-elevated"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn size={15} />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_ZOOM', payload: 1 })}
            className="p-1.5 rounded hover:bg-core-elevated"
            title="Reset zoom"
            aria-label="Reset zoom"
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'TOGGLE_GRID' })}
            className={`p-1.5 rounded ${state.showGrid ? 'bg-core-accent/20 text-core-accent' : 'hover:bg-core-elevated'}`}
            title="Toggle grid"
            aria-label="Toggle grid"
          >
            <Grid3x3 size={15} />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'TOGGLE_SNAPPING' })}
            className={`p-1.5 rounded ${state.showSnapping ? 'bg-core-accent/20 text-core-accent' : 'hover:bg-core-elevated'}`}
            title="Toggle snapping"
            aria-label="Toggle snapping"
          >
            <Magnet size={15} />
          </button>
          <button
            type="button"
            onClick={() => navigate('export-utilities')}
            disabled={!state.project}
            className="ic-topbar-export"
            title="Export icon pack"
            aria-label="Export icon pack"
          >
            <Download size={15} />
            <span>Export</span>
          </button>
        </div>
      </div>
    </footer>
  );
};