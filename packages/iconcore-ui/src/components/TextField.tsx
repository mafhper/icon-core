import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { Field } from './Field';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Field label. Rendered uppercase above the input, or to the left when `variant="inline"`. */
  label: string;
  /** Optional explanatory copy under the input. */
  hint?: ReactNode;
  /**
   * `field` (default) stacks the label above; `inline` renders the bare control
   * so it can sit inside `InlineField`/`ControlRow` on a single row.
   */
  variant?: 'field' | 'inline';
}

const inputClasses =
  'h-[var(--ic-control-md)] w-full rounded-[var(--ic-radius-md)] border border-ic-border bg-ic-elevated px-[0.72rem] ' +
  'text-[0.78rem] font-normal normal-case tracking-normal text-ic-text outline-none ' +
  'focus-visible:border-ic-accent';

/**
 * Labelled single-line text input. Compound of `Field` + native `<input>`.
 * Visuals replicate the app's `.ic-field input` so migration is pixel-neutral.
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
