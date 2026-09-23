import type { ExportPreset, IconTarget } from '@iconcore/shared';
import { EXPORT_PRESETS, PRESET_ID_BY_TARGET } from './registry';

export { PRESET_ID_BY_TARGET } from './registry';
export type { ExportContext } from './registry';

/** All preset definitions, in a stable order (registry order, spec §3). */
export const getAllPresets = (): ExportPreset[] => EXPORT_PRESETS;

/** Look up a preset by id (`tauri`, `web`, `custom`…) or `undefined`. */
export const getPreset = (presetId: string): ExportPreset | undefined =>
  EXPORT_PRESETS.find((preset) => preset.id === presetId);

/** The preset that supersedes a legacy `IconTarget` ('web-favicon' → 'web'…). */
export const getPresetForTarget = (target: IconTarget): ExportPreset => {
  const presetId = PRESET_ID_BY_TARGET[target];
  const preset = presetId ? getPreset(presetId) : undefined;
  if (!preset) {
    throw new Error(`No export preset has been mapped for target "${target}".`);
  }
  return preset;
};

/** Reverse mapping: the legacy target a preset replaces, if any. */
export const targetForPreset = (presetId: string): IconTarget | undefined => {
  const entry = Object.entries(PRESET_ID_BY_TARGET).find(([, mappedId]) => mappedId === presetId);
  return entry ? (entry[0] as IconTarget) : undefined;
};