import { Download, Save, FolderOpen, Undo2, Redo2, Layers } from 'lucide-react';
import { useComposer } from '../ComposerContext';
import { useToast } from '../toast/ToastContext';
import { parseProjectFile } from '../utils/projectGuard';
import { VariantSwitcher } from './VariantSwitcher';

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
        <div className="ic-topbar-brand">
          <Layers size={20} className="text-core-accent" />
          <div>
            <p>
              {state.project?.metadata.name ?? 'Icon Core'}
            </p>
            <p className={`text-xs text-core-muted ${state.isDirty ? '' : 'invisible'}`}>Unsaved changes</p>
          </div>
        </div>

        <div className="ic-topbar-shortcuts">
          <span className="flex items-center gap-1.5">
            <span className="text-core-accent">Layer:</span>
            <span className="flex items-center gap-0.5">
              <span className="kbd">L</span> add
            </span>
            <span className="flex items-center gap-0.5">
              <span className="kbd">⌘</span><span className="kbd">D</span> dup
            </span>
            <span className="flex items-center gap-0.5">
              <span className="kbd">⌫</span> del
            </span>
          </span>
          <span className="w-px h-4 bg-core-border" />
          <span className="flex items-center gap-0.5">
            <span className="kbd">⌘</span><span className="kbd">K</span>
          </span>
          <span>Commands</span>
        </div>

        <VariantSwitcher />

        <div className="ic-topbar-actions">
          <button
            type="button"
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={state.historyIndex <= 0}
            className="core-btn inline-flex items-center gap-1 rounded-lg border border-core-border bg-core-surface px-2 py-1.5 text-xs disabled:opacity-50"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'REDO' })}
            disabled={state.historyIndex >= state.history.length - 1}
            className="core-btn inline-flex items-center gap-1 rounded-lg border border-core-border bg-core-surface px-2 py-1.5 text-xs disabled:opacity-50"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={14} />
          </button>

          <button
            type="button"
            onClick={handleOpen}
            className="core-btn inline-flex items-center gap-2 rounded-xl border border-core-border bg-core-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]"
          >
            <FolderOpen size={14} />
            <span>Open</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!state.project}
            className="core-btn inline-flex items-center gap-2 rounded-xl border border-core-border bg-core-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
          >
            <Save size={14} />
            <span>Save</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('export-utilities')}
            disabled={!state.project}
            className="core-btn core-btn-primary inline-flex items-center gap-2 rounded-xl border border-core-border px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
          >
            <Download size={14} />
            <span className="ic-export-label-full">Export Utilities</span>
            <span className="ic-export-label-short">Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};
