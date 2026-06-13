import { useState, useMemo } from 'react';
import { ArrowLeft, Download, Check, Loader2, FileText, AlertTriangle } from 'lucide-react';
import type { IconTarget, IconVariant } from '@iconcore/shared';
import { useComposer } from '../ComposerContext';
import { useToast } from '../toast/ToastContext';
import {
  EXPORT_TARGETS,
  EXPORT_VARIANTS,
  buildIconPackage,
  countExportFiles,
  countExportTasks
} from '../utils/exportPackage';
import { saveAs } from 'file-saver';

type ExportPhase = 'idle' | 'exporting' | 'archiving' | 'complete' | 'error';

interface ExportProgress {
  phase: ExportPhase;
  currentTask: number;
  totalTasks: number;
  currentTarget: string;
  currentSize: number;
}

export const ExportView = () => {
  const { state, dispatch, navigate } = useComposer();
  const toast = useToast();
  const [selectedTargets, setSelectedTargets] = useState<Set<IconTarget>>(() => new Set(state.enabledTargets));
  const [selectedVariants, setSelectedVariants] = useState<Set<IconVariant>>(() => new Set([state.activeVariant]));
  const [progress, setProgress] = useState<ExportProgress>({ phase: 'idle', currentTask: 0, totalTasks: 0, currentTarget: '', currentSize: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const toggleTarget = (id: IconTarget) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      dispatch({ type: 'SET_ACTIVE_TARGET', payload: { target: id, enabled: next.has(id) } });
      return next;
    });
  };

  const toggleVariant = (id: IconVariant) => {
    setSelectedVariants((prev) => {
      const next = new Set(prev);
      if (next.has(id) && next.size > 1) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalTasks = useMemo(
    () => countExportTasks([...selectedTargets], [...selectedVariants]),
    [selectedTargets, selectedVariants]
  );

  const totalFilesLabel = useMemo(
    () => countExportFiles([...selectedTargets], [...selectedVariants]),
    [selectedTargets, selectedVariants]
  );

  const handleExport = async () => {
    if (!state.project || selectedTargets.size === 0 || selectedVariants.size === 0) return;

    setError(null);
    setProgress({ phase: 'exporting', currentTask: 0, totalTasks, currentTarget: '', currentSize: 0 });
    setElapsed(0);

    const startTime = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - startTime), 100);

    try {
      const { blob } = await buildIconPackage(
        state.project,
        [...selectedTargets],
        [...selectedVariants],
        {
          onProgress: (info) => setProgress({
            phase: 'exporting',
            currentTask: info.completed,
            totalTasks: info.total,
            currentTarget: info.label,
            currentSize: 0
          }),
          onArchiveStart: () => setProgress({ phase: 'archiving', currentTask: totalTasks, totalTasks, currentTarget: '', currentSize: 0 })
        }
      );

      saveAs(blob, `${state.project.exportProfile.outputBaseName}-icons.zip`);
      setProgress({ phase: 'complete', currentTask: totalTasks, totalTasks, currentTarget: '', currentSize: 0 });
      toast.success(`Exported ${totalFilesLabel} files`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      setError(message);
      setProgress({ phase: 'error', currentTask: 0, totalTasks, currentTarget: '', currentSize: 0 });
      toast.error(`Export failed: ${message}`);
    } finally {
      clearInterval(timer);
    }
  };

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => navigate('edit-space')}
          className="inline-flex items-center gap-2 text-sm text-core-muted hover:text-core-text transition"
        >
          <ArrowLeft size={16} />
          Back to Edit Space
        </button>

        <div>
          <h1 className="font-display text-2xl uppercase tracking-[0.18em] mb-2">
            Export Utilities
          </h1>
          <p className="text-sm text-core-muted">
            Select targets and variants. You will receive a ZIP with rendered assets, manifests, reports, and usage notes.
          </p>
        </div>

        <div className="card-surface rounded-2xl border border-core-border bg-core-surface p-6 space-y-3">
          <h2 className="font-display text-sm uppercase tracking-[0.18em] text-core-accent">
            Variants
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {EXPORT_VARIANTS.map((variant) => (
              <label
                key={variant}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border cursor-pointer ${
                  selectedVariants.has(variant)
                    ? 'border-core-accent bg-core-accent/10'
                    : 'border-core-border hover:border-core-accent/50'
                }`}
              >
                <span className="text-xs font-semibold uppercase tracking-[0.08em]">{variant}</span>
                <input
                  type="checkbox"
                  checked={selectedVariants.has(variant)}
                  onChange={() => toggleVariant(variant)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="card-surface rounded-2xl border border-core-border bg-core-surface p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm uppercase tracking-[0.18em] text-core-accent">
              Export Targets
            </h2>
            <select
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'all') {
                  setSelectedTargets(new Set(EXPORT_TARGETS.map((t) => t.id)));
                } else if (val === 'web') {
                  setSelectedTargets(new Set(['web-favicon', 'pwa']));
                } else if (val === 'desktop') {
                  setSelectedTargets(new Set(['tauri', 'electron', 'desktop-generic']));
                } else {
                  setSelectedTargets(new Set(['web-favicon']));
                }
              }}
              className="text-xs py-1.5 px-2 rounded-lg"
            >
              <option value="">Quick select...</option>
              <option value="all">All targets</option>
              <option value="web">Web only (favicon + PWA)</option>
              <option value="desktop">Desktop (Tauri + Electron)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EXPORT_TARGETS.map((target) => (
              <label
                key={target.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                  selectedTargets.has(target.id)
                    ? 'border-core-accent bg-core-accent/10'
                    : 'border-core-border hover:border-core-accent/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTargets.has(target.id)}
                  onChange={() => toggleTarget(target.id)}
                  className="rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{target.name}</p>
                  <p className="text-xs text-core-muted">
                    {target.tasks.length} files
                  </p>
                </div>
                {selectedTargets.has(target.id) && (
                  <Check size={16} className="text-core-accent shrink-0" />
                )}
              </label>
            ))}
          </div>
        </div>

        {(progress.phase !== 'idle' && progress.phase !== 'complete') && (
          <div className="card-surface rounded-2xl border border-core-border bg-core-surface p-6 composer-scale-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {progress.phase === 'exporting' && <Loader2 size={20} className="animate-spin text-core-accent" />}
                {progress.phase === 'archiving' && <FileText size={20} className="text-core-accent composer-pulse" />}
                <div>
                  <p className="text-sm font-semibold">
                    {progress.phase === 'exporting' && `Exporting ${progress.currentTarget}`}
                    {progress.phase === 'archiving' && 'Packaging ZIP archive...'}
                    {progress.phase === 'error' && 'Export failed'}
                  </p>
                  <p className="text-xs text-core-muted">
                    {progress.currentTask} / {progress.totalTasks} render tasks
                    {elapsed > 0 && ` · ${formatElapsed(elapsed)}`}
                  </p>
                </div>
              </div>
              <span className="text-sm font-mono tabular-nums">
                {totalTasks > 0 ? Math.round((progress.currentTask / totalTasks) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-core-elevated rounded-full h-2 overflow-hidden">
              <div
                className="bg-core-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${totalTasks > 0 ? (progress.currentTask / totalTasks) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {progress.phase === 'complete' && (
          <div className="card-surface rounded-2xl border border-core-success/50 bg-core-surface p-6 composer-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-core-success/20 flex items-center justify-center">
                <Check size={20} className="text-core-success" />
              </div>
              <div>
                <p className="text-sm font-semibold">Export complete!</p>
                <p className="text-xs text-core-muted">
                  {totalFilesLabel} files exported · {formatElapsed(elapsed)}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="card-surface rounded-2xl border border-core-danger/50 bg-core-surface p-6 composer-scale-in">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-core-danger" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleExport}
          disabled={selectedTargets.size === 0 || progress.phase === 'exporting' || progress.phase === 'archiving'}
          className="w-full core-btn core-btn-primary inline-flex items-center justify-center gap-2 rounded-xl border border-core-border px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={16} />
          {progress.phase === 'exporting' || progress.phase === 'archiving'
            ? 'Exporting...'
            : progress.phase === 'complete'
              ? 'Export Again'
              : `Export ZIP (${totalFilesLabel} files)`}
        </button>
      </div>
    </div>
  );
};
