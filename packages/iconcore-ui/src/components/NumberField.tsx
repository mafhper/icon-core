import { type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { Field } from './Field';
import type { TextFieldProps } from './TextField';

export interface NumberFieldProps extends Omit<TextFieldProps, 'type'> {
  /** Field label. Rendered uppercase above the input, or to the left when `variant="inline"`. */
  label: string;
  /** Optional explanatory copy under the input. */
  hint?: ReactNode;
}

const inputClasses =
  'h-[var(--ic-control-md)] w-full rounded-[var(--ic-radius-md)] border border-ic-border bg-ic-elevated px-[0.72rem] ' +
  'text-[0.78rem] font-normal normal-case tracking-normal text-ic-text outline-none ' +
  'focus-visible:border-ic-accent tabular-nums ' +
  '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]';

/**
 * Labelled numeric input. Compound of `Field` + native `<input type="number">`.
 * Tabular numerals keep X/Y/size columns stable while typing; native spinners
 * are hidden so compact rows stay aligned.
 */
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  { className, label, hint, variant = 'field', ...rest },
  ref
) {
  const control = (
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
