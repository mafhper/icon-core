import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { Field } from './Field';
import { NumberField } from './NumberField';

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Field label. Plain name — the value lives in the paired number field. */
  label: string;
  /** Optional explanatory copy under the slider. */
  hint?: ReactNode;
  /**
   * `field` (default) stacks the label above the slider only; `inline` pairs the
   * slider with a number field — the panel's single language for a bounded
   * numeric property, so the same quantity is never a slider in one place and a
   * bare number in another.
   */
  variant?: 'field' | 'inline';
  /** Value shown at the right of an `inline` label row (state, not a control). */
  valueLabel?: ReactNode;
  /** Hide the label row (used when a sibling composes its own label). */
  hideLabel?: boolean;
  /** Unit for the paired number field (`%`, `°`, `px`, `×`). Enables the pairing. */
  unit?: ReactNode;
  /** Commit once when the value settles (slider release, number blur or Enter). */
  onCommit?: () => void;
}

/**
 * Labelled range slider. `variant="inline"` + `unit` renders the panel's standard
 * numeric row: `label` above, then `[slider] [number unit]`. The consumer keeps
 * the model in its own units; the number field shows the same value and commits
 * through `onCommit`, so a drag is still one undo transaction.
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  {
    className,
    label,
    hint,
    variant = 'field',
    valueLabel,
    hideLabel = false,
    unit,
    onCommit,
    onPointerUp,
    onKeyUp,
    ...rest
  },
  ref
) {
  const commit = () => onCommit?.();
  const step = rest.step === undefined ? 1 : Number(rest.step);
  const rawValue = Number(rest.value ?? 0);
  const displayValue = step < 1 ? Number(rawValue.toFixed(2)) : Math.round(rawValue);

  const input = (
    <input
      ref={ref}
      type="range"
      className={cn('w-full', className)}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        commit();
      }}
      onKeyUp={(event) => {
        onKeyUp?.(event);
        commit();
      }}
      {...rest}
    />
  );

  if (variant === 'inline') {
    const showLabelRow = !hideLabel || valueLabel != null;
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
        {showLabelRow && (
          <div className="flex items-baseline justify-between gap-2">
            {!hideLabel && (
              <span className="min-w-0 truncate text-[length:var(--ic-label-size)] leading-none text-ic-text-muted">
                {label}
              </span>
            )}
            {valueLabel != null && (
              <span className="text-[0.72rem] font-medium tabular-nums text-ic-text">{valueLabel}</span>
            )}
          </div>
        )}

        {unit == null ? (
          input
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">{input}</div>
            <NumberField
              variant="inline"
              unit={unit}
              label={label}
              min={rest.min as string | undefined}
              max={rest.max as string | undefined}
              step={rest.step as string | undefined}
              value={displayValue}
              onChange={(event) => {
                // Route the paired field through the consumer's own handler, so it
                // keeps owning the model (and its units).
                rest.onChange?.({ target: { value: event.target.value } } as never);
              }}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commit();
              }}
              className="w-16 shrink-0"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <Field label={label} hint={hint}>
      {input}
    </Field>
  );
});
