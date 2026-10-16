import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Download, FileDown, TriangleAlert } from 'lucide-react';
import type { ExportArtifact, ExportPlan, IconVariant } from '@iconcore/shared';
import { createCanvasBackend } from '@iconcore/renderer';
import { executePlan, validatePlan, type PlanProgress } from '@iconcore/exporters';
import type { GeneratedFile } from '@iconcore/exporters';
import { Button, Switch } from '@iconcore/ui';
import { saveAs } from 'file-saver';
import { useComposer } from '../../composer/ComposerContext';
import { zipFiles } from '../../composer/utils/exportPackage';
import { projectVariants } from '../../composer/utils/variantPresets';
import { StudioDialog } from './StudioDialog';
import { StudioVariantTiles } from './StudioVariantTiles';

type ExportStage = 'configure' | 'progress' | 'done' | 'error';

const FORMATS = [
  { id: 'svg', label: 'SVG', note: 'Scalable vector · single file' },
  { id: 'png', label: 'PNG', note: 'Raster image · individual sizes' },
  { id: 'ico', label: 'ICO', note: 'Windows icon · multiple resolutions' }
] as const;

type FormatId = (typeof FORMATS)[number]['id'];

const SIZES = [16, 32, 64, 128, 256, 512, 1024];

/** ICO entries the platform actually reads (the Tauri set). */
const ICO_ENTRIES = [16, 24, 32, 48, 64, 256];

const VARIANTS: IconVariant[] = ['default', 'light', 'dark', 'mono'];

/**
 * Studio export dialog (Fase 5): the mockup's three stages over the real
 * pipeline. Configure builds a minimal `ExportPlan` (SVG/PNG/ICO — no new
 * ICNS/WebP promises), progress streams `executePlan`, done lists real files
 * with real downloads. Variant expansion uses `{variant}` paths, so three
 * variants never overwrite each other (the IC55 rule, by construction).
 *
 * Transparency defaults ON (IC-N22: transparent unless asked opaque), and the
 * background flag rides on PNG/ICO artifacts — the export asks for alpha
 * unless the artifact requires opaque.
 */
export const StudioExportDialog = ({ onClose }: { onClose: () => void }) => {
  const { state } = useComposer();
  const project = state.project;

  const [stage, setStage] = useState<ExportStage>('configure');
  const [formats, setFormats] = useState<FormatId[]>(['svg', 'png']);
  const [sizes, setSizes] = useState<number[]>([256, 512]);
  const [variants, setVariants] = useState<IconVariant[]>([state.activeVariant]);
  const [transparent, setTransparent] = useState(true);
  const [progress, setProgress] = useState<PlanProgress>({ phase: 'planning', completed: 0, total: 0, done: false });
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggleIn = <T,>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

  const plan: ExportPlan | null = useMemo(() => {
    if (!project) return null;
    const background = transparent ? undefined : ('opaque' as const);
    const artifacts: ExportArtifact[] = [];
    if (formats.includes('svg')) {
      artifacts.push({ id: 'studio-svg', format: 'svg', path: '{name}-{variant}.svg', enabled: true, size: project.canvas.size });
    }
    for (const size of [...sizes].sort((a, b) => a - b)) {
      if (!formats.includes('png')) break;
      artifacts.push({
        id: `studio-png-${size}`,
        format: 'png',
        path: `{name}-{variant}-${size}px.png`,
        enabled: true,
        size,
        ...(background ? { background } : {})
      });
    }
    if (formats.includes('ico')) {
      artifacts.push({
        id: 'studio-ico',
        format: 'ico',
        path: '{name}-{variant}.ico',
        enabled: true,
        entries: ICO_ENTRIES,
        ...(background ? { background } : {})
      });
    }
    return { artifacts, attachments: [] };
  }, [project, formats, sizes, transparent]);

  const validation = useMemo(
    () =>
      project && plan
        ? validatePlan(plan, { project, variants: projectVariants(project) }, { variants })
        : { ready: false, problems: ['No project open.'], warnings: [] as string[] },
    [project, plan, variants]
  );

  const fileCount = (plan?.artifacts.length ?? 0) * Math.max(1, variants.length);
  const needsSizes = formats.includes('png');
  const canExport =
    validation.ready && formats.length > 0 && variants.length > 0 && (!needsSizes || sizes.length > 0);
  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  const runExport = async () => {
    if (!project || !plan || !canExport) return;
    setError(null);
    setFiles([]);
    setWarnings([]);
    setStage('progress');
    setProgress({ phase: 'planning', completed: 0, total: 0, done: false });

    const backend = createCanvasBackend();
    try {
      const result = await executePlan(plan, { project, variants: projectVariants(project) }, backend, {
        variants,
        onProgress: setProgress
      });
      setFiles(result.files);
      setWarnings(result.warnings);
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      setStage('error');
    } finally {
      backend.destroy();
    }
  };

  const downloadAll = async () => {
    if (!project || files.length === 0) return;
    const baseName = project.exportProfile.outputBaseName || 'iconcore';
    const blob = await zipFiles(files, { compression: 'deflate', level: 6 });
    saveAs(blob, `${baseName}-icons.zip`);
  };

  if (!project) return null;
  const canvas = project.canvas.size;

  return (
    <StudioDialog
      title="Export icons"
      description={`${project.metadata.name} · ${canvas} × ${canvas}`}
      onClose={onClose}
    >
      <div className="studio-export-stages" aria-hidden="true">
        {(['configure', 'progress', 'done'] as const).map((id, index, all) => (
          <span
            key={id}
            className="studio-export-stage"
            data-done={stage === 'error' ? false : all.indexOf(stage as (typeof all)[number]) >= index}
          />
        ))}
      </div>

      {stage === 'configure' && (
        <>
          <div className="studio-export-preview">
            <StudioVariantTiles />
          </div>
          <h3 className="text-xs font-semibold text-ic-text-muted mt-3 mb-1">File format</h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label="File format">
            {FORMATS.map((format) => (
              <label key={format.id} className="inline-flex cursor-pointer items-center gap-1.5 text-[13px]">
                <input
                  type="checkbox"
                  checked={formats.includes(format.id)}
                  onChange={() => setFormats((prev) => toggleIn(prev, format.id))}
                />
                {format.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-ic-text-muted mt-1">
            {FORMATS.find((format) => formats.includes(format.id))?.note ?? 'Pick at least one format.'}
          </p>

          {formats.includes('png') && (
            <>
              <h3 className="text-xs font-semibold text-ic-text-muted mt-3 mb-1">Sizes · px</h3>
              <div className="flex flex-wrap gap-2" role="group" aria-label="PNG sizes">
                {SIZES.map((size) => (
                  <label key={size} className="inline-flex cursor-pointer items-center gap-1 text-[13px] tabular-nums">
                    <input
                      type="checkbox"
                      checked={sizes.includes(size)}
                      onChange={() => setSizes((prev) => toggleIn(prev, size))}
                    />
                    {size}
                  </label>
                ))}
              </div>
            </>
          )}

          <h3 className="text-xs font-semibold text-ic-text-muted mt-3 mb-1">Variants</h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Variants">
            {VARIANTS.map((variant) => (
              <label key={variant} className="inline-flex cursor-pointer items-center gap-1.5 text-[13px]">
                <input
                  type="checkbox"
                  checked={variants.includes(variant)}
                  onChange={() =>
                    setVariants((prev) =>
                      prev.includes(variant) && prev.length > 1
                        ? prev.filter((item) => item !== variant)
                        : prev.includes(variant)
                          ? prev
                          : [...prev, variant]
                    )
                  }
                />
                {variant}
              </label>
            ))}
          </div>

          <div className="mt-3">
            <Switch label="Transparent background" checked={transparent} onChange={(event) => setTransparent(event.target.checked)} />
          </div>

          {!validation.ready && (
            <p className="text-xs text-ic-danger mt-2" role="alert">
              {validation.problems.join(' ')}
            </p>
          )}
          <p className="text-xs text-ic-text-muted mt-2 tabular-nums">
            {fileCount} {fileCount === 1 ? 'file' : 'files'} · {variants.length} {variants.length === 1 ? 'variant' : 'variants'}
          </p>

          <div className="studio-dialog-actions mt-4">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={runExport} disabled={!canExport}>
              Export {fileCount > 0 ? `${fileCount} ${fileCount === 1 ? 'file' : 'files'}` : ''}
            </Button>
          </div>
        </>
      )}

      {stage === 'progress' && (
        <>
          <p className="studio-dialog-description">
            Rendering {progress.total} {progress.total === 1 ? 'file' : 'files'}…
            {progress.currentPath ? ` ${progress.currentPath}` : ''}
          </p>
          <div className="studio-export-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Export progress">
            <div style={{ width: `${percent}%` }} />
          </div>
          <p className="text-xs text-ic-text-muted tabular-nums">
            {progress.completed} of {progress.total} · {percent}%
          </p>
        </>
      )}

      {stage === 'done' && (
        <>
          <p className="studio-dialog-description">
            <Check size={14} aria-hidden="true" className="inline" /> {files.length} {files.length === 1 ? 'file' : 'files'} ready.
            {warnings.length > 0 ? ` ${warnings.length} warning${warnings.length === 1 ? '' : 's'} — see the app log.` : ''}
          </p>
          <ul className="studio-export-files">
            {files.map((file) => (
              <li key={file.path}>
                <FileDown size={14} aria-hidden="true" />
                <span>{file.path}</span>
                <span className="studio-export-size">{(file.size / 1024).toFixed(1)} KB</span>
                <Button variant="secondary" onClick={() => saveAs(file.blob, file.path.replace(/[\\/]/g, '-'))}>
                  Download
                </Button>
              </li>
            ))}
          </ul>
          <div className="studio-dialog-actions">
            <Button variant="ghost" onClick={() => setStage('configure')}>
              <ArrowLeft size={14} aria-hidden="true" /> Export more
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" onClick={downloadAll}>
              <Download size={14} aria-hidden="true" /> Download all (.zip)
            </Button>
          </div>
        </>
      )}

      {stage === 'error' && (
        <>
          <p className="studio-dialog-description" role="alert">
            <TriangleAlert size={14} aria-hidden="true" className="inline" /> {error ?? 'Export failed'}
          </p>
          <div className="studio-dialog-actions">
            <Button variant="ghost" onClick={() => setStage('configure')}>
              <ArrowLeft size={14} aria-hidden="true" /> Back
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </>
      )}
    </StudioDialog>
  );
};
