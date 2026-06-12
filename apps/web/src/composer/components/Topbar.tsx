import { Download, Save, FolderOpen, Undo2, Redo2, Layers } from 'lucide-react';
import { useComposer } from '../ComposerContext';
import { VariantSwitcher } from './VariantSwitcher';

export const Topbar = () => {
  const { state, dispatch } = useComposer();

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
  };

  const handleOpen = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.iconcore.json,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const project = JSON.parse(text);
        dispatch({ type: 'LOAD_PROJECT', payload: project });
      } catch (err) {
        console.error('Failed to parse project file:', err);
      }
    };
    input.click();
  };

  return (
    <header className="sticky top-0 z-20 border-b border-core-border bg-core-bg/88 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Layers size={20} className="text-core-accent" />
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em]">
              {state.project?.metadata.name ?? 'IconCore Composer'}
            </p>
            {state.isDirty && (
              <p className="text-xs text-core-muted">Unsaved changes</p>
            )}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4 text-xs text-core-muted">
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

        <div className="flex items-center gap-2">
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
            Open
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!state.project}
            className="core-btn inline-flex items-center gap-2 rounded-xl border border-core-border bg-core-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
          >
            <Save size={14} />
            Save
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'NAVIGATE', payload: 'export' })}
            disabled={!state.project}
            className="core-btn core-btn-primary inline-flex items-center gap-2 rounded-xl border border-core-border px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>
    </header>
  );
};