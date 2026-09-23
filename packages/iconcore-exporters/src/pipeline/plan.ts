import type {
  ExportArtifact,
  ExportContext,
  ExportPlan,
  IconVariant
} from '@iconcore/shared';
import {
  extensionForFormat,
  isContainerSpec,
  kindOf
} from '@iconcore/shared';
import { targetForPreset } from '../presets';
import type { PlannedArtifact } from './types';

/** A resolved variant set: one entry when the artifact is explicit, else the defaults. */
const variantsFor = (artifact: ExportArtifact, variants: IconVariant[]): IconVariant[] =>
  artifact.variant ? [artifact.variant] : variants;

/** Size label for the `{size}` token / catalog sizing. */
const sizeFor = (artifact: ExportArtifact, canvasSize: number): number => {
  if (isContainerSpec(artifact)) {
    return artifact.entries.length > 0 ? Math.max(...artifact.entries) : canvasSize;
  }
  return artifact.size ?? canvasSize;
};

const extensionFor = (artifact: ExportArtifact): string => extensionForFormat(artifact.format);

/**
 * Resolve an artifact path: substitute the documented tokens
 * `{name} {variant} {format} {size} {target}` (ADR-014 §4) and guarantee the
 * extension matches the format. `{name}` comes from `exportProfile.outputBaseName`
 * (the single source for the base name, spec §8); `{target}` falls back to the
 * legacy `IconTarget` the plan's preset supersedes.
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
    size: String(sizeFor(artifact, project.canvas.size))
  };
  if (target) labels.target = target;

  let path = artifact.path.replace(/\{(\w+)\}/g, (token, key: string) => labels[key] ?? token);

  // Deterministic extension (never `icon.png.png`): append only when missing.
  if (!path.toLowerCase().endsWith(`.${ext}`)) {
    path = `${path}.${ext}`;
  }
  return path;
};

/**
 * Plan the artifacts of an `ExportPlan` (ADR-014 §2.9): expand every *enabled*
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
        return {
          artifact,
          path,
          variant,
          kind: kindOf(artifact.format),
          format: artifact.format,
          mime: artifactMime(artifact),
          size: sizeFor(artifact, project.canvas.size),
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