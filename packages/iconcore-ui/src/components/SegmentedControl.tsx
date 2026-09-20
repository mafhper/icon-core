import { forwardRef } from 'react';
import { cn } from '../utils/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  /** Options in display order. */
  options: ReadonlyArray<SegmentedOption<T>>;
  /** Currently selected value (controlled). */
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group (e.g. "Work area backdrop"). Required. */
  'aria-label': string;
  className?: string;
}

/**
 * Single-select segmented button group (e.g. dots/grid/plain backdrop).
 *
 * Native buttons with `aria-pressed` (not Radix): three-or-fewer mutually
 * exclusive choices need no roving-tabindex menu semantics. The selected
 * option carries the accent-soft tint; the group itself is `role="group"`.
 */
function SegmentedControlInner<T extends string>(
  { options, value, onChange, 'aria-label': ariaLabel, className }: SegmentedControlProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  return (
    <div
      ref={ref}
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'flex flex-wrap gap-1 rounded-xl border border-ic-border bg-ic-elevated p-1',
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            data-active={active ? true : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-8 flex-1 cursor-pointer whitespace-nowrap rounded-[9px] px-3 text-[0.78rem] font-semibold transition-colors duration-150',
              active ? 'bg-ic-accent-soft text-ic-accent' : 'bg-transparent text-ic-text-muted hover:text-ic-text'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export const SegmentedControl = forwardRef(SegmentedControlInner) as <T extends string>(
  props: SegmentedControlProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => React.ReactElement;
