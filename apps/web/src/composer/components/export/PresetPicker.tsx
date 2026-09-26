import type { ExportPlan, ExportPreset } from '@iconcore/shared';
import { Check } from 'lucide-react';

export interface PresetPickerProps {
  presets: ExportPreset[];
  plan: ExportPlan;
  onSelect: (presetId: string) => void;
  onCustomize: () => void;
}

/**
 * Step 1 — "where do you intend to use this icon?" (spec §7).
 *
 * A preset is only the *initial* list of artifacts. Nine cards each carrying a
 * description, a platform line and a documentation line buried the plan under a
 * wall of text, so the options are now compact and the **selected** one explains
 * itself below. `Customize` turns the plan into a custom one (drops `presetId`,
 * keeps every artifact — spec §8).
 */
export const PresetPicker = ({ presets, plan, onSelect, onCustomize }: PresetPickerProps) => {
  const selected = presets.find((preset) => preset.id === plan.presetId);

  return (
    <section aria-label="Export presets" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
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

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Export presets">
        {presets.map((preset) => {
          const active = plan.presetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset.id)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.78rem] font-medium transition-colors ${
                active
                  ? 'border-ic-accent bg-ic-accent/12 text-ic-accent-text'
                  : 'border-ic-border bg-ic-elevated text-ic-text-muted hover:border-ic-accent/50 hover:text-ic-text'
              }`}
            >
              {active && <Check size={13} />}
              {preset.label}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="rounded-xl border border-ic-border bg-ic-elevated px-3 py-2.5">
          <p className="text-[0.8rem] text-ic-text">{selected.description}</p>
          {selected.documentation && (
            <p className="mt-1 text-[0.72rem] text-ic-text-faint">{selected.documentation}</p>
          )}
        </div>
      )}
    </section>
  );
};
