import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { Field } from './Field';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Field label. Sentence case above the input, or to the left when `variant="inline"`. */
  label: string;
  /** Optional explanatory copy under the input. */
  hint?: ReactNode;
  /**
   * `field` (default) stacks the label above; `inline` renders the bare control
   * so it can sit inside `InlineField`/`ControlRow` on a single row.
   */
  variant?: 'field' | 'inline';
}

/**
 * Panel field: flat filled surface, no visible border until focus. `bg-none`
 * neutralises the app's legacy gradient so the field reads as one flat plane.
 */
const fieldClasses =
  'h-[var(--ic-control-md)] w-full rounded-[var(--ic-field-radius)] border border-transparent bg-ic-elevated bg-none px-2 ' +
  'text-[0.75rem] text-ic-text outline-none ' +
  'hover:bg-ic-overlay focus:border-ic-accent';

/**
 * Labelled single-line text input. Compound of `Field` + native `<input>`.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { className, label, hint, type = 'text', variant = 'field', ...rest },
  ref
) {
  const control = (
    <input
      ref={ref}
      type={type}
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
