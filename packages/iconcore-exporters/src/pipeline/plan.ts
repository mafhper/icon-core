import type {
  Dimensions,
  ExportArtifact,
  ExportContext,
  ExportPlan,
  IconVariant
} from '@iconcore/shared';
import {
  extensionForFormat,
  isContainerSpec,
  kindOf,
  resolveSize
} from '@iconcore/shared';
import { getPreset, targetForPreset } from '../presets';
import type { PlannedArtifact } from './types';

/**
 * A resolved variant set: one entry when the artifact is explicit, else the defaults.
 *
 * Exported because the path has to be resolved **identically** in the planner
 * and in the validator. They used to compute this separately, which is how two
 * callers could disagree about what a plan writes — and a plan that validates
 * cleanly but then collides at export time is the worst possible outcome.
 */
export const variantsFor = (artifact: ExportArtifact, variants: IconVariant[]): IconVariant[] =>
  artifact.variant ? [artifact.variant] : variants;

/**
 * Resolve an artifact's output dimensions. The single rule lives in
 * `resolveSize`: `size` alone is square, `size` + `height` is the pair, and an
 * artifact that declares neither inherits the canvas pair. Containers carry
 * physical `entries` and are square by contract.
 */
const dimensionsFor = (artifact: ExportArtifact, canvas: Dimensions): Dimensions => {
  if (isContainerSpec(artifact)) {
    const side = artifact.entries.length > 0 ? Math.max(...artifact.entries) : canvas.width;
    return { width: side, height: side };
  }
  return resolveSize({
    size: artifact.size ?? canvas.width,
    height: artifact.height ?? (artifact.size === undefined ? canvas.height : undefined)
  });
};

/**
 * Width label for the `{size}` token / catalog sizing. A single token cannot
 * express a pair, so `{size}` is the width — for a square artifact that is the
 * same number it always was.
 */
const sizeFor = (artifact: ExportArtifact, canvas: Dimensions): number =>
  dimensionsFor(artifact, canvas).width;

const extensionFor = (artifact: ExportArtifact): string => extensionForFormat(artifact.format);

/**
 * The declared path already names the variant, so a folder prefix would be
 * redundant (and would double it for a custom plan that opted in explicitly).
 */
const pathNamesVariant = (declared: string): boolean => /\{variant\}/.test(declared);

/**
 * Resolve an artifact path: substitute the documented tokens
 * `{name} {variant} {format} {size} {target}`  and guarantee the
 * extension matches the format. `{name}` comes from `exportProfile.outputBaseName`
 * (the single source for the base name); `{target}` falls back to the
 * legacy `IconTarget` the plan's preset supersedes.
 *
 * When the preset declares `variantLayout: 'per-folder'`, every variant other
 * than `default` is placed under a `<variant>/` folder. Without this, N
 * variants resolve to one path and the last render silently overwrites the
 * others — which is what made "I selected three variants and got one file"
 * reproducible.
 */
export const resolveArtifactPath = (
  artifact: ExportArtifact,
  context: ExportContext,
  variant: IconVariant,
  presetId?: string,
  options: { multiVariant?: boolean } = {}
): string => {
  const project = context.project;
  const name = project.exportProfile.outputBaseName || project.metadata.shortName || project.metadata.name;
  const target = artifact.target ?? (presetId ? targetForPreset(presetId) : undefined);
  const ext = extensionFor(artifact);
  const labels: Record<string, string> = {
    name,
    variant,
    format: ext,
    size: String(sizeFor(artifact, resolveSize(project.canvas)))
  };
  if (target) labels.target = target;

  let path = artifact.path.replace(/\{(\w+)\}/g, (token, key: string) => labels[key] ?? token);

  // Two independent reasons to give a non-default variant its own folder, and
  // the second one overrides the preset either way:
  //
  // 1. The preset declares `per-folder` — because something outside the ZIP
  //    (a manifest, a browser request) addresses those paths by name.
  // 2. **This artifact expands to more than one variant.** Without a folder,
  //    every variant would resolve to the same string and the plan could not be
  //    exported at all. That is not a preference, it is an impossible export,
  //    and it used to be reachable: the preset the Export screen starts on —
  //    `custom`, "start empty" — declares no `variantLayout`, so ticking a
  //    second variant produced collisions on every artifact and the export
  //    button stayed disabled with the reason hidden in a warning panel.
  //
  //    So an undeclared preset now means "safe", not "collide". A preset still
  //    opts out by naming the variant in the path (`{variant}`), which is the
  //    documented way to pin an artifact to one variant.
  const needsOwnFolder = options.multiVariant === true || presetUsesVariantFolders(presetId);
  if (variant !== 'default' && !pathNamesVariant(artifact.path) && needsOwnFolder) {
    path = `${variant}/${path}`;
  }

  // Deterministic extension (never `icon.png.png`): append only when missing.
  if (!path.toLowerCase().endsWith(`.${ext}`)) {
    path = `${path}.${ext}`;
  }
  return path;
};

/**
 * Whether the preset reserves a folder per variant. Defaults to `false`, so a
 * preset that never declared a layout keeps the paths it has always had.
 */
const presetUsesVariantFolders = (presetId?: string): boolean =>
  presetId ? getPreset(presetId)?.variantLayout === 'per-folder' : false;

/**
 * Plan the artifacts of an `ExportPlan`: expand every *enabled*
 * spec, resolve its variant set and its output path. Containers keep their
 * physical `entries` for execution. This is a pure/structural step — nothing is
 * rendered here.
 */
export const planArtifacts = (
  plan: ExportPlan,
  context: ExportContext,
  options: { variants?: IconVariant[] } = {}
): PlannedArtifact[] => {
  const variants = options.variants ?? ['default'];
  const project = context.project;

  return plan.artifacts
    .filter((artifact) => artifact.enabled)
    .flatMap((artifact) => {
      const expanded = variantsFor(artifact, variants);
      const multiVariant = expanded.length > 1;

      return expanded.map((variant) => {
        const path = resolveArtifactPath(artifact, context, variant, plan.presetId, {
          multiVariant
        });
        const isContainer = isContainerSpec(artifact);
        const dimensions = dimensionsFor(artifact, resolveSize(project.canvas));
        return {
          artifact,
          path,
          variant,
          kind: kindOf(artifact.format),
          format: artifact.format,
          mime: artifactMime(artifact),
          size: dimensions.width,
          // Only when non-square: a square artifact keeps serializing exactly as
          // it did before `height` existed.
          ...(dimensions.height !== dimensions.width ? { height: dimensions.height } : {}),
          entries: isContainer ? artifact.entries : undefined
        };
      });
    });
};

const artifactMime = (artifact: ExportArtifact): string => {
  switch (artifact.format) {
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'jpeg':
      return 'image/jpeg';
    case 'ico':
      return 'image/x-icon';
    case 'icns':
      return 'image/icns';
  }
};