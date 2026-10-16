import { Magnet, MousePointer2, Hand } from 'lucide-react';
import { resolveSize } from '@iconcore/shared';
import { useComposer } from '../../composer/ComposerContext';
import pkg from '../../../package.json';

export type StudioTool = 'select' | 'hand';

interface StudioStatusBarProps {
  tool: StudioTool;
  cursor: { x: number; y: number } | null;
}

const toolLabel = (tool: StudioTool): string => (tool === 'hand' ? 'Hand' : 'Select');

const toolIcon = (tool: StudioTool) =>
  tool === 'hand' ? <Hand size={12} aria-hidden="true" /> : <MousePointer2 size={12} aria-hidden="true" />;

/**
 * Studio statusbar (Fase 1): three zones.
 *
 * Left: active tool + live cursor position over the stage. Middle: the active
 * layer's dimensions, falling back to the canvas size. Right: the snapping
 * switch (a real toggle, not a readout), the dirty/ready state, and the app
 * version from the workspace manifest.
 */
export const StudioStatusBar = ({ tool, cursor }: StudioStatusBarProps) => {
  const { state, dispatch } = useComposer();
  const project = state.project;
  const activeLayer = project?.layers.find((layer) => layer.id === state.activeLayerId) ?? null;

  const canvas = project ? resolveSize(project.canvas) : null;
  const dimensions = activeLayer?.source.shape
    ? `${Math.round(activeLayer.source.shape.width)} × ${Math.round(activeLayer.source.shape.height)}`
    : canvas
      ? `${canvas.width} × ${canvas.height}`
      : '—';

  return (
    <footer className="studio-statusbar" aria-label="Status bar">
      <span className="studio-status-group">
        {toolIcon(tool)}
        <span>{toolLabel(tool)}</span>
      </span>
      <span className="studio-status-group studio-status-coords" aria-label="Cursor position">
        X {cursor?.x ?? '—'} <span aria-hidden="true">·</span> Y {cursor?.y ?? '—'}
      </span>
      <span className="studio-status-group" aria-label="Selection dimensions">
        {dimensions} px
      </span>
      <span className="studio-status-spacer" />
      <span className="studio-status-group">
        <button
          type="button"
          className="studio-status-snap"
          aria-pressed={state.showSnapping}
          onClick={() => dispatch({ type: 'TOGGLE_SNAPPING' })}
        >
          <Magnet size={12} aria-hidden="true" />
          <span>{state.showSnapping ? 'Snapping on' : 'Snapping off'}</span>
        </button>
      </span>
      <span className="studio-status-group studio-status-ready" role="status">
        <span className="studio-status-dot" aria-hidden="true" />
        <span>{state.isDirty ? 'Unsaved changes' : 'Ready'}</span>
      </span>
      <span className="studio-status-group" aria-label="App version">
        v{pkg.version}
      </span>
    </footer>
  );
};
