import type { ExportPlan, ExportPreset } from '@iconcore/shared';
import { Check } from 'lucide-react';

export interface PresetPickerProps {
  presets: ExportPreset[];
  plan: ExportPlan;
  onSelect: (presetId: string) => void;
  onCustomize: () => void;
}

/**
 * "Choose where you intend to use this icon" (spec §7).
 *
 * A preset is only the *initial* list of artifacts — picking one does not lock
 * the plan, and `Customize` turns the current plan into a custom one (dropping
 * `presetId` while keeping every artifact, spec §8).
 */
export const PresetPicker = ({ presets, plan, onSelect, onCustomize }: PresetPickerProps) => (
  <div className="card-surface rounded-2xl border border-ic-border bg-ic-surface p-6 space-y-3">
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-display text-sm font-semibold tracking-tight text-ic-accent-text">
        Where will you use this icon?
      </h2>
      {plan.presetId ? (
        <button
          type="button"
          onClick={onCustomize}
          className="text-xs font-semibold text-ic-accent-text hover:underline"
        >
          Customize
        </button>
      ) : (
        <span className="text-xs text-ic-text-muted">Custom plan</span>
      )}
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-label="Export presets">
      {presets.map((preset) => {
        const active = plan.presetId === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset.id)}
            aria-pressed={active}
            className={`text-left px-4 py-3 rounded-xl border transition-colors ${
              active ? 'border-ic-accent bg-ic-accent/10' : 'border-ic-border hover:border-ic-accent/50'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">{preset.label}</p>
              {active && <Check size={16} className="text-ic-accent-text shrink-0" />}
            </div>
            <p className="text-xs text-ic-text-muted mt-1">{preset.description}</p>
            <p className="text-xs text-ic-text-faint mt-1.5">
              {preset.platforms.length > 0 ? preset.platforms.join(' · ') : 'any format'}
              {preset.recommended ? ' · recommended' : ''}
            </p>
            {preset.documentation && (
              <p className="text-xs text-ic-text-faint mt-1 break-words">{preset.documentation}</p>
            )}
          </button>
        );
      })}
    </div>
  </div>
);
