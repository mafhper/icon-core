import type { Fill } from '@iconcore/shared';
import { ColorField, Select } from '@iconcore/ui';
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
 */
export const FillEditor = ({ label, fill, onChange, onCommit, noneNote }: FillEditorProps) => {
  const kind = fill?.kind ?? 'solid';
  const solid = solidOf(fill);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
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
      ) : isGradientFill(fill) ? (
        <GradientEditor fill={fill} onChange={onChange} onCommit={onCommit} />
      ) : (
        <ColorField
          label="Color"
          value={solid}
          onChange={(next) => onChange({ kind: 'solid', color: next.color, alpha: next.alpha })}
          onCommit={onCommit}
        />
      )}
    </div>
  );
};
