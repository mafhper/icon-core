import { type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { Field } from './Field';
import type { TextFieldProps } from './TextField';

export interface NumberFieldProps extends Omit<TextFieldProps, 'type'> {
  /** Field label. Rendered uppercase above the input. */
  label: string;
  /** Optional explanatory copy under the input. */
  hint?: ReactNode;
}

const inputClasses =
  'w-full rounded-[0.66rem] border border-ic-border bg-ic-elevated px-[0.72rem] py-[0.58rem] ' +
  'text-[0.82rem] font-normal normal-case tracking-normal text-ic-text outline-none ' +
  'focus-visible:border-ic-accent tabular-nums';

/**
 * Labelled numeric input. Compound of `Field` + native `<input type="number">`.
 * Tabular numerals keep X/Y/size columns stable while typing.
 */
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  { className, label, hint, ...rest },
  ref
) {
  return (
    <Field label={label} hint={hint}>
      <input ref={ref} type="number" className={cn(inputClasses, className)} {...rest} />
    </Field>
  );
});
