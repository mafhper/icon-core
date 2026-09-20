import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils/cn';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Row label (e.g. "Depth shadow"). */
  label: string;
}

/**
 * Labelled on/off row. Native checkbox (not Radix) by design: the app's
 * inspector toggles are single checkboxes with full native keyboard and
 * screen-reader behaviour; no new runtime dep is warranted.
 *
 * Visuals replicate `.ic-switch-row` (bordered row, label left, box right).
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { className, label, ...rest },
  ref
) {
  return (
    <label
      className={cn(
        'flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-xl border border-ic-border px-2.5',
        'text-[0.76rem] font-bold text-ic-text-muted select-none',
        className
      )}
    >
      <span>{label}</span>
      <input ref={ref} type="checkbox" className="h-4 w-4 shrink-0 accent-ic-accent" {...rest} />
    </label>
  );
});
