import { type ReactNode, type SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { Field } from './Field';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Field label. Rendered uppercase above the select, or to the left when `variant="inline"`. */
  label: string;
  /** Optional explanatory copy under the select. */
  hint?: ReactNode;
  /**
   * `field` (default) stacks the label above; `inline` renders the bare control
   * so it can sit inside `InlineField`/`ControlRow` on a single row.
   */
  variant?: 'field' | 'inline';
}

const selectClasses =
  'h-[var(--ic-control-md)] w-full appearance-none rounded-[var(--ic-radius-md)] border border-ic-border bg-ic-elevated px-[0.72rem] ' +
  'text-[0.78rem] font-normal normal-case tracking-normal text-ic-text outline-none ' +
  'focus-visible:border-ic-accent';

/**
 * Labelled native select. Compound of `Field` + `<select>`.
 * Native (not Radix) by design: full keyboard/screen-reader behaviour for
 * free, zero new runtime deps, and the app's global select CSS already
 * provides the dropdown arrow.
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
