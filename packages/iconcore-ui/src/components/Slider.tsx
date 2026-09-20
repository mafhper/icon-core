import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { Field } from './Field';

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Field label. Bake the live value in (e.g. `Scale (100%)`) like the app does. */
  label: string;
  /** Optional explanatory copy under the slider. */
  hint?: ReactNode;
}

/**
 * Labelled range slider. Compound of `Field` + native `<input type="range">`.
 * The consumer owns the value display (baked into `label`); commit-on-release
 * (`onPointerUp`/`onKeyUp` → COMMIT_HISTORY) stays in the app.
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { className, label, hint, ...rest },
  ref
) {
  return (
    <Field label={label} hint={hint}>
      <input ref={ref} type="range" className={cn('w-full', className)} {...rest} />
    </Field>
  );
});
