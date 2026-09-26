import { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, Check, Download, FileText, FolderOpen, LoaderCircle, TriangleAlert } from 'lucide-react';
import { createCanvasBackend } from '@iconcore/renderer';
import { executePlan, type PlanProgress } from '@iconcore/exporters';
import type { ExportDestination, IconVariant, ZipCompression } from '@iconcore/shared';
import { Button, FieldGroup, SegmentedControl, Slider, withIconStroke } from '@iconcore/ui';
import { useComposer } from '../ComposerContext';
import { useToast } from '../toast/ToastContext';
import { useExportPlan } from '../hooks/useExportPlan';
import { isDesktopRuntime, exportToDesktop } from '../../lib/desktopExport';
import { saveAs } from 'file-saver';
import { zipFiles } from '../utils/exportPackage';
import { PresetPicker } from '../components/export/PresetPicker';
import { AddArtifactRow, ArtifactRow } from '../components/export/ArtifactRow';
import { CompanionFiles } from '../components/export/CompanionFiles';
import { OutputManifest } from '../components/export/OutputManifest';
import { plannedOutputPaths, planSummary } from '../utils/exportPlanState';

type ExportPhase = 'idle' | 'exporting' | 'archiving' | 'complete' | 'error';

const VARIANT_SET: IconVariant[] = ['default', 'light', 'dark', 'mono'];

/** "1 file" / "9 files" — the count is on the button, so it has to read right. */
const fileNoun = (count: number): string => `${count} ${count === 1 ? 'file' : 'files'}`;

/**
 * EX5 — the export plan editor.
 *
 * Reads top to bottom as the three questions the user actually has:
 * **where** is this going → **which** files → **how** do I get them.
 * The output list sits next to the action so nothing produced can surprise you
 * at the archive.
 */
export const ExportView = () => {
  const { state, navigate } = useComposer();
  const toast = useToast();
  const desktop = isDesktopRuntime();
  const { plan, actions, validation, presets, variants, setVariants, destination, setDestination, persist, context } =
    useExportPlan();

  const profile = state.project?.exportProfile;
  const [compression, setCompression] = useState<ZipCompression>(profile?.compression ?? 'deflate');
  const [compressionLevel, setCompressionLevel] = useState<number>(profile?.compressionLevel ?? 6);
  const [phase, setPhase] = useState<ExportPhase>('idle');
  const [progress, setProgress] = useState<PlanProgress>({ phase: 'planning', completed: 0, total: 0, done: false });
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => planSummary(plan), [plan]);
  const outputPaths = useMemo(
    () => (context?.project ? plannedOutputPaths(plan, context, variants) : []),
    [plan, context, variants]
  );
  const busy = phase === 'exporting' || phase === 'archiving';
  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const canExport = validation.ready && summary.files > 0 && !busy;

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

  const handleExport = async () => {
    if (!state.project || !canExport) return;

    // EX6: the plan being executed is the one persisted, so reopening the view
    // shows exactly what was exported.
    persist();
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
    ? [{ value: 'zip', label: 'ZIP' }, { value: 'folder', label: 'Folder…' }, { value: 'files', label: 'Separate files' }]
    : [{ value: 'zip', label: 'ZIP' }, { value: 'files', label: 'Separate files' }];

  // Nothing to export without a project. The legacy view read `state.project!`;
  // be explicit instead. Placed after every hook so the hook order is stable.
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

  return (
    <div className="ic-export-view min-h-screen p-8">
      <div className="mx-auto space-y-6" style={{ maxWidth: '64rem' }}>
        <button
          type="button"
          onClick={() => {
            persist();
            navigate('edit-space');
          }}
          className="inline-flex items-center gap-2 text-sm text-ic-text-muted hover:text-ic-text transition"
        >
          {withIconStroke(<ArrowLeft size={16} />)}
          Back to Edit Space
        </button>

        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Export</h1>
          <p className="mt-1 text-sm text-ic-text-muted">
            Choose a starting point, adjust the files, and export exactly that.
          </p>
        </header>

        <div className="grid gap-6" style={{ gridTemplateColumns: 'var(--ic-export-columns)' }}>
          {/* ------------------------------------------------------ the plan */}
          <div className="min-w-0 space-y-6">
            <div className="card-surface rounded-2xl border border-ic-border bg-ic-surface p-6">
              <PresetPicker
                presets={presets}
                plan={plan}
                onSelect={actions.setPreset}
                onCustomize={actions.customize}
              />
            </div>

            <div className="card-surface rounded-2xl border border-ic-border bg-ic-surface p-6 space-y-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-sm font-semibold tracking-tight text-ic-accent-text">Artifacts</h2>
                <span className="text-[0.72rem] tabular-nums text-ic-text-faint">
                  {summary.enabled} of {summary.total}
                  {summary.formats > 1 ? ` · ${summary.formats} formats` : ''}
                  {summary.containers > 0 ? ` · ${summary.containers} ${summary.containers === 1 ? 'container' : 'containers'}` : ''}
                </span>
              </div>

              {plan.artifacts.length === 0 ? (
                <p className="text-sm text-ic-text-muted">
                  This plan is empty. Pick a preset above or add an artifact below.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5 list-none p-0">
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

              <CompanionFiles plan={plan} onToggle={actions.toggleAttachment} />
            </div>

            <details className="card-surface rounded-2xl border border-ic-border bg-ic-surface px-6 py-4">
              <summary className="cursor-pointer text-sm font-semibold text-ic-accent-text">
                Variants
                <span className="ml-2 font-normal text-ic-text-muted">
                  {variants.map((variant) => variant[0].toUpperCase() + variant.slice(1)).join(', ')}
                </span>
              </summary>
              <p className="mt-2 text-xs text-ic-text-muted">
                Applied to artifacts that don&apos;t name a variant of their own.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {VARIANT_SET.map((variant) => (
                  <label
                    key={variant}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                      variants.includes(variant)
                        ? 'border-ic-accent bg-ic-accent/10'
                        : 'border-ic-border hover:border-ic-accent/50'
                    }`}
                  >
                    <span className="text-xs font-semibold capitalize">{variant}</span>
                    <input
                      type="checkbox"
                      checked={variants.includes(variant)}
                      onChange={() => toggleVariant(variant)}
                      aria-label={`Export the ${variant} variant`}
                    />
                  </label>
                ))}
              </div>
            </details>
          </div>

          {/* --------------------------------------------------- the delivery */}
          <div className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="card-surface rounded-2xl border border-ic-border bg-ic-surface p-5 space-y-4">
              {validation.problems.length > 0 ? (
                <ul className="space-y-1.5" role="alert">
                  {validation.problems.map((problem) => (
                    <li key={problem} className="flex items-start gap-2 text-xs text-ic-danger">
                      <TriangleAlert size={14} className="mt-px shrink-0" />
                      <span>{problem}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-sm text-ic-success">
                  <Check size={16} />
                  Ready
                </p>
              )}

              {validation.warnings.length > 0 && (
                <details className="text-xs text-ic-text-muted">
                  <summary className="cursor-pointer">
                    {validation.warnings.length} warning{validation.warnings.length === 1 ? '' : 's'}
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {validation.warnings.map((warning) => (
                      <li key={warning}>· {warning}</li>
                    ))}
                  </ul>
                </details>
              )}

              <OutputManifest paths={outputPaths} total={summary.files} disabled={!validation.ready} />
            </div>

            <div className="card-surface rounded-2xl border border-ic-border bg-ic-surface p-5 space-y-4">
              <FieldGroup label="Destination">
                <SegmentedControl
                  aria-label="Delivery destination"
                  value={destination}
                  onChange={setDestination}
                  options={destinationOptions}
                />
              </FieldGroup>

              {destination === 'files' && (
                <p className="text-xs text-ic-text-muted">Each file downloads separately (paths flattened into the name).</p>
              )}
              {destination === 'folder' && (
                <p className="text-xs text-ic-text-muted">You&apos;ll pick a folder; the tree is written there uncompressed.</p>
              )}

              {destination === 'zip' && (
                <FieldGroup label="Compression">
                  <SegmentedControl
                    aria-label="Compression"
                    value={compression}
                    onChange={setCompression}
                    options={[{ value: 'deflate', label: 'Deflate' }, { value: 'store', label: 'Store' }]}
                  />
                  {compression === 'deflate' && (
                    <Slider
                      variant="inline"
                      label="Level"
                      unit=""
                      min={0}
                      max={9}
                      value={compressionLevel}
                      onChange={(event) => setCompressionLevel(Number(event.target.value))}
                    />
                  )}
                </FieldGroup>
              )}
            </div>

            {busy && (
              <div className="card-surface rounded-2xl border border-ic-border bg-ic-surface p-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {phase === 'exporting' ? (
                      <LoaderCircle size={18} className="animate-spin text-ic-accent-text" />
                    ) : (
                      <FileText size={18} className="text-ic-accent-text" />
                    )}
                    <span className="text-sm font-semibold">
                      {phase === 'archiving'
                        ? destination === 'folder' ? 'Writing files…' : 'Packaging…'
                        : progress.phase === 'planning' ? 'Preparing…'
                          : progress.phase === 'attaching' ? 'Adding companion files…'
                            : `Rendering ${progress.currentPath ?? ''}`}
                    </span>
                  </div>
                  <span className="text-sm tabular-nums text-ic-text-muted">{percent}%</span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-ic-elevated"
                  role="progressbar"
                  aria-label="Export progress"
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                  aria-valuenow={progress.completed}
                >
                  <div className="h-2 rounded-full bg-ic-accent transition-[width] duration-300" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-ic-text-muted">
                  {progress.completed} / {progress.total}
                  {elapsed > 0 && ` · ${formatElapsed(elapsed)}`}
                </p>
              </div>
            )}

            {error && (
              <div className="card-surface rounded-2xl border border-ic-danger/50 bg-ic-surface p-5">
                <div className="flex items-start gap-2">
                  <TriangleAlert size={18} className="mt-px shrink-0 text-ic-danger" />
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            )}

            <Button
              variant="primary"
              onClick={handleExport}
              disabled={!canExport}
              className="w-full px-4 py-3 text-sm font-semibold"
              iconLeft={destination === 'folder' ? <FolderOpen size={16} /> : <Download size={16} />}
            >
              {busy
                ? 'Exporting…'
                : phase === 'complete'
                  ? 'Export again'
                  : destination === 'folder'
                    ? `Export ${fileNoun(summary.files)} to folder`
                    : destination === 'files'
                      ? `Download ${fileNoun(summary.files)}`
                      : `Export ZIP · ${fileNoun(summary.files)}`}
            </Button>          </div>
        </div>
      </div>
    </div>
  );
};
