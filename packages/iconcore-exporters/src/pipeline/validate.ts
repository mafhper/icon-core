import type { ExportArtifact, ExportContext, ExportPlan, IconVariant } from '@iconcore/shared';
import { isContainerSpec } from '@iconcore/shared';
import { resolveCanvasBackground } from '@iconcore/renderer';
import { planProblems } from '../planner';
import { resolveArtifactPath } from './plan';

export interface PlanValidation {
  /** True when there are no structural problems. */
  ready: boolean;
  /** Structural problems that block execution. */
  problems: string[];
  /** Non-blocking nature warnings shown in "Ready · N warnings". */
  warnings: string[];
}

/**
 * Which of the variants a plan expands have a transparent (`none`) background.
 *
 * A plan can be expanded across several variants, and transparency is a
 * per-variant property of the document — checking only `default` would silence
 * the warning for a `dark` variant that is transparent on an otherwise opaque
 * project. The legacy per-target path passed the variant explicitly; the plan
 * level has to consider all of them.
 */
const transparentVariants = (context: ExportContext, variants: IconVariant[]): IconVariant[] =>
  variants.filter((variant) => resolveCanvasBackground(context.project, variant).kind === 'none');

const labelVariants = (variants: IconVariant[]): string =>
  variants.length === 1 ? variants[0] : variants.join(', ');

/** Per-artifact nature warnings: JPEG alpha, opaque-on-transparent, containers. */
export const artifactNatureWarnings = (
  artifact: ExportArtifact,
  context: ExportContext,
  options: { variants?: IconVariant[] } = {}
): string[] => {
  const warnings: string[] = [];
  const variants = options.variants ?? ['default'];
  const transparent = transparentVariants(context, variants);
  const label = `"${artifact.path}"`;
  const where = labelVariants(variants);

  // JPEG has no alpha channel — transparent layers would be flattened.
  if (artifact.format === 'jpeg' && transparent.length > 0) {
    warnings.push(`${label}: JPEG has no alpha channel — transparent/half-transparent layers render against a flattened background (${where}).`);
  }

  // Opaque requirement (e.g. PWA maskable) on a transparent project.
  if (artifact.format !== 'jpeg' && artifact.background === 'opaque' && transparent.length > 0) {
    warnings.push(
      `${label}: requests an opaque background but the canvas is transparent in ${labelVariants(transparent)} — background is resolved at render time.`
    );
  }

  if (isContainerSpec(artifact)) {
    if (artifact.format === 'ico') {
      // Windows recommends a 256px entry (ICO row).
      if (!artifact.entries.includes(256)) {
        warnings.push(`${label}: ICO pack lacks the recommended 256px entry (present: ${artifact.entries.join(', ')}).`);
      }
    } else {
      // macOS prefers the classic set ic04..ic10 (ICNS row).
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
 * Paths that two or more renders would write, each with the variants that
 * collide on it.
 *
 * This is the guard for the silent-overwrite class of defect: an artifact with
 * no explicit `variant` expands once per selected variant, and if the preset
 * shares one path across variants the renders land on top of each other. The
 * user selects three variants, the pipeline renders three times, and the
 * archive holds one file — with no warning anywhere.
 *
 * Reported as a **problem**, not a warning: the export would produce a
 * different result than the plan describes, and silently dropping a variant is
 * worse than refusing to export.
 */
const pathCollisions = (
  plan: ExportPlan,
  context: ExportContext,
  variants: IconVariant[]
): string[] => {
  // Claimants are `<artifactId> (<variant>)` so that two *different* artifacts
  // writing the same path collide even when both render `default` — counting
  // variants alone would see one claimant and let it through.
  const byPath = new Map<string, Set<string>>();

  const claim = (path: string, who: string) => {
    const seen = byPath.get(path) ?? new Set<string>();
    seen.add(who);
    byPath.set(path, seen);
  };

  for (const artifact of plan.artifacts) {
    if (!artifact.enabled) continue;
    const own = artifact.variant ? [artifact.variant] : variants;
    for (const variant of own) {
      claim(resolveArtifactPath(artifact, context, variant, plan.presetId), `${artifact.id} (${variant})`);
    }
  }

  for (const attachment of plan.attachments) {
    if (attachment.enabled === false) continue;
    claim(attachment.path, attachment.path);
  }

  const problems: string[] = [];
  for (const [path, claimants] of byPath) {
    if (claimants.size < 2) continue;
    const list = [...claimants].join(', ');
    problems.push(
      `"${path}" would be written by ${claimants.size} different outputs (${list}). ` +
        `They overwrite each other and only one survives. Rename an artifact's output path, ` +
        `pin it to a single variant, or pick a preset that keeps one folder per variant.`
    );
  }
  return problems;
};

/**
 * Validate a plan before execution:
 * - structural problems come from {@link planProblems} (extension/size/entries/ids)
 *   plus {@link pathCollisions} (two outputs, one path);
 * - nature warnings come from {@link artifactNatureWarnings} (alpha/opaqueness,
 *   container sets, lossy quality). Warnings never block execution.
 *
 * `variants` must be the set the plan will expand, so per-variant transparency
 * and path collisions are judged on every variant that will actually be
 * rendered.
 */
export const validatePlan = (
  plan: ExportPlan,
  context: ExportContext,
  options: { variants?: IconVariant[] } = {}
): PlanValidation => {
  const variants = options.variants ?? ['default'];
  const problems = [...planProblems(plan), ...pathCollisions(plan, context, variants)];
  const warnings = plan.artifacts
    .filter((artifact) => artifact.enabled)
    .flatMap((artifact) => artifactNatureWarnings(artifact, context, { variants }));
  return { ready: problems.length === 0, problems, warnings };
};