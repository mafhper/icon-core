import type {
  ExportArtifact,
  ExportContext,
  ExportPlan,
  IconTarget,
  IconVariant
} from '@iconcore/shared';
import { isContainerSpec, kindOf, extensionForFormat } from '@iconcore/shared';
import { buildPlan, getAllPresets, PRESET_ID_BY_TARGET } from '@iconcore/exporters';

/**
 * EX5 — the editable export plan.
 *
 * The plan is a plain list of artifacts (spec §0.1: "artifact, not a global
 * format"). A preset is only the *initial* list; everything after it is the
 * user's, which is why this module is pure state manipulation with no React.
 * The hook (`useExportPlan`) is a thin wrapper so the behaviour is testable
 * without a renderer.
 */

/** Physical container sizes offered in the editor (ICO/ICNS ladders). */
export const CONTAINER_ENTRY_CHOICES = [16, 24, 32, 48, 64, 128, 256, 512, 1024] as const;

/** Raster/vector sizes offered in the editor. */
export const ARTIFACT_SIZE_CHOICES = [16, 32, 48, 64, 128, 180, 256, 512, 1024] as const;

export const EXPORT_VARIANT_CHOICES: IconVariant[] = ['default', 'light', 'dark', 'mono', 'highContrast', 'transparent'];

/** Next free id, so duplicating never collides (planProblems checks uniqueness). */
const nextId = (artifacts: ExportArtifact[], prefix: string): string => {
  let index = 1;
  const taken = new Set(artifacts.map((artifact) => artifact.id));
  while (taken.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
};

const replaceArtifact = (
  plan: ExportPlan,
  id: string,
  update: (artifact: ExportArtifact) => ExportArtifact
): ExportPlan => ({
  ...plan,
  artifacts: plan.artifacts.map((artifact) => (artifact.id === id ? update(artifact) : artifact))
});

/**
 * Build the initial plan.
 *
 * Priority (spec §8): a persisted snapshot wins, so reopening a project
 * restores exactly what the user had. Otherwise the legacy enabled targets are
 * bridged to their presets, and a project with neither falls back to `web`.
 */
export const initialPlan = (
  context: ExportContext,
  snapshot?: { presetId?: string; artifacts?: ExportArtifact[] }
): ExportPlan => {
  if (snapshot?.artifacts && snapshot.artifacts.length > 0) {
    return {
      presetId: snapshot.presetId,
      artifacts: snapshot.artifacts,
      attachments: attachmentsFor(snapshot.presetId)
    };
  }

  const enabled = context.project.targets.filter((target) => target.enabled).map((target) => target.target);
  const first = enabled[0];
  if (first) {
    // Legacy single-format projects: apply the global format to raster artifacts
    // so the old choice is not silently lost (spec §8 legacy fallback).
    const plan = bridgeLegacyTargets(context, enabled);
    return applyLegacyDefaults(plan, context);
  }

  return buildPlan(context, 'web');
};

/** Attachments a preset contributes; kept local so the hook does not re-derive it. */
const attachmentsFor = (presetId?: string): ExportPlan['attachments'] => {
  if (presetId === 'web') {
    return [
      { path: 'site.webmanifest', generator: 'manifest' },
      { path: 'browserconfig.xml', generator: 'browserconfig' }
    ];
  }
  if (presetId === 'pwa') return [{ path: 'manifest.webmanifest', generator: 'manifest' }];
  return [];
};

/** Bridge N legacy targets to the artifacts of their presets (deduped by id). */
const bridgeLegacyTargets = (context: ExportContext, targets: IconTarget[]): ExportPlan => {
  const artifacts: ExportArtifact[] = [];
  const attachments: ExportPlan['attachments'] = [];
  const seenAttachments = new Set<string>();

  for (const target of targets) {
    const preset = presetForTarget(target);
    if (!preset) continue;
    const plan = buildPlan(context, preset.id);
    for (const artifact of plan.artifacts) {
      if (!artifacts.some((existing) => existing.id === artifact.id)) artifacts.push(artifact);
    }
    for (const attachment of plan.attachments) {
      if (seenAttachments.has(attachment.path)) continue;
      seenAttachments.add(attachment.path);
      attachments.push(attachment);
    }
  }

  const presetId = targets.length === 1 ? presetForTarget(targets[0])?.id : 'custom';
  return { presetId, artifacts, attachments };
};

/** Map a legacy `IconTarget` to its superseding preset id (uses the shared mapping). */
const presetForTarget = (target: IconTarget) => {
  const presetId = PRESET_ID_BY_TARGET[target];
  return presetId ? getAllPresets().find((preset) => preset.id === presetId) : undefined;
};

/**
 * Apply the legacy global `format`/`quality` to raster artifacts that carry no
 * explicit setting, and fix each path's extension. Only affects the seed; once
 * the user edits the plan the snapshot takes over.
 */
const applyLegacyDefaults = (plan: ExportPlan, context: ExportContext): ExportPlan => {
  const legacyFormat = context.project.exportProfile.format;
  const legacyQuality = context.project.exportProfile.quality;
  if (!legacyFormat) return plan;

  return {
    ...plan,
    artifacts: plan.artifacts.map((artifact) => {
      if (artifact.format !== 'png' && kindOf(artifact.format) !== 'raster') return artifact;
      const next: ExportArtifact = {
        ...artifact,
        format: legacyFormat,
        quality: legacyQuality,
        // The path must follow the format (planProblems enforces it).
        path: artifact.path.replace(/\.(png|webp|jpe?g)$/i, `.${extensionForFormat(legacyFormat)}`)
      };
      return next;
    })
  };
};

/* ------------------------------------------------------------------ actions */

export interface PlanActions {
  setPreset: (presetId: string) => void;
  /** Turn the current plan into a custom one (keeps artifacts, drops presetId). */
  customize: () => void;
  setArtifact: (id: string, patch: Partial<ExportArtifact>) => void;
  toggleArtifact: (id: string) => void;
  removeArtifact: (id: string) => void;
  duplicateArtifact: (id: string) => void;
  addArtifact: (format: ExportArtifact['format']) => void;
  setEntries: (id: string, entries: number[]) => void;
  toggleEntry: (id: string, entry: number) => void;
  setVariants: (variants: IconVariant[]) => void;
  reset: () => void;
}

/** Reducer-style update of a plan. Pure — every action returns a new plan. */
export const planAction = (
  plan: ExportPlan,
  context: ExportContext,
  action:
    | { type: 'setPreset'; presetId: string }
    | { type: 'customize' }
    | { type: 'setArtifact'; id: string; patch: Partial<ExportArtifact> }
    | { type: 'toggleArtifact'; id: string }
    | { type: 'removeArtifact'; id: string }
    | { type: 'duplicateArtifact'; id: string }
    | { type: 'addArtifact'; format: ExportArtifact['format'] }
    | { type: 'setEntries'; id: string; entries: number[] }
    | { type: 'toggleEntry'; id: string; entry: number }
): ExportPlan => {
  switch (action.type) {
    case 'setPreset':
      return buildPlan(context, action.presetId);
    case 'customize':
      return plan.presetId ? { ...plan, presetId: undefined } : plan;
    case 'setArtifact':
      return replaceArtifact(plan, action.id, (artifact) => ({ ...artifact, ...action.patch }) as ExportArtifact);
    case 'toggleArtifact':
      return replaceArtifact(plan, action.id, (artifact) => ({ ...artifact, enabled: !artifact.enabled }));
    case 'removeArtifact':
      return { ...plan, artifacts: plan.artifacts.filter((artifact) => artifact.id !== action.id) };
    case 'duplicateArtifact': {
      const source = plan.artifacts.find((artifact) => artifact.id === action.id);
      if (!source) return plan;
      const copy: ExportArtifact = {
        ...source,
        id: nextId(plan.artifacts, source.id),
        // Keep paths unique: suffix before the extension.
        path: suffixPath(source.path, plan.artifacts.map((artifact) => artifact.path))
      };
      const index = plan.artifacts.findIndex((artifact) => artifact.id === action.id);
      const artifacts = [...plan.artifacts];
      artifacts.splice(index + 1, 0, copy);
      return { ...plan, artifacts };
    }
    case 'addArtifact': {
      const isContainer = action.format === 'ico' || action.format === 'icns';
      const extension = action.format === 'jpeg' ? 'jpg' : action.format;
      const artifact: ExportArtifact = isContainer
        ? {
            id: nextId(plan.artifacts, action.format),
            format: action.format,
            path: `icon.${extension}`,
            enabled: true,
            entries: action.format === 'ico' ? [16, 32, 48, 64, 256] : [16, 32, 128, 256, 512]
          }
        : {
            id: nextId(plan.artifacts, action.format),
            format: action.format,
            path: `icon-512.${extension}`,
            enabled: true,
            size: 512
          };
      return { ...plan, artifacts: [...plan.artifacts, artifact] };
    }
    case 'setEntries':
      return replaceArtifact(plan, action.id, (artifact) =>
        isContainerSpec(artifact) ? { ...artifact, entries: [...action.entries].sort((a, b) => a - b) } : artifact
      );
    case 'toggleEntry':
      return replaceArtifact(plan, action.id, (artifact) => {
        if (!isContainerSpec(artifact)) return artifact;
        const has = artifact.entries.includes(action.entry);
        const entries = has
          ? artifact.entries.filter((entry) => entry !== action.entry)
          : [...artifact.entries, action.entry];
        // Never let a container end up empty — planProblems rejects that.
        if (entries.length === 0) return artifact;
        return { ...artifact, entries: entries.sort((a, b) => a - b) };
      });
  }
};

/** `icon.png` + existing `icon-2.png` ⇒ `icon-3.png`; keeps the extension. */
export const suffixPath = (path: string, taken: string[]): string => {
  const match = /^(.*?)(\.[^./\\]+)$/.exec(path);
  const base = match ? match[1] : path;
  const extension = match ? match[2] : '';
  const existing = new Set(taken);
  let index = 2;
  let candidate = `${base}-${index}${extension}`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `${base}-${index}${extension}`;
  }
  return candidate;
};

/** Label for a format badge in the plan list. */
export const formatLabel = (format: ExportArtifact['format']): string =>
  format === 'jpeg' ? 'JPEG' : format.toUpperCase();

/** Summary line for the plan (counts by nature, spec §7 "real counts"). */
export const planSummary = (plan: ExportPlan): { total: number; enabled: number; containers: number; formats: number } => {
  const enabled = plan.artifacts.filter((artifact) => artifact.enabled);
  return {
    total: plan.artifacts.length,
    enabled: enabled.length,
    containers: enabled.filter((artifact) => kindOf(artifact.format) === 'container').length,
    formats: new Set(enabled.map((artifact) => artifact.format)).size
  };
};
