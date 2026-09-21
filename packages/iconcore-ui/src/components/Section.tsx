import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  /** Section heading (e.g. "Layer", "Color", "Work area"). Rendered, not just aria. */
  title: string;
  /** Optional explanatory copy under the heading. */
  hint?: ReactNode;
}

/**
 * Labelled group of form fields inside an inspector/panel.
 *
 * Renders a `<section>` with an 11px semibold sentence-case heading (the
 * OpenPencil panel section title) instead of the old uppercase accent kicker:
 * the heading names the group without shouting over the controls. Separation
 * between consecutive sections (top border + spacing) comes from the consumer's
 * stack (e.g. the app's `.ic-field-stack > section:not(:first-child)` rule).
 */
export const Section = forwardRef<HTMLElement, SectionProps>(function Section(
  { className, title, hint, children, ...rest },
  ref
) {
  return (
    <section ref={ref} className={cn('grid grid-cols-[minmax(0,1fr)] gap-3', className)} {...rest}>
      <h3 className="m-0 text-[length:var(--ic-label-size)] font-semibold text-ic-text">{title}</h3>
      {hint != null && (
        <p className="m-0 text-[0.72rem] font-normal leading-snug text-ic-text-muted">{hint}</p>
      )}
      {children}
    </section>
  );
});
