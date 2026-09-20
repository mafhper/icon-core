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
 * Renders a `<section>` with an uppercase accent heading. Separation between
 * consecutive sections (top border + spacing) comes from the consumer's stack
 * (e.g. the app's `.ic-field-stack > section:not(:first-child)` rule).
 */
export const Section = forwardRef<HTMLElement, SectionProps>(function Section(
  { className, title, hint, children, ...rest },
  ref
) {
  return (
    <section ref={ref} className={cn('grid gap-3', className)} {...rest}>
      <h3 className="m-0 text-[0.66rem] font-extrabold uppercase tracking-[0.14em] text-ic-accent">
        {title}
      </h3>
      {hint != null && (
        <p className="-mt-1 text-[0.72rem] font-medium leading-snug text-ic-text-muted">{hint}</p>
      )}
      {children}
    </section>
  );
});
