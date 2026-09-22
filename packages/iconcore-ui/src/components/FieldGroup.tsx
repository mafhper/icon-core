import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';

export interface FieldGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Group label (e.g. "Format"). Sentence case, mute 11px — same as `Field`. */
  label: string;
  /** Optional explanatory copy under the control. */
  hint?: ReactNode;
}

/**
 * Labelled group of **composed** controls — `Field`'s layout without the
 * `<label>` wrapper.
 *
 * `Field` renders a `<label>`, which must wrap a single labelable control. A
 * `SegmentedControl`, a `ColorField` row (swatch + hex + alpha) or any group of
 * buttons is several controls, and a `<label>` around them associates with the
 * first one only — a broken, misleading name. `FieldGroup` keeps the identical
 * typography and spacing but exposes the name as `role="group"` +
 * `aria-label`, so every child keeps its own accessible name.
 */
export const FieldGroup = forwardRef<HTMLDivElement, FieldGroupProps>(function FieldGroup(
  { className, label, hint, children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      className={cn('grid grid-cols-[minmax(0,1fr)] gap-[var(--ic-label-gap)]', className)}
      {...rest}
    >
      <span className="truncate text-[length:var(--ic-label-size)] leading-none text-ic-text-muted">{label}</span>
      {children}
      {hint != null && (
        <span className="text-[0.72rem] leading-snug text-ic-text-muted">{hint}</span>
      )}
    </div>
  );
});
