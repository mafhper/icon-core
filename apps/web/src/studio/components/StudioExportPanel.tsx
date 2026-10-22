import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Download, FileDown, TriangleAlert } from 'lucide-react';
import type { CanvasMaskShape, ExportArtifact, ExportPlan, IconVariant } from '@iconcore/shared';
import { createCanvasBackend } from '@iconcore/renderer';
import { executePlan, validatePlan, type PlanProgress } from '@iconcore/exporters';
import type { GeneratedFile } from '@iconcore/exporters';
import { Button, Switch } from '@iconcore/ui';
import { saveAs } from 'file-saver';
import { useComposer } from '../../composer/ComposerContext';
import { zipFiles } from '../../composer/utils/exportPackage';
import { projectVariants } from '../../composer/utils/variantPresets';
import { variantTiles } from '../variantLabels';
import { VariantTileBody } from './StudioVariantTiles';

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

/**
 * Cooperative-cancel sentinel.
 *
 * `executePlan` has no `AbortSignal` (and this panel adds no exporter API), so
 * cancellation rides the one hook the pipeline offers: the progress callback.
 * A tick from a run whose generation is stale throws, which unwinds the
 * artifact loop between encodes; the same generation check keeps any late
 * settlement from reaching the UI.
 */
class ExportCancelledError extends Error {}

/**
 * Studio export panel (sidebar): the dialog's three stages morph into the
 * Inspector Export tab over the real pipeline. Configure builds the same
 * minimal `ExportPlan` (SVG/PNG/ICO — no ICNS/WebP promises), progress streams
 * `executePlan`, done lists real files with real downloads — one surface, one
 * pipeline, zero invented behavior.
 *
 * Interactions the dialog did not have, by owner decision:
 * - the 2×2 live tiles are **card-checkboxes**: clicking a card toggles its
 *   variant into the export (minimum one — unchecking the last is a no-op);
 * - the **active ring** is a separate control: it marks the variant the canvas
 *   edits and dispatches `SET_ACTIVE_VARIANT`, independent from the export
 *   selection;
 * - configure has **no Cancel** (owner decision: the ghost next to
 *   `Export N files` reset a form that had nothing to close); the reset to
 *   defaults lives on **Close** (done stage). The **Cancel in progress** stays
 *   — it is the only exit while a run is in flight, aborting cooperatively
 *   back to configure without letting the late result land.
 *
 * Transparency defaults OFF and rides every artifact — the export carries the
 * canvas background unless the person asks for alpha (WYSIWYG), the same
 * contract the dialog held. The panel's tiles follow the switch, so
 * Preview/Export is the file — frame included: every SVG/PNG artifact carries
 * the resolved canvas shape (`maskShape`), the same precedence the tiles use,
 * and only a container keeps full bleed (Windows/macOS mask at display time).
 */
export const StudioExportPanel = () => {
  const { state, dispatch } = useComposer();
  const project = state.project;

  const [stage, setStage] = useState<ExportStage>('configure');
  const [formats, setFormats] = useState<FormatId[]>(['svg', 'png']);
  const [sizes, setSizes] = useState<number[]>([256, 512]);
  const [variants, setVariants] = useState<IconVariant[]>([state.activeVariant]);
  const [transparent, setTransparent] = useState(false);
  const [progress, setProgress] = useState<PlanProgress>({ phase: 'planning', completed: 0, total: 0, done: false });
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** Run generation: bumped by every start and by every cancel. It *is* the
   *  cancellation state — every older run is stale by construction, so a new
   *  run can never un-cancel one that is still draining, and a settlement that
   *  races its own cancel is ignored instead of leaking into the UI. */
  const runRef = useRef(0);

  const toggleIn = <T,>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

  const plan: ExportPlan | null = useMemo(() => {
    if (!project) return null;
    const background = transparent ? undefined : ('opaque' as const);
    // The file mirrors the editor's frame, with the same precedence the tiles
    // use (`VariantTileBody`): the document's shape wins, the toolbar's covers
    // a project that never declared one. The encoders resolve it through
    // `maskModeFor`; desktop containers ignore it (see the ICO below).
    const maskShape: CanvasMaskShape = project.canvas.maskShape ?? state.maskShape ?? 'rounded-rectangle';
    const artifacts: ExportArtifact[] = [];
    if (formats.includes('svg')) {
      artifacts.push({
        id: 'studio-svg',
        format: 'svg',
        path: '{name}-{variant}.svg',
        enabled: true,
        size: project.canvas.size,
        maskShape,
        // Same contract as the PNG/ICO below: with the switch off the file
        // carries the variant's resolved background (WYSIWYG); with it on the
        // artifact says nothing and the encoder exports alpha.
        ...(background ? { background } : {})
      });
    }
    for (const size of [...sizes].sort((a, b) => a - b)) {
      if (!formats.includes('png')) break;
      artifacts.push({
        id: `studio-png-${size}`,
        format: 'png',
        path: `{name}-{variant}-${size}px.png`,
        enabled: true,
        size,
        maskShape,
        ...(background ? { background } : {})
      });
    }
    if (formats.includes('ico')) {
      artifacts.push({
        id: 'studio-ico',
        format: 'ico',
        path: `{name}-{variant}.ico`,
        enabled: true,
        entries: ICO_ENTRIES,
        // No `maskShape` here: container wins (`maskModeFor` answers 'none' for
        // a container even when a shape is declared). Windows/macOS pick the
        // size they want from one file and mask at display time — a clipped
        // `.ico` would lose a ring of pixels the OS clips identically.
        ...(background ? { background } : {})
      });
    }
    return { artifacts, attachments: [] };
  }, [project, formats, sizes, transparent, state.maskShape]);

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
  const renderingCount = progress.total > 0 ? progress.total : fileCount;

  /** Minimum-one rule of the variant card-checkboxes: unchecking the last is a no-op. */
  const toggleVariant = (variant: IconVariant) =>
    setVariants((prev) =>
      prev.includes(variant) && prev.length > 1 ? prev.filter((item) => item !== variant) : prev.includes(variant) ? prev : [...prev, variant]
    );

  const resetSession = () => {
    setFormats(['svg', 'png']);
    setSizes([256, 512]);
    setVariants([state.activeVariant]);
    setTransparent(false);
    setProgress({ phase: 'planning', completed: 0, total: 0, done: false });
    setFiles([]);
    setWarnings([]);
    setError(null);
    setStage('configure');
  };

  const runExport = async () => {
    if (!project || !plan || !canExport) return;
    const myRun = ++runRef.current;
    setError(null);
    setFiles([]);
    setWarnings([]);
    setStage('progress');
    setProgress({ phase: 'planning', completed: 0, total: 0, done: false });

    const backend = createCanvasBackend();
    try {
      const result = await executePlan(plan, { project, variants: projectVariants(project) }, backend, {
        variants,
        onProgress: (next) => {
          // Cancelada (ou superada por uma corrida nova): derruba o laço.
          if (myRun !== runRef.current) throw new ExportCancelledError();
          setProgress(next);
        }
      });
      if (myRun !== runRef.current) return;
      setFiles(result.files);
      setWarnings(result.warnings);
      setStage('done');
    } catch (err) {
      // A cancelled run never surfaces: the sentinel unwinds the pipeline and
      // the token covers a settlement that raced past it.
      if (err instanceof ExportCancelledError || myRun !== runRef.current) return;
      setError(err instanceof Error ? err.message : 'Export failed');
      setStage('error');
    } finally {
      backend.destroy();
    }
  };

  const cancelExport = () => {
    runRef.current += 1;
    setProgress({ phase: 'planning', completed: 0, total: 0, done: false });
    setStage('configure');
  };

  const downloadAll = async () => {
    if (!project || files.length === 0) return;
    const baseName = project.exportProfile.outputBaseName || 'iconcore';
    const blob = await zipFiles(files, { compression: 'deflate', level: 6 });
    saveAs(blob, `${baseName}-icons.zip`);
  };

  if (!project) return null;
  const tilesBackground = transparent ? 'transparent' : 'canvas';

  const tileGrid = (inert: boolean) => (
    <div className="studio-tiles studio-tiles-grid" role="group" aria-label="Variants" data-inert={inert}>
      {variantTiles().map((tile) => {
        const selected = variants.includes(tile.id);
        const active = state.activeVariant === tile.id;
        return (
          <div key={tile.id} className="studio-export-tile">
            <button
              type="button"
              role="checkbox"
              aria-checked={selected}
              className="studio-tile studio-export-tile-card"
              disabled={inert}
              onClick={() => toggleVariant(tile.id)}
            >
              <VariantTileBody variant={tile.id} background={tilesBackground} />
              <span>{tile.label}</span>
            </button>
            {selected && <Check size={14} className="studio-export-tile-check" aria-hidden="true" />}
            <button
              type="button"
              className="studio-export-ring"
              data-active={active}
              aria-pressed={active}
              aria-label={`Set ${tile.label} active`}
              disabled={inert}
              onClick={() => dispatch({ type: 'SET_ACTIVE_VARIANT', payload: tile.id })}
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="studio-panel-scroll">
        {stage === 'configure' && (
          <>
            {tileGrid(false)}
            <div className="studio-export-settings">
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

              {needsSizes && (
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

              <div className="mt-3">
                <Switch
                  label="Transparent background"
                  checked={transparent}
                  onChange={(event) => setTransparent(event.target.checked)}
                />
              </div>

              {!validation.ready && (
                <p className="text-xs text-ic-danger mt-2" role="alert">
                  {validation.problems.join(' ')}
                </p>
              )}
              <p className="text-xs text-ic-text-muted mt-2 tabular-nums">
                {fileCount} {fileCount === 1 ? 'file' : 'files'} · {variants.length}{' '}
                {variants.length === 1 ? 'variant' : 'variants'}
              </p>
            </div>
          </>
        )}

        {stage === 'progress' && (
          <>
            {tileGrid(true)}
            <div className="studio-export-settings">
              <p className="studio-export-note mt-3">
                Rendering {renderingCount} {renderingCount === 1 ? 'file' : 'files'}…{progress.currentPath ? ` ${progress.currentPath}` : ''}
              </p>
              <div
                className="studio-export-progress"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Export progress"
              >
                <div style={{ width: `${percent}%` }} />
              </div>
            </div>
          </>
        )}

        {stage === 'done' && (
          <div className="studio-export-settings studio-export-lead">
            <p className="studio-export-note">
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
          </div>
        )}

        {stage === 'error' && (
          <div className="studio-export-settings studio-export-lead">
            <p className="studio-export-note" role="alert">
              <TriangleAlert size={14} aria-hidden="true" className="inline" /> {error ?? 'Export failed'}
            </p>
          </div>
        )}
      </div>

      {/* Single morphing footer: the actions of every stage live here. */}
      <div className="studio-export-foot">
        {stage === 'configure' && (
          <button type="button" className="studio-export-button" onClick={runExport} disabled={!canExport}>
            Export {fileCount > 0 ? `${fileCount} ${fileCount === 1 ? 'file' : 'files'}` : ''}
          </button>
        )}
        {stage === 'progress' && (
          <>
            <button type="button" className="studio-export-ghost" onClick={cancelExport}>
              Cancel
            </button>
            <button type="button" className="studio-export-button" disabled>
              Exporting…
            </button>
          </>
        )}
        {stage === 'done' && (
          <>
            <button type="button" className="studio-export-ghost" onClick={() => setStage('configure')}>
              <ArrowLeft size={14} aria-hidden="true" /> Export more
            </button>
            <button type="button" className="studio-export-ghost" onClick={resetSession}>
              Close
            </button>
            <button type="button" className="studio-export-button" onClick={downloadAll}>
              <Download size={14} aria-hidden="true" /> Download all (.zip)
            </button>
          </>
        )}
        {stage === 'error' && (
          <button type="button" className="studio-export-ghost" onClick={() => setStage('configure')}>
            <ArrowLeft size={14} aria-hidden="true" /> Back
          </button>
        )}
      </div>
    </>
  );
};
