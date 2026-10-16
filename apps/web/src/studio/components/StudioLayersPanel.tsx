import { useState } from 'react';
import { useComposer } from '../../composer/ComposerContext';
import { LayerList } from '../../composer/components/LayerList';
import { ProjectTitle } from '../../composer/components/ProjectTitle';
import { StudioConfirmDialog } from './StudioConfirmDialog';
import { StudioInsertMenu } from './StudioInsertMenu';

/**
 * Studio Layers panel (Fase 2): tree with eye/lock/inline-rename,
 * duplicate/delete menu, drag-and-drop and an empty state with a CTA —
 * all owned by the reused `LayerList`, which stays synchronised with Canvas
 * and Inspector through the shared reducer state.
 *
 * The one behaviour the studio adds: menu/row-driven deletes ask first.
 * Keyboard Delete stays direct (one undo away); a clicked trash can is
 * deliberate enough to deserve the question, and its layer name is in it.
 */
export const StudioLayersPanel = () => {
  const { state, dispatch } = useComposer();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDelete = state.project?.layers.find((layer) => layer.id === pendingDeleteId) ?? null;

  return (
    <>
      {/* The project title owns the panel width (Composer lesson: in a top
          bar it grows and pushes everything sideways on every keystroke),
          and it is the rename entry point until the Fase 5 dialogs. */}
      <ProjectTitle />
      <div className="studio-panel-heading">
        <span>Layers</span>
        <span className="studio-panel-count">{state.project?.layers.length ?? 0}</span>
        <span className="studio-topbar-spacer" />
        <StudioInsertMenu variant="icon" />
      </div>
      <div className="studio-panel-scroll">
        <LayerList onDeleteRequest={setPendingDeleteId} />
      </div>
      {pendingDelete && (
        <StudioConfirmDialog
          title="Delete layer?"
          message={`“${pendingDelete.name}” will be removed. You can undo this action.`}
          confirmLabel="Delete layer"
          onConfirm={() => {
            dispatch({ type: 'REMOVE_LAYER', payload: { id: pendingDelete.id } });
            setPendingDeleteId(null);
          }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </>
  );
};
