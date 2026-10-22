import { forwardRef, useState, type ButtonHTMLAttributes, type KeyboardEvent } from 'react';

import { cn } from '../lib/cn';

export type SwitchSize = 'sm' | 'md';

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'type' | 'value'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: SwitchSize;
}

const BASE =
  'inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input';

const TRACK: Record<SwitchSize, string> = {
  sm: 'h-5 w-9',
  md: 'h-6 w-11'
};

const THUMB: Record<SwitchSize, string> = {
  sm: 'size-4 data-[state=checked]:translate-x-4',
  md: 'size-5 data-[state=checked]:translate-x-5'
};

/**
 * `button[role=switch]`. Space/Enter are handled on `keydown` with `preventDefault`
 * so the toggle runs exactly once: letting the browser's native button activation
 * fire as well would toggle twice in a real browser (and never in jsdom).
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, defaultChecked = false, onCheckedChange, size = 'md', disabled, className, onClick, onKeyDown, ...rest },
  ref
) {
  const [uncontrolled, setUncontrolled] = useState(defaultChecked);
  const isControlled = checked !== undefined;
  const value = isControlled ? checked : uncontrolled;
  const state = value ? 'checked' : 'unchecked';

  const toggle = () => {
    if (disabled) return;

    const next = !value;
    if (!isControlled) setUncontrolled(next);
    onCheckedChange?.(next);
  };

  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      role="switch"
      aria-checked={value}
      data-state={state}
      disabled={disabled}
      className={cn(BASE, TRACK[size], className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) toggle();
      }}
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;

        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          toggle();
        }
      }}
    >
      <span
        aria-hidden="true"
        data-state={state}
        className={cn(
          'pointer-events-none block rounded-full bg-background shadow ring-0 transition-transform',
          THUMB[size]
        )}
      />
    </button>
  );
});
