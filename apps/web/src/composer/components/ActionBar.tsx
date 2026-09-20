import { Circle, Grid3x3, Magnet, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, RectangleHorizontal, Redo2, RotateCcw, Square, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { ButtonGroup, IconButton, ToolbarDivider, Tooltip } from '@iconcore/ui';
import { useComposer } from '../ComposerContext';
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../constants';
import { SizePreview } from './SizePreview';
import { AppearanceSwitcher } from './AppearanceSwitcher';

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
 *
 * A2: the 11 inline buttons now use the action grammar (@iconcore/ui).
 * Panel toggles swap between open/close glyphs so their state reads without
 * relying on color alone (selected tint alone was ambiguous).
 * Undo/Redo keep a native `title` because they can be disabled, and Radix
 * Tooltip does not open over a disabled trigger (004 §9).
 */
export const ActionBar = ({
  onToggleLeft,
  leftOpen,
  showLeftToggle = false,
  onToggleInspector,
  inspectorOpen,
  showInspectorToggle = false
}: ActionBarProps) => {
  const { state, dispatch } = useComposer();
  const platformLabel = `Platform: ${PLATFORM_LABELS[state.maskShape] ?? state.maskShape}`;

  return (
    <footer className="ic-action-bar">
      <div className="ic-action-bar-inner">
        <div className="flex min-w-0 items-center gap-1">
          {showLeftToggle && (
            <>
              <ButtonGroup label="Panels" className="ic-toolbar-group">
                <Tooltip content="Toggle Layers panel">
                  <IconButton
                    selected={leftOpen}
                    onClick={onToggleLeft}
                    icon={leftOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
                    aria-label="Toggle Layers panel"
                    aria-expanded={leftOpen ?? false}
                  />
                </Tooltip>
              </ButtonGroup>
              <ToolbarDivider />
            </>
          )}
          <ButtonGroup label="History" className="ic-toolbar-group">
            <IconButton
              onClick={() => dispatch({ type: 'UNDO' })}
              disabled={state.historyIndex <= 0}
              icon={<Undo2 size={15} />}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            />
            <IconButton
              onClick={() => dispatch({ type: 'REDO' })}
              disabled={state.historyIndex >= state.history.length - 1}
              icon={<Redo2 size={15} />}
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo"
            />
          </ButtonGroup>
        </div>

        <div className="flex min-w-0 items-center gap-1">
          <ButtonGroup label="Zoom" className="ic-toolbar-group">
          <Tooltip content="Zoom out">
            <IconButton
              onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.max(ZOOM_MIN, state.zoom - ZOOM_STEP) })}
              icon={<ZoomOut size={15} />}
              aria-label="Zoom out"
            />
          </Tooltip>
          <span className="text-xs font-mono tabular-nums">{(state.zoom * 100).toFixed(0)}%</span>
          <Tooltip content="Zoom in">
            <IconButton
              onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.min(ZOOM_MAX, state.zoom + ZOOM_STEP) })}
              icon={<ZoomIn size={15} />}
              aria-label="Zoom in"
            />
          </Tooltip>
          <Tooltip content="Reset zoom">
            <IconButton
              onClick={() => dispatch({ type: 'SET_ZOOM', payload: 1 })}
              icon={<RotateCcw size={15} />}
              aria-label="Reset zoom"
            />
          </Tooltip>
          </ButtonGroup>
          <ToolbarDivider />
          <ButtonGroup label="View" className="ic-toolbar-group">
            <Tooltip content="Toggle grid">
              <IconButton
                selected={state.showGrid}
                onClick={() => dispatch({ type: 'TOGGLE_GRID' })}
                icon={<Grid3x3 size={15} />}
                aria-label="Toggle grid"
              />
            </Tooltip>
            <Tooltip content="Toggle snapping">
              <IconButton
                selected={state.showSnapping}
                onClick={() => dispatch({ type: 'TOGGLE_SNAPPING' })}
                icon={<Magnet size={15} />}
                aria-label="Toggle snapping"
              />
            </Tooltip>
          </ButtonGroup>
          <ToolbarDivider />
          <ButtonGroup label="Shape" className="ic-toolbar-group">
            <Tooltip content={platformLabel}>
              <IconButton
                onClick={() => {
                  const index = PLATFORM_CYCLE.indexOf(state.maskShape as (typeof PLATFORM_CYCLE)[number]);
                  const next = PLATFORM_CYCLE[(index + 1) % PLATFORM_CYCLE.length];
                  dispatch({ type: 'SET_MASK_SHAPE', payload: next });
                }}
                icon={
                  state.maskShape === 'circle'
                    ? <Circle size={15} />
                    : state.maskShape === 'square'
                      ? <Square size={15} />
                      : <RectangleHorizontal size={15} />
                }
                aria-label={platformLabel}
              />
            </Tooltip>
          </ButtonGroup>
          {state.project && (
            <>
              <ToolbarDivider />
              <ButtonGroup label="Appearance" className="ic-toolbar-group">
                <AppearanceSwitcher />
                <SizePreview />
              </ButtonGroup>
            </>
          )}
          {showInspectorToggle && (
            <>
              <ToolbarDivider />
              <ButtonGroup label="Panels" className="ic-toolbar-group">
                <Tooltip content="Toggle Inspector panel">
                  <IconButton
                    selected={inspectorOpen}
                    onClick={onToggleInspector}
                    icon={inspectorOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                    aria-label="Toggle Inspector panel"
                    aria-expanded={inspectorOpen ?? false}
                  />
                </Tooltip>
              </ButtonGroup>
            </>
          )}
        </div>
      </div>
    </footer>
  );
};