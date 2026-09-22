import { useState, useMemo } from 'react';
import { ArrowLeft, Download, Check, LoaderCircle, FileText, TriangleAlert, FolderOpen } from 'lucide-react';
import type { IconTarget, IconVariant, OutputFormat, ExportStructure, ZipCompression } from '@iconcore/shared';
import { Button, Field, SegmentedControl, Slider, Switch, withIconStroke } from '@iconcore/ui';
import { useComposer } from '../ComposerContext';
import { useToast } from '../toast/ToastContext';
import {
  EXPORT_TARGETS,
  EXPORT_VARIANTS,
  buildIconPackage,
  zipFiles,
  countExportTasks,
  countExportFiles
} from '../utils/exportPackage';
import { isDesktopRuntime, exportToDesktop } from '../../lib/desktopExport';
import { saveAs } from 'file-saver';

type ExportPhase = 'idle' | 'exporting' | 'archiving' | 'complete' | 'error';
type Destination = 'zip' | 'files' | 'folder';

interface ExportProgress {
  phase: ExportPhase;
  currentTask: number;
  totalTasks: number;
  currentTarget: string;
}

/**
 * A6: the local `Segmented` (no semantics) is replaced by the kit
 * `SegmentedControl` (role=group + aria-pressed). Option lists below map
 * `{id,label}` to `{value,label}` inline.
 */

export const ExportView = () => {
  const { state, dispatch, navigate } = useComposer();
  const toast = useToast();
  const profile = state.project?.exportProfile;
  const desktop = isDesktopRuntime();

  const [selectedTargets, setSelectedTargets] = useState<Set<IconTarget>>(() => new Set(state.enabledTargets));
  const [selectedVariants, setSelectedVariants] = useState<Set<IconVariant>>(() => new Set([state.activeVariant]));

  const [format, setFormat] = useState<OutputFormat>(profile?.format ?? 'png');
  const [quality, setQuality] = useState<number>(profile?.quality ?? 0.92);
  const [structure, setStructure] = useState<ExportStructure>(profile?.structure ?? 'nested');
  const [destination, setDestination] = useState<Destination>(profile?.zip === false ? 'files' : 'zip');
  const [compression, setCompression] = useState<ZipCompression>(profile?.compression ?? 'deflate');
  const [compressionLevel, setCompressionLevel] = useState<number>(profile?.compressionLevel ?? 6);
  const [includePreview, setIncludePreview] = useState<boolean>(profile?.includePreview ?? true);
  const [includeReport, setIncludeReport] = useState<boolean>(profile?.generateReport ?? true);

  const [progress, setProgress] = useState<ExportProgress>({ phase: 'idle', currentTask: 0, totalTasks: 0, currentTarget: '' });
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const persist = () => {
    dispatch({
      type: 'UPDATE_EXPORT_PROFILE',
      payload: {
        format, quality, structure,
        zip: destination !== 'files',
        compression, compressionLevel,
        includePreview, generateReport: includeReport
      }
    });
  };

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

  const isLossy = format !== 'png';

  const handleExport = async () => {
    if (!state.project || selectedTargets.size === 0 || selectedVariants.size === 0) return;

    persist();
    setError(null);
    setProgress({ phase: 'exporting', currentTask: 0, totalTasks, currentTarget: '' });
    setElapsed(0);

    const startTime = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - startTime), 100);

    try {
      const { files } = await buildIconPackage(
        state.project,
        [...selectedTargets],
        [...selectedVariants],
        {
          format,
          quality,
          structure,
          includeReport,
          includePreview,
          onProgress: (info) => setProgress({
            phase: 'exporting',
            currentTask: info.completed,
            totalTasks: info.total,
            currentTarget: info.label
          })
        }
      );

      const baseName = state.project.exportProfile.outputBaseName || 'iconcore';

      if (destination === 'folder') {
        setProgress({ phase: 'archiving', currentTask: totalTasks, totalTasks, currentTarget: '' });
        const ok = await exportToDesktop(files);
        if (!ok) throw new Error('Folder export is only available in the desktop app.');
        toast.success(`Wrote ${files.length} files to the chosen folder`);
      } else if (destination === 'files') {
        for (const file of files) {
          saveAs(file.blob, file.path.replace(/[\\/]/g, '-'));
        }
        toast.success(`Downloaded ${files.length} files`);
      } else {
        setProgress({ phase: 'archiving', currentTask: totalTasks, totalTasks, currentTarget: '' });
        const blob = await zipFiles(files, { compression, level: compressionLevel });
        saveAs(blob, `${baseName}-icons.zip`);
        toast.success(`Exported ${files.length} files`);
      }

      setProgress({ phase: 'complete', currentTask: totalTasks, totalTasks, currentTarget: '' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      setError(message);
      setProgress({ phase: 'error', currentTask: 0, totalTasks, currentTarget: '' });
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

  const busy = progress.phase === 'exporting' || progress.phase === 'archiving';
  const destinationOptions: Array<{ id: Destination; label: string }> = desktop
    ? [{ id: 'zip', label: 'ZIP archive' }, { id: 'folder', label: 'Folder…' }, { id: 'files', label: 'Separate files' }]
    : [{ id: 'zip', label: 'ZIP archive' }, { id: 'files', label: 'Separate files' }];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => navigate('edit-space')}
          className="inline-flex items-center gap-2 text-sm text-ic-muted hover:text-ic-text transition"
        >
          {withIconStroke(<ArrowLeft size={16} />)}
          Back to Edit Space
        </button>

        <div>
          <h1 className="font-display text-2xl uppercase tracking-[0.18em] mb-2">
            Export Utilities
          </h1>
          <p className="text-sm text-ic-muted">
            Pick targets, variants and output settings. Everything renders through the same engine you see on the canvas.
          </p>
        </div>

        <div className="card-surface rounded-2xl border border-ic-border bg-ic-surface p-6 space-y-3">
          <h2 className="font-display text-sm uppercase tracking-[0.18em] text-ic-accent">
            Variants
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {EXPORT_VARIANTS.map((variant) => (
              <label
                key={variant}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border cursor-pointer ${
                  selectedVariants.has(variant)
                    ? 'border-ic-accent bg-ic-accent/10'
                    : 'border-ic-border hover:border-ic-accent/50'
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

        <div className="card-surface rounded-2xl border border-ic-border bg-ic-surface p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm uppercase tracking-[0.18em] text-ic-accent">
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
                } else if (val === 'minimal') {
                  setSelectedTargets(new Set(['web-favicon']));
                }
              }}
              className="text-xs py-1.5 px-2 rounded-lg"
            >
              <option value="">Quick select...</option>
              <option value="all">All targets</option>
              <option value="web">Web only (favicon + PWA)</option>
              <option value="desktop">Desktop (Tauri + Electron)</option>
              <option value="minimal">Favicon only</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EXPORT_TARGETS.map((target) => (
              <label
                key={target.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                  selectedTargets.has(target.id)
                    ? 'border-ic-accent bg-ic-accent/10'
                    : 'border-ic-border hover:border-ic-accent/50'
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
                  <p className="text-xs text-ic-muted">
                    {target.tasks.length} files
                  </p>
                </div>
                {selectedTargets.has(target.id) && (
                  <Check size={16} className="text-ic-accent shrink-0" />
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="card-surface rounded-2xl border border-ic-border bg-ic-surface p-6 space-y-5">
          <h2 className="font-display text-sm uppercase tracking-[0.18em] text-ic-accent">
            Output
          </h2>

          <Field label="Format">
            <SegmentedControl
              aria-label="Format"
              value={format}
              onChange={setFormat}
              options={[{ value: 'png', label: 'PNG' }, { value: 'webp', label: 'WebP' }, { value: 'jpeg', label: 'JPEG' }]}
            />
          </Field>

          {isLossy && (
            <Slider
              label={`Quality (${Math.round(quality * 100)}%)`}
              min={10}
              max={100}
              value={Math.round(quality * 100)}
              onChange={(e) => setQuality(Number(e.target.value) / 100)}
            />
          )}

          <Field label="Folder structure">
            <SegmentedControl
              aria-label="Folder structure"
              value={structure}
              onChange={setStructure}
              options={[{ value: 'nested', label: 'Nested (target/variant)' }, { value: 'flat', label: 'Flat' }]}
            />
          </Field>

          <Field label="Destination">
            <SegmentedControl
              aria-label="Destination"
              value={destination}
              onChange={setDestination}
              options={destinationOptions.map((o) => ({ value: o.id, label: o.label }))}
            />
          </Field>
          {destination === 'files' && (
            <p className="text-xs text-ic-muted mt-1.5">Each file downloads separately (paths flattened into the filename).</p>
          )}
          {destination === 'folder' && (
            <p className="text-xs text-ic-muted mt-1.5">You'll be asked to choose a folder; the full tree is written there, uncompressed.</p>
          )}

          {destination === 'zip' && (
            <Field label="Compression">
              <SegmentedControl
                aria-label="Compression"
                value={compression}
                onChange={setCompression}
                options={[{ value: 'deflate', label: 'Deflate' }, { value: 'store', label: 'Store (none)' }]}
              />
              {compression === 'deflate' && (
                <Slider
                  label={`Deflate level (${compressionLevel})`}
                  min={0}
                  max={9}
                  value={compressionLevel}
                  onChange={(e) => setCompressionLevel(Number(e.target.value))}
                />
              )}
            </Field>
          )}

          <Switch
            label={<span>Include <code>preview.html</code> test sheet</span>}
            checked={includePreview}
            onChange={(e) => setIncludePreview(e.target.checked)}
          />
          <Switch
            label={<span>Include per-target <code>iconcore-report.json</code></span>}
            checked={includeReport}
            onChange={(e) => setIncludeReport(e.target.checked)}
          />
        </div>

        {busy && (
          <div className="card-surface rounded-2xl border border-ic-border bg-ic-surface p-6 composer-scale-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {progress.phase === 'exporting' && <LoaderCircle size={20} className="animate-spin text-ic-accent" />}
                {progress.phase === 'archiving' && <FileText size={20} className="text-ic-accent composer-pulse" />}
                <div>
                  <p className="text-sm font-semibold">
                    {progress.phase === 'exporting' && `Rendering ${progress.currentTarget}`}
                    {progress.phase === 'archiving' && (destination === 'folder' ? 'Writing files…' : 'Packaging archive…')}
                  </p>
                  <p className="text-xs text-ic-muted">
                    {progress.currentTask} / {progress.totalTasks} render tasks
                    {elapsed > 0 && ` · ${formatElapsed(elapsed)}`}
                  </p>
                </div>
              </div>
              <span className="text-sm font-mono tabular-nums">
                {totalTasks > 0 ? Math.round((progress.currentTask / totalTasks) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-ic-elevated rounded-full h-2 overflow-hidden">
              <div
                className="bg-ic-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${totalTasks > 0 ? (progress.currentTask / totalTasks) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {progress.phase === 'complete' && (
          <div className="card-surface rounded-2xl border border-ic-success/50 bg-ic-surface p-6 composer-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-ic-success/20 flex items-center justify-center">
                <Check size={20} className="text-ic-success" />
              </div>
              <div>
                <p className="text-sm font-semibold">Export complete!</p>
                <p className="text-xs text-ic-muted">
                  {formatElapsed(elapsed)}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="card-surface rounded-2xl border border-ic-danger/50 bg-ic-surface p-6 composer-scale-in">
            <div className="flex items-center gap-3">
              <TriangleAlert size={20} className="text-ic-danger" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <Button
          variant="primary"
          onClick={handleExport}
          disabled={selectedTargets.size === 0 || busy}
          className="w-full px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em]"
          iconLeft={destination === 'folder' ? <FolderOpen size={16} /> : <Download size={16} />}
        >
          {busy
            ? 'Exporting...'
            : progress.phase === 'complete'
              ? 'Export Again'
              : destination === 'folder'
                ? `Export to folder (≈${totalFilesLabel} files)`
                : destination === 'files'
                  ? `Download ${totalFilesLabel} files`
                  : `Export ZIP (≈${totalFilesLabel} files)`}
        </Button>
      </div>
    </div>
  );
};
