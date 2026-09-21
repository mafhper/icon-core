import { type LabelHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';

export interface FieldProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Field label (e.g. "Name", "Opacity"). Sentence case, mute 11px. */
  label: string;
  /** Optional explanatory copy under the control. */
  hint?: ReactNode;
}

/**
 * Label + control wrapper for a single form field.
 *
 * Renders a `<label>` so clicking the label focuses the control. The label sits
 * **above** the control in sentence case at `--ic-label-size` (11px) — the panel
 * language shared with OpenPencil's field group and the tauri-ui-kit property
 * row. Typography lives on the label span, never on the wrapper, so the control
 * inherits nothing to undo.
 */
export const Field = forwardRef<HTMLLabelElement, FieldProps>(function Field(
  { className, label, hint, children, ...rest },
  ref
) {
  return (
    <label
      ref={ref}
      className={cn('grid grid-cols-[minmax(0,1fr)] gap-[var(--ic-label-gap)]', className)}
      {...rest}
    >
      <span className="truncate text-[length:var(--ic-label-size)] leading-none text-ic-text-muted">
        {label}
      </span>
      {children}
      {hint != null && (
        <span className="text-[0.72rem] leading-snug text-ic-text-muted">{hint}</span>
      )}
    </label>
  );
});
