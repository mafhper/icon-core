import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { type ReactNode } from 'react';

export { TooltipProvider } from '@radix-ui/react-tooltip';

export interface TooltipProps {
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Overrides the surrounding `TooltipProvider` delay for this tooltip only. */
  delayDuration?: number;
  children: ReactNode;
}

/**
 * Presentation-only label for an icon action. Never the primary affordance:
 * consumers must pair it with `aria-label` on the trigger.
 *
 * Delay is owned by the app-level `TooltipProvider` (mounted in ComposerApp)
 * unless `delayDuration` is passed here to override it.
 *
 * Note (004 §9): Radix Tooltip does not open when the trigger is a disabled
 * `<button>`. Disabled affordances keep a native `title` instead.
 */
export const Tooltip = ({ content, side = 'top', delayDuration, children }: TooltipProps) => {
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          className="z-50 rounded-ic-sm border border-ic-border bg-ic-overlay px-2 py-1 text-[11px] font-medium text-ic-text shadow-lg select-none"
        >
          {content}
          <TooltipPrimitive.Arrow className="h-1.5 w-2.5 fill-ic-overlay" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
};