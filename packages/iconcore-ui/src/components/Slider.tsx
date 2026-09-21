import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { Field } from './Field';

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Field label. Bake the live value in (e.g. `Scale (100%)`) like the app does. */
  label: string;
  /** Optional explanatory copy under the slider. */
  hint?: ReactNode;
  /**
   * `field` (default) stacks the label above; `inline` puts the label on the
   * left and (optionally) the value on the right, with the slider spanning the
   * full width below — the inspector's angle/position pattern.
   */
  variant?: 'field' | 'inline';
  /** Value shown at the right of an `inline` label row (state, not a control). */
  valueLabel?: ReactNode;
}

/**
 * Labelled range slider. Compound of `Field` + native `<input type="range">`.
 * The consumer owns the value display; commit-on-release
 * (`onPointerUp`/`onKeyUp` → `COMMIT_HISTORY`) stays in the app.
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { className, label, hint, variant = 'field', valueLabel, ...rest },
  ref
) {
  const input = <input ref={ref} type="range" className={cn('w-full', className)} {...rest} />;

  if (variant === 'inline') {
    return (
      <div className="grid gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[length:var(--ic-label-size)] font-bold uppercase tracking-[0.04em] text-ic-text-muted">
            {label}
          </span>
          {valueLabel != null && (
            <span className="text-[0.72rem] font-semibold tabular-nums text-ic-text">{valueLabel}</span>
          )}
        </div>
        {input}
      </div>
    );
  }

  return (
    <Field label={label} hint={hint}>
      {input}
    </Field>
  );
});
