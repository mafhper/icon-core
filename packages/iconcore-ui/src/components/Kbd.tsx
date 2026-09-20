import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils/cn';

export interface KbdProps extends HTMLAttributes<HTMLElement> {}

/**
 * Presentational keyboard key. Pairs with a button/label to state its shortcut;
 * never the sole label for an action.
 */
export const Kbd = forwardRef<HTMLElement, KbdProps>(function Kbd({ className, children, ...rest }, ref) {
  return (
    <kbd
      ref={ref}
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-ic-md border border-ic-border bg-ic-elevated px-1.5 text-[10px] font-semibold text-ic-text-muted',
        className
      )}
      {...rest}
    >
      {children}
    </kbd>
  );
});