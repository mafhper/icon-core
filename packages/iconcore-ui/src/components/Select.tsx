import { type ReactNode, type SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { Field } from './Field';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Field label. Sentence case above the select, or to the left when `variant="inline"`. */
  label: string;
  /** Optional explanatory copy under the select. */
  hint?: ReactNode;
  /**
   * `field` (default) stacks the label above; `inline` renders the bare control
   * so it can sit inside `InlineField`/`ControlRow` on a single row.
   */
  variant?: 'field' | 'inline';
}

/**
 * Panel select: flat filled surface. The dropdown arrow comes from the app's
 * global `select` rule (unlayered, so it survives the flat background).
 */
const selectClasses =
  'h-[var(--ic-control-md)] w-full rounded-[var(--ic-field-radius)] border border-transparent bg-ic-elevated px-2 ' +
  'text-[0.75rem] text-ic-text outline-none ' +
  'hover:bg-ic-overlay focus:border-ic-accent';

/**
 * Labelled native select. Compound of `Field` + `<select>`.
 * Native (not Radix) by design: full keyboard/screen-reader behaviour for
 * free, zero new runtime deps.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, hint, variant = 'field', children, ...rest },
  ref
) {
  const control = (
    <select
      ref={ref}
      aria-label={variant === 'inline' ? label : undefined}
      className={cn(selectClasses, className)}
      {...rest}
    >
      {children}
    </select>
  );

  if (variant === 'inline') return control;

  return (
    <Field label={label} hint={hint}>
      {control}
    </Field>
  );
});
