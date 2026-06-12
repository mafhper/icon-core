import { useState } from 'react';
import { Layers, Zap, FolderOpen, LayoutTemplate } from 'lucide-react';
import { useComposer } from '../ComposerContext';

export const StartView = ({ onOpenPresets }: { onOpenPresets?: () => void }) => {
  const { dispatch } = useComposer();
  const [projectName, setProjectName] = useState('My Icon');
  const [canvasSize, setCanvasSize] = useState(512);

  const handleCreate = () => {
    dispatch({ type: 'NEW_PROJECT', payload: { name: projectName, size: canvasSize } });
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
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Layers size={64} className="mx-auto mb-4 text-core-accent" />
          <h1 className="font-display text-3xl uppercase tracking-[0.18em] mb-2">
            IconCore Composer
          </h1>
          <p className="text-sm text-core-muted">
            Design, compose, and export professional icon packs
          </p>
        </div>

        <div className="card-surface rounded-2xl border border-core-border bg-core-surface p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-core-muted mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-core-border bg-core-elevated text-sm"
              placeholder="My Icon"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-core-muted mb-2">
              Canvas Size
            </label>
            <select
              value={canvasSize}
              onChange={(e) => setCanvasSize(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-core-border bg-core-elevated text-sm"
            >
              <option value={256}>256 × 256</option>
              <option value={512}>512 × 512</option>
              <option value={1024}>1024 × 1024</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCreate}
              className="flex-1 core-btn core-btn-primary inline-flex items-center justify-center gap-2 rounded-xl border border-core-border px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em]"
            >
              <Zap size={16} />
              Create
            </button>
            <button
              type="button"
              onClick={onOpenPresets}
              className="flex-1 core-btn inline-flex items-center justify-center gap-2 rounded-xl border border-core-border bg-core-elevated px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] hover:border-core-accent/50"
            >
              <LayoutTemplate size={16} />
              Presets
            </button>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-core-muted mb-3">or</p>
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex items-center gap-2 text-sm text-core-accent hover:underline"
          >
            <FolderOpen size={16} />
            Open existing project
          </button>
        </div>

        <div className="text-center pt-8 border-t border-core-border">
          <p className="text-xs text-core-muted">
            Looking for the simple mode?{' '}
            <a href="#" className="text-core-accent hover:underline">
              Use the classic generator
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};