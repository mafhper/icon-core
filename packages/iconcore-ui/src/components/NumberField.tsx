import { type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { Field } from './Field';
import type { TextFieldProps } from './TextField';

export interface NumberFieldProps extends Omit<TextFieldProps, 'type'> {
  /** Field label. Rendered uppercase above the input, or to the left when `variant="inline"`. */
  label: string;
  /** Optional explanatory copy under the input. */
  hint?: ReactNode;
  /** Unit shown inside the field, right of the number (e.g. `%`, `°`). */
  unit?: ReactNode;
}

const inputClasses =
  'h-[var(--ic-control-md)] w-full rounded-[var(--ic-radius-md)] border border-ic-border bg-ic-elevated px-[0.72rem] ' +
  'text-[0.78rem] font-normal normal-case tracking-normal text-ic-text outline-none ' +
  'focus-visible:border-ic-accent tabular-nums ' +
  '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]';

const bareInputClasses =
  'min-w-0 w-full bg-transparent text-right tabular-nums outline-none ' +
  '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]';

/**
 * Labelled numeric input. Compound of `Field` + native `<input type="number">`.
 * Tabular numerals keep X/Y/size columns stable while typing; native spinners
 * are hidden so compact rows stay aligned. With `unit`, the number and the unit
 * share one bordered field (`[ 100 % ]`) — the pattern used by gradient stops.
 */
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  { className, label, hint, variant = 'field', unit, ...rest },
  ref
) {
  const control =
    unit != null ? (
      <span
        className={cn(
          'flex h-[var(--ic-control-md)] w-full items-center gap-0.5 rounded-[var(--ic-radius-md)] border border-ic-border bg-ic-elevated px-2',
          'text-[0.78rem] font-normal normal-case tracking-normal text-ic-text focus-within:border-ic-accent',
          className
        )}
      >
        <input
          ref={ref}
          type="number"
          aria-label={label}
          className={bareInputClasses}
          {...rest}
        />
        <span className="select-none text-[0.72rem] text-ic-text-muted">{unit}</span>
      </span>
    ) : (
      <input
        ref={ref}
        type="number"
        aria-label={variant === 'inline' ? label : undefined}
        className={cn(inputClasses, className)}
        {...rest}
      />
    );

  if (variant === 'inline') return control;

  return (
    <Field label={label} hint={hint}>
      {control}
    </Field>
  );
});
