import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { Field } from './Field';

export interface ColorFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Field label. Rendered uppercase above the swatch. */
  label: string;
  /** Optional explanatory copy under the swatch. */
  hint?: ReactNode;
}

/**
 * Labelled color swatch. Compound of `Field` + native `<input type="color">`.
 */
export const ColorField = forwardRef<HTMLInputElement, ColorFieldProps>(function ColorField(
  { className, label, hint, ...rest },
  ref
) {
  return (
    <Field label={label} hint={hint}>
      <input ref={ref} type="color" className={cn('h-9 w-full cursor-pointer', className)} {...rest} />
    </Field>
  );
});
