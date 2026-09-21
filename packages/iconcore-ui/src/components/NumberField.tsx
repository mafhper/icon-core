import { type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { Field } from './Field';
import type { TextFieldProps } from './TextField';

export interface NumberFieldProps extends Omit<TextFieldProps, 'type'> {
  /** Field label. Sentence case above the input, or to the left when `variant="inline"`. */
  label: string;
  /** Optional explanatory copy under the input. */
  hint?: ReactNode;
  /** Unit shown inside the field, right of the number (e.g. `%`, `°`). */
  unit?: ReactNode;
}

/**
 * Panel field: flat filled surface, no visible border until focus. Tabular
 * numerals keep X/Y/size columns stable while typing; native spinners are hidden
 * so compact rows stay aligned.
 */
const fieldClasses =
  'h-[var(--ic-control-md)] w-full rounded-[var(--ic-field-radius)] border border-transparent bg-ic-elevated bg-none px-2 py-0 ' +
  'text-[0.75rem] text-ic-text outline-none ' +
  'hover:bg-ic-overlay focus:border-ic-accent tabular-nums';

const bareInputClasses =
  'min-w-0 w-full rounded-none bg-transparent p-0 text-right tabular-nums text-[length:var(--ic-control-font-size)] outline-none ' +
  '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]';

/**
 * Labelled numeric input. Compound of `Field` + native `<input type="number">`.
 * With `unit`, the number and the unit share one field (`[ 100 % ]`) — the
 * pattern used by gradient stops and paint opacity.
 */
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  { className, label, hint, variant = 'field', unit, ...rest },
  ref
) {
  const control =
    unit != null ? (
      <span
        className={cn(
          'flex h-[var(--ic-control-md)] w-full items-center gap-0.5 rounded-[var(--ic-field-radius)] border border-transparent bg-ic-elevated px-2',
          'text-[0.75rem] text-ic-text hover:bg-ic-overlay focus-within:border-ic-accent',
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
        <span className="select-none text-[0.6875rem] text-ic-text-muted">{unit}</span>
      </span>
    ) : (
      <input
        ref={ref}
        type="number"
        aria-label={variant === 'inline' ? label : undefined}
        className={cn(fieldClasses, className)}
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
