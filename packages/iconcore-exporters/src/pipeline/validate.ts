import type { ExportArtifact, ExportContext, ExportPlan } from '@iconcore/shared';
import { isContainerSpec } from '@iconcore/shared';
import { resolveCanvasBackground } from '@iconcore/renderer';
import { planProblems } from '../planner';

export interface PlanValidation {
  /** True when there are no structural problems (spec §0.5). */
  ready: boolean;
  /** Structural problems that block execution. */
  problems: string[];
  /** Non-blocking nature warnings shown in "Ready · N warnings". */
  warnings: string[];
}

/**
 * A "ready" project never warns about opacity (alpha is meaningful everywhere).
 * With a transparent/none background every opacity-sensitive check applies.
 */
const isProjectTransparent = (context: ExportContext): boolean => {
  const background = resolveCanvasBackground(context.project, 'default');
  return background.kind === 'none';
};

/** Per-artifact nature warnings (spec §6): JPEG alpha, opaque-on-transparent, containers. */
export const artifactNatureWarnings = (artifact: ExportArtifact, context: ExportContext): string[] => {
  const warnings: string[] = [];
  const transparentProject = isProjectTransparent(context);
  const label = `"${artifact.path}"`;

  // JPEG has no alpha channel — transparent layers would be flattened.
  if (artifact.format === 'jpeg' && resolveCanvasBackground(context.project, 'default').kind === 'none') {
    warnings.push(`${label}: JPEG has no alpha channel — transparent/half-transparent layers render against a flattened background.`);
  }

  // Opaque requirement (e.g. PWA maskable) on a transparent project.
  if (artifact.format !== 'jpeg' && artifact.background === 'opaque' && transparentProject) {
    warnings.push(`${label}: requests an opaque background but the canvas is transparent — background is resolved at render time.`);
  }

  if (isContainerSpec(artifact)) {
    if (artifact.format === 'ico') {
      // Windows recommends a 256px entry (spec §6, ICO row).
      if (!artifact.entries.includes(256)) {
        warnings.push(`${label}: ICO pack lacks the recommended 256px entry (present: ${artifact.entries.join(', ')}).`);
      }
    } else {
      // macOS prefers the classic set ic04..ic10 (spec §6, ICNS row).
      const minimal = [16, 32, 128, 256, 512];
      const missing = minimal.filter((size) => !artifact.entries.includes(size));
      if (missing.length > 0) {
        warnings.push(`${label}: ICNS pack is missing recommended sizes ${missing.join(', ')}px.`);
      }
    }
  }

  // Lossy formats with a quality below a sane floor (visible banding).
  if (artifact.format === 'webp' && typeof artifact.quality === 'number' && artifact.quality < 0.6) {
    warnings.push(`${label}: WebP quality ${artifact.quality} is below 0.6 — expect visible artifacts.`);
  }

  return warnings;
};

/**
 * Validate a plan before execution (spec §0.5 + §6):
 * - structural problems come from {@link planProblems} (extension/size/entries/ids);
 * - nature warnings come from {@link artifactNatureWarnings} (alpha/opaqueness,
 *   container sets, lossy quality). Warnings never block execution.
 */
export const validatePlan = (plan: ExportPlan, context: ExportContext): PlanValidation => {
  const problems = planProblems(plan);
  const warnings = plan.artifacts
    .filter((artifact) => artifact.enabled)
    .flatMap((artifact) => artifactNatureWarnings(artifact, context));
  return { ready: problems.length === 0, problems, warnings };
};