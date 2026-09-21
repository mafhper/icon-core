import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils/cn';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Row label (e.g. "Depth shadow"). Accepts rich content such as <code>. */
  label: ReactNode;
}

/**
 * Labelled on/off row: `label` on the left, a real **switch** on the right.
 *
 * A switch is not a checkbox: it reports the state of a setting rather than an
 * independent selection, so it gets a track + thumb (and `role="switch"` for
 * assistive tech) instead of a ticked box. The native input is kept underneath,
 * which is where keyboard support, `checked` and `disabled` come from; the track
 * and thumb are the input's own background and `::after`.
 *
 * States: off/on, hover, focus-visible (ring), disabled. No border or card: the
 * control carries the state, the row only aligns it.
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { className, label, ...rest },
  ref
) {
  return (
    <label className={cn('flex min-h-8 cursor-pointer items-center justify-between gap-3 select-none', className)}>
      <span className="min-w-0 truncate text-[length:var(--ic-label-size)] leading-none text-ic-text-muted">
        {label}
      </span>
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        className={cn(
          'relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-ic-border outline-none',
          'transition-colors hover:bg-ic-overlay',
          'checked:bg-ic-accent checked:hover:bg-ic-accent-hover',
          'focus-visible:ring-2 focus-visible:ring-ic-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ic-bg',
          'disabled:cursor-not-allowed disabled:opacity-40',
          // Thumb: the input's own pseudo-element, so there is nothing extra to focus.
          "after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform after:content-['']",
          'checked:after:translate-x-4',
          className
        )}
        {...rest}
      />
    </label>
  );
});
