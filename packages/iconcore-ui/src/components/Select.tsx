import { type ReactNode, type SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { Field } from './Field';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Field label. Rendered uppercase above the select. */
  label: string;
  /** Optional explanatory copy under the select. */
  hint?: ReactNode;
}

const selectClasses =
  'w-full appearance-none rounded-[0.66rem] border border-ic-border bg-ic-elevated px-[0.72rem] py-[0.58rem] ' +
  'text-[0.82rem] font-normal normal-case tracking-normal text-ic-text outline-none ' +
  'focus-visible:border-ic-accent';

/**
 * Labelled native select. Compound of `Field` + `<select>`.
 * Native (not Radix) by design: full keyboard/screen-reader behaviour for
 * free, zero new runtime deps, and the app's global select CSS already
 * provides the dropdown arrow.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, hint, children, ...rest },
  ref
) {
  return (
    <Field label={label} hint={hint}>
      <select ref={ref} className={cn(selectClasses, className)} {...rest}>
        {children}
      </select>
    </Field>
  );
});
