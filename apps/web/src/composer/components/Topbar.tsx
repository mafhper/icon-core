import { Download, Save, FolderOpen, Undo2, Redo2 } from 'lucide-react';
import { useComposer } from '../ComposerContext';
import { useToast } from '../toast/ToastContext';
import { parseProjectFile } from '../utils/projectGuard';
import { AnimatedIconCoreLogo } from '../../app/AnimatedIconCoreLogo';

export const Topbar = () => {
  const { state, dispatch, navigate } = useComposer();
  const toast = useToast();

  const handleSave = () => {
    if (!state.project) return;
    const json = JSON.stringify(state.project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.project.metadata.name.toLowerCase().replace(/\s+/g, '-')}.iconcore.json`;
    a.click();
    URL.revokeObjectURL(url);
    dispatch({ type: 'SET_DIRTY', payload: false });
    toast.success('Project saved');
  };

  const handleOpen = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.iconcore.json,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const project = parseProjectFile(await file.text());
      if (!project) {
        toast.error(`"${file.name}" is not a valid Icon Core project file.`);
        return;
      }
      dispatch({ type: 'LOAD_PROJECT', payload: project });
      toast.success(`Opened ${project.metadata.name}`);
    };
    input.click();
  };

  return (
    <header className="ic-topbar">
      <div className="ic-topbar-inner">
        <button
          type="button"
          className="ic-topbar-brand"
          onClick={() => navigate('workspaces')}
          title="Home — start or open a project"
        >
          <AnimatedIconCoreLogo className="ic-topbar-logo" animated={false} />
          <span className="ic-topbar-title">{state.project?.metadata.name ?? 'Icon Core'}</span>
          {state.isDirty && <span className="ic-topbar-dirty" title="Unsaved changes" aria-label="Unsaved changes" />}
        </button>

        <div className="ic-topbar-actions">
          <div className="ic-topbar-cluster">
            <button
              type="button"
              onClick={() => dispatch({ type: 'UNDO' })}
              disabled={state.historyIndex <= 0}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'REDO' })}
              disabled={state.historyIndex >= state.history.length - 1}
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo"
            >
              <Redo2 size={15} />
            </button>
          </div>

          <div className="ic-topbar-cluster">
            <button type="button" onClick={handleOpen} title="Open project…" aria-label="Open project">
              <FolderOpen size={15} />
            </button>
            <button type="button" onClick={handleSave} disabled={!state.project} title="Save project" aria-label="Save project">
              <Save size={15} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate('export-utilities')}
            disabled={!state.project}
            className="ic-topbar-export"
            title="Export icon pack"
          >
            <Download size={15} />
            <span>Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};
