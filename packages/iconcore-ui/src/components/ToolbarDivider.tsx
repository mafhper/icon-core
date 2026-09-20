import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils/cn';

export interface ToolbarDividerProps extends HTMLAttributes<HTMLSpanElement> {
  /** Divider axis. Vertical separates items in a horizontal bar (default). */
  orientation?: 'vertical' | 'horizontal';
}

/**
 * Discrete separator between toolbar action groups.
 *
 * Purely decorative (`role="separator"`), 1px of the theme border colour so the
 * grouping reads as structure, not as another control. Sized to sit beside the
 * 28px `IconButton` without stretching the bar.
 */
export const ToolbarDivider = forwardRef<HTMLSpanElement, ToolbarDividerProps>(function ToolbarDivider(
  { className, orientation = 'vertical', ...rest },
  ref
) {
  return (
    <span
      ref={ref}
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'shrink-0 bg-ic-border',
        orientation === 'vertical' ? 'mx-1 h-[18px] w-px' : 'my-1 h-px w-full',
        className
      )}
      {...rest}
    />
  );
});
