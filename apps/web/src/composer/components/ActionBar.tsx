import { Circle, Download, Grid3x3, Magnet, PanelLeftOpen, PanelRightOpen, RectangleHorizontal, Redo2, RotateCcw, Square, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { useComposer } from '../ComposerContext';
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../constants';
import { SizePreview } from './SizePreview';

const PLATFORM_LABELS: Record<string, string> = {
  square: 'Square',
  'rounded-rectangle': 'Rounded',
  circle: 'Circle',
  squircle: 'Squircle'
};

const PLATFORM_CYCLE = ['square', 'rounded-rectangle', 'circle'] as const;

interface ActionBarProps {
  onToggleLeft?: () => void;
  leftOpen?: boolean;
  showLeftToggle?: boolean;
  onToggleInspector?: () => void;
  inspectorOpen?: boolean;
  showInspectorToggle?: boolean;
}

/**
 * Contextual action bar at the bottom of the Composer AppShell.
 *
 * Owns the panel toggles (Layers left, Inspector right — symmetric flat
 * icons beside the document actions), the undo/redo history controls, the
 * view controls (zoom, grid, snapping) and the Export entry point.
 */
export const ActionBar = ({
  onToggleLeft,
  leftOpen,
  showLeftToggle = false,
  onToggleInspector,
  inspectorOpen,
  showInspectorToggle = false
}: ActionBarProps) => {
  const { state, dispatch, navigate } = useComposer();

  return (
    <footer className="ic-action-bar">
      <div className="ic-action-bar-inner">
        <div className="ic-toolbar-group">
          {showLeftToggle && (
            <button
              type="button"
              onClick={onToggleLeft}
              className={`p-1.5 rounded ${leftOpen ? 'bg-core-accent/20 text-core-accent' : 'hover:bg-core-elevated'}`}
              title="Toggle Layers panel"
              aria-label="Toggle Layers panel"
              aria-expanded={leftOpen ?? false}
            >
              <PanelLeftOpen size={15} />
            </button>
          )}
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
            className="p-1.5 rounded hover:bg-core-elevated"
            onClick={() => {
              const index = PLATFORM_CYCLE.indexOf(state.maskShape as (typeof PLATFORM_CYCLE)[number]);
              const next = PLATFORM_CYCLE[(index + 1) % PLATFORM_CYCLE.length];
              dispatch({ type: 'SET_MASK_SHAPE', payload: next });
            }}
            title={`Platform: ${PLATFORM_LABELS[state.maskShape] ?? state.maskShape}`}
            aria-label={`Platform: ${PLATFORM_LABELS[state.maskShape] ?? state.maskShape}`}
          >
            {state.maskShape === 'circle'
              ? <Circle size={15} />
              : state.maskShape === 'square'
                ? <Square size={15} />
                : <RectangleHorizontal size={15} />}
          </button>
          {state.project && <SizePreview />}
          {showInspectorToggle && (
            <button
              type="button"
              onClick={onToggleInspector}
              className={`p-1.5 rounded ${inspectorOpen ? 'bg-core-accent/20 text-core-accent' : 'hover:bg-core-elevated'}`}
              title="Toggle Inspector panel"
              aria-label="Toggle Inspector panel"
              aria-expanded={inspectorOpen ?? false}
            >
              <PanelRightOpen size={15} />
            </button>
          )}
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