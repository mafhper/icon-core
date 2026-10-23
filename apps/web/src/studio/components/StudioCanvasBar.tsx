import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Redo2, Undo2 } from 'lucide-react';
import { IconButton, Tooltip } from '@iconcore/ui';
import { useComposer } from '../../composer/ComposerContext';
import { StudioViewOptions } from './StudioViewOptions';

interface StudioCanvasBarProps {
  leftOpen: boolean;
  inspectorOpen: boolean;
  onToggleLeft: () => void;
  onToggleInspector: () => void;
  onResetView: () => void;
}

/**
 * Studio canvas bar (chrome slice): the toolbar scoped to the canvas column —
 * never above the sidebars. First icon collapses the left panel, last icon
 * collapses the right one; undo, redo and View options ride between them.
 *
 * Insert is a layer function and lives ONLY in the Layers header; Export lives
 * in the Inspector Export tab. Neither is duplicated here.
 */
export const StudioCanvasBar = ({
  leftOpen,
  inspectorOpen,
  onToggleLeft,
  onToggleInspector,
  onResetView
}: StudioCanvasBarProps) => {
  const { state, dispatch } = useComposer();
  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  return (
    <div className="studio-canvasbar" role="toolbar" aria-label="Studio toolbar">
      <div className="studio-topbar-group">
        <Tooltip content={leftOpen ? 'Hide Layers panel' : 'Show Layers panel'}>
          <IconButton
            icon={leftOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            aria-label={leftOpen ? 'Hide Layers panel' : 'Show Layers panel'}
            aria-pressed={leftOpen}
            onClick={onToggleLeft}
          />
        </Tooltip>
      </div>
      <span className="studio-divider" aria-hidden="true" />
      <div className="studio-topbar-group">
        <Tooltip content="Undo (Ctrl+Z)">
          <IconButton
            icon={<Undo2 size={16} />}
            aria-label="Undo"
            disabled={!canUndo}
            onClick={() => dispatch({ type: 'UNDO' })}
          />
        </Tooltip>
        <Tooltip content="Redo (Ctrl+Shift+Z)">
          <IconButton
            icon={<Redo2 size={16} />}
            aria-label="Redo"
            disabled={!canRedo}
            onClick={() => dispatch({ type: 'REDO' })}
          />
        </Tooltip>
      </div>
      <span className="studio-divider" aria-hidden="true" />
      <div className="studio-topbar-group">
        <StudioViewOptions onResetView={onResetView} />
      </div>
      {/* Variant lives only in the canvas tiles (and the Inspector Export
          grid, which renders the same tiles): no canvas-bar duplicate. */}
      <div className="studio-topbar-spacer" />
      <div className="studio-topbar-group">
        <Tooltip content={inspectorOpen ? 'Hide Inspector panel' : 'Show Inspector panel'}>
          <IconButton
            icon={inspectorOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            aria-label={inspectorOpen ? 'Hide Inspector panel' : 'Show Inspector panel'}
            aria-pressed={inspectorOpen}
            onClick={onToggleInspector}
          />
        </Tooltip>
      </div>
    </div>
  );
};
