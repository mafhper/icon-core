import type { IconCoreProject, IconTarget, IconVariant } from '@iconcore/shared';
import type { RenderBackend, RenderOptions } from '@iconcore/renderer';
import { auditProject } from '@iconcore/validator';
import type { ExportResult, ExportFile } from './types';
import { planFromTarget } from './planner';
import { executePlan } from './pipeline';

/**
 * Compatibility adapter: run a legacy `IconTarget` through the **plan**
 * pipeline, so the CLI keeps its `ExportResult` contract while the source of
 * truth for what a target produces is the preset registry (`src/presets`).
 *
 * The old `Target → RasterTask[]` machinery is gone (spec §1.1: no third
 * compatibility layer). This function is the only bridge left, and it delegates
 * entirely to `executePlan` — there is no second rendering path.
 *
 * Attachments are produced too, then split out: the manifest is returned in the
 * legacy `manifest` field (the CLI writes it itself) and the rest are dropped,
 * because the CLI composes its own report and file list.
 */
export const exportTarget = async (
  project: IconCoreProject,
  target: IconTarget,
  variant: IconVariant,
  backend: RenderBackend,
  options?: RenderOptions
): Promise<ExportResult> => {
  const context = { project, variants: [variant] };

  let plan;
  try {
    plan = planFromTarget(context, target);
  } catch {
    return { target, files: [], manifest: null, warnings: [`Unknown target: ${target}`] };
  }

  const quality = options?.quality;
  const withQuality = quality === undefined
    ? plan
    : {
        ...plan,
        artifacts: plan.artifacts.map((artifact) =>
          artifact.format === 'png' ? artifact : { ...artifact, quality }
        )
      };

  const result = await executePlan(withQuality, context, backend, { variants: [variant] });

  const files: ExportFile[] = result.files
    .filter((file) => file.kind === 'artifact')
    .map((file) => ({ path: file.path, blob: file.blob, size: file.size }));

  // The pipeline emits the manifest as an attachment; hand it back in the shape
  // the legacy contract expects.
  const manifestFile = result.files.find((file) => file.generator === 'manifest');
  const manifest = manifestFile ? JSON.parse(await manifestFile.blob.text()) : null;

  const warnings = [...result.warnings];
  for (const issue of auditProject(project).issues) {
    if (issue.severity === 'warning' || issue.severity === 'error') {
      warnings.push(issue.message);
    }
  }

  return { target, files, manifest, warnings };
};

export const exportAllTargets = async (
  project: IconCoreProject,
  variant: IconVariant,
  targets: IconTarget[],
  backend: RenderBackend,
  options?: RenderOptions
): Promise<ExportResult[]> => {
  const results: ExportResult[] = [];
  for (const target of targets) {
    results.push(await exportTarget(project, target, variant, backend, options));
  }
  return results;
};
