import { type LabelHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';

export interface FieldProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Field label (e.g. "Name", "Opacity"). Rendered uppercase. */
  label: string;
  /** Optional explanatory copy under the control. */
  hint?: ReactNode;
}

/**
 * Label + control wrapper for a single form field.
 *
 * Renders a `<label>` so clicking the label focuses the control. The label is
 * uppercase/muted; the control itself always renders normal-case text.
 */
export const Field = forwardRef<HTMLLabelElement, FieldProps>(function Field(
  { className, label, hint, children, ...rest },
  ref
) {
  return (
    <label
      ref={ref}
      className={cn(
        'grid gap-2 text-[0.72rem] font-bold uppercase tracking-[0.04em] text-ic-text-muted',
        className
      )}
      {...rest}
    >
      <span>{label}</span>
      {children}
      {hint != null && (
        <span className="text-[0.72rem] font-medium normal-case tracking-normal text-ic-text-muted">
          {hint}
        </span>
      )}
    </label>
  );
});
