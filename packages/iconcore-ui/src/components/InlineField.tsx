import { type HTMLAttributes, type LabelHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';

/**
 * Inspector grammar — compact rows.
 *
 * `Field` stacks the label above the control (good for tall controls).
 * `InlineField`/`ControlRow` keep the label on the same line, which is what the
 * inspector needs: without it every control "fights" the layout and rows either
 * overflow or look misaligned.
 */

const rowClasses =
  'grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-center gap-[var(--ic-control-gap)] ' +
  'text-[length:var(--ic-label-size)] font-bold uppercase tracking-[0.04em] text-ic-text-muted';

export interface InlineFieldProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Short label rendered to the left of the control. */
  label: string;
  /** Optional explanatory copy under the row. */
  hint?: ReactNode;
}

/**
 * `Label  [Control]` — one row, one control. Renders a `<label>` so clicking the
 * label focuses the control (use only when the control is a single form element).
 */
export const InlineField = forwardRef<HTMLLabelElement, InlineFieldProps>(function InlineField(
  { className, label, hint, children, ...rest },
  ref
) {
  return (
    <label ref={ref} className={cn(rowClasses, className)} {...rest}>
      <span className="truncate">{label}</span>
      <span className="min-w-0">{children}</span>
      {hint != null && (
        <span className="col-span-2 text-[length:var(--ic-label-size)] font-medium normal-case tracking-normal text-ic-text-muted">
          {hint}
        </span>
      )}
    </label>
  );
});

export interface ControlRowProps extends HTMLAttributes<HTMLDivElement> {
  /** Short label rendered to the left of the composed control. */
  label: string;
  hint?: ReactNode;
}

/**
 * `Color  [Swatch][HEX][Alpha]` — one row, **composed** control. Renders a
 * `<div>` (a `<label>` cannot legally wrap multiple interactive children), so the
 * control must carry its own accessible names.
 */
export const ControlRow = forwardRef<HTMLDivElement, ControlRowProps>(function ControlRow(
  { className, label, hint, children, ...rest },
  ref
) {
  return (
    <div ref={ref} className={cn(rowClasses, className)} {...rest}>
      <span className="truncate">{label}</span>
      <span className="min-w-0">{children}</span>
      {hint != null && (
        <span className="col-span-2 text-[length:var(--ic-label-size)] font-medium normal-case tracking-normal text-ic-text-muted">
          {hint}
        </span>
      )}
    </div>
  );
});
