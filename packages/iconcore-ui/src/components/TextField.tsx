import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { Field } from './Field';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Field label. Rendered uppercase above the input. */
  label: string;
  /** Optional explanatory copy under the input. */
  hint?: ReactNode;
}

const inputClasses =
  'w-full rounded-[0.66rem] border border-ic-border bg-ic-elevated px-[0.72rem] py-[0.58rem] ' +
  'text-[0.82rem] font-normal normal-case tracking-normal text-ic-text outline-none ' +
  'focus-visible:border-ic-accent';

/**
 * Labelled single-line text input. Compound of `Field` + native `<input>`.
 * Visuals replicate the app's `.ic-field input` so migration is pixel-neutral.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { className, label, hint, type = 'text', ...rest },
  ref
) {
  return (
    <Field label={label} hint={hint}>
      <input ref={ref} type={type} className={cn(inputClasses, className)} {...rest} />
    </Field>
  );
});
