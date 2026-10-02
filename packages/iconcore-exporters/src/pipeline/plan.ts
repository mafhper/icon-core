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

/** A resolved variant set: one entry when the artifact is explicit, else the defaults. */
const variantsFor = (artifact: ExportArtifact, variants: IconVariant[]): IconVariant[] =>
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
  presetId?: string
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

  if (variant !== 'default' && !pathNamesVariant(artifact.path) && presetUsesVariantFolders(presetId)) {
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
    .flatMap((artifact) =>
      variantsFor(artifact, variants).map((variant) => {
        const path = resolveArtifactPath(artifact, context, variant, plan.presetId);
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
      })
    );
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