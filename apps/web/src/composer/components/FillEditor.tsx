import type { Fill } from '@iconcore/shared';
import { normalizeStops } from '@iconcore/renderer';
import { Select } from '@iconcore/ui';
import { StudioColorPicker } from '../../studio/components/StudioColorPicker';
import { convertFillKind, FILL_KIND_OPTIONS, isGradientFill, solidOf } from '../utils/fill';
import { GradientEditor } from './GradientEditor';

interface FillEditorProps {
  /** Row label, e.g. `Fill` or `Background fill`. */
  label: string;
  fill: Fill | undefined;
  /** Transient update (no history commit). */
  onChange: (fill: Fill, transient?: boolean) => void;
  /** Commit the current value to history. */
  onCommit: () => void;
  /** Copy shown when the fill is `none`. */
  noneNote?: string;
}

/**
 * One unified Fill control, Figma/OpenPencil-style: the *kind* selector sits at
 * the top and the matching adjustments render underneath it — solid colour for
 * `solid`, the full gradient editor for the four gradient kinds, a note for
 * `none`. Switching kind converts the value (`convertFillKind`) instead of
 * discarding it, so the fill stays continuous.
 *
 * The picker's floating panel repeats the switch as icon tabs (solid +
 * linear gradient, the reference's header minus the kinds the engine cannot
 * paint), so the kind can change without the sidebar selector in reach. The
 * picker stays mounted across the switch — solid and gradient share the same
 * instance — so the floating panel stays open and its body swaps to the
 * gradient editor instead of closing back to the sidebar.
 */
export const FillEditor = ({ label, fill, onChange, onCommit, noneNote }: FillEditorProps) => {
  const kind = fill?.kind ?? 'solid';
  const solid = solidOf(fill);
  const gradient = isGradientFill(fill) ? fill : undefined;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <Select
        label={label}
        value={kind}
        onChange={(event) => onChange(convertFillKind(fill, event.target.value as Fill['kind']))}
      >
        {FILL_KIND_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </Select>

      {kind === 'none' ? (
        <p className="ic-variant-scope-note">{noneNote ?? 'No fill — the shape is transparent.'}</p>
      ) : (
        <>
          <StudioColorPicker
            label="Color"
            value={solid}
            onChange={(next, transient) => {
              // The header has no hex well while gradient (it shows a gradient
              // swatch), so this only fires for solid. Defensive: a solid edit
              // arriving with a gradient fill retints the first stop instead
              // of discarding the stops.
              if (gradient) {
                const current = normalizeStops(gradient.stops);
                const updated = current.map((stop, index) =>
                  index === 0 ? { ...stop, color: next.color, alpha: next.alpha } : stop
                );
                onChange({ ...gradient, stops: updated }, transient);
                return;
              }
              onChange({ kind: 'solid', color: next.color, alpha: next.alpha }, transient);
            }}
            onCommit={onCommit}
            fillKind={kind}
            onFillKindChange={(next) => onChange(convertFillKind(fill, next))}
            gradientFill={gradient}
            onGradientChange={gradient ? (next, transient) => onChange(next, transient) : undefined}
            onGradientCommit={onCommit}
          />
          {gradient && <GradientEditor fill={gradient} onChange={onChange} onCommit={onCommit} />}
        </>
      )}
    </div>
  );
};
