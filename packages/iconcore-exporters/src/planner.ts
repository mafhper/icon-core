import type {
  ExportArtifact,
  ExportAttachment,
  ExportContext,
  ExportPlan,
  IconTarget
} from '@iconcore/shared';
import { extensionForFormat, isContainerSpec } from '@iconcore/shared';
import { getPreset, getPresetForTarget, targetForPreset } from './presets';

/**
 * Documentation companions, shared by every preset that ships files. Declared
 * **before** the preset table so the initialisers can reference them.
 */
const COMPANION_ATTACHMENTS: ExportAttachment[] = [
  { path: 'iconcore-report.json', generator: 'report' },
  { path: 'preview.html', generator: 'preview' },
  { path: 'README.md', generator: 'readme' }
];

/**
 * Non-icon files a preset plan ships besides the rendered icons (ADR-014 §1.3).
 * The generators themselves run in EX4 (plan execution); EX3 defines the plan.
 *
 * Every companion is **declared** so the editor can show it and the user can
 * turn it off. `manifest`/`browserconfig` are part of the integration (dropping
 * them breaks the target), so they start enabled; `report`/`preview`/`readme`
 * are documentation and also start enabled — but the user asked for exactly
 * this: nothing produced that they did not ask for and cannot switch off.
 */
const ATTACHMENTS_BY_PRESET: Record<string, ExportAttachment[]> = {
  web: [
    { path: 'site.webmanifest', generator: 'manifest' },
    { path: 'browserconfig.xml', generator: 'browserconfig' },
    ...COMPANION_ATTACHMENTS
  ],
  pwa: [{ path: 'manifest.webmanifest', generator: 'manifest' }, ...COMPANION_ATTACHMENTS]
};

/**
 * Build the initial plan for a preset (ADR-014 §2.6 → §3). The preset is the
 * only source of artifact definitions; callers can then edit the returned
 * plan (that editing flow belongs to EX5/EX6).
 */
export const buildPlan = (context: ExportContext, presetId: string): ExportPlan => {
  const preset = getPreset(presetId);
  if (!preset) {
    throw new Error(`Unknown export preset: "${presetId}".`);
  }
  const target = targetForPreset(presetId);
  const artifacts: ExportArtifact[] = preset.createArtifacts(context).map((artifact) =>
    artifact.target || target === undefined ? artifact : { ...artifact, target }
  );
  return {
    presetId,
    artifacts,
    attachments: ATTACHMENTS_BY_PRESET[presetId] ?? COMPANION_ATTACHMENTS
  };
};

/**
 * Compatibility bridge: build the plan for a legacy `IconTarget` by mapping it
 * to its preset. This is how the corrected Tauri/Electron sets are exposed to
 * the still-legacy `exportTarget` consumers until EX5 removes them.
 */
export const planFromTarget = (context: ExportContext, target: IconTarget): ExportPlan => {
  const preset = getPresetForTarget(target);
  return buildPlan(context, preset.id);
};

/**
 * Structural invariants of a plan (spec §0.5):
 * - every path extension matches its format (`extensionForFormat`);
 * - container formats have non-empty physical `entries`;
 * - raster/vector artifacts carry a positive size;
 * - artifact ids are unique.
 * Returns a list of problems (empty = valid).
 */
export const planProblems = (plan: ExportPlan): string[] => {
  const problems: string[] = [];
  const ids = plan.artifacts.map((artifact) => artifact.id);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicates.length > 0) {
    problems.push(`Duplicate artifact ids: ${duplicates.join(', ')}`);
  }
  for (const artifact of plan.artifacts) {
    if (!artifact.enabled) {
      continue;
    }
    const ext = extensionForFormat(artifact.format);
    if (!artifact.path.toLowerCase().endsWith(`.${ext}`)) {
      problems.push(`"${artifact.path}" does not match its ${artifact.format} format (expected .${ext}).`);
    }
    if (isContainerSpec(artifact)) {
      if (artifact.entries.length === 0) {
        problems.push(`"${artifact.path}" container has no entries.`);
      }
      for (const entry of artifact.entries) {
        if (!Number.isInteger(entry) || entry <= 0) {
          problems.push(`"${artifact.path}" has an invalid container entry: ${entry}.`);
        }
      }
    } else if (typeof artifact.size !== 'number' || artifact.size <= 0) {
      problems.push(`"${artifact.path}" needs a positive size.`);
    }
  }
  return problems;
};