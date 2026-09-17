import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils/cn';

export interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Render as a labelled toolbar (the rail groups). Default: unlabelled group. */
  label?: string;
}

/**
 * Groups related action buttons (tool rail groups, toolbar clusters).
 * Undecorated by default: spacing comes from the consumer's palette.
 * `role="group"` when unlabelled, `role="toolbar"` when labelled.
 */
export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(function ButtonGroup(
  { className, label, children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      role={label ? 'toolbar' : 'group'}
      aria-label={label}
      className={cn('flex items-center', className)}
      {...rest}
    >
      {children}
    </div>
  );
});