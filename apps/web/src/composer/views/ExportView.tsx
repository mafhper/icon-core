import { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, Check, Download, FileText, FolderOpen, LoaderCircle, TriangleAlert } from 'lucide-react';
import { createCanvasBackend } from '@iconcore/renderer';
import { executePlan, type PlanProgress } from '@iconcore/exporters';
import type { ExportDestination, IconVariant, ZipCompression } from '@iconcore/shared';
import { Button, FieldGroup, SegmentedControl, Slider, Switch, withIconStroke } from '@iconcore/ui';
import { useComposer } from '../ComposerContext';
import { useToast } from '../toast/ToastContext';
import { useExportPlan } from '../hooks/useExportPlan';
import { isDesktopRuntime, exportToDesktop } from '../../lib/desktopExport';
import { saveAs } from 'file-saver';
import { zipFiles } from '../utils/exportPackage';
import { PresetPicker } from '../components/export/PresetPicker';
import { AddArtifactRow, ArtifactRow } from '../components/export/ArtifactRow';
import { planSummary } from '../utils/exportPlanState';

type ExportPhase = 'idle' | 'exporting' | 'archiving' | 'complete' | 'error';

const VARIANT_SET: IconVariant[] = ['default', 'light', 'dark', 'mono'];

/**
 * EX5 — the export plan editor.
 *
 * Replaces the target-checkbox + global-format screen. The plan is a list of
 * artifacts and the pipeline (`executePlan`) executes exactly what the list
 * says, so per-artifact format/size/path/variant is possible and SVG/ICO/ICNS
 * are first-class (the two gaps that motivated IC15).
 */
export const ExportView = () => {
  const { state, navigate } = useComposer();
  const toast = useToast();
  const desktop = isDesktopRuntime();
  const { plan, actions, validation, presets, variants, setVariants } = useExportPlan();

  const profile = state.project?.exportProfile;
  const [destination, setDestination] = useState<ExportDestination>(profile?.destination ?? (profile?.zip === false ? 'files' : 'zip'));
  const [compression, setCompression] = useState<ZipCompression>(profile?.compression ?? 'deflate');
  const [compressionLevel, setCompressionLevel] = useState<number>(profile?.compressionLevel ?? 6);
  const [includePreview, setIncludePreview] = useState<boolean>(profile?.includePreview ?? true);
  const [includeReport, setIncludeReport] = useState<boolean>(profile?.generateReport ?? true);
  const [phase, setPhase] = useState<ExportPhase>('idle');
  const [progress, setProgress] = useState<PlanProgress>({ phase: 'planning', completed: 0, total: 0, done: false });
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => planSummary(plan), [plan]);
  const busy = phase === 'exporting' || phase === 'archiving';
  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  const toggleVariant = useCallback(
    (variant: IconVariant) => {
      setVariants(
        variants.includes(variant)
          ? variants.length > 1
            ? variants.filter((item) => item !== variant)
            : variants
          : [...variants, variant]
      );
    },
    [variants, setVariants]
  );

  // Nothing to export without a project. The legacy view read `state.project!`
  // and rendered a broken screen on the empty state; be explicit instead. Placed
  // after every hook so the hook order stays stable.
  if (!state.project) {
    return (
      <div className="ic-export-view min-h-screen p-8">
        <div className="mx-auto max-w-2xl space-y-4">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Export</h1>
          <p className="text-sm text-ic-text-muted">Open or create a project first — there is nothing to export yet.</p>
          <Button variant="secondary" iconLeft={<ArrowLeft size={16} />} onClick={() => navigate('workspaces')}>
            Back to projects
          </Button>
        </div>
      </div>
    );
  }

  const handleExport = async () => {
    if (!state.project || !validation.ready) return;

    setError(null);
    setPhase('exporting');
    setElapsed(0);
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 100);

    const backend = createCanvasBackend();
    try {
      const result = await executePlan(plan, { project: state.project, variants }, backend, {
        variants,
        onProgress: setProgress
      });
      backend.destroy();

      const baseName = state.project.exportProfile.outputBaseName || 'iconcore';
      const files = result.files;

      if (destination === 'folder') {
        setPhase('archiving');
        const ok = await exportToDesktop(files);
        if (!ok) throw new Error('Folder export is only available in the desktop app.');
        toast.success(`Wrote ${files.length} files to the chosen folder`);
      } else if (destination === 'files') {
        for (const file of files) {
          saveAs(file.blob, file.path.replace(/[\\/]/g, '-'));
        }
        toast.success(`Downloaded ${files.length} files`);
      } else {
        setPhase('archiving');
        const blob = await zipFiles(files, { compression, level: compressionLevel });
        saveAs(blob, `${baseName}-icons.zip`);
        toast.success(`Exported ${files.length} files`);
      }

      setPhase('complete');
      if (result.warnings.length > 0) {
        toast.info(`Exported with ${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'} — see WARNINGS.txt.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      setError(message);
      setPhase('error');
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

  const destinationOptions: Array<{ value: ExportDestination; label: string }> = desktop
    ? [{ value: 'zip', label: 'ZIP archive' }, { value: 'folder', label: 'Folder…' }, { value: 'files', label: 'Separate files' }]
    : [{ value: 'zip', label: 'ZIP archive' }, { value: 'files', label: 'Separate files' }];

  return (
    <div className="ic-export-view min-h-screen p-8">
      <div className="mx-auto space-y-6" style={{ maxWidth: '68rem' }}>
        <button
          type="button"
          onClick={() => navigate('edit-space')}
          className="inline-flex items-center gap-2 text-sm text-ic-text-muted hover:text-ic-text transition"
        >
          {withIconStroke(<ArrowLeft size={16} />)}
          Back to Edit Space
        </button>

        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight mb-2">Export</h1>
          <p className="text-sm text-ic-text-muted">
            Pick a starting point, then edit the exact files you need. Every artifact renders through the
            same engine you see on the canvas.
          </p>
        </div>

        <div className="grid gap-6" style={{ gridTemplateColumns: 'var(--ic-export-columns)' }}>
          {/* ---------------------------------------------------------- plan */}
          <div className="space-y-6 min-w-0">
            <PresetPicker
              presets={presets}
              plan={plan}
              onSelect={actions.setPreset}
              onCustomize={actions.customize}
            />

            <div className="card-surface rounded-2xl border border-ic-border bg-ic-surface p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-sm font-semibold tracking-tight text-ic-accent-text">
                  Export plan
                </h2>
                <span className="text-xs text-ic-text-muted">
                  {summary.enabled} of {summary.total} artifacts · {summary.formats} format{summary.formats === 1 ? '' : 's'}
                  {summary.containers > 0 ? ` · ${summary.containers} container${summary.containers === 1 ? '' : 's'}` : ''}
                </span>
              </div>

              {plan.artifacts.length === 0 ? (
                <p className="text-sm text-ic-text-muted">
                  This plan is empty. Pick a preset above or add an artifact below.
                </p>
              ) : (
                <ul className="flex list-none flex-col gap-1.5 p-0">
                  {plan.artifacts.map((artifact) => (
                    <ArtifactRow
                      key={artifact.id}
                      artifact={artifact}
                      onChange={actions.setArtifact}
                      onToggle={actions.toggleArtifact}
                      onDuplicate={actions.duplicateArtifact}
                      onRemove={actions.removeArtifact}
                      onToggleEntry={actions.toggleEntry}
                    />
                  ))}
                </ul>
              )}

              <AddArtifactRow onAdd={actions.addArtifact} />
            </div>

            <div className="card-surface rounded-2xl border border-ic-border bg-ic-surface p-6 space-y-3">
              <h2 className="font-display text-sm font-semibold tracking-tight text-ic-accent-text">
                Variants
              </h2>
              <p className="text-xs text-ic-text-muted">
                Applied to artifacts that don&apos;t name a variant of their own.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {VARIANT_SET.map((variant) => (
                  <label
                    key={variant}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border cursor-pointer ${
                      variants.includes(variant)
                        ? 'border-ic-accent bg-ic-accent/10'
                        : 'border-ic-border hover:border-ic-accent/50'
                    }`}
                  >
                    <span className="text-xs font-semibold capitalize">{variant}</span>
                    <input type="checkbox" checked={variants.includes(variant)} onChange={() => toggleVariant(variant)} />
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ----------------------------------------------------- transport */}
          <div className="space-y-6 min-w-0">
            <div className="card-surface rounded-2xl border border-ic-border bg-ic-surface p-6 space-y-4">
              <h2 className="font-display text-sm font-semibold tracking-tight text-ic-accent-text">
                Readiness
              </h2>

              {validation.problems.length > 0 ? (
                <ul className="space-y-1.5" role="alert">
                  {validation.problems.map((problem) => (
                    <li key={problem} className="flex items-start gap-2 text-xs text-ic-danger">
                      <TriangleAlert size={14} className="shrink-0 mt-px" />
                      <span>{problem}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-sm text-ic-success">
                  <Check size={16} />
                  Ready to export
                </p>
              )}

              {validation.warnings.length > 0 && (
                <details className="text-xs text-ic-text-muted">
                  <summary className="cursor-pointer">
                    {validation.warnings.length} warning{validation.warnings.length === 1 ? '' : 's'}
                  </summary>
                  <ul className="mt-2 space-y-1 pl-1">
                    {validation.warnings.map((warning) => (
                      <li key={warning}>· {warning}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            <div className="card-surface rounded-2xl border border-ic-border bg-ic-surface p-6 space-y-5">
              <h2 className="font-display text-sm font-semibold tracking-tight text-ic-accent-text">
                Delivery
              </h2>

              <FieldGroup label="Destination">
                <SegmentedControl
                  aria-label="Delivery destination"
                  value={destination}
                  onChange={setDestination}
                  options={destinationOptions}
                />
              </FieldGroup>
              {destination === 'files' && (
                <p className="text-xs text-ic-text-muted">Each file downloads separately (paths flattened into the filename).</p>
              )}
              {destination === 'folder' && (
                <p className="text-xs text-ic-text-muted">You&apos;ll be asked to choose a folder; the full tree is written there, uncompressed.</p>
              )}

              {destination === 'zip' && (
                <FieldGroup label="Compression">
                  <SegmentedControl
                    aria-label="Compression"
                    value={compression}
                    onChange={setCompression}
                    options={[{ value: 'deflate', label: 'Deflate' }, { value: 'store', label: 'Store (none)' }]}
                  />
                  {compression === 'deflate' && (
                    <Slider
                      variant="inline"
                      label="Deflate level"
                      unit=""
                      min={0}
                      max={9}
                      value={compressionLevel}
                      onChange={(event) => setCompressionLevel(Number(event.target.value))}
                    />
                  )}
                </FieldGroup>
              )}

              <Switch
                label={<span>Include <code>preview.html</code> test sheet</span>}
                checked={includePreview}
                onChange={(event) => setIncludePreview(event.target.checked)}
              />
              <Switch
                label={<span>Include <code>iconcore-report.json</code></span>}
                checked={includeReport}
                onChange={(event) => setIncludeReport(event.target.checked)}
              />
            </div>

            {busy && (
              <div className="card-surface rounded-2xl border border-ic-border bg-ic-surface p-6 composer-scale-in">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {phase === 'exporting' && <LoaderCircle size={20} className="animate-spin text-ic-accent-text" />}
                    {phase === 'archiving' && <FileText size={20} className="text-ic-accent-text composer-pulse" />}
                    <div>
                      <p className="text-sm font-semibold">
                        {phase === 'archiving'
                          ? destination === 'folder' ? 'Writing files…' : 'Packaging archive…'
                          : progress.phase === 'planning' ? 'Preparing plan…'
                            : progress.phase === 'attaching' ? 'Adding manifests…'
                              : `Rendering ${progress.currentPath ?? ''}`}
                      </p>
                      <p className="text-xs text-ic-text-muted">
                        {progress.completed} / {progress.total} artifacts
                        {elapsed > 0 && ` · ${formatElapsed(elapsed)}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-mono tabular-nums">{percent}%</span>
                </div>
                <div
                  className="w-full bg-ic-elevated rounded-full h-2 overflow-hidden"
                  role="progressbar"
                  aria-label="Export progress"
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                  aria-valuenow={progress.completed}
                >
                  <div
                    className="bg-ic-accent h-2 rounded-full transition-[width] duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )}

            {phase === 'complete' && (
              <div className="card-surface rounded-2xl border border-ic-success/50 bg-ic-surface p-6 composer-scale-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-ic-success/20 flex items-center justify-center">
                    <Check size={20} className="text-ic-success" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Export complete!</p>
                    <p className="text-xs text-ic-text-muted">{formatElapsed(elapsed)}</p>
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
              disabled={!validation.ready || summary.enabled === 0 || busy}
              className="w-full px-4 py-3 text-sm font-semibold"
              iconLeft={destination === 'folder' ? <FolderOpen size={16} /> : <Download size={16} />}
            >
              {busy
                ? 'Exporting...'
                : phase === 'complete'
                  ? 'Export again'
                  : destination === 'folder'
                    ? `Export to folder (${summary.enabled} files)`
                    : destination === 'files'
                      ? `Download ${summary.enabled} files`
                      : `Export ZIP (${summary.enabled} files)`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
